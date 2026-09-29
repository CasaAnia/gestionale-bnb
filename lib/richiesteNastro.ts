// ============================================================================
// LE RICHIESTE SUL NASTRO (Richieste «Maison», riferimento approvato da Ania
// il 29/09/2026: docs/design/richieste-riferimento.html, telefoni 1–3).
//
// Il calendario delle Richieste è lo stesso nastro del Calendario. In vista
// «Presunta» ogni richiesta aperta è una SCHEDA TRATTEGGIATA d'ottone della
// misura delle altre, con quattro righe:
//   (a) «30 set → 3 ott · dal sito»         (maiuscoletto ottone)
//   (b) «Anna Rinaldi»                      (Cormorant)
//   (c) «in attesa · 2 persone» oppure «proposta inviata · scade 18:00»
//   (d) vuota
// Dove sta:
//   · la richiesta con la proposta inviata → sulle camere proposte (quelle
//     che tiene in opzione), con le date di ogni tratto;
//   · la richiesta per una camera → su quella camera;
//   · la richiesta per «qualsiasi camera» → sulla riga «Qualsiasi camera»,
//     come prima, E su ogni camera libera per tutte le sue notti (libera =
//     nessuna prenotazione confermata e nessuna camera tenuta da un'altra
//     proposta ancora valida).
// Due o più richieste con notti in comune sulla stessa riga diventano UNA
// scheda col bordo punteggiato: «2 richieste» e i cognomi nella riga (c).
//
// Solo regole pure: niente React, niente Supabase.
// ============================================================================
import { nottiDellaRichiesta, periodiDelleNotti } from './nottiRichieste.ts'
import { RIGA_QUALSIASI } from './richiesteCalendario.ts'
import { CANALE_LABEL, eAperta, nomeCompleto, type Richiesta } from './richieste.ts'
import { STATI_CHE_OCCUPANO, giorniTra } from './disponibilita.ts'
import { scadenzaOpzione, oraRoma } from './opzioni.ts'
import { periodoConMese } from './schedaPrenotazione.ts'
import { personePerNotte } from './richiesteProposta.ts'
import { pezziPersone, testoRiga } from './rigaRichiesta.ts'

type Segmento = { camera?: { id?: string | null; name?: string | null } | null; arrivo?: string | null; partenza?: string | null }
export type RichiestaNastro = Richiesta & {
  condizione_pagamento?: string | null
  proposta_soluzione?: { segmenti?: Segmento[] | null } | null
  proposta_alternative?: ({ segmenti?: Segmento[] | null } | null)[] | null
}
export type PrenotazioneNastro = { room_id: string; check_in: string; check_out: string; status: string }
export type CameraNastro = { id: string; name: string }
/** Una camera tenuta da una proposta (lib/calendarioOpzioni.barreTenute) */
export type TenutaNastro = { richiestaId: string; cameraId: string; notti: string[]; scaduta: boolean }

/** Una scheda da disegnare: la riga (id della camera o RIGA_QUALSIASI), le date e chi c'è dentro */
export type SchedaRichieste = {
  chiave: string
  riga: string
  arrivo: string
  partenza: string
  richieste: RichiestaNastro[]
}

/** Il colore delle schede tratteggiate (riferimento: .card.rq2) */
export const TINTA_RICHIESTA = { bordo: '#A8894F', testo: '#6E5116', etichetta: '#A8894F', fondo: '#FFFFFF', fondoInviata: '#FBF6EA' } as const

// Le camere proposte in una proposta inviata: soluzione e alternative, senza doppioni
function tratti(r: RichiestaNastro): { cameraId: string; notti: string[] }[] {
  const tutti = [...(r.proposta_soluzione?.segmenti ?? []), ...(r.proposta_alternative ?? []).flatMap(a => a?.segmenti ?? [])]
  const visti = new Set<string>()
  const out: { cameraId: string; notti: string[] }[] = []
  for (const s of tutti) {
    const id = s?.camera?.id
    if (!id || !s.arrivo || !s.partenza || s.arrivo >= s.partenza) continue
    const k = `${id}|${s.arrivo}|${s.partenza}`
    if (visti.has(k)) continue
    visti.add(k)
    out.push({ cameraId: id, notti: giorniTra(s.arrivo, s.partenza) })
  }
  return out
}

