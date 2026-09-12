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
//
// I NUMERI e il NOME della camera si scrivono in Georgia, più grandi e verde
// scuro (è lo stile del gestionale: i numeri sono sempre in Georgia); il resto
// è piccolo e grigio. Qui si decide COSA scrivere e quali pezzi sono forti,
// la pagina decide come disegnarli.
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

// «Ambra» (nome della camera, forte) oppure «camera qualsiasi» (piccolo e grigio:
// non è il nome di niente)
export function pezziCamera(camera: string | null | undefined): PezzoRiga[] {
  const nome = (camera ?? '').trim()
  return nome ? [{ testo: nome, forte: true }] : [{ testo: 'camera qualsiasi', forte: false }]
}

// La riga intera, coi puntini di mezzo già dentro.
export function pezziRigaRichiesta({ periodo, notti, personeNotti, camera }: {
  periodo: string
  notti: number
  personeNotti: number[]
  camera?: string | null
}): PezzoRiga[] {
  const gruppi = [pezziNumerici(periodo), pezziNotti(notti), pezziPersone(personeNotti), pezziCamera(camera)]
    .filter(g => g.length > 0)
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
