// ============================================================================
// LA RIGA SOTTO IL NOME, NELLA SCHEDA DELLA RICHIESTA (Ania, su bozza,
// 12/09/2026).
//
// Prima la scheda diceva le stesse cose in quattro posti (riga delle date,
// due colonne grandi «3 / PERSONE» e «Ambra / CAMERA CHIESTA») e una sola
// richiesta occupava quasi mezzo schermo. Adesso è tutto su una riga:
//
//   gio 29 → sab 31 ott · 2 notti · 3 persone · Ambra
//   lun 3 → mer 5 nov · 2 notti · 1 persona · camera qualsiasi
//   (nell'elenco l'ultimo pezzo è il solo valore: «· qualsiasi»)
//
// Quali pezzi sono FORTI lo decide il modo:
//
//  · 'numeri'  — i numeri e il nome della camera, come nella testa della
//                proposta, dove la riga è grande;
//  · 'elenco'  — nella riga dell'elenco (Ania, dal telefono, 12/09/2026):
//                forti le DATE con la freccia, il NUMERO delle notti, il
//                NUMERO delle persone (o la sequenza «3 → 1») e la CAMERA.
//                La parola «camera» non si scrive proprio: si legge
//                «· Ambra» oppure «· qualsiasi», e Ania sa che è la camera.
//                Le parole di mezzo — «notti», «persone», i puntini —
//                restano piccole e grigie: si leggono i dati, non le
//                etichette.
//
// Qui si decide COSA scrivere e quali pezzi sono forti, la pagina decide come
// disegnarli.
//
// Le persone seguono la regola già scritta in lib/personeTesta: «3» quando non
// cambiano, «3 → 1» quando cambiano notte per notte.
// ============================================================================
import { personeTesta } from './personeTesta.ts'

// `forte` = Georgia, più grande, verde scuro. Altrimenti piccolo e grigio.
export type PezzoRiga = { testo: string; forte: boolean }

export const SEPARATORE = ' · '

// Taglia un testo nei suoi numeri: «gio 29 → sab 31 ott» diventa
// «gio » + «29» + « → sab » + «31» + « ott», coi numeri segnati forti.
export function pezziNumerici(testo: string): PezzoRiga[] {
  return testo.split(/(\d+)/).filter(x => x !== '').map(x => ({ testo: x, forte: /^\d+$/.test(x) }))
}

// «2 notti» · «1 notte»
export function pezziNotti(notti: number): PezzoRiga[] {
  return pezziNumerici(`${notti} ${notti === 1 ? 'notte' : 'notti'}`)
}

// «3 persone» · «1 persona» · «3 → 1 persone» (quando cambiano notte per notte)
export function pezziPersone(personeNotti: number[]): PezzoRiga[] {
  const pezzi = personeTesta(personeNotti)
  if (pezzi.length === 0) return []
  const out: PezzoRiga[] = []
  pezzi.forEach((x, i) => {
    if (i > 0) out.push({ testo: ' ', forte: false })
    out.push({ testo: x.testo, forte: x.grande })
  })
  // «persona» solo quando il numero è uno e non cambia mai
  const una = pezzi.length === 1 && pezzi[0].testo === '1'
  out.push({ testo: una ? ' persona' : ' persone', forte: false })
  return out
}

// «Ambra» (nome della camera, forte) oppure «camera qualsiasi».
// Nell'elenco (`soloValore`) la parola «camera» non si scrive: resta il solo
// valore, forte — «Ambra» oppure «qualsiasi». È la risposta alla domanda
// «quale camera?», e la domanda si capisce dal posto in cui sta.
export function pezziCamera(camera: string | null | undefined, { soloValore = false } = {}): PezzoRiga[] {
  const nome = (camera ?? '').trim()
  if (nome) return [{ testo: nome, forte: true }]
  return soloValore
    ? [{ testo: 'qualsiasi', forte: true }]
    : [{ testo: 'camera qualsiasi', forte: false }]
}

export type ModoForte = 'numeri' | 'elenco'

// Le date con la freccia sono un pezzo solo: «gio 29 → sab 31 ott» tutto forte
const tutteLeDate = (periodo: string): PezzoRiga[] => (periodo ? [{ testo: periodo, forte: true }] : [])

// Le persone dell'elenco: forti i numeri E la freccia fra un numero e l'altro,
// così «3 → 1» si legge come una cosa sola. Le parole di servizio della forma
// lunga («da 1 a 3») restano piccole.
const personeElenco = (personeNotti: number[]): PezzoRiga[] =>
  pezziPersone(personeNotti).map(p => (p.testo === '→' ? { ...p, forte: true } : p))

// La riga intera, coi puntini di mezzo già dentro.
export function pezziRigaRichiesta({ periodo, notti, personeNotti, camera, forte = 'numeri' }: {
  periodo: string
  notti: number
  personeNotti: number[]
  camera?: string | null
  forte?: ModoForte
}): PezzoRiga[] {
  const elenco = forte === 'elenco'
  const gruppi = [
    elenco ? tutteLeDate(periodo) : pezziNumerici(periodo),
    pezziNotti(notti),
    elenco ? personeElenco(personeNotti) : pezziPersone(personeNotti),
    pezziCamera(camera, { soloValore: elenco }),
  ].filter(g => g.length > 0)
  const out: PezzoRiga[] = []
  gruppi.forEach((g, i) => {
    if (i > 0) out.push({ testo: SEPARATORE, forte: false })
    out.push(...g)
  })
  return out
}

// La riga come si legge, tutta di seguito: serve alle prove e alle etichette
// per chi non vede.
export const testoRiga = (pezzi: PezzoRiga[]): string => pezzi.map(p => p.testo).join('')

// ── Da quanto è arrivata ────────────────────────────────────────────────────
// A destra del nome: «oggi», «ieri», «2 giorni fa». Si contano i giorni di
// calendario, non le 24 ore: una richiesta delle 23:50 di ieri è «ieri» anche
// se sono passate due ore.
const mezzanotte = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export function daQuantoArrivata(createdAt: string | null | undefined, adesso: Date = new Date()): string {
  const d = new Date(createdAt ?? '')
  if (Number.isNaN(d.getTime())) return ''
  const giorni = Math.round((mezzanotte(adesso).getTime() - mezzanotte(d).getTime()) / 86400000)
  if (giorni <= 0) return 'oggi'
  if (giorni === 1) return 'ieri'
  return `${giorni} giorni fa`
}