function nottiSicure(r: RichiestaNastro): string[] {
  try { return nottiDellaRichiesta(r) } catch { return giorniTra(r.arrivo, r.partenza) }
}

/**
 * I posti di una richiesta sul nastro: una voce per riga, con le notti che ci
 * occupa. `occupata(cameraId, notte, richiestaId)` dice se la camera quella
 * notte è presa davvero (prenotazione confermata o tenuta di un'altra proposta).
 */
export function postiRichiesta(r: RichiestaNastro, camere: CameraNastro[], occupata: (cameraId: string, notte: string, richiestaId: string) => boolean): { riga: string; notti: string[] }[] {
  if (r.stato === 'proposta_inviata') {
    const t = tratti(r)
    if (t.length > 0) return t.map(x => ({ riga: x.cameraId, notti: x.notti }))
  }
  const notti = nottiSicure(r)
  if (notti.length === 0) return []
  if (r.camera_id) return [{ riga: r.camera_id, notti }]
  const libere = camere.filter(c => notti.every(n => !occupata(c.id, n, r.id)))
  return [{ riga: RIGA_QUALSIASI, notti }, ...libere.map(c => ({ riga: c.id, notti }))]
}

/** Chi occupa davvero una camera una notte: prenotazioni confermate e camere tenute da un'altra proposta ancora valida */
export type Occupata = (cameraId: string, notte: string, richiestaId: string) => boolean
export function occupazione(prenotazioni: PrenotazioneNastro[], tenute: TenutaNastro[] = []): Occupata {
  const occupate = new Map<string, Set<string>>()   // camera → notti occupate da una prenotazione
  for (const p of prenotazioni) {
    if (!STATI_CHE_OCCUPANO.has(p.status)) continue
    if (!occupate.has(p.room_id)) occupate.set(p.room_id, new Set())
    for (const n of giorniTra(p.check_in, p.check_out)) occupate.get(p.room_id)!.add(n)
  }
  return (cameraId: string, notte: string, richiestaId: string): boolean =>
    !!occupate.get(cameraId)?.has(notte) || tenute.some(t => !t.scaduta && t.richiestaId !== richiestaId && t.cameraId === cameraId && t.notti.includes(notte))
}

/** Le camere libere per tutte le notti di una richiesta (il foglietto: «qualsiasi · libere: Ambra, Allegra, Lena») */
export function camereLibere(r: RichiestaNastro, camere: CameraNastro[], prenotazioni: PrenotazioneNastro[], tenute: TenutaNastro[] = []): CameraNastro[] {
  const occupata = occupazione(prenotazioni, tenute)
  const notti = nottiSicure(r)
  return notti.length === 0 ? [] : camere.filter(c => notti.every(n => !occupata(c.id, n, r.id)))
}

/**
 * Tutte le schede delle richieste aperte. Sulla stessa riga le richieste che
 * hanno notti in comune si uniscono in una scheda sola (anche a catena: A
 * tocca B e B tocca C = una scheda); ogni gruppo di notti di fila è una scheda.
 */
