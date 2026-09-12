// ============================================================================
// COSA DICE UNA RICHIESTA, IN DUE RIGHE (Ania, dal telefono, 12/09/2026).
//
// Prima la scheda diceva le stesse cose in quattro posti (riga delle date,
// due colonne grandi «3 / PERSONE» e «Ambra / CAMERA CHIESTA») e una sola
// richiesta occupava quasi mezzo schermo. Adesso sono due righe, con la forma
// delle righe «Da controllare» della Home:
//
//   IERI · DAL SITO · GIÀ STATA QUI 3 VOLTE
//   Anna Sawicka · gio 29 → sab 31 ott
//   2 notti · 3 persone · qualsiasi · 1.360 €
//
//  · l'ETICHETTA in alto (`etichettaRigaRichiesta`) è come ETICHETTA_TIPO
//    della Home, 10 px maiuscolo ottone: dice quando è arrivata e da dove;
//  · il TITOLO (`titoloRigaRichiesta`) è come il titolo della Home, «chi ·
//    quando»: il nome e le date insieme, 15 px semibold verde scuro;
//  · la SECONDA (`pezziRigaElenco`) dice quanto, quanti e dove. Forti solo il
//    NUMERO delle notti, il NUMERO delle persone (o la sequenza «3 → 1») e la
//    CAMERA. La parola «camera» non si scrive: si legge «· Ambra» oppure
//    «· qualsiasi», e Ania sa che quello è il posto della camera. Le parole di
//    mezzo — «notti», «persone», i puntini — restano piccole e grigie.
//
// Nella testa della PROPOSTA, dove la riga è grande e sta da sola, resta la
// riga intera di `pezziRigaRichiesta`, coi numeri forti e l'etichetta
// «camera qualsiasi» per esteso.
//
// Qui si decide COSA scrivere e quali pezzi sono forti, la pagina decide come
// disegnarli.
//
// Le persone seguono la regola già scritta in lib/personeTesta: «3» quando non
// cambiano, «3 → 1» quando cambiano notte per notte.
// ============================================================================
import { personeTesta } from './personeTesta.ts'
import { euroTondi } from './euroTondi.ts'
import { CANALE_LABEL, type CanaleRichiesta } from './richieste.ts'

// `forte` = più grande e verde scuro. Altrimenti piccolo e grigio.
// `speso` = quanto ha già speso da noi: forte, ma in rosso (Ania, 12/09/2026).
export type PezzoRiga = { testo: string; forte: boolean; speso?: boolean }

export const SEPARATORE = ' · '

// Unisce col puntino solo i pezzi che ci sono davvero.
const conPuntino = (pezzi: string[]): string => pezzi.map(x => x.trim()).filter(x => x !== '').join(SEPARATORE)

// Il TITOLO dell'elenco: «Anna Sawicka · gio 29 → sab 31 ott». La stessa
// forma del titolo delle righe «Da controllare» della Home (lib/daControllare:
// «chi · quando»). Senza uno dei due pezzi resta l'altro, senza puntino
// appeso.
export function titoloRigaRichiesta(nome: string, periodo: string): string {
  return conPuntino([nome, periodo])
}

// L'ETICHETTA piccola sopra il titolo, come ETICHETTA_TIPO delle righe «Da
// controllare» della Home: quando è arrivata e da dove — «ieri · dal sito»,
// «oggi · telefono». A schermo si legge in maiuscolo, ma le maiuscole le fa il
// disegno (`uppercase`), non questo testo.
export function etichettaRigaRichiesta(createdAt: string | null | undefined, canale: CanaleRichiesta, adesso: Date = new Date(), cliente: string | null = null): string {
  return conPuntino([daQuantoArrivata(createdAt, adesso), CANALE_LABEL[canale] ?? '', cliente ?? ''])
}

// Il pezzo dell'etichetta che dice se la cliente è già stata qui: si somma
// agli altri due — «ieri · dal sito · già stata qui 3 volte». È la stessa cosa
// che la testa della proposta scrive per esteso (chiEIlCliente), detta corta
// perché qui è un'etichetta. Alla prima volta non si scrive niente: la riga
// resta com'era.
export function pezzoCliente(volte: number, inArchivio: boolean): string | null {
  const n = Math.max(0, Math.trunc(volte))
  if (n === 1) return 'già stata qui 1 volta'
  if (n > 1) return `già stata qui ${n} volte`
  return inArchivio ? 'già in archivio' : null
}

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

// Le persone dell'elenco: forti i numeri E la freccia fra un numero e l'altro,
// così «3 → 1» si legge come una cosa sola. Le parole di servizio della forma
// lunga («da 1 a 3») restano piccole.
const personeElenco = (personeNotti: number[]): PezzoRiga[] =>
  pezziPersone(personeNotti).map(p => (p.testo === '→' ? { ...p, forte: true } : p))

// Unisce i gruppi coi puntini di mezzo, che restano piccoli e grigi.
const unisci = (gruppi: PezzoRiga[][]): PezzoRiga[] => {
  const out: PezzoRiga[] = []
  gruppi.filter(g => g.length > 0).forEach((g, i) => {
    if (i > 0) out.push({ testo: SEPARATORE, forte: false })
    out.push(...g)
  })
  return out
}

// La SECONDA riga dell'elenco: «2 notti · 3 persone · qualsiasi». Le date non
// stanno più qui: sono salite nella prima riga, accanto al nome.
// In fondo, per chi è già stata qui, quanto ha speso in tutto: «· 1.360 €»,
// l'unico pezzo di storico che entra nell'elenco (Ania, 12/09/2026). Senza
// soggiorni conclusi non c'è niente da scrivere.
export function pezziRigaElenco({ notti, personeNotti, camera, totaleCent = 0 }: {
  notti: number
  personeNotti: number[]
  camera?: string | null
  totaleCent?: number | null
}): PezzoRiga[] {
  const speso = Number(totaleCent) > 0 ? [{ testo: euroTondi(Number(totaleCent)), forte: true, speso: true }] : []
  return unisci([pezziNotti(notti), personeElenco(personeNotti), pezziCamera(camera, { soloValore: true }), speso])
}

// La riga intera della testa della proposta, coi puntini di mezzo già dentro:
// «gio 29 → sab 31 ott · 2 notti · 3 persone · Ambra», forti i numeri e il
// nome della camera.
export function pezziRigaRichiesta({ periodo, notti, personeNotti, camera }: {
  periodo: string
  notti: number
  personeNotti: number[]
  camera?: string | null
}): PezzoRiga[] {
  return unisci([pezziNumerici(periodo), pezziNotti(notti), pezziPersone(personeNotti), pezziCamera(camera)])
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
