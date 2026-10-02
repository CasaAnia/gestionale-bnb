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
// Ogni giorno: STESSA regola e stessa fonte della pagina Pulizie
// (lib/pulizie.conteggioGiorno): quante camere hanno pulizie ancora da fare
// (il numero) e quante le hanno tutte fatte («✓»); niente = «—».
import { conteggioGiorno, motivoCameraGiorno, attive, type Decisione, type MotivoCamera } from './pulizie.ts'
import { nomeOspite } from './guestName.ts'
import { oraBreve } from './schema0064.ts'
import { cognome, giornoLungo } from './giornataPulizie.ts'

export const GIORNI_STRISCIA = 28
export const GIORNI_VISIBILI_TELEFONO = 7
export const GIORNI_VISIBILI_MAC = 14

export type GiornoStriscia = { giorno: string; daFare: number; fatte: number; oggi: boolean; inizioSettimana: boolean; cambi: number; camere?: CameraDaPreparare[] }

// ── Il riquadro sotto la striscia (Home «Maison», 28/09/2026; contenuto
// nuovo dal riferimento approvato da Ania il 02/10/2026,
// docs/design/pulizie-domani-riferimento.html, colonna 3) ──────────────────
// Un tocco su un giorno apre, sotto la striscia, le camere da preparare quel
// giorno: in testa «VENERDÌ 2 OTTOBRE · 2 CAMERE» («OGGI · 3 CAMERE»), poi una
// riga per camera con cosa succede e gli ORARI: «parte Elena Esposito 10:00»
// (o «· orario da chiedere»), a capo «bagagli Serra 11:00 · arriva Giovanni
// Serra 16:00» (ogni pezzo solo se c'è); chi resta «Lucia Ferri resta ·
// biancheria della 4ª notte»; il cambio camera «Fam. Russo passa in Ambra ⇄».
// Gli orari sono gli stessi della pagina Pulizie (check_out_time,
// bagagli_alle, check_in_time). Le camere sono esattamente quelle contate nel
// numero della casella (stessa regola: lib/pulizie.motivoCameraGiorno).
export type CameraDaPreparare = {
  roomId: string
  camera: string
  motivo: MotivoCamera['tipo']
  /** la prima riga, secondo il motivo */
  parte?: { nome: string; ora: string | null }
  /** «Lucia Ferri resta · biancheria della 4ª notte» */
  resta?: string
  /** «Fam. Russo passa in Ambra ⇄» */
  passa?: string
  /** pulizia rimandata a quel giorno o rimasta da fare: «pulizia rimasta da completare» */
  rimasta?: string
  /** la seconda riga, con chi arriva quel giorno: ogni pezzo solo se c'è */
  bagagli?: { cognome: string; ora: string }
  arriva?: { nome: string; ora: string | null }
}
export const PULIZIA_RIMASTA = 'pulizia rimasta da completare'
export const ORARIO_DA_CHIEDERE = 'orario da chiedere'
export const CHIUDI_RIQUADRO = 'Chiudi'
export const VEDI_NELLE_PULIZIE = 'Vedi nelle Pulizie ›'

/** «venerdì 2 ottobre · 2 camere», «oggi · 3 camere» (maiuscoletto dalla veste) */
export function testaRiquadro(giorno: string, eOggi: boolean, camere: number): string {
  return `${eOggi ? 'oggi' : giornoLungo(giorno)} · ${camere} ${camere === 1 ? 'camera' : 'camere'}`
}

type CameraNome = { id: string; name?: string | null }
const breve = (nome: string | null | undefined) => String(nome ?? '').split(' ').slice(-1)[0]