export function schedeRichieste(richieste: RichiestaNastro[], camere: CameraNastro[], prenotazioni: PrenotazioneNastro[], tenute: TenutaNastro[] = []): SchedaRichieste[] {
  const occupata = occupazione(prenotazioni, tenute)

  // per riga: le voci (richiesta + notti)
  const perRiga = new Map<string, { r: RichiestaNastro; notti: string[] }[]>()
  for (const r of richieste.filter(eAperta)) {
    for (const p of postiRichiesta(r, camere, occupata)) {
      if (!perRiga.has(p.riga)) perRiga.set(p.riga, [])
      const voci = perRiga.get(p.riga)!
      const gia = voci.find(v => v.r.id === r.id)
      if (gia) gia.notti = [...new Set([...gia.notti, ...p.notti])].sort()
      else voci.push({ r, notti: p.notti })
    }
  }

  const schede: SchedaRichieste[] = []
  for (const [riga, voci] of perRiga) {
    // gruppi di voci con notti in comune (componenti connesse)
    const n = voci.length
    const padre = Array.from({ length: n }, (_, i) => i)
    const trova = (x: number): number => { while (padre[x] !== x) { padre[x] = padre[padre[x]]; x = padre[x] } return x }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const nj = new Set(voci[j].notti)
      if (voci[i].notti.some(x => nj.has(x))) { const a = trova(i), b = trova(j); if (a !== b) padre[a] = b }
    }
    const gruppi = new Map<number, typeof voci>()
    voci.forEach((v, i) => { const k = trova(i); if (!gruppi.has(k)) gruppi.set(k, []); gruppi.get(k)!.push(v) })
    for (const g of gruppi.values()) {
      const chi = [...g].sort((a, b) => a.r.arrivo.localeCompare(b.r.arrivo) || a.r.created_at.localeCompare(b.r.created_at)).map(v => v.r)
      for (const periodo of periodiDelleNotti(g.flatMap(v => v.notti))) {
        schede.push({ chiave: `${riga}|${chi.map(r => r.id).join('+')}|${periodo.arrivo}`, riga, arrivo: periodo.arrivo, partenza: periodo.partenza, richieste: chi })
      }
    }
  }
  return schede.sort((a, b) => a.arrivo.localeCompare(b.arrivo) || a.chiave.localeCompare(b.chiave))
}

/** «2 persone» · «3 → 2 persone» */
export function personeRichiesta(r: Pick<Richiesta, 'persone' | 'persone_per_notte' | 'arrivo' | 'partenza' | 'notti_richieste'>): string {
  let notti: number[]
  try { notti = personePerNotte(r as Richiesta) } catch { notti = [Math.max(1, Number(r.persone) || 1)] }
  return testoRiga(pezziPersone(notti))
}

/** Lo stato in breve, riga (c): «in attesa» · «proposta inviata · scade 18:00» · «proposta inviata · scaduta» */
export function statoBreve(r: RichiestaNastro, adesso: Date): string {
  if (r.stato !== 'proposta_inviata') return 'in attesa'
  const s = scadenzaOpzione(r)
  if (!s) return 'proposta inviata'
  return s.getTime() > adesso.getTime() ? `proposta inviata · scade ${oraRoma(s)}` : 'proposta inviata · scaduta'
}

export type RigheSchedaRichieste = { date: string; nome: string; sotto: string; inviata: boolean; sovrapposte: boolean }

/** Le quattro righe della scheda tratteggiata (la quarta è vuota) */
export function righeSchedaRichieste(s: Pick<SchedaRichieste, 'arrivo' | 'partenza' | 'richieste'>, adesso: Date = new Date()): RigheSchedaRichieste {
  const periodo = periodoConMese(s.arrivo, s.partenza)
  if (s.richieste.length > 1) {
    return {
      date: periodo,
      nome: `${s.richieste.length} richieste`,
      sotto: s.richieste.map(r => (r.cognome || nomeCompleto(r)).trim()).join(' · '),
      inviata: s.richieste.some(r => r.stato === 'proposta_inviata'),
      sovrapposte: true,
    }
  }
  const r = s.richieste[0]
  const inviata = r.stato === 'proposta_inviata'
  return {
    date: `${periodo} · ${CANALE_LABEL[r.canale] ?? ''}`,
    nome: nomeCompleto(r),
    sotto: inviata ? statoBreve(r, adesso) : `in attesa · ${personeRichiesta(r)}`,
    inviata,
    sovrapposte: false,
  }
}
