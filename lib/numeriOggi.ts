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
