// ============================================================================
// TRE NUMERI IN CIMA ALLA HOME (07/09/2026): arrivi di oggi, partenze di
// oggi, camere occupate stanotte «su N» (camere attive). Solo prenotazioni
// confermate/completate; un cambio camera (stesso soggiorno, partenza e
// nuovo arrivo lo stesso giorno) NON è né un arrivo né una partenza, con la
// stessa regola della riga «⇄ CAMBIO» della Home (lib/roomChanges). Il giorno
// è quello di Roma (lib/spese/adattatore.oggiARoma), passato dal chiamante.
// Funzioni pure, senza Supabase.
// ============================================================================
import { buildChangeGroups } from './roomChanges.ts'
import { prenotazioneValida } from './statistiche/tipi.ts'

export type PrenotazioneOggi = {
  id: string
  room_id: string
  group_id?: string | null
  guest_id?: string | null
  check_in: string
  check_out: string
  status: string
}
export type CameraOggi = { id: string; active?: boolean | null }

export type NumeriOggi = { arriviOggi: number; partenzeOggi: number; camereOccupate: number; camereTotali: number }

export function numeriOggi(prenotazioni: PrenotazioneOggi[], camere: CameraOggi[], oggi: string): NumeriOggi {
  const valide = prenotazioni.filter(prenotazioneValida)
  const byId = new Map(valide.map(b => [b.id, b]))
  const { edges } = buildChangeGroups(valide)
  // Stessa lettura della Home: il segmento che ENTRA oggi in una nuova camera
  // non è un check-in; quello che ESCE oggi dalla vecchia non è un check-out
  const cambioIn = new Set<string>(), cambioOut = new Set<string>()
  for (const e of edges) {
    const from = byId.get(e.fromId), to = byId.get(e.toId)
    if (!from || !to || to.check_in !== oggi) continue
    cambioIn.add(to.id)
    if (from.check_out === oggi) cambioOut.add(from.id)
  }
  const arriviOggi = valide.filter(b => b.check_in === oggi && !cambioIn.has(b.id)).length
  const partenzeOggi = valide.filter(b => b.check_out === oggi && !cambioOut.has(b.id)).length
  const occupate = new Set(valide.filter(b => b.check_in <= oggi && b.check_out > oggi).map(b => b.room_id))
  const camereTotali = camere.filter(c => c.active !== false).length
  return { arriviOggi, partenzeOggi, camereOccupate: occupate.size, camereTotali }
}

// Periodo minimo da leggere per i tre numeri: le prenotazioni che toccano
// oggi (check_in ≤ oggi ≤ check_out) bastano anche per riconoscere i cambi
// camera di oggi (entrambi i segmenti toccano oggi).
export const testoOccupate = (n: NumeriOggi) => `${n.camereOccupate} su ${n.camereTotali}`

// ── Striscia della settimana (07/09/2026; regola delle Pulizie dall'08/09) ──
// Camere da preparare in un giorno = STESSA regola della pagina Pulizie
// (lib/pulizie.camereDaPreparareGiorno): partenze e cambi camera con la
// scadenza quel giorno (rimandi di Ania compresi), cambi biancheria ogni 4
// notti dei soggiorni lunghi (rettifiche registrate comprese), ogni camera
// contata una volta al giorno. Così Home e Pulizie dicono sempre lo stesso numero.
import { camereDaPreparareGiorno, type Decisione } from './pulizie.ts'

export const GIORNI_STRISCIA = 28
export const GIORNI_VISIBILI_TELEFONO = 7
export const GIORNI_VISIBILI_MAC = 14

export type GiornoStriscia = { giorno: string; camere: number; oggi: boolean; inizioSettimana: boolean }

export function strisciaSettimane(rooms: { id: string }[], prenotazioni: Parameters<typeof camereDaPreparareGiorno>[1], events: Decisione[], oggi: string, giorni = GIORNI_STRISCIA): GiornoStriscia[] {
  const out: GiornoStriscia[] = []
  for (let i = 0; i < giorni; i++) {
    const giorno = new Date(Date.parse(oggi + 'T00:00:00Z') + i * 86400000).toISOString().slice(0, 10)
    out.push({ giorno, camere: camereDaPreparareGiorno(rooms, prenotazioni, events, giorno, oggi), oggi: i === 0, inizioSettimana: i > 0 && i % 7 === 0 })
  }
  return out
}

// «sab 6» — giorno della settimana breve, senza fuso orario
const GIORNI_SETTIMANA = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']
export function etichettaGiornoBreve(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return `${GIORNI_SETTIMANA[d.getUTCDay()]} ${d.getUTCDate()}`
}
export const ultimoGiornoStriscia = (oggi: string, giorni = GIORNI_STRISCIA) => new Date(Date.parse(oggi + 'T00:00:00Z') + (giorni - 1) * 86400000).toISOString().slice(0, 10)
