// ============================================================================
// CAMERE DA PROPORRE (11/09/2026, veste approvata da Ania): l'elenco con la
// spunta della pagina della proposta. Logica pura, senza interfaccia.
//
// Una riga per ogni camera attiva, nell'ordine di sempre (Amelia, Allegra,
// Ambra, Lena). Una camera è PROPONIBILE quando esiste una soluzione che
// copre da sola tutte le notti richieste: quelle partono spuntate. Le altre
// restano grigie, con il motivo scritto in parole semplici.
//
// Disponibilità, capienza e letti di supporto NON si ricalcolano qui: sono
// quelli di lib/richiesteProposta (proponiSoluzioni e motiviEsclusione), così
// l'elenco non può dire una cosa diversa dal messaggio che parte.
// ============================================================================
import { motiviEsclusione, personePerNotte, type CameraListino, type MotivoEsclusione, type PrenotazioneOccupante, type RichiestaProposta, type Soluzione } from './richiesteProposta.ts'
import { nottiDellaRichiesta } from './nottiRichieste.ts'
import { centesimi, centesimiTotale, personeInTutteLeNotti, ORDINE_TRE_PERSONE } from './richiesteTesti.ts'
import { ROOM_TYPE_BY_NAME, ROOM_SLUG_BY_NAME } from './roomTypes.ts'
import { MESI_BREVI } from './dateItaliane.ts'

export type RigaCameraProposta = {
  camera: CameraListino
  proponibile: boolean
  soluzione: Soluzione | null
  totaleCent: number        // il soggiorno intero in quella camera
  prezzoNotteCent: number   // quanto costa la notte, LETTO COMPRESO se si paga
  lettoNotteCent: number    // quanto pesa il letto in più, a notte (0 = non si paga)
  tripla: boolean           // Lena venduta come tripla
  lettoInPiu: boolean       // serve il letto in più e si paga
  tavolo: boolean           // Allegra col letto in più: va tolto il tavolo
  stato: string             // «libera» oppure il motivo per cui non si propone
}

const giornoDi = (iso: string) => Number(iso.slice(8, 10))
const meseDi = (iso: string) => MESI_BREVI[Number(iso.slice(5, 7)) - 1]

// «29» quando le notti stanno tutte nello stesso mese, «29 ott» quando no
function giornoLeggibile(iso: string, notti: string[]): string {
  const unMese = notti.every(g => g.slice(0, 7) === notti[0].slice(0, 7))
  return unMese ? String(giornoDi(iso)) : `${giornoDi(iso)} ${meseDi(iso)}`
}

// «il 30» · «dal 30» (da lì fino alla fine) · «il 29 e il 31».
// Mai un intervallo con il trattino: si legge peggio e confonde.
export function quandoInParole(giorni: string[], notti: string[]): string {
  const indici = giorni.map(g => notti.indexOf(g)).filter(i => i >= 0).sort((a, b) => a - b)
  if (indici.length === 0) return ''
  if (indici.length === 1) return `il ${giornoLeggibile(notti[indici[0]], notti)}`
  const consecutivi = indici.every((x, k) => k === 0 || x === indici[k - 1] + 1)
  const finoInFondo = indici[indici.length - 1] === notti.length - 1
  if (consecutivi && finoInFondo) return `dal ${giornoLeggibile(notti[indici[0]], notti)}`
  return indici.map(i => `il ${giornoLeggibile(notti[i], notti)}`).join(' e ')
}

// Perché la camera non si può proporre, in parole semplici.
// Quando NON va bene per nessuna notte le date non si scrivono: un intervallo
// parziale come «(29–30 ott)» farebbe credere che per le altre notti vada.
export function motivoInParole(motivo: MotivoEsclusione, camera: CameraListino, notti: string[]): string {
  const tipo = (ROOM_TYPE_BY_NAME[camera.name] ?? 'camera').toLowerCase()
  const tutte = motivo.notti.length >= notti.length
  switch (motivo.stato) {
    case 'occupata':
      return `occupata ${quandoInParole(motivo.notti, notti)}`
    case 'senza_posto':
      return `${tipo}: per ${motivo.persone} persone non va${tutte ? '' : ` ${quandoInParole(motivo.notti, notti)}`}`
    case 'brande_esaurite':
      return `il letto in più è già impegnato${tutte ? '' : ` ${quandoInParole(motivo.notti, notti)}`}`
    case 'libera':
      return 'libera'
  }
}

// L'ordine dell'elenco (Ania, 11/09/2026): le camere si leggono nello stesso
// ordine in cui compaiono nel messaggio — con tre persone Lena, Ambra,
// Allegra; negli altri casi l'ordine con cui la ricerca le propone (la camera
// chiesta per prima). Le camere che NON si possono proporre vanno sempre in
// fondo, dopo tutte le proponibili.
function ordineDelMessaggio(richiesta: RichiestaProposta, intere: Soluzione[]): string[] {
  const perCamera = intere.map(s => s.segmenti[0].camera)
  if (personeInTutteLeNotti(richiesta as { persone?: number | null; persone_per_notte?: number[] | null }, 3)) {
    const posto = (c: CameraListino) => {
      const i = ORDINE_TRE_PERSONE.indexOf(ROOM_SLUG_BY_NAME[c.name] ?? '')
      return i < 0 ? ORDINE_TRE_PERSONE.length : i
    }
    return perCamera.map((c, i) => ({ c, i })).sort((a, b) => posto(a.c) - posto(b.c) || a.i - b.i).map(x => x.c.id)
  }
  return perCamera.map(c => c.id)
}

