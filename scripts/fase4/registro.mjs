// ============================================================================
// REGISTRO del collaudo (Fase 4) — annotazione INCREMENTALE: il file viene
// riscritto a OGNI artefatto creato, così la pulizia (passo 5) trova tutto
// anche se un giro si interrompe a metà. La pulizia lavora ESCLUSIVAMENTE
// su questi registri: mai cancellazioni generiche per token o prefisso.
// ============================================================================
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export function cartellaRegistri() {
  const dir = process.env.REGISTRO_DIR
  if (!dir) { console.error('REGISTRO_DIR mancante (cartella dei registri del collaudo)'); process.exit(1) }
  mkdirSync(dir, { recursive: true })
  return dir
}

export const IMPRONTA_INIZIALE = 'impronta-iniziale.json'

export function nuovoRegistro(tipo) {
  const file = join(cartellaRegistri(), `${tipo}-${Date.now()}.json`)
  const dati = {
    tipo, avviato: new Date().toISOString(), pulito: false,
    tokens: [],      // upload_token delle registrazioni riuscite
    documenti: [],   // id dei documenti creati
    percorsi: [],    // oggetti storage caricati dai flussi
    estranei: [],    // oggetti piazzati APPOSTA e lasciati (prova 3)
    utenti: [],      // id degli utenti sintetici
  }
  const salva = () => writeFileSync(file, JSON.stringify(dati, null, 2))
  salva()
  return {
    dati, file,
    annota(campo, valore) {
      if (valore && !dati[campo].includes(valore)) { dati[campo].push(valore); salva() }
    },
  }
}

export function tuttiIRegistri() {
  const dir = cartellaRegistri()
  return readdirSync(dir)
    .filter(f => f.endsWith('.json') && f !== IMPRONTA_INIZIALE)
    .map(f => ({ file: join(dir, f), dati: JSON.parse(readFileSync(join(dir, f), 'utf8')) }))
}

export function marcaPulito(r) {
  r.dati.pulito = true
  writeFileSync(r.file, JSON.stringify(r.dati, null, 2))
}
