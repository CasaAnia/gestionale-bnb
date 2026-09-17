// ============================================================================
// LO SCONTO DALLA SCHEDA NUOVA (17/09/2026): nessuno, percentuale, prezzo
// finale — le stesse tre forme dell'inserimento (lib/nuovaPrenotazione).
//
// Regole, prese dalla scheda attuale e mai riscritte:
// - il prezzo pieno di un tratto è tariffa × notti + letto, come lo legge
//   `contoSoggiorno` SENZA sconto e senza totale salvato (è quello che
//   «rimuovi sconto» della scheda attuale scrive in total_amount);
// - lo sconto si salva riga per riga (`scontoPerRiga`): la percentuale
//   uguale su tutte, il prezzo finale come quota di ogni riga (target_total);
// - il totale che si scrive in ogni riga è ESATTAMENTE quello che
//   `contoSoggiorno` rileggerà da quei campi: così l'anteprima di qui e il
//   conto riaperto coincidono al centesimo, anche con più camere;
// - togliere lo sconto: discount null e total_amount = prezzo pieno.
//
// Funzioni pure: niente Supabase, niente orologio.
// ============================================================================
import { contoSoggiorno } from './conto.ts'
import { scontoPerRiga, type ScontoNuova } from './nuovaPrenotazione.ts'
import { euroScheda } from './schedaPrenotazione.ts'

export const TITOLO_SCONTO = 'Sconto'
export const SALVA_SCONTO = 'Salva'
export const COMANDO_SCONTO = 'Sconto'
export const TIPI_SCONTO = [
  { chiave: 'nessuno', testo: 'Nessuno' },
  { chiave: 'percentuale', testo: 'Percentuale' },
  { chiave: 'finale', testo: 'Prezzo finale' },
] as const satisfies readonly { chiave: ScontoNuova['tipo']; testo: string }[]
export const ETICHETTA_PER_CENTO = 'Quanto per cento'
export const ETICHETTA_IN_TUTTO = 'Quanto paga in tutto'
export const RIGA_ATTUALE = 'Totale attuale'
export const RIGA_NUOVO = 'Nuovo totale'
export const RIGA_RESTA = 'Resta da incassare'
export const ERRORE_PERCENTUALE = 'La percentuale deve stare fra 0 e 100.'
export const ERRORE_FINALE = (pienoCent: number) => `Il prezzo finale deve stare sotto il prezzo pieno (${euroScheda(pienoCent)}).`
export const ERRORE_NIENTE_RIGHE = 'Non c’è nessuna camera attiva a cui applicare lo sconto.'
export const SCONTO_SALVATO = 'Sconto salvato.'
export const SCONTO_TOLTO = 'Sconto tolto.'

export type RigaScontabile = {
  id: string
  status?: string | null
  check_in?: string
  check_out?: string
  price_per_night?: number | string | null
  extra_bed_total?: number | string | null
  discount_type?: string | null
  discount_value?: number | string | null
  total_amount?: number | string | null
}

export type CampiScontoRiga = { discount_type: string | null; discount_value: number | null; total_amount: number }

const attive = <T extends RigaScontabile>(righe: T[]) => righe.filter(r => r.status !== 'annullata')
const cent = (n: number) => Math.round(n * 100)

/** Il prezzo pieno di un tratto, in euro: tariffa × notti + letto, senza
 *  guardare né lo sconto né il totale salvato (la regola di «rimuovi sconto»). */
export function prezzoPienoRiga(r: RigaScontabile): number {
  return contoSoggiorno({ check_in: r.check_in, check_out: r.check_out, price_per_night: r.price_per_night, extra_bed_total: r.extra_bed_total }).totale
}

/** Lo sconto com'è salvato oggi sulle righe attive, nelle tre forme del foglio.
 *  Percentuale se tutte le righe portano la stessa percentuale; prezzo finale
 *  se tutte portano un totale concordato (la somma dei totali); altrimenti
 *  nessuno. */
export function scontoSalvato(righe: RigaScontabile[]): ScontoNuova {
  const vive = attive(righe)
  if (vive.length === 0) return { tipo: 'nessuno', valore: null }
  const tipi = new Set(vive.map(r => r.discount_type || null))
  if (tipi.size !== 1) return { tipo: 'nessuno', valore: null }
  const tipo = [...tipi][0]
  if (tipo === 'percentage') {
    const valori = new Set(vive.map(r => Number(r.discount_value)))
    const v = [...valori][0]
    return valori.size === 1 && v > 0 && v < 100 ? { tipo: 'percentuale', valore: v } : { tipo: 'nessuno', valore: null }
  }
  if (tipo === 'target_total') {
    const conti = vive.map(r => contoSoggiorno(r))
    if (conti.some(c => c.sconto <= 0)) return { tipo: 'nessuno', valore: null }
    return { tipo: 'finale', valore: conti.reduce((s, c) => s + cent(c.totale), 0) / 100 }
  }
  return { tipo: 'nessuno', valore: null }
}

