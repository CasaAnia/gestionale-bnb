// Date da leggere, mai il formato interno (Ania, 10/09/2026).
// Ovunque si mostri una data si scrive prima il giorno, poi il mese, poi
// l'anno: 10/09/2026 oppure 10 settembre 2026. Il formato interno resta
// quello del database (2026-09-10) e non va toccato: qui si traduce solo
// per gli occhi. L'anno si conserva quando serve a distinguere anni diversi
// — lo storico e i soggiorni a cavallo di Capodanno.

export const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
export const MESI_LUNGHI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

type Pezzi = { anno: number; mese: number; giorno: number }

// Accetta sia "2026-09-10" sia "2026-09-10T18:00:00": conta solo la data.
function pezzi(iso: string | null | undefined): Pezzi | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso).trim())
  if (!m) return null
  const anno = Number(m[1]), mese = Number(m[2]), giorno = Number(m[3])
  if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return null
  return { anno, mese, giorno }
}

// 10/09/2026 — la data completa in cifre.
export function dataItaliana(iso: string | null | undefined): string {
  const p = pezzi(iso)
  if (!p) return ''
  return `${String(p.giorno).padStart(2, '0')}/${String(p.mese).padStart(2, '0')}/${p.anno}`
}

// 10 settembre 2026 — la data completa a parole.
export function dataLunga(iso: string | null | undefined): string {
  const p = pezzi(iso)
  if (!p) return ''
  return `${p.giorno} ${MESI_LUNGHI[p.mese - 1]} ${p.anno}`
}

// 10 set — giorno e mese, senza anno.
export function giornoMese(iso: string | null | undefined): string {
  const p = pezzi(iso)
  if (!p) return ''
  return `${p.giorno} ${MESI_BREVI[p.mese - 1]}`
}

// 10 set 2026 — giorno, mese e anno in forma corta.
export function giornoMeseAnno(iso: string | null | undefined): string {
  const p = pezzi(iso)
  if (!p) return ''
  return `${p.giorno} ${MESI_BREVI[p.mese - 1]} ${p.anno}`
}

// «10 set → 12 set», compatto. L'anno compare da solo quando serve:
// sempre se il periodo scavalca il Capodanno (allora su tutte e due le date),
// e su richiesta (anno: true) quando l'elenco mescola anni diversi.
export function periodoCompatto(dal: string | null | undefined, al: string | null | undefined, opzioni: { anno?: boolean } = {}): string {
  const a = pezzi(dal), z = pezzi(al)
  if (!a || !z) return ''
  if (a.anno !== z.anno) return `${giornoMeseAnno(dal)} → ${giornoMeseAnno(al)}`
  return opzioni.anno
    ? `${giornoMese(dal)} → ${giornoMeseAnno(al)}`
    : `${giornoMese(dal)} → ${giornoMese(al)}`
}
