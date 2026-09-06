// Opzione di 3 ore (incarico del 06/09/2026): una richiesta con proposta
// inviata da meno di 3 ore tiene «in opzione» le camere e le notti proposte
// (tutte le camere della soluzione inviata, comprese le alternative del caso A
// e i segmenti dei casi B/C). Entro le 3 ore quelle camere non si propongono
// ad altri; dopo, l'opzione cade da sola e resta solo una nota. Solo regole
// pure: chi legge il database sta in lib/richiesteDati e nella pagina.
import { ORE_SCADENZA_PROPOSTA, nomeCompleto } from './richieste.ts'
import { giorniTra, siSovrappone, STATI_CHE_OCCUPANO } from './disponibilita.ts'
import type { PrenotazioneOccupante } from './richiesteProposta.ts'

export const ORE_OPZIONE = ORE_SCADENZA_PROPOSTA
export const ORE_CHIUSURA_DOPO_SCADENZA = 24

export type SegmentoOpzione = { camera: { id: string; name: string }; arrivo: string; partenza: string }
export type RichiestaOpzione = {
  id: string
  nome: string
  cognome: string
  stato: string
  proposta_inviata_at: string | null
  proposta_soluzione?: { segmenti: SegmentoOpzione[] } | null
  proposta_alternative?: { segmenti: SegmentoOpzione[] }[] | null
}

export type Opzione = {
  richiestaId: string
  ospite: string           // «Mario Rossi»
  cameraId: string
  cameraNome: string
  arrivo: string
  partenza: string
  notti: string[]          // giorni ISO in opzione
  scadenza: Date           // fine dell'opzione
}

// Fine dell'opzione di una richiesta (null se non ha una proposta inviata)
export function scadenzaOpzione(r: Pick<RichiestaOpzione, 'stato' | 'proposta_inviata_at'>): Date | null {
  if (r.stato !== 'proposta_inviata' || !r.proposta_inviata_at) return null
  const t = new Date(r.proposta_inviata_at).getTime()
  if (Number.isNaN(t)) return null
  return new Date(t + ORE_OPZIONE * 3600000)
}

// Tutti i segmenti proposti (soluzione inviata + alternative), senza doppioni camera+date
function segmentiProposti(r: RichiestaOpzione): SegmentoOpzione[] {
  const tutti = [...(r.proposta_soluzione?.segmenti ?? []), ...(r.proposta_alternative ?? []).flatMap(a => a?.segmenti ?? [])]
  const visti = new Set<string>()
  return tutti.filter(s => {
    if (!s?.camera?.id || !s.arrivo || !s.partenza) return false
    const k = `${s.camera.id}|${s.arrivo}|${s.partenza}`
    if (visti.has(k)) return false
    visti.add(k)
    return true
  })
}

function opzioniDi(r: RichiestaOpzione, scadenza: Date): Opzione[] {
  return segmentiProposti(r).map(s => ({
    richiestaId: r.id, ospite: nomeCompleto(r), cameraId: s.camera.id, cameraNome: s.camera.name,
    arrivo: s.arrivo, partenza: s.partenza, notti: giorniTra(s.arrivo, s.partenza), scadenza,
  }))
}

// Opzioni ATTIVE (meno di 3 ore dall'invio), escludendo la richiesta indicata
export function opzioniAttive(richieste: RichiestaOpzione[], adesso: Date, escludiId?: string | null): Opzione[] {
  const out: Opzione[] = []
  for (const r of richieste) {
    if (escludiId && r.id === escludiId) continue
    const s = scadenzaOpzione(r)
    if (!s || s.getTime() <= adesso.getTime()) continue
    out.push(...opzioniDi(r, s))
  }
  return out
}

// Opzioni SCADUTE (proposta ancora «inviata» ma oltre le 3 ore): non bloccano, si segnalano
export function opzioniScadute(richieste: RichiestaOpzione[], adesso: Date, escludiId?: string | null): Opzione[] {
  const out: Opzione[] = []
  for (const r of richieste) {
    if (escludiId && r.id === escludiId) continue
    const s = scadenzaOpzione(r)
    if (!s || s.getTime() > adesso.getTime()) continue
    out.push(...opzioniDi(r, s))
  }
  return out
}

