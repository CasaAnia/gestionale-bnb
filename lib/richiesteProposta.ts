// Ricerca della soluzione per una richiesta (pezzo 3): logica pura, senza
// interfaccia. Lavora SOLO sulle prenotazioni confermate/completate: le altre
// richieste non limitano mai la disponibilità.
//
// Prezzi: le STESSE regole della conferma di prenotazione (lib/tariffe per
// tariffa a notte e letto aggiuntivo, lib/conto per il totale), mai copie.
//
// Casi, nell'ordine in cui vengono proposti:
//  A completa       una camera libera per tutto il periodo
//  B cambio         due segmenti in camere diverse, un solo cambio
//  C manca_mezzo    inizio e fine coperti, una o più notti scoperte in mezzo
//  D manca_estremo  un periodo continuo che parte dopo o finisce prima
//  E completo       nulla copre almeno la metà delle notti
import { tariffaCamera, totaleLetto } from './tariffe.ts'
import { contoSoggiorno } from './conto.ts'
import { ordinaCamere, STATI_CHE_OCCUPANO } from './disponibilita.ts'
import { giorniTra } from './richiesteCalendario.ts'

export type CameraListino = {
  id: string
  name: string
  base_price?: number | string | null
  double_price?: number | string | null
  has_extra_bed?: boolean | null
  extra_bed_price?: number | string | null
  bathroom_type?: string | null
  active?: boolean | null
}
export type RichiestaProposta = { arrivo: string; partenza: string; persone: number; camera_id: string | null }
export type PrenotazioneOccupante = { room_id: string; check_in: string; check_out: string; status: string }

export type CasoSoluzione = 'completa' | 'cambio' | 'manca_mezzo' | 'manca_estremo' | 'completo'

export type SegmentoSoluzione = {
  camera: CameraListino
  arrivo: string
  partenza: string
  notti: number
  prezzoNotte: number       // tariffa della camera (come price_per_night)
  lettoTotale: number       // letto aggiuntivo addebitato (come extra_bed_total)
  totale: number            // dal conto unico (lib/conto)
}

export type Soluzione = {
  caso: CasoSoluzione
  segmenti: SegmentoSoluzione[]
  nottiTotali: number
  nottiCoperte: number
  nottiMancanti: string[]   // notti (giorni ISO) non coperte, in ordine
  prezzoTotale: number
}

export const ETICHETTA_CASO: Record<CasoSoluzione, string> = {
  completa: 'Disponibilità completa',
  cambio: 'Cambio camera',
  manca_mezzo: 'Manca una parte',
  manca_estremo: 'Manca inizio/fine',
  completo: 'Completo',
}

export const MAX_SOLUZIONI = 5

// Capienza massima: le stesse soglie delle tariffe (Amelia parte da 1 posto,
// le altre da 2; il letto aggiuntivo aggiunge 1, Lena arriva a 4).
export function capienzaCamera(camera: CameraListino): number {
  const base = camera.name === 'Amelia' ? 1 : 2
  if (!camera.has_extra_bed) return base
  return camera.name === 'Lena' ? 4 : base + 1
}

// Prezzo di un segmento con le regole della conferma: tariffa a notte per
// persone, letto aggiuntivo per tutte le notti quando addebitato, totale dal conto.
export function segmento(camera: CameraListino, arrivo: string, partenza: string, persone: number): SegmentoSoluzione {
  const notti = giorniTra(arrivo, partenza).length
  const { prezzoNotte } = tariffaCamera(camera, persone)
  const lettoTotale = totaleLetto(camera, persone, notti)
  const conto = contoSoggiorno({ check_in: arrivo, check_out: partenza, price_per_night: prezzoNotte, extra_bed_total: lettoTotale })
  return { camera, arrivo, partenza, notti, prezzoNotte, lettoTotale, totale: conto.totale }
}

function soluzione(caso: CasoSoluzione, segmenti: SegmentoSoluzione[], notti: string[]): Soluzione {
  const coperte = new Set(segmenti.flatMap(s => giorniTra(s.arrivo, s.partenza)))
  return {
    caso,
    segmenti,
    nottiTotali: notti.length,
    nottiCoperte: coperte.size,
    nottiMancanti: notti.filter(n => !coperte.has(n)),
    prezzoTotale: Math.round(segmenti.reduce((s, x) => s + x.totale, 0) * 100) / 100,
  }
}

