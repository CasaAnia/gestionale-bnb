// ============================================================================
// Collaudo contratto — REGISTRO DUREVOLE degli artefatti: si scrive
// PRIMA di ogni effetto (gli id nascono lato client), così la pulizia
// lavora per identificativi ESATTI anche dopo un'interruzione a metà.
// Stessa convenzione della 0022: cartella da REGISTRO_DIR, mai nel repo.
// ============================================================================
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export function cartellaRegistri() {
  const dir = process.env.REGISTRO_DIR
  if (!dir) { console.error('REGISTRO_DIR mancante (cartella dei registri del collaudo)'); process.exit(1) }
  mkdirSync(dir, { recursive: true })
  return dir
}

const PREFISSO = 'collaudo-contratto-'

export function nuovoRegistro() {
  const file = join(cartellaRegistri(), `${PREFISSO}${Date.now()}.json`)
  const dati = {
    avviato: new Date().toISOString(), pulito: false,
    docIds: [],                 // documenti creati dal collaudo (id generati qui)
    sonde: [],                  // op_key delle sonde a giornale
    contrattoApplicato: false,
    transizioneApplicata: false,
    fotografiaBase: null,       // fotografia iniziale OBBLIGATORIA
    puliziaArrivataA: -1,       // ultima istruzione del piano completata
  }
  const salva = () => writeFileSync(file, JSON.stringify(dati, null, 2))
  salva()
  return {
    file, dati,
    // gli id si REGISTRANO prima degli INSERT
    documento(docId) { dati.docIds.push(docId); salva() },
    sonda(opKey) { dati.sonde.push(opKey); salva() },
    segna(campo, valore = true) { dati[campo] = valore; salva() },
  }
}

// l'ULTIMO registro non ancora pulito (per il passo di pulizia)
export function apriUltimoRegistro() {
  const dir = cartellaRegistri()
  const file = readdirSync(dir).filter(f => f.startsWith(PREFISSO)).sort().at(-1)
  if (!file) return null
  const percorso = join(dir, file)
  const dati = JSON.parse(readFileSync(percorso, 'utf8'))
  const salva = () => writeFileSync(percorso, JSON.stringify(dati, null, 2))
  return {
    file: percorso, dati,
    documento(docId) { dati.docIds.push(docId); salva() },
    sonda(opKey) { dati.sonde.push(opKey); salva() },
    segna(campo, valore = true) { dati[campo] = valore; salva() },
  }
}
