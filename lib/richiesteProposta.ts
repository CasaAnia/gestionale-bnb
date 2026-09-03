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
import { tariffaCamera, totaleLetto, capienzaCamera } from './tariffe.ts'
import { lettiOccupatiPerNotte, cameraOspita, type PrenotazioneLetti } from './lettiAggiuntivi.ts'
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
// persone_per_notte (pezzo 9): un intero per notte (null = tutte le notti
// uguali a `persone`). Caso reale: in 2 la prima notte, poi in 1.
export type RichiestaProposta = { arrivo: string; partenza: string; persone: number; camera_id: string | null; persone_per_notte?: number[] | null }

// Le persone di ogni notte della richiesta, sempre come array lungo quanto le
// notti. Un array salvato con lunghezza diversa dalle notti è un dato
// incoerente (date cambiate senza la striscia): errore esplicito, mai un
// ripiego silenzioso.
export function personePerNotte(r: { arrivo: string; partenza: string; persone: number; persone_per_notte?: number[] | null }): number[] {
  const n = giorniTra(r.arrivo, r.partenza).length
  const base = Math.max(1, Number(r.persone) || 1)
  const p = r.persone_per_notte
  if (p == null) return Array.from({ length: n }, () => base)
  if (!Array.isArray(p) || p.length !== n || p.some(x => !Number.isInteger(x) || x < 1))
    throw new Error(`Persone per notte non valide: servono ${n} interi da 1 in su (trovati ${JSON.stringify(p)}). Modifica la richiesta e ricontrolla la striscia delle notti.`)
  return p.map(x => Number(x))
}

// Persone «di riferimento» per una lista di notti: il massimo (capienza, letti)
export const personeMassime = (persone: number[]) => persone.reduce((m, x) => Math.max(m, x), 1)
export const personeUniformi = (persone: number[]) => persone.every(x => x === persone[0])
// num_guests / extra_bed / extra_bed_dates: i letti aggiuntivi già presi (pool condiviso da 2)
export type PrenotazioneOccupante = { room_id: string; check_in: string; check_out: string; status: string } & Partial<PrenotazioneLetti>

export type CasoSoluzione = 'completa' | 'cambio' | 'manca_mezzo' | 'manca_estremo' | 'completo'