export function proponiSoluzioni(
  richiesta: RichiestaProposta,
  camere: CameraListino[],
  prenotazioniConfermate: PrenotazioneOccupante[],
): Soluzione[] {
  const notti = giorniTra(richiesta.arrivo, richiesta.partenza)
  const n = notti.length
  if (n === 0) return []
  const persone = Math.max(1, Number(richiesta.persone) || 1)

  // Camere candidate: attive, con capienza sufficiente; la richiesta per prima
  const ordinate = ordinaCamere(camere.filter(c => c.active !== false && capienzaCamera(c) >= persone))
  const candidate = [
    ...ordinate.filter(c => c.id === richiesta.camera_id),
    ...ordinate.filter(c => c.id !== richiesta.camera_id),
  ]
  const preferita = (c: CameraListino) => c.id === richiesta.camera_id
  const occupanti = prenotazioniConfermate.filter(p => STATI_CHE_OCCUPANO.has(p.status))
  // libera[camera][i] = la camera è libera nella notte notti[i]
  const libera = new Map<string, boolean[]>()
  for (const c of candidate) {
    libera.set(c.id, notti.map(g => !occupanti.some(p => p.room_id === c.id && p.check_in <= g && p.check_out > g)))
  }
  const liberaTra = (c: CameraListino, da: number, a: number) => {
    const l = libera.get(c.id)!
    for (let i = da; i < a; i++) if (!l[i]) return false
    return a > da
  }
  const seg = (c: CameraListino, da: number, a: number) => segmento(c, notti[da], a < n ? notti[a] : richiesta.partenza, persone)
  const partenzaDi = (a: number) => (a < n ? notti[a] : richiesta.partenza)

  // Ogni livello si propone solo se il precedente non ha dato nulla: una
  // soluzione parziale non è mai un'alternativa utile a una completa.
  const out: Soluzione[] = []

  // A — completa
  for (const c of candidate) if (liberaTra(c, 0, n)) out.push(soluzione('completa', [seg(c, 0, n)], notti))
  if (out.length) return out.slice(0, MAX_SOLUZIONI)

  // B — un solo cambio camera
  if (n >= 2) {
    const cambi: { sol: Soluzione; nottiPreferita: number; seconda: number }[] = []
    for (const c1 of candidate) for (const c2 of candidate) {
      if (c1.id === c2.id) continue
      let migliore: { k: number; nottiPreferita: number; seconda: number } | null = null
      for (let k = 1; k < n; k++) {
        if (!liberaTra(c1, 0, k) || !liberaTra(c2, k, n)) continue
        const nottiPreferita = (preferita(c1) ? k : 0) + (preferita(c2) ? n - k : 0)
        const seconda = n - k
        if (!migliore || nottiPreferita > migliore.nottiPreferita || (nottiPreferita === migliore.nottiPreferita && seconda < migliore.seconda)) {
          migliore = { k, nottiPreferita, seconda }
        }
      }
      if (migliore) {
        const s1 = seg(c1, 0, migliore.k), s2 = { ...seg(c2, migliore.k, n), arrivo: notti[migliore.k], partenza: partenzaDi(n) }
        cambi.push({ sol: soluzione('cambio', [s1, s2], notti), nottiPreferita: migliore.nottiPreferita, seconda: migliore.seconda })
      }
    }
    cambi.sort((a, b) => b.nottiPreferita - a.nottiPreferita || a.seconda - b.seconda || a.sol.prezzoTotale - b.sol.prezzoTotale)
    out.push(...cambi.map(x => x.sol))
    if (out.length) return out.slice(0, MAX_SOLUZIONI)
  }

  // C — inizio e fine coperti, buco in mezzo (al massimo due segmenti)
  if (n >= 3) {
    const mezzi: Soluzione[] = []
    for (const c1 of candidate) for (const c2 of candidate) {
      let migliore: Soluzione | null = null
      for (let a = 1; a < n - 1; a++) for (let b = a + 1; b < n; b++) {
        if (!liberaTra(c1, 0, a) || !liberaTra(c2, b, n)) continue
        const s = soluzione('manca_mezzo', [seg(c1, 0, a), seg(c2, b, n)], notti)
        if (!migliore || s.nottiCoperte > migliore.nottiCoperte) migliore = s
      }
      if (migliore) mezzi.push(migliore)
    }
    mezzi.sort((x, y) => y.nottiCoperte - x.nottiCoperte
      || Number(preferita(y.segmenti[0].camera)) + Number(preferita(y.segmenti[1].camera)) - Number(preferita(x.segmenti[0].camera)) - Number(preferita(x.segmenti[1].camera))
      || Number(x.segmenti[0].camera.id !== x.segmenti[1].camera.id) - Number(y.segmenti[0].camera.id !== y.segmenti[1].camera.id))
    out.push(...mezzi)
  }

  // D — un periodo continuo che parte dopo o finisce prima
  const estremi: Soluzione[] = []
  for (const c of candidate) {
    let migliore: Soluzione | null = null
    for (let a = 0; a < n; a++) for (let b = a + 1; b <= n; b++) {
      if (a === 0 && b === n) continue
      if (!liberaTra(c, a, b)) continue
      const s = soluzione('manca_estremo', [{ ...seg(c, a, b), arrivo: notti[a], partenza: partenzaDi(b) }], notti)
      if (!migliore || s.nottiCoperte > migliore.nottiCoperte) migliore = s
    }
    if (migliore) estremi.push(migliore)
  }
  estremi.sort((x, y) => y.nottiCoperte - x.nottiCoperte || Number(preferita(y.segmenti[0].camera)) - Number(preferita(x.segmenti[0].camera)))
  out.push(...estremi)

  // C e D insieme, la più coperta per prima (C prima di D a parità).
  // E — soglia: meno della metà delle notti coperte = completo
  const utili = out.filter(s => s.nottiCoperte * 2 >= n)
    .sort((x, y) => y.nottiCoperte - x.nottiCoperte || Number(x.caso === 'manca_estremo') - Number(y.caso === 'manca_estremo'))
  if (utili.length === 0) return [soluzione('completo', [], notti)]
  return utili.slice(0, MAX_SOLUZIONI)
}
