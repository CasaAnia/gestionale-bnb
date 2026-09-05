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
