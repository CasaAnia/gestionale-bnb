// ============================================================================
// RICAVI PER CAMERA nell'anno scelto (ex «Rendimento camere»/«incassi»): il
// valore di ogni soggiorno confermato ripartito notte per notte (competenza),
// contando solo le notti già trascorse (fino a stanotte compresa). Per un
// anno passato tutti i 12 mesi; per un anno futuro niente. Solo camere attive.
// R4 (revisione di f4d5474): l'occupazione di ogni camera divide le sue
// notti per i GIORNI VENDIBILI della camera — dall'inizio dell'anno (o dalla
// data documentata di entrata in servizio) fino a stanotte, meno i periodi
// di fuori servizio — non per i giorni dalla prima notte venduta globale,
// che nascondeva i mesi iniziali vuoti e gonfiava la percentuale.
// ============================================================================
import { prenotazioneValida, type CameraStat, type FuoriServizio, type PrenotazioneStat } from './tipi.ts'
import { ricavoPerNotteCent } from './intervallo.ts'
import { nottiTra, spostaGiorni } from './periodo.ts'
import { nottiChiuse } from './fuoriServizio.ts'

export type RicaviCamera = { room_id: string; name: string; notti: number; ricaviCent: number; mensiliCent: number[]; giorniVendibili: number; occupazionePerMille: number; adrCent: number }

export const LIMITE_OCCUPAZIONE_CAMERE = 'sui giorni dall’inizio dell’anno: i periodi di fuori servizio non sono ancora registrati'

export type RicaviPerCamera = {
  anno: number
  lista: RicaviCamera[]           // ordinata per ricavi, solo camere con notti
  primoMese: number               // indice 0–11 del primo mese VENDIBILE (gennaio o entrata in servizio), non del primo venduto
  meseCorrente: number            // ultimo mese contato (0–11)
  numMesi: number
  annoPassato: boolean
  limite: string | null           // testo da mostrare accanto al dato finché i fuori servizio non esistono
}

export function ricaviPerCamera(anno: number, oggi: string, camere: CameraStat[], prenotazioni: PrenotazioneStat[], fuoriServizio: FuoriServizio[] = []): RicaviPerCamera | null {
  const annoOggi = Number(oggi.slice(0, 4))
  if (anno > annoOggi) return null
  const meseCorrente = anno < annoOggi ? 11 : Number(oggi.slice(5, 7)) - 1
  const tetto = anno < annoOggi ? `${anno + 1}-01-01` : spostaGiorni(oggi, 1)   // notti fino a stanotte compresa
  const da = `${anno}-01-01`
  const attive = camere.filter(c => c.active !== false)
  const stats = new Map<string, RicaviCamera>()
  const vendibili = new Map<string, number>()
  for (const c of attive) {
    const inizio = c.in_servizio_dal && c.in_servizio_dal > da ? c.in_servizio_dal : da
    vendibili.set(c.id, Math.max(0, nottiTra(inizio, tetto) - nottiChiuse(fuoriServizio, c.id, inizio, tetto)))
    stats.set(c.id, { room_id: c.id, name: c.name, notti: 0, ricaviCent: 0, mensiliCent: Array(12).fill(0), giorniVendibili: vendibili.get(c.id)!, occupazionePerMille: 0, adrCent: 0 })
  }
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
  for (const s of lista) {
    s.occupazionePerMille = s.giorniVendibili > 0 ? Math.round(s.notti * 1000 / s.giorniVendibili) : 0
    s.adrCent = Math.round(s.ricaviCent / s.notti)
  }
  // R11: la media per mese conta TUTTI i mesi vendibili dell'anno (da gennaio,
  // o dal mese documentato di entrata in servizio della prima camera attiva),
  // non dalla prima notte venduta: i mesi senza vendite pesano sulla media
  const inizi = attive.map(c => (c.in_servizio_dal && c.in_servizio_dal > da ? c.in_servizio_dal : da))
  const inizioAnno = inizi.length ? inizi.sort()[0] : da
  const primoMese = inizioAnno.slice(0, 4) === String(anno) ? Number(inizioAnno.slice(5, 7)) - 1 : 0
  return { anno, lista, primoMese, meseCorrente, numMesi: Math.max(1, meseCorrente - primoMese + 1), annoPassato: anno < annoOggi, limite: fuoriServizio.length === 0 ? LIMITE_OCCUPAZIONE_CAMERE : null }
}