// Le opzioni viste dalla ricerca delle soluzioni: come prenotazioni confermate
export function occupantiDaOpzioni(opzioni: Opzione[]): PrenotazioneOccupante[] {
  return opzioni.map(o => ({ room_id: o.cameraId, check_in: o.arrivo, check_out: o.partenza, status: 'confermata' }))
}

// Solo le opzioni che toccano le notti della richiesta [arrivo, partenza)
export function opzioniSovrapposte(opzioni: Opzione[], arrivo: string, partenza: string): Opzione[] {
  return opzioni.filter(o => siSovrappone({ check_in: o.arrivo, check_out: o.partenza }, arrivo, partenza))
}

// «16:40» nell'ora di Roma
export function oraRoma(d: Date): string {
  return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(d)
}

const elenco = (nomi: string[]) => nomi.length <= 1 ? nomi.join('') : `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}`

type Camera = { id: string; name: string; active?: boolean | null }
export type NotaOpzioni = { tipo: 'blocco' | 'scadute'; testo: string }

// La nota ottone per la proposta di un'altra richiesta:
//  · opzioni attive sovrapposte → «Ambra è in opzione fino alle 16:40 per Mario
//    Rossi. Libere per tutto il periodo: Allegra.» (o «Nessuna camera è
//    proponibile: …» se non resta niente);
//  · nessuna attiva ma scadute sovrapposte → «Ambra era in opzione per Mario
//    Rossi, scaduta alle 16:40. Puoi proporla.»;
//  · altrimenti null.
export function notaOpzioni(
  richiesta: { arrivo: string; partenza: string },
  camere: Camera[],
  prenotazioniConfermate: PrenotazioneOccupante[],
  attive: Opzione[],
  scadute: Opzione[],
): NotaOpzioni | null {
  const { arrivo, partenza } = richiesta
  const bloccanti = opzioniSovrapposte(attive, arrivo, partenza)
  if (bloccanti.length > 0) {
    const frasi = perRichiesta(bloccanti).map(g => `${elenco(g.camere)} ${g.camere.length === 1 ? 'è' : 'sono'} in opzione fino alle ${oraRoma(g.scadenza)} per ${g.ospite}`)
    const occupate = new Set(prenotazioniConfermate.filter(p => STATI_CHE_OCCUPANO.has(p.status) && siSovrappone(p, arrivo, partenza)).map(p => p.room_id))
    const inOpzione = new Set(bloccanti.map(o => o.cameraId))
    const libere = camere.filter(c => c.active !== false && !occupate.has(c.id) && !inOpzione.has(c.id)).map(c => c.name)
    if (libere.length === 0) return { tipo: 'blocco', testo: `Nessuna camera è proponibile: ${frasi.join('; ')}.` }
    return { tipo: 'blocco', testo: `${frasi.join('; ')}. Libere per tutto il periodo: ${elenco(libere)}.` }
  }
  const cadute = opzioniSovrapposte(scadute, arrivo, partenza)
  if (cadute.length > 0) {
    const frasi = perRichiesta(cadute).map(g => `${elenco(g.camere)} ${g.camere.length === 1 ? 'era' : 'erano'} in opzione per ${g.ospite}, scaduta alle ${oraRoma(g.scadenza)}`)
    return { tipo: 'scadute', testo: `${frasi.join('; ')}. ${cadute.length === 1 ? 'Puoi proporla' : 'Puoi proporle'}.` }
  }
  return null
}

function perRichiesta(opzioni: Opzione[]): { ospite: string; scadenza: Date; camere: string[] }[] {
  const gruppi = new Map<string, { ospite: string; scadenza: Date; camere: string[] }>()
  for (const o of opzioni) {
    const g = gruppi.get(o.richiestaId) ?? { ospite: o.ospite, scadenza: o.scadenza, camere: [] }
    if (!g.camere.includes(o.cameraNome)) g.camere.push(o.cameraNome)
    gruppi.set(o.richiestaId, g)
  }
  return [...gruppi.values()]
}

// Notti (giorni ISO) della richiesta in cui la camera è in opzione: «Scelgo io» le mostra come non assegnabili
export function nottiInOpzione(opzioni: Opzione[], cameraId: string, arrivo: string, partenza: string): string[] {
  const notti = giorniTra(arrivo, partenza)
  return notti.filter(g => opzioni.some(o => o.cameraId === cameraId && o.notti.includes(g)))
}