export type SegmentoSoluzione = {
  camera: CameraListino
  arrivo: string
  partenza: string
  notti: number
  prezzoNotte: number       // tariffa della camera (come price_per_night): con persone variabili, la tariffa della notte più economica
  lettoTotale: number       // letto aggiuntivo addebitato (come extra_bed_total): con persone variabili, tutto ciò che supera prezzoNotte × notti
  totale: number            // dal conto unico (lib/conto) = prezzoNotte × notti + lettoTotale
  // pezzo 9 (facoltativi: le soluzioni salvate prima non li hanno)
  personeNotti?: number[]   // persone in ogni notte del segmento
  lettoNotti?: string[]     // notti (ISO) in cui il letto aggiuntivo viene ADDEBITATO
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

export { capienzaCamera }

// Prezzo di un segmento con le regole della conferma, NOTTE PER NOTTE
// (pezzo 9): per ogni notte la tariffa della camera per le persone di quella
// notte e il letto aggiuntivo solo se in quella notte viene addebitato; tutto
// in centesimi. price_per_night = tariffa della notte più economica,
// extra_bed_total = il resto, così contoSoggiorno (price × notti + letto) dà
// esattamente il totale. Con persone uniformi coincide con la regola di prima.
export function segmento(camera: CameraListino, arrivo: string, partenza: string, persone: number | number[]): SegmentoSoluzione {
  const giorni = giorniTra(arrivo, partenza)
  const notti = giorni.length
  const personeNotti = Array.isArray(persone) ? persone.slice(0, notti) : Array.from({ length: notti }, () => persone)
  if (personeNotti.length !== notti) throw new Error(`Segmento ${arrivo}–${partenza}: servono ${notti} valori di persone, trovati ${personeNotti.length}`)
  const cent = (n: number | string | null | undefined) => Math.round(Number(n || 0) * 100)
  let totaleCent = 0
  let minNotteCent = Infinity
  const lettoNotti: string[] = []
  personeNotti.forEach((p, i) => {
    const t = tariffaCamera(camera, p)
    const letto = totaleLetto(camera, p, 1)
    if (letto > 0) lettoNotti.push(giorni[i])
    totaleCent += cent(t.prezzoNotte) + cent(letto)
    minNotteCent = Math.min(minNotteCent, cent(t.prezzoNotte))
  })
  const prezzoNotte = notti ? minNotteCent / 100 : 0
  const lettoTotale = (totaleCent - minNotteCent * notti) / 100
  const conto = contoSoggiorno({ check_in: arrivo, check_out: partenza, price_per_night: prezzoNotte, extra_bed_total: lettoTotale })
  return { camera, arrivo, partenza, notti, prezzoNotte, lettoTotale, totale: conto.totale, personeNotti, lettoNotti }
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
  const persone = personePerNotte(richiesta)
  const massime = personeMassime(persone)

  // Camere candidate: attive, con capienza sufficiente nella notte più
  // affollata; la richiesta per prima
  const ordinate = ordinaCamere(camere.filter(c => c.active !== false && capienzaCamera(c) >= massime))
  const candidate = [
    ...ordinate.filter(c => c.id === richiesta.camera_id),
    ...ordinate.filter(c => c.id !== richiesta.camera_id),
  ]
  const preferita = (c: CameraListino) => c.id === richiesta.camera_id
  const occupanti = prenotazioniConfermate.filter(p => STATI_CHE_OCCUPANO.has(p.status))
  // Letti aggiuntivi già assegnati alle confermate, notte per notte (pool da 2)
  const lettiPresi = lettiOccupatiPerNotte(occupanti)
  // libera[camera][i] = nella notte notti[i] la camera non è occupata E può
  // ospitare le persone DI QUELLA NOTTE (capienza + letti aggiuntivi liberi)
  const libera = new Map<string, boolean[]>()
  for (const c of candidate) {
    libera.set(c.id, notti.map((g, i) =>
      !occupanti.some(p => p.room_id === c.id && p.check_in <= g && p.check_out > g)
      && cameraOspita(c, persone[i], [g], lettiPresi)))
  }
  const liberaTra = (c: CameraListino, da: number, a: number) => {
    const l = libera.get(c.id)!
    for (let i = da; i < a; i++) if (!l[i]) return false
    return a > da
  }
  const seg = (c: CameraListino, da: number, a: number) => segmento(c, notti[da], a < n ? notti[a] : richiesta.partenza, persone.slice(da, a))
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

// ── Disponibilità di una singola camera su un periodo ───────────────────────
// Stessa regola di proponiSoluzioni: nessuna confermata/completata sovrapposta
// e posto per `persone` in ogni notte (capienza + pool dei letti condivisi).
export function cameraDisponibile(
  camera: CameraListino, arrivo: string, partenza: string, persone: number | number[], prenotazioniConfermate: PrenotazioneOccupante[],
): boolean {
  const notti = giorniTra(arrivo, partenza)
  const perNotte = Array.isArray(persone) ? persone : notti.map(() => persone)
  if (notti.length === 0 || perNotte.length !== notti.length || camera.active === false || capienzaCamera(camera) < personeMassime(perNotte)) return false
  const occupanti = prenotazioniConfermate.filter(p => STATI_CHE_OCCUPANO.has(p.status))
  if (occupanti.some(p => p.room_id === camera.id && notti.some(g => p.check_in <= g && p.check_out > g))) return false
  const lettiPresi = lettiOccupatiPerNotte(occupanti)
  return notti.every((g, i) => cameraOspita(camera, perNotte[i], [g], lettiPresi))
}

// ── Alternativa ad Amelia (pezzo 6) ─────────────────────────────────────────
// Blocco facoltativo, attivato da Ania con un interruttore. Si può offrire solo se:
//  · la soluzione è un UNICO segmento nella camera Amelia (con più segmenti
//    lo «stesso periodo» non è definito: scelta prudente, niente alternativa);
//  · il soggiorno proposto è di almeno NOTTI_MINIME_ALTERNATIVA_AMELIA notti;
//  · Ambra o Allegra è libera per lo stesso periodo con le stesse persone;
//  · la differenza a notte è positiva (tutto dalle tariffe reali, in centesimi).
export const NOTTI_MINIME_ALTERNATIVA_AMELIA = 3
export const CAMERE_ALTERNATIVE_AMELIA = ['Allegra', 'Ambra']

export type AlternativaAmelia = {
  camera: CameraListino
  differenzaNotteCentesimi: number   // in più a notte rispetto ad Amelia, letto compreso
  prezzoTotaleCentesimi: number      // prezzo complessivo nella camera alternativa
}

const cent = (n: number | string | null | undefined) => Math.round(Number(n || 0) * 100)

// Prezzo di ogni notte di un segmento (tariffa + letto se addebitato), in centesimi
export function prezziNottiCentesimi(s: SegmentoSoluzione): number[] {
  const giorni = giorniTra(s.arrivo, s.partenza)
  const persone = personeSegmento(s)
  const letto = new Set(s.lettoNotti ?? (s.lettoTotale > 0 ? giorni : []))
  return persone.map((p, i) => cent(tariffaCamera(s.camera, p).prezzoNotte) + (letto.has(giorni[i]) ? cent(totaleLetto(s.camera, p, 1)) : 0))
}
// Persone per notte di un segmento, anche per le soluzioni salvate prima del
// pezzo 9 (senza personeNotti): si ricavano dalla tariffa e dal letto salvati
export function personeSegmento(s: SegmentoSoluzione): number[] {
  if (s.personeNotti && s.personeNotti.length === s.notti) return s.personeNotti
  const base = s.lettoTotale > 0 ? (s.camera.name === 'Amelia' ? 2 : s.camera.name === 'Lena' ? 4 : 3)
    : (s.camera.name === 'Lena' && cent(s.prezzoNotte) === cent(s.camera.double_price) && cent(s.camera.double_price) !== cent(s.camera.base_price) ? 3 : s.camera.name === 'Amelia' ? 1 : 2)
  return Array.from({ length: s.notti }, () => base)
}

export function alternativaAmelia(
  richiesta: { persone: number },
  soluzione: Soluzione,
  camere: CameraListino[],
  prenotazioniConfermate: PrenotazioneOccupante[],
): AlternativaAmelia | null {
  if (soluzione.segmenti.length !== 1) return null
  const s = soluzione.segmenti[0]
  if (s.camera.name !== 'Amelia' || s.notti < NOTTI_MINIME_ALTERNATIVA_AMELIA) return null
  const persone = s.personeNotti && s.personeNotti.length === s.notti ? s.personeNotti : Array.from({ length: s.notti }, () => Math.max(1, Number(richiesta.persone) || 1))
  const ameliaNotti = prezziNottiCentesimi({ ...s, personeNotti: persone, lettoNotti: s.lettoNotti ?? (s.lettoTotale > 0 ? giorniTra(s.arrivo, s.partenza) : []) })
  for (const nome of CAMERE_ALTERNATIVE_AMELIA) {
    const c = camere.find(x => x.name === nome)
    if (!c || !cameraDisponibile(c, s.arrivo, s.partenza, persone, prenotazioniConfermate)) continue
    const alt = segmento(c, s.arrivo, s.partenza, persone)
    const altNotti = prezziNottiCentesimi(alt)
    const differenze = altNotti.map((x, i) => x - ameliaNotti[i])
    // il testo promette «X € in più a notte»: con persone variabili la
    // differenza deve essere la stessa in ogni notte, altrimenti niente blocco
    const differenza = differenze[0]
    if (!(differenza > 0) || differenze.some(d => d !== differenza)) continue
    return { camera: c, differenzaNotteCentesimi: differenza, prezzoTotaleCentesimi: cent(alt.totale) }
  }
  return null
}
