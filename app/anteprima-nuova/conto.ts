// ANTEPRIMA NUOVA PRENOTAZIONE — i conti, tutti qui e senza effetti.
// Regole già decise con Ania:
//  · la partenza chiude il periodo e non è una notte occupata;
//  · il letto aggiuntivo si paga per le notti scelte, anche con due ospiti;
//  · lo sconto è UNO per prenotazione e non tocca mai la tariffa a notte;
//  · un valore che manca non vale zero: il conto resta «da completare».

export type Letto = {
  attivo: boolean
  notti: string[]                       // ISO delle notti col letto
  importo: number | null
  criterio: 'notte' | 'ogni4' | 'totale'
}
export type Periodo = {
  id: string
  gruppo: string                        // camere dello stesso gruppo = un solo soggiorno
  cameraId: string | null
  arrivo: string
  partenza: string
  ospiti: number
  tariffa: number | null
  letto: Letto
}
export type Sconto = { tipo: 'percentuale' | 'totale'; valore: number } | null

export function round2(n: number) { return Math.round(n * 100) / 100 }

export function giorni(arrivo: string, partenza: string): string[] {
  if (!arrivo || !partenza) return []
  const g: string[] = []
  const [ay, am, ad] = arrivo.split('-').map(Number)
  const [py, pm, pd] = partenza.split('-').map(Number)
  const d = new Date(ay, am - 1, ad), fine = new Date(py, pm - 1, pd)
  while (d < fine) {
    g.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    d.setDate(d.getDate() + 1)
  }
  return g
}
export function notti(p: Periodo) { return giorni(p.arrivo, p.partenza).length }

export function costoLetto(p: Periodo): number {
  const l = p.letto
  if (!l.attivo || !l.importo) return 0
  const n = l.notti.length
  if (n === 0) return 0
  if (l.criterio === 'totale') return round2(l.importo)
  if (l.criterio === 'ogni4') return round2(l.importo * Math.ceil(n / 4))
  return round2(l.importo * n)
}

export function totalePeriodo(p: Periodo): number | null {
  const n = notti(p)
  if (!p.cameraId || n <= 0 || p.tariffa === null) return null
  return round2(n * p.tariffa + costoLetto(p))
}

export type RigaConto = { etichetta: string; importo: number }

export function righeConto(periodi: Periodo[], nomeCamera: (id: string | null) => string): RigaConto[] {
  const righe: RigaConto[] = []
  for (const p of periodi) {
    const n = notti(p)
    if (p.cameraId && n > 0 && p.tariffa !== null) {
      righe.push({ etichetta: `${nomeCamera(p.cameraId)} · ${n} ${n === 1 ? 'notte' : 'notti'} × ${p.tariffa}`, importo: round2(n * p.tariffa) })
    }
    const letto = costoLetto(p)
    if (letto > 0) righe.push({ etichetta: `Letto aggiuntivo · ${p.letto.notti.length} ${p.letto.notti.length === 1 ? 'notte' : 'notti'}`, importo: letto })
  }
  return righe
}

// Prezzo pieno: null se manca un dato indispensabile (non è zero).
export function prezzoPieno(periodi: Periodo[]): number | null {
  if (periodi.length === 0) return null
  let somma = 0
  for (const p of periodi) {
    const t = totalePeriodo(p)
    if (t === null) return null
    somma += t
  }
  return round2(somma)
}

export function valoreSconto(pieno: number | null, sconto: Sconto): number {
  if (pieno === null || !sconto) return 0
  if (sconto.tipo === 'percentuale') return round2(pieno * sconto.valore / 100)
  return round2(Math.max(0, pieno - sconto.valore))
}

export function totaleFinale(pieno: number | null, sconto: Sconto): number | null {
  if (pieno === null) return null
  return round2(pieno - valoreSconto(pieno, sconto))
}

// Lo sconto «porta il totale a» deve restare sotto il prezzo pieno.
export function scontoNonValido(pieno: number | null, sconto: Sconto): string | null {
  if (!sconto || pieno === null) return null
  if (sconto.tipo === 'totale' && sconto.valore >= pieno)
    return `Il totale concordato deve restare sotto il prezzo pieno (${pieno.toFixed(2).replace('.', ',')} €).`
  if (sconto.tipo === 'percentuale' && (sconto.valore <= 0 || sconto.valore >= 100))
    return 'La percentuale deve stare fra 1 e 99.'
  return null
}

export type Accordo =
  | { modo: 'contanti' }
  | { modo: 'bonifico_arrivo' }
  | { modo: 'bonifico_intero' }
  | { modo: 'caparra50'; data: string; ora: string }
  | { modo: 'caparra_libera'; importo: number | null; data: string; ora: string }

export function caparraAttesa(totale: number | null, a: Accordo): number | null {
  if (totale === null) return null
  if (a.modo === 'caparra50') return round2(totale / 2)
  if (a.modo === 'caparra_libera') return a.importo === null ? null : round2(a.importo)
  return null
}

// Divide un periodo in due: fino al cambio nella camera di partenza, dal
// cambio nella nuova. Le notti del letto restano a chi le aveva davvero.
export function dividiPerCambio(p: Periodo, dal: string, nuovaCamera: string, tariffa: number | null, nuovoId: string): [Periodo, Periodo] {
  const primo: Periodo = { ...p, partenza: dal, letto: { ...p.letto, notti: p.letto.notti.filter(n => n < dal) } }
  const secondo: Periodo = {
    ...p, id: nuovoId, cameraId: nuovaCamera, arrivo: dal, partenza: p.partenza, tariffa,
    letto: { ...p.letto, notti: p.letto.notti.filter(n => n >= dal), criterio: p.letto.criterio === 'totale' ? 'notte' : p.letto.criterio, importo: p.letto.criterio === 'totale' ? null : p.letto.importo },
  }
  return [primo, secondo]
}

// Letti aggiuntivi impegnati in una certa notte da tutti i periodi.
export function lettiPerNotte(periodi: Periodo[]): Record<string, number> {
  const c: Record<string, number> = {}
  for (const p of periodi) if (p.letto.attivo) for (const n of p.letto.notti) c[n] = (c[n] || 0) + 1
  return c
}
