// ============================================================================
// LA CAMERA CHIESTA BASTA PER LE PERSONE? (Ania, 12/09/2026)
//
// Una richiesta registra quello che chiede la cliente, quindi si salva anche
// se la camera chiesta non ci sta: «Ambra» in quattro non è un errore da
// bloccare, è una cosa da sapere. Nel modulo compare un avviso in mattone,
// niente di più.
//
// Capienza e letti in più NON si ricalcolano qui: si usa capienzaCamera di
// lib/tariffe, la stessa che usano prenotazioni, proposte e disponibilità.
// ============================================================================
import { capienzaCamera } from './tariffe.ts'
import { ordinaCamere } from './disponibilita.ts'

type Camera = { id: string; name: string; has_extra_bed?: boolean | null; active?: boolean | null }

const PAROLE = ['', 'una', 'due', 'tre', 'quattro', 'cinque', 'sei']
const inParole = (n: number) => PAROLE[n] ?? String(n)
const elenco = (nomi: string[]) => (nomi.length <= 1 ? nomi.join('') : `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}`)

// Le camere attive che possono ospitare quelle persone, nell'ordine di sempre
export function camereCheBastano(camere: Camera[], persone: number): Camera[] {
  return ordinaCamere(camere.filter(c => c.active !== false && capienzaCamera(c) >= persone))
}

// «Ambra non basta per 4 persone: in quattro va solo Lena»
// «Ambra non basta per 3 persone: in tre vanno Lena e Allegra»
// «Nessuna camera basta per 5 persone»
// null quando la camera basta, non è stata chiesta, o non si sa nulla.
export function avvisoCameraPersone(camera: Camera | null | undefined, persone: number, camere: Camera[]): string | null {
  if (!camera || !(persone > 0)) return null
  if (capienzaCamera(camera) >= persone) return null
  const bastano = camereCheBastano(camere, persone).filter(c => c.id !== camera.id)
  if (bastano.length === 0) return `Nessuna camera basta per ${persone} persone`
  const nomi = bastano.map(c => c.name)
  return `${camera.name} non basta per ${persone} persone: in ${inParole(persone)} ${bastano.length === 1 ? 'va solo' : 'vanno'} ${elenco(nomi)}`
}
