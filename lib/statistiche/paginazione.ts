// Letture a pagine: Supabase/PostgREST tronca a 1.000 righe per chiamata.
// `raccogliPagine` chiede pagine di `limite` righe finché ne arrivano meno del
// limite; al primo errore si ferma e lo riporta (mai una lista parziale che
// sembra completa). Nessun import di Supabase: il chiamante passa la pagina.
export const LIMITE_PAGINA = 1000

export async function raccogliPagine<T>(
  pagina: (offset: number, limite: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  limite = LIMITE_PAGINA,
  massimoPagine = 50,
): Promise<{ data: T[]; error: unknown; pagine: number }> {
  const tutte: T[] = []
  let pagine = 0
  for (let offset = 0; pagine < massimoPagine; offset += limite) {
    let r: { data: T[] | null; error: unknown }
    try { r = await pagina(offset, limite) } catch (e) { return { data: [], error: e ?? new Error('errore sconosciuto'), pagine } }
    pagine++
    if (r.error) return { data: [], error: r.error, pagine }
    const righe = r.data ?? []
    tutte.push(...righe)
    if (righe.length < limite) break
  }
  return { data: tutte, error: null, pagine }
}

// R5 (revisione di f4d5474): un filtro `in (...)` di PostgREST con centinaia
// di ID finisce nell'URL; si spezza in blocchi e si raccolgono TUTTI i
// risultati, senza mai tagliare in silenzio.
export const DIMENSIONE_BLOCCO_ID = 100

export function aBlocchi<T>(lista: T[], dimensione = DIMENSIONE_BLOCCO_ID): T[][] {
  const out: T[][] = []
  for (let i = 0; i < lista.length; i += Math.max(1, dimensione)) out.push(lista.slice(i, i + Math.max(1, dimensione)))
  return out
}

// Legge blocco per blocco; al primo errore si ferma e NON torna righe
// parziali; le righe si deduplicano per chiave.
export async function raccogliBlocchi<T, K>(
  blocchi: K[][],
  leggi: (blocco: K[]) => PromiseLike<{ data: T[] | null; error: unknown }>,
  chiave: (riga: T) => string,
): Promise<{ data: T[]; error: unknown; blocchi: number }> {
  const viste = new Set<string>()
  const tutte: T[] = []
  let letti = 0
  for (const blocco of blocchi) {
    let r: { data: T[] | null; error: unknown }
    try { r = await leggi(blocco) } catch (e) { return { data: [], error: e ?? new Error('errore sconosciuto'), blocchi: letti } }
    letti++
    if (r.error) return { data: [], error: r.error, blocchi: letti }
    for (const riga of r.data ?? []) { const k = chiave(riga); if (!viste.has(k)) { viste.add(k); tutte.push(riga) } }
  }
  return { data: tutte, error: null, blocchi: letti }
}
