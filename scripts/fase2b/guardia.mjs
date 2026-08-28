// ============================================================================
// GUARDIA PRODUZIONE (Fase 2B) — da importare in OGNI script che tocca un
// progetto Supabase remoto. Interrompe il processo se l'URL o il project ref
// bersaglio coincidono con la PRODUZIONE (letta a runtime da .env.local:
// nessun identificativo scritto qui dentro).
// ============================================================================
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export function refProduzione() {
  const env = readFileSync(join(REPO, '.env.local'), 'utf8')
  const riga = env.split('\n').find(x => x.startsWith('NEXT_PUBLIC_SUPABASE_URL='))
  const m = riga?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)
  if (!m) throw new Error('GUARDIA: impossibile leggere il ref di produzione da .env.local')
  return m[1]
}

export const maschera = (ref) => ref.slice(0, 4) + '****'

// Da chiamare con l'URL o il ref del progetto BERSAGLIO prima di qualunque
// richiesta. Esce con errore se è la produzione.
export function verificaNonProduzione(bersaglio) {
  const prod = refProduzione()
  if (!bersaglio) throw new Error('GUARDIA: bersaglio mancante')
  if (String(bersaglio).includes(prod)) {
    console.error(`GUARDIA PRODUZIONE: il bersaglio coincide con la produzione (${maschera(prod)}). STOP.`)
    process.exit(2)
  }
  return true
}
