// ============================================================================
// IL FOGLIETTO DI UNA RICHIESTA (Richieste «Maison», novità 14b del
// 29/09/2026, telefono 3 del riferimento): si apre toccando una scheda
// tratteggiata sul nastro, al posto del vecchio pannello.
//
//   RICHIESTA · DAL SITO · OGGI 08:41
//   🧾 ★ Anna Rinaldi                                   (☏) (💬)
//   TELEFONO  +39 347 812 6690
//   DATE      30 set → 3 ott · 3 notti
//   PERSONE   2
//   CAMERA    qualsiasi · libere: Ambra, Allegra, Lena
//   STATO     in attesa · arrivata oggi
//   NOTA      «Se possibile la camera con il balcone, grazie»   (mattone)
//   CLIENTE   già ospite 3 volte · 640 € spesi
//   INVIA PROPOSTA · MODIFICA · RIFIUTA · CHIUDI
//
// Qui si decide cosa c'è scritto: la pagina lo disegna. Solo regole pure.
// ============================================================================
import { CANALE_LABEL, oraArrivo, nottiRichiesta, formatDateRichiesta, scadenzaProposta, avvisoFerma, tastoRichiesta, type Richiesta } from './richieste.ts'
import { daQuantoArrivata, pezzoCliente, pezziPersone, testoRiga } from './rigaRichiesta.ts'
import { personePerNotte } from './richiesteProposta.ts'
import { personeTesta } from './personeTesta.ts'
import { periodoConMese, testoNotti } from './schedaPrenotazione.ts'
import { euroTondi } from './euroTondi.ts'
import { telefonoPerEsteso } from './whatsapp.ts'

export const ALTEZZA_FOGLIETTO_RICHIESTA = 380

/** «RICHIESTA · DAL SITO · OGGI 08:41» (il maiuscolo lo fa il disegno) */
export function testaFogliettoRichiesta(r: Pick<Richiesta, 'canale' | 'created_at'>, adesso: Date = new Date()): string {
  return ['richiesta', CANALE_LABEL[r.canale] ?? '', oraArrivo(r.created_at, adesso)].filter(Boolean).join(' · ')
}

/** «2» quando non cambiano, «3 → 2 persone» quando cambiano notte per notte */
export function personeFoglietto(r: Richiesta): string {
  let notti: number[]
  try { notti = personePerNotte(r) } catch { notti = [Math.max(1, Number(r.persone) || 1)] }
  const pezzi = personeTesta(notti)
  return pezzi.length === 1 ? pezzi[0].testo : testoRiga(pezziPersone(notti))
}

/** «30 set → 3 ott · 3 notti» (con le notti scelte a mano: «Notti del 1, 2 e 4 ottobre 2026 · 3 notti») */
export function dateFoglietto(r: Richiesta): string {
  const n = nottiRichiesta(r)
  return `${r.notti_richieste ? formatDateRichiesta(r) : periodoConMese(r.arrivo, r.partenza)} · ${testoNotti(n)}`
}

/** «Ambra» oppure «qualsiasi · libere: Ambra, Allegra, Lena» */
export function cameraFoglietto(r: Pick<Richiesta, 'camera_id' | 'rooms'>, libere: string[]): string {
  if (r.camera_id) return r.rooms?.name ?? 'camera scelta'
  return libere.length > 0 ? `qualsiasi · libere: ${libere.join(', ')}` : 'qualsiasi · nessuna libera per tutte le notti'
}

/** «in attesa · arrivata oggi» · «proposta inviata · scade tra 2 h 15 min» · «in attesa · ferma da 3 giorni» */
export function statoFoglietto(r: Richiesta & { condizione_pagamento?: string | null }, adesso: Date = new Date()): string {
  const ferma = avvisoFerma(r, adesso)
  if (r.stato === 'proposta_inviata') {
    const s = scadenzaProposta(r, adesso)
    const base = s ? s.testo.charAt(0).toLowerCase() + s.testo.slice(1) : 'proposta inviata'
    return ferma ? `${base} · ${ferma}` : base
  }
  if (ferma) return `in attesa · ${ferma}`
  return `in attesa · arrivata ${daQuantoArrivata(r.created_at, adesso)}`
}

/** «già ospite 3 volte · 640 € spesi» (vuota per chi viene la prima volta) */
export function clienteFoglietto(volte: number, inArchivio: boolean, spesoCent: number): string {
  return [pezzoCliente(volte, inArchivio), spesoCent > 0 ? `${euroTondi(spesoCent)} spesi` : ''].filter(Boolean).join(' · ')
}

export type RigaFogliettoRichiesta = { etichetta: string; valore: string; tipo?: 'numero' | 'mat' }

/** Le sette righe, sempre tutte e nello stesso ordine (una riga vuota resta: il foglio ha l'altezza fissa) */
export function righeFogliettoRichiesta(r: Richiesta & { condizione_pagamento?: string | null }, dati: { libere: string[]; volte: number; inArchivio: boolean; spesoCent: number }, adesso: Date = new Date()): RigaFogliettoRichiesta[] {
  const nota = (r.note ?? '').trim()
  return [
    { etichetta: 'Telefono', valore: telefonoPerEsteso(r.telefono) || '—', tipo: 'numero' },
    { etichetta: 'Date', valore: dateFoglietto(r) },
    { etichetta: 'Persone', valore: personeFoglietto(r) },
    { etichetta: 'Camera', valore: cameraFoglietto(r, dati.libere) },
    { etichetta: 'Stato', valore: statoFoglietto(r, adesso) },
    { etichetta: 'Nota', valore: nota ? `«${nota}»` : '', tipo: 'mat' },
    { etichetta: 'Cliente', valore: clienteFoglietto(dati.volte, dati.inArchivio, dati.spesoCent) },
  ]
}

export type AzioneFoglietto = 'proposta' | 'conferma' | 'modifica' | 'rifiuta'
/** Le azioni in fondo, nell'ordine: «Invia proposta» (o «Conferma» con la proposta inviata) · «Modifica» · «Rifiuta» */
export function azioniFogliettoRichiesta(r: Pick<Richiesta, 'stato'>): { azione: AzioneFoglietto; testo: string }[] {
  const tasto = tastoRichiesta(r.stato)
  if (!tasto) return []
  return [
    { azione: r.stato === 'proposta_inviata' ? 'conferma' : 'proposta', testo: tasto },
    { azione: 'modifica', testo: 'Modifica' },
    { azione: 'rifiuta', testo: 'Rifiuta' },
  ]
}