/** Il valore da scrivere nel campo aprendo il foglio: vuoto senza sconto. */
export function valoreIniziale(sconto: ScontoNuova): string {
  return sconto.tipo === 'nessuno' || sconto.valore == null ? '' : String(sconto.valore)
}

/** Da quello che si scrive nel campo (virgola compresa) al numero, o null. */
export function valoreDaCampo(testo: string): number | null {
  const t = testo.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Perché lo sconto scritto non si può salvare; null se va bene. */
export function erroreSconto(righe: RigaScontabile[], sconto: ScontoNuova): string | null {
  const vive = attive(righe)
  if (vive.length === 0) return ERRORE_NIENTE_RIGHE
  if (sconto.tipo === 'nessuno') return null
  const v = sconto.valore
  if (sconto.tipo === 'percentuale') return v != null && v > 0 && v < 100 ? null : ERRORE_PERCENTUALE
  const pienoCent = vive.reduce((s, r) => s + cent(prezzoPienoRiga(r)), 0)
  return v != null && v > 0 && cent(v) < pienoCent ? null : ERRORE_FINALE(pienoCent)
}

export type AnteprimaSconto = {
  attualeCent: number      // il conto com'è adesso (somma dei totali salvati)
  nuovoCent: number        // il conto dopo il salvataggio, riletto dai nuovi campi
  restaCent: number        // nuovo totale − pagamenti già registrati, mai sotto zero
  oltre: boolean           // i pagamenti superano il nuovo totale
  righe: { id: string; campi: CampiScontoRiga }[]
}

/**
 * Cosa cambia salvando: i campi di OGNI riga attiva e i tre numeri del foglio.
 * Il totale di ogni riga si ricava rileggendo i nuovi campi con
 * `contoSoggiorno`: è la stessa lettura che farà la scheda riaperta.
 */
export function anteprimaSconto(righe: RigaScontabile[], ricevutiCent: number, sconto: ScontoNuova): AnteprimaSconto {
  const vive = attive(righe)
  const pieni = vive.map(prezzoPienoRiga)
  const valido = erroreSconto(righe, sconto) === null && sconto.tipo !== 'nessuno'
  const perRiga = valido ? scontoPerRiga(pieni, sconto) : pieni.map(() => ({}))
  const nuove = vive.map((r, i) => {
    const s = perRiga[i] as { discount_type?: string; discount_value?: number }
    const discount_type = s.discount_type ?? null
    const discount_value = s.discount_value ?? null
    const letto = contoSoggiorno({ check_in: r.check_in, check_out: r.check_out, price_per_night: r.price_per_night, extra_bed_total: r.extra_bed_total, discount_type, discount_value })
    return { id: r.id, campi: { discount_type, discount_value, total_amount: letto.totale } }
  })
  const attualeCent = vive.reduce((s, r) => s + cent(Number(r.total_amount) || 0), 0)
  const nuovoCent = nuove.reduce((s, n) => s + cent(n.campi.total_amount), 0)
  return {
    attualeCent,
    nuovoCent,
    restaCent: Math.max(0, nuovoCent - ricevutiCent),
    oltre: ricevutiCent > nuovoCent,
    righe: nuove,
  }
}

/** Le tre righe del foglio, già in parole. */
export function righeAnteprima(a: AnteprimaSconto): { chiave: string; testo: string; importo: string }[] {
  return [
    { chiave: 'attuale', testo: RIGA_ATTUALE, importo: euroScheda(a.attualeCent) },
    { chiave: 'nuovo', testo: RIGA_NUOVO, importo: euroScheda(a.nuovoCent) },
    { chiave: 'resta', testo: RIGA_RESTA, importo: euroScheda(a.restaCent) },
  ]
}

/** Vero se salvare non cambierebbe nessuna riga: allora «Salva» chiude e basta. */
export function nienteDaSalvare(righe: RigaScontabile[], a: AnteprimaSconto): boolean {
  const per = new Map(righe.map(r => [r.id, r]))
  return a.righe.every(n => {
    const r = per.get(n.id)
    if (!r) return false
    return (r.discount_type || null) === n.campi.discount_type
      && (r.discount_value == null ? null : Number(r.discount_value)) === n.campi.discount_value
      && cent(Number(r.total_amount) || 0) === cent(n.campi.total_amount)
  })
}
