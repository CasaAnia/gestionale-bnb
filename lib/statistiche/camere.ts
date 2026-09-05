// ============================================================================
// RICAVI PER CAMERA nell'anno scelto (ex «Rendimento camere»/«incassi»): il
// valore di ogni soggiorno confermato ripartito notte per notte (competenza),
// contando solo le notti già trascorse (fino a stanotte compresa). Per un
// anno passato tutti i 12 mesi; per un anno futuro niente. Solo camere attive.
// ============================================================================
import { prenotazioneValida, type CameraStat, type PrenotazioneStat } from './tipi.ts'
import { ricavoPerNotteCent } from './intervallo.ts'
import { nottiTra, spostaGiorni } from './periodo.ts'

export type RicaviCamera = { room_id: string; name: string; notti: number; ricaviCent: number; mensiliCent: number[]; occupazionePerMille: number; adrCent: number }

export type RicaviPerCamera = {
  anno: number
  lista: RicaviCamera[]           // ordinata per ricavi, solo camere con notti
  giorniTrascorsi: number         // dalla prima notte venduta a stanotte compresa
  primoMese: number               // indice 0–11 del primo mese con notti
  meseCorrente: number            // ultimo mese contato (0–11)
  numMesi: number
  annoPassato: boolean
}

export function ricaviPerCamera(anno: number, oggi: string, camere: CameraStat[], prenotazioni: PrenotazioneStat[]): RicaviPerCamera | null {
  const annoOggi = Number(oggi.slice(0, 4))
  if (anno > annoOggi) return null
  const meseCorrente = anno < annoOggi ? 11 : Number(oggi.slice(5, 7)) - 1
  const tetto = anno < annoOggi ? `${anno + 1}-01-01` : spostaGiorni(oggi, 1)   // notti fino a stanotte compresa
  const da = `${anno}-01-01`
  const attive = camere.filter(c => c.active !== false)
  const stats = new Map<string, RicaviCamera>()
  for (const c of attive) stats.set(c.id, { room_id: c.id, name: c.name, notti: 0, ricaviCent: 0, mensiliCent: Array(12).fill(0), occupazionePerMille: 0, adrCent: 0 })
  let primaNotte: string | null = null
  for (const b of prenotazioni.filter(prenotazioneValida)) {
    const st = stats.get(b.room_id)
    if (!st) continue
    for (const n of ricavoPerNotteCent(b)) {
      if (n.giorno < da || n.giorno >= tetto) continue
      st.notti += 1
      st.ricaviCent += n.cent
      st.mensiliCent[Number(n.giorno.slice(5, 7)) - 1] += n.cent
      if (!primaNotte || n.giorno < primaNotte) primaNotte = n.giorno
    }
  }
  const lista = [...stats.values()].filter(s => s.notti > 0).sort((x, y) => y.ricaviCent - x.ricaviCent)
  if (!lista.length || !primaNotte) return null
  const giorniTrascorsi = Math.max(1, nottiTra(primaNotte, tetto))
  for (const s of lista) {
    s.occupazionePerMille = Math.round(s.notti * 1000 / giorniTrascorsi)
    s.adrCent = Math.round(s.ricaviCent / s.notti)
  }
  const primoMese = Number(primaNotte.slice(5, 7)) - 1
  return { anno, lista, giorniTrascorsi, primoMese, meseCorrente, numMesi: meseCorrente - primoMese + 1, annoPassato: anno < annoOggi }
}