export function camereDaPreparare(rooms: CameraNome[], prenotazioni: Parameters<typeof conteggioGiorno>[1], events: Decisione[], giorno: string, oggi: string): CameraDaPreparare[] {
  const valide = attive(prenotazioni)
  const out: CameraDaPreparare[] = []
  for (const r of rooms) {
    const m = motivoCameraGiorno(prenotazioni, r.id, giorno, oggi, events)
    if (!m) continue
    const voce: CameraDaPreparare = { roomId: r.id, camera: breve(r.name), motivo: m.tipo }
    if (m.tipo === 'partenza') voce.parte = { nome: nomeOspite(m.booking), ora: oraBreve(m.booking.check_out_time) }
    else if (m.tipo === 'biancheria') voce.resta = `${nomeOspite(m.booking)} resta · biancheria della 4ª notte`
    else if (m.tipo === 'cambio') voce.passa = `${nomeOspite(m.booking)} passa in ${breve(rooms.find(x => x.id === m.verso?.room_id)?.name) || 'un’altra camera'} ⇄`
    else voce.rimasta = PULIZIA_RIMASTA
    // L'arrivo di QUEL giorno in quella camera (non un prolungamento né chi arriva col cambio camera)
    const arriva = valide.find(b => b.room_id === r.id && b.check_in === giorno && !valide.some(x => x.id !== b.id && x.guest_id && x.guest_id === b.guest_id && x.check_out === b.check_in))
    if (arriva) {
      const bag = oraBreve(arriva.bagagli_alle)
      if (bag) voce.bagagli = { cognome: cognome(arriva), ora: bag }
      voce.arriva = { nome: nomeOspite(arriva), ora: oraBreve(arriva.check_in_time) }
    }
    out.push(voce)
  }
  return out
}

// Cambi camera per giorno (incarico del 06/09/2026): un ospite che quel giorno
// passa da una camera a un'altra (catene di lib/roomChanges, stesse del
// Calendario). Contano già tra le camere da preparare: qui solo il segnale ⇄.
export function cambiCameraPerGiorno(prenotazioni: { id: string; room_id: string; check_in: string; check_out: string; status?: string; group_id?: string | null; guest_id?: string | null }[]): Record<string, number> {
  const valide = prenotazioni.filter(b => !b.status || prenotazioneValida(b as Parameters<typeof prenotazioneValida>[0]))
  const perId = new Map(valide.map(b => [b.id, b]))
  const out: Record<string, number> = {}
  for (const e of buildChangeGroups(valide).roomChangeEdges) {
    const a = perId.get(e.toId)
    if (!a) continue
    out[a.check_in] = (out[a.check_in] ?? 0) + 1
  }
  return out
}

// Dove stanno i ⇄ nella casella: 1 = sotto, 2 = sotto e sopra, 3+ = anche al centro sul numero
export function simboliCambi(cambi: number): { sopra: boolean; centro: boolean; sotto: boolean } {
  return { sotto: cambi >= 1, sopra: cambi >= 2, centro: cambi >= 3 }
}

export function strisciaSettimane(rooms: CameraNome[], prenotazioni: Parameters<typeof conteggioGiorno>[1], events: Decisione[], oggi: string, giorni = GIORNI_STRISCIA): GiornoStriscia[] {
  const out: GiornoStriscia[] = []
  const cambi = cambiCameraPerGiorno(prenotazioni as Parameters<typeof cambiCameraPerGiorno>[0])
  for (let i = 0; i < giorni; i++) {
    const giorno = new Date(Date.parse(oggi + 'T00:00:00Z') + i * 86400000).toISOString().slice(0, 10)
    const c = conteggioGiorno(rooms, prenotazioni, events, giorno, oggi)
    out.push({ giorno, daFare: c.daFare, fatte: c.fatte, oggi: i === 0, inizioSettimana: i > 0 && i % 7 === 0, cambi: cambi[giorno] ?? 0, camere: camereDaPreparare(rooms, prenotazioni, events, giorno, oggi) })
  }
  return out
}

// Cosa mostra la casella: il numero delle pulizie da fare, «✓» se tutte
// fatte, «—» se non c'è nulla
export function testoCasella(g: Pick<GiornoStriscia, 'daFare' | 'fatte'>): { testo: string; tono: 'numero' | 'fatto' | 'niente' } {
  if (g.daFare > 0) return { testo: String(g.daFare), tono: 'numero' }
  if (g.fatte > 0) return { testo: '✓', tono: 'fatto' }
  return { testo: '—', tono: 'niente' }
}

// «sab 6» — giorno della settimana breve, senza fuso orario
const GIORNI_SETTIMANA = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']
export function etichettaGiornoBreve(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return `${GIORNI_SETTIMANA[d.getUTCDay()]} ${d.getUTCDate()}`
}
export const ultimoGiornoStriscia = (oggi: string, giorni = GIORNI_STRISCIA) => new Date(Date.parse(oggi + 'T00:00:00Z') + (giorni - 1) * 86400000).toISOString().slice(0, 10)
