// ============================================================================
// «SCELGO IO» (pezzo 10): la composizione MANUALE della soluzione notte per
// notte. Ania assegna la camera a ogni notte con lo stesso gesto della striscia
// «Persone notte per notte»; qui si calcolano le camere ammesse per ciascuna
// notte (solo prenotazioni confermate, persone di quella notte, pool delle 2
// brande), la soluzione risultante (stessa struttura di proposta_soluzione,
// con `manuale: true`) e i prezzi a mano. Logica pura: si prova in node.
// ============================================================================
import { capienzaCamera } from './tariffe.ts'
import { cameraOspita, lettiOccupatiPerNotte } from './lettiAggiuntivi.ts'
import { ordinaCamere, STATI_CHE_OCCUPANO } from './disponibilita.ts'
import { giorniTra } from './richiesteCalendario.ts'
import {
  personePerNotte, segmento, conPrezziNotti, prezziNottiCentesimi,
  type CameraListino, type PrenotazioneOccupante, type RichiestaProposta, type SegmentoSoluzione, type Soluzione,
} from './richiesteProposta.ts'

export const NESSUNA = null   // notte scoperta
export type Composizione = (string | null)[]          // id della camera per ogni notte, null = nessuna
export type PrezziManuali = (number | null)[]         // centesimi per notte, null = tariffa

// Camere ammesse per la notte i: libere sulle confermate e con posto per le
// persone di QUELLA notte (capienza base + brande libere quella notte). In una
// composizione c'è UNA camera per notte, quindi il pool non è conteso fra le
// notti della stessa composizione. In ordine fisso (Amelia → Lena).
export function camereAmmesseNotte(
  i: number, richiesta: RichiestaProposta, camere: CameraListino[], prenotazioniConfermate: PrenotazioneOccupante[],
): CameraListino[] {
  const notti = giorniTra(richiesta.arrivo, richiesta.partenza)
  const persone = personePerNotte(richiesta)
  const g = notti[i]
  if (!g) return []
  const occupanti = prenotazioniConfermate.filter(p => STATI_CHE_OCCUPANO.has(p.status))
  const lettiPresi = lettiOccupatiPerNotte(occupanti)
  return ordinaCamere(camere.filter(c => c.active !== false)).filter(c =>
    !occupanti.some(p => p.room_id === c.id && p.check_in <= g && p.check_out > g)
    && persone[i] <= capienzaCamera(c)
    && cameraOspita(c, persone[i], [g], lettiPresi))
}

// Il ciclo di un tocco: la camera successiva fra le ammesse, poi «nessuna», poi la prima
export function cameraSuccessiva(attuale: string | null, ammesse: CameraListino[]): string | null {
  const ids = ammesse.map(c => c.id)
  if (attuale === null) return ids[0] ?? null
  const k = ids.indexOf(attuale)
  if (k < 0 || k === ids.length - 1) return null
  return ids[k + 1]
}

// Composizione iniziale dalla soluzione automatica corrente (camera per notte)
export function composizioneDaSoluzione(richiesta: { arrivo: string; partenza: string }, sol: Soluzione | null): Composizione {
  const notti = giorniTra(richiesta.arrivo, richiesta.partenza)
  return notti.map(g => sol?.segmenti.find(s => s.arrivo <= g && s.partenza > g)?.camera.id ?? null)
}

// Dalla composizione alla SOLUZIONE: un segmento per ogni tratto di notti
// consecutive nella stessa camera; prezzi dalle tariffe vere, notte per
// notte, sostituiti dove Ania ha scritto un prezzo a mano. Il caso: una sola
// camera per tutte le notti → completa; più camere senza buchi → cambio; con
// notti scoperte → manca_mezzo (buco interno) o manca_estremo; nessuna camera
// → completo. Sempre `manuale: true`.
export function soluzioneDaComposizione(
  richiesta: RichiestaProposta, camere: CameraListino[], composizione: Composizione, prezziManuali: PrezziManuali = [],
): Soluzione {
  const notti = giorniTra(richiesta.arrivo, richiesta.partenza)
  if (composizione.length !== notti.length) throw new Error(`Composizione non valida: servono ${notti.length} notti, trovate ${composizione.length}`)
  const persone = personePerNotte(richiesta)
  const segmenti: SegmentoSoluzione[] = []
  let da = 0
  for (let i = 1; i <= notti.length; i++) {
    if (i === notti.length || composizione[i] !== composizione[da]) {
      const id = composizione[da]
      if (id !== null) {
        const camera = camere.find(c => c.id === id)
        if (!camera) throw new Error(`Camera ${id} non trovata`)
        const partenza = i < notti.length ? notti[i] : richiesta.partenza
        let s = segmento(camera, notti[da], partenza, persone.slice(da, i))
        const tariffe = prezziNottiCentesimi(s)
        const manuali = prezziManuali.slice(da, i)
        if (manuali.some(p => p != null)) {
          s = conPrezziNotti(s, tariffe.map((t, k) => manuali[k] ?? t), true)
        }
        segmenti.push(s)
      }
      da = i
    }
  }
  const coperte = new Set(segmenti.flatMap(s => giorniTra(s.arrivo, s.partenza)))
  const nottiMancanti = notti.filter(n => !coperte.has(n))
  const camereUsate = new Set(segmenti.map(s => s.camera.id))
  const primaCoperta = notti.findIndex(n => coperte.has(n))
  const ultimaCoperta = notti.length - 1 - [...notti].reverse().findIndex(n => coperte.has(n))
  const internaScoperta = primaCoperta >= 0 && notti.slice(primaCoperta, ultimaCoperta + 1).some(n => !coperte.has(n))
  const caso: Soluzione['caso'] = segmenti.length === 0 ? 'completo'
    : nottiMancanti.length === 0 ? (camereUsate.size === 1 && segmenti.length === 1 ? 'completa' : 'cambio')
      : internaScoperta ? 'manca_mezzo' : 'manca_estremo'
  return {
    caso, segmenti, manuale: true,
    nottiTotali: notti.length, nottiCoperte: coperte.size, nottiMancanti,
    prezzoTotale: Math.round(segmenti.reduce((s, x) => s + x.totale, 0) * 100) / 100,
  }
}

// Totale in centesimi di una composizione (per il riassunto sotto la striscia)
export const totaleCentesimi = (sol: Soluzione) => Math.round(sol.prezzoTotale * 100)

// Prezzo di tariffa di ogni notte della composizione (centesimi; null = notte scoperta)
export function prezziTariffaPerNotte(richiesta: RichiestaProposta, camere: CameraListino[], composizione: Composizione): (number | null)[] {
  const sol = soluzioneDaComposizione(richiesta, camere, composizione)
  const notti = giorniTra(richiesta.arrivo, richiesta.partenza)
  const perGiorno = new Map<string, number>()
  for (const s of sol.segmenti) {
    const giorni = giorniTra(s.arrivo, s.partenza)
    const tariffe = prezziNottiCentesimi({ ...s, prezziNottiCentesimi: undefined })
    giorni.forEach((g, k) => perGiorno.set(g, tariffe[k]))
  }
  return notti.map(g => perGiorno.get(g) ?? null)
}

// «Applica a tutte le notti di questa camera»: lo stesso prezzo a mano su ogni notte della stessa camera
export function applicaATutteLeNotti(composizione: Composizione, prezzi: PrezziManuali, i: number, prezzoCent: number): PrezziManuali {
  const id = composizione[i]
  return composizione.map((c, k) => (c !== null && c === id ? prezzoCent : (prezzi[k] ?? null)))
}
