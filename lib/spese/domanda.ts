// Il motore della scheda 💬 Domanda (estratto da SpeseTracker.tsx in Fase 1
// — stessa logica parola per parola, solo reso funzione pura e testabile).
// Capisce mese, persona/gruppo, categoria, sottocategoria, negozio, prodotto
// e "da sempre", anche combinati. Nessuna capacità nuova in questa fase.
import type { Fx, Voce, Group, Category, Subcat } from './types.ts'
import { MESI, eur, eur2, strip, corto } from './costanti.ts'
import { monthLabel } from './periodo.ts'

export type ContestoDomanda = {
  rows: Fx[]
  month: string                       // mese attualmente scelto (YYYY-MM)
  groups: Group[]
  cats: Category[]
  subcats: Subcat[]
  vociDi: (spese: Fx[]) => Voce[]     // scomposizione già collegata a righe/nomi
}

export function rispondi(q: string, ctx: ContestoDomanda): string {
  const { rows, groups, cats, subcats, vociDi } = ctx
  const s = strip(q)
  // "da sempre" / "in tutto" / "tutti gli scontrini": nessun filtro mese
  const sempre = s.includes('sempre') || s.includes('in tutto') || s.includes('tutti gli scontrini') || s.includes('tutti i mesi')
  // Mese: se nominato, cerco l'anno più recente che ha dati
  let m = ctx.month, mLbl = monthLabel(ctx.month)
  let mesePreciso = false
  for (let i = 0; i < 12; i++) {
    if (s.includes(MESI[i])) {
      const mm = String(i + 1).padStart(2, '0')
      const anni = [...new Set(rows.map(r => r.expense_date.slice(0, 4)))].sort().reverse()
      m = `${anni[0] || ctx.month.slice(0, 4)}-${mm}`
      for (const y of anni) if (rows.some(r => r.expense_date.startsWith(`${y}-${mm}`))) { m = `${y}-${mm}`; break }
      mLbl = MESI[i]
      mesePreciso = true
      break
    }
  }
  const tuttoIlPeriodo = sempre && !mesePreciso
  const quando = tuttoIlPeriodo ? 'Da sempre' : `A ${mLbl}`
  let v = vociDi(tuttoIlPeriodo ? rows : rows.filter(r => r.expense_date.slice(0, 7) === m))
  if (!v.length) return tuttoIlPeriodo ? 'Non trovo spese registrate.' : `A ${mLbl} non trovo spese registrate.`
  const filtri: string[] = []
  // Persona/gruppo (prima i nomi più lunghi, così "Matteo e Ania" vince su "Matteo")
  const gNames = [...groups.map(g => g.name)].sort((a, b) => b.length - a.length)
  for (const g of gNames) if (s.includes(strip(g))) { v = v.filter(x => x.g === g); filtri.push(g); break }
  // Nome intero contenuto nella domanda, oppure una sua parola intera
  // (es. "bar" → "Colazione/Bar", "frutta" → "Frutta e verdura")
  const combacia = (nome: string) => {
    const full = strip(nome)
    if (s.includes(full)) return true
    return full.split(/[^a-z0-9]+/).some(w => w.length >= 3 && new RegExp(`\\b${w}\\b`).test(s))
  }
  // Categoria
  const cNames = [...new Set(cats.map(c => c.name))].sort((a, b) => b.length - a.length)
  for (const c of cNames) if (combacia(c)) { v = v.filter(x => x.cat === c); filtri.push(c.toLowerCase()); break }
  // Sottocategoria (es. "benzina", "trucchi", "affitto"). Se il nome è una
  // parola sola prende anche le voci che si CHIAMANO così: il caffè del
  // pranzo sta sotto Mangiare fuori/Pranzo ma deve contare come caffè.
  const sNames = [...new Set(subcats.map(x => x.name))].sort((a, b) => b.length - a.length)
  for (const sc of sNames) if (combacia(sc)) {
    const w = strip(sc)
    const unaParola = !/[^a-z0-9]/.test(w)
    v = v.filter(x => x.sott === sc || (unaParola && new RegExp(`\\b${w}`).test(strip(x.n))))
    filtri.push(sc.toLowerCase()); break
  }
  // Negozio
  const negozi = [...new Set(rows.filter(r => r.store).map(r => corto(r.store!)))]
  for (const n of negozi) if (n.length > 3 && s.includes(strip(n))) { v = v.filter(x => corto(x.store) === n); filtri.push(n); break }
  // "Dove abbiamo speso di più?"
  if (s.includes('dove') && s.includes('piu')) {
    // dopo i filtri (persona, categoria…) può non restare nulla: si dice,
    // non si va in errore (gestione, NON capacità nuova)
    if (!v.length) return `${quando} non trovo niente per «${q.trim()}».`
    const perS: Record<string, number> = {}, perC: Record<string, number> = {}
    v.forEach(x => { if (x.store) perS[corto(x.store)] = (perS[corto(x.store)] || 0) + x.a; perC[x.cat] = (perC[x.cat] || 0) + x.a })
    const ts = Object.entries(perS).sort((a, b) => b[1] - a[1])[0]
    const tc = Object.entries(perC).sort((a, b) => b[1] - a[1])[0]
    return `${quando} la voce più pesante è ${tc[0].toLowerCase()} (${eur(tc[1])})${ts ? ` e il negozio dove avete speso di più è ${ts[0]} (${eur(ts[1])})` : ''}.`
  }
  // Prodotto: parole della domanda cercate dentro i nomi delle voci
  if (!filtri.some(f => !groups.some(g => g.name === f))) {
    const parole = s.replace(/[?.,!]/g, ' ').split(/\s+/).filter(w => w.length > 3
      && !['quanto', 'quanti', 'quante', 'questo', 'mese', 'speso', 'spesa', 'spese', 'abbiamo', 'comprato', 'cosa', 'della', 'dello', 'delle', 'sempre', 'tutto', 'tutti', 'totale', 'scontrini', ...MESI].includes(w))
    let trovato = parole.length === 0
    for (const w of parole) {
      const match = v.filter(x => strip(x.n).includes(w))
      if (match.length) { v = match; filtri.push(w); trovato = true; break }
    }
    // Ha cercato qualcosa di preciso ("tè freddo") che non esiste:
    // niente totale generico, meglio dirlo chiaro.
    if (!trovato) return `Non trovo nessuna voce per «${q.trim()}»${quando === 'Da sempre' ? '' : ` a ${mLbl}`}. Prova con un altro nome, o aggiungi "da sempre" per cercare in tutti i mesi.`
  }
  if (!v.length) return `${quando} non trovo niente per «${q.trim()}».`
  const tot = v.reduce((sum, x) => sum + x.a, 0)
  const top = [...v].sort((a, b) => b.a - a.a).slice(0, 3).map(x => `${x.n} (${eur2(x.a)})`).join(', ')
  const cosa = filtri.length ? filtri.join(' · ') : 'in totale'
  return `${quando}, ${cosa}: ${eur2(tot)} in ${v.length} ${v.length === 1 ? 'voce' : 'voci'}.${v.length > 1 ? ` Le più grosse: ${top}.` : ''}`
}
