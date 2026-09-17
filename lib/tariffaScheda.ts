// ============================================================================
// «TARIFFE» (17/09/2026): il foglio della scheda nuova per cambiare la
// tariffa a notte di ogni tratto (era il campo «Tariffa» di «Altre
// modifiche» della scheda attuale). Il letto in più e lo sconto restano
// come sono: il totale di ogni riga si rilegge con `contoSoggiorno`, la
// stessa lettura della scheda, così l'anteprima e il conto riaperto
// coincidono. Con un prezzo finale concordato che non sta più sotto il
// nuovo prezzo pieno non si salva: prima si sistema lo sconto.
// Funzioni pure: niente Supabase.
// ============================================================================
import { contoSoggiorno } from './conto.ts'
import { euroScheda, periodoTratto } from './schedaPrenotazione.ts'
import { fmtEuroBreve } from './prezzoNotti.ts'

export const TITOLO_TARIFFE = 'Tariffe'
export const COMANDO_TARIFFE = 'Tariffe'
export const SALVA_TARIFFE = 'Salva'
export const TARIFFE_SALVATE = 'Tariffe salvate.'
export const ERRORE_TARIFFA = (camera: string) => `Scrivi la tariffa a notte di ${camera}: un numero, anche con la virgola.`
export const ERRORE_SCONTO_SOPRA = (camera: string) => `Con questa tariffa il prezzo finale concordato di ${camera} non è più uno sconto: sistema prima lo sconto dal conto.`
export const RIGA_ATTUALE = 'Totale attuale'
export const RIGA_NUOVO = 'Nuovo totale'

export type RigaTariffabile = {
  id: string
  status?: string | null
  check_in: string
  check_out: string
  price_per_night?: number | string | null
  extra_bed_total?: number | string | null
  discount_type?: string | null
  discount_value?: number | string | null
  total_amount?: number | string | null
  rooms?: { name?: string | null } | null
}

export type VoceTariffa = { id: string; camera: string; periodo: string; tariffa: string; aNotte: string }

const attive = <T extends RigaTariffabile>(righe: T[]) => righe.filter(r => r.status !== 'annullata')
const nomeDi = (r: RigaTariffabile) => (r.rooms?.name ?? '').trim() || 'camera'
const cent = (n: number) => Math.round(n * 100)

/** Le righe del foglio: una per tratto attivo, con la tariffa salvata già scritta */
export function vociTariffa(righe: RigaTariffabile[]): VoceTariffa[] {
  return attive(righe).map(r => {
    const t = Number(r.price_per_night) || 0
    return {
      id: r.id, camera: nomeDi(r), periodo: periodoTratto(r.check_in, r.check_out),
      tariffa: Number.isInteger(t) ? String(t) : t.toFixed(2),
      aNotte: `${fmtEuroBreve(t)} a notte`,
    }
  })
}

/** Dal testo del campo al numero (virgola compresa); null se non è una tariffa */
export function tariffaDaCampo(testo: string): number | null {
  const t = String(testo ?? '').trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

export type CampiTariffa = { price_per_night: number; total_amount: number }

/**
 * I campi di ogni riga con le tariffe scritte nel foglio, e l'errore se una
 * non si può salvare. Cambia SOLO chi ha una tariffa diversa; il totale si
 * rilegge dai campi nuovi con contoSoggiorno (sconto e letto compresi).
 */
export function campiTariffe(righe: RigaTariffabile[], scritte: Record<string, string>): { ok: true; righe: { id: string; campi: CampiTariffa }[] } | { ok: false; errore: string } {
  const out: { id: string; campi: CampiTariffa }[] = []
  for (const r of attive(righe)) {
    const testo = scritte[r.id]
    if (testo === undefined) continue
    const nuova = tariffaDaCampo(testo)
    if (nuova === null) return { ok: false, errore: ERRORE_TARIFFA(nomeDi(r)) }
    if (cent(nuova) === cent(Number(r.price_per_night) || 0)) continue
    // senza total_amount: con un totale salvato contoSoggiorno lo terrebbe buono (LETTURA), qui serve il RICALCOLO
    const letto = contoSoggiorno({ check_in: r.check_in, check_out: r.check_out, price_per_night: nuova, extra_bed_total: r.extra_bed_total, discount_type: r.discount_type, discount_value: r.discount_value })
    // un prezzo finale concordato che non sta più sotto il pieno non è più uno sconto
    if (r.discount_type === 'target_total' && Number(r.discount_value) > 0 && letto.sconto <= 0) return { ok: false, errore: ERRORE_SCONTO_SOPRA(nomeDi(r)) }
    out.push({ id: r.id, campi: { price_per_night: nuova, total_amount: letto.totale } })
  }
  return { ok: true, righe: out }
}

/** Totale attuale e nuovo totale, in centesimi, per i tre numeri del foglio */
export function anteprimaTariffe(righe: RigaTariffabile[], scritte: Record<string, string>): { attualeCent: number; nuovoCent: number } {
  const vive = attive(righe)
  const attualeCent = vive.reduce((s, r) => s + cent(Number(r.total_amount) || 0), 0)
  const esito = campiTariffe(righe, scritte)
  if (!esito.ok) return { attualeCent, nuovoCent: attualeCent }
  const nuovi = new Map(esito.righe.map(x => [x.id, x.campi.total_amount]))
  const nuovoCent = vive.reduce((s, r) => s + cent(nuovi.has(r.id) ? nuovi.get(r.id)! : Number(r.total_amount) || 0), 0)
  return { attualeCent, nuovoCent }
}

export function righeAnteprimaTariffe(a: { attualeCent: number; nuovoCent: number }): { chiave: string; testo: string; importo: string }[] {
  return [
    { chiave: 'attuale', testo: RIGA_ATTUALE, importo: euroScheda(a.attualeCent) },
    { chiave: 'nuovo', testo: RIGA_NUOVO, importo: euroScheda(a.nuovoCent) },
  ]
}
