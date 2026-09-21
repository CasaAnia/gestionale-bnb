// Loader per le prove di lib/pagamentiDati senza rete: sostituisce SOLO il
// client Supabase con quello finto messo dal test in globalThis.__fakeSupabase
// e insegna a Node a risolvere gli import senza estensione dei file .ts.
// (Nato dai test di revisione del 21/09/2026 sul cambio di identità.)
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export async function resolve(specificatore, contesto, next) {
  if (specificatore === './supabase' && contesto.parentURL?.endsWith('/lib/pagamentiDati.ts')) {
    return { url: 'data:text/javascript,export const supabase = globalThis.__fakeSupabase', shortCircuit: true }
  }
  if (specificatore.startsWith('.') && contesto.parentURL?.startsWith('file:')) {
    const u = new URL(specificatore, contesto.parentURL)
    for (const coda of ['.ts', '/index.ts']) if (existsSync(fileURLToPath(u) + coda)) return next(u.href + coda, contesto)
  }
  return next(specificatore, contesto)
}
