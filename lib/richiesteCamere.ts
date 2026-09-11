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
import { centesimi, centesimiTotale } from './richiesteTesti.ts'
import { ROOM_TYPE_BY_NAME } from './roomTypes.ts'
import { MESI_BREVI } from './dateItaliane.ts'

export type RigaCameraProposta = {
  camera: CameraListino
  proponibile: boolean
  soluzione: Soluzione | null
  totaleCent: number        // il soggiorno intero in quella camera
  prezzoNotteCent: number   // la tariffa della camera, senza il letto
  lettoNotteCent: number    // quanto si paga il letto in più, a notte (0 = non si paga)
  tripla: boolean           // Lena venduta come tripla
  lettoInPiu: boolean       // serve il letto in più e si paga
  tavolo: boolean           // Allegra col letto in più: va tolto il tavolo
  stato: string             // «libera tutte e 2 le notti» oppure il motivo
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
  return motiviEsclusione(richiesta, camere, prenotazioniConfermate).map(({ camera, motivo }) => {
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
      prezzoNotteCent: centesimi(s.segmenti[0].prezzoNotte),
      lettoNotteCent,
      tripla: camera.name === 'Lena' && personeMax >= 3,
      lettoInPiu,
      tavolo: camera.name === 'Allegra' && lettoInPiu,
      stato: notti.length === 1 ? 'libera la notte' : `libera tutte e ${notti.length} le notti`,
    }
  })
}

// Gli id delle camere che partono spuntate: tutte quelle proponibili
export const camereProponibili = (righe: RigaCameraProposta[]): string[] =>
  righe.filter(r => r.proponibile).map(r => r.camera.id)

// Le soluzioni delle camere spuntate, nell'ordine dell'elenco: la prima è
// quella su cui si costruisce il messaggio, le altre sono le alternative.
// Una camera diventata non proponibile sparisce da sola.
export function soluzioniSpuntate(righe: RigaCameraProposta[], spuntate: string[]): Soluzione[] {
  const scelte = new Set(spuntate)
  return righe.filter(r => r.proponibile && r.soluzione && scelte.has(r.camera.id)).map(r => r.soluzione as Soluzione)
}
