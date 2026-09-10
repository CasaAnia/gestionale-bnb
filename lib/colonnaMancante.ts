// Solo errori di schema: un vincolo violato non autorizza a togliere dati.
export function colonnaMancante(error: { code?: string; message?: string } | null): string | null {
  if (!error || !['42703', 'PGRST204'].includes(error.code ?? '')) return null
  const message = error.message ?? ''
  const postgrest = /Could not find the '([a-z_][a-z0-9_]*)' column\b/i.exec(message)
  if (postgrest) return postgrest[1]
  const postgres = /\bcolumn\s+((?:"?[a-z_][a-z0-9_]*"?\.)*"?[a-z_][a-z0-9_]*"?)\s+(?:of relation\s+"[^"]+"\s+)?does not exist\b/i.exec(message)
  return postgres?.[1].replaceAll('"', '').split('.').pop() ?? null
}