// Una soluzione copre da sola tutte le notti richieste con UNA camera sola?
const camerUnica = (s: Soluzione) =>
  s.segmenti.length > 0 && s.nottiCoperte === s.nottiTotali && new Set(s.segmenti.map(x => x.camera.id)).size === 1

export function camereDaProporre(
  richiesta: RichiestaProposta,
  camere: CameraListino[],
  prenotazioniConfermate: PrenotazioneOccupante[],
  soluzioni: Soluzione[],
): RigaCameraProposta[] {
  const notti = nottiDellaRichiesta(richiesta)
  const personeMax = personePerNotte(richiesta).reduce((m, x) => Math.max(m, x), 1)
  const intere = soluzioni.filter(camerUnica)
  const ordine = ordineDelMessaggio(richiesta, intere)
  const righe = motiviEsclusione(richiesta, camere, prenotazioniConfermate).map(({ camera, motivo }) => {
    const s = intere.find(x => x.segmenti[0].camera.id === camera.id) ?? null
    if (!s) {
      return {
        camera, proponibile: false, soluzione: null,
        totaleCent: 0, prezzoNotteCent: 0, lettoNotteCent: 0,
        tripla: false, lettoInPiu: false, tavolo: false,
        stato: motivoInParole(motivo, camera, notti),
      }
    }
    const nottiLetto = s.segmenti.flatMap(x => x.lettoNotti ?? []).length
    const lettoCent = s.segmenti.reduce((t, x) => t + centesimi(x.lettoTotale), 0)
    const lettoNotteCent = nottiLetto > 0 ? Math.round(lettoCent / nottiLetto) : 0
    const lettoInPiu = lettoNotteCent > 0
    return {
      camera, proponibile: true, soluzione: s,
      totaleCent: centesimiTotale(s),
      // Il prezzo a notte che si legge nell'elenco è quello che paga davvero
      // l'ospite: tariffa più letto, quando il letto si paga (Ania, 11/09/2026)
      prezzoNotteCent: centesimi(s.segmenti[0].prezzoNotte) + lettoNotteCent,
      lettoNotteCent,
      tripla: camera.name === 'Lena' && personeMax >= 3,
      lettoInPiu,
      tavolo: camera.name === 'Allegra' && lettoInPiu,
      stato: 'libera',
    }
  })
  // Prima le proponibili nell'ordine del messaggio, poi le grigie come stanno
  const posto = (r: RigaCameraProposta) => (r.proponibile ? ordine.indexOf(r.camera.id) : ordine.length + 1)
  return righe.map((r, i) => ({ r, i })).sort((a, b) => posto(a.r) - posto(b.r) || a.i - b.i).map(x => x.r)
}

// Gli id delle camere che si POSSONO spuntare: tutte quelle proponibili
export const camereProponibili = (righe: RigaCameraProposta[]): string[] =>
  righe.filter(r => r.proponibile).map(r => r.camera.id)

// Quali partono spuntate (decisione di Ania, 11/09/2026): se il cliente ha
// chiesto una camera precisa ed è proponibile, parte spuntata SOLO quella —
// le altre restano nell'elenco, spuntabili a mano. Se ha chiesto «qualsiasi»,
// o la camera chiesta non si può proporre, partono spuntate tutte.
// È la stessa regola del 07/09: chi ha chiesto Allegra non deve ricevere un
// messaggio con tre camere senza che Ania l'abbia deciso.
export function camereDaSpuntare(righe: RigaCameraProposta[], cameraRichiesta?: string | null): string[] {
  const proponibili = camereProponibili(righe)
  if (cameraRichiesta && proponibili.includes(cameraRichiesta)) return [cameraRichiesta]
  return proponibili
}

// Le soluzioni delle camere spuntate, nell'ordine dell'elenco: la prima è
// quella su cui si costruisce il messaggio, le altre sono le alternative.
// Una camera diventata non proponibile sparisce da sola.
export function soluzioniSpuntate(righe: RigaCameraProposta[], spuntate: string[]): Soluzione[] {
  const scelte = new Set(spuntate)
  return righe.filter(r => r.proponibile && r.soluzione && scelte.has(r.camera.id)).map(r => r.soluzione as Soluzione)
}

// ── Le spunte, in un posto solo (Ania, 11/09/2026) ──────────────────────────
// Le spunte cambiano SOLO quando si tocca una camera: mai scegliendo come
// paga, mai rispondendo a «L'hai inviata?», mai riaprendo la pagina. Finché
// non ne è stata toccata nessuna valgono quelle di partenza (camera chiesta =
// solo lei); una camera diventata non proponibile sparisce da sola.
export function spunteCorrenti(proponibili: string[], diPartenza: string[], scelteAMano: string[] | null): string[] {
  if (scelteAMano === null) return diPartenza.filter(x => proponibili.includes(x))
  return proponibili.filter(x => scelteAMano.includes(x))
}

// Tocco su una camera: se era spuntata si toglie, altrimenti si aggiunge.
// Il risultato resta nell'ordine dell'elenco.
export function conSpuntaCambiata(proponibili: string[], correnti: string[], cameraId: string): string[] {
  if (!proponibili.includes(cameraId)) return correnti
  return correnti.includes(cameraId)
    ? correnti.filter(x => x !== cameraId)
    : proponibili.filter(x => correnti.includes(x) || x === cameraId)
}
