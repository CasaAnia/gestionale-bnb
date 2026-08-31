// ============================================================================
// Collaudo contratto — REGISTRO DUREVOLE degli artefatti: si scrive
// PRIMA di ogni effetto (gli id nascono lato client), così la pulizia
// lavora per identificativi ESATTI anche dopo un'interruzione a metà.
// Le scritture sono ATOMICHE (file temporaneo + rename): un guasto di
// scrittura non corrompe mai la copia precedente, che resta leggibile.
// Un NUOVO giro è VIETATO finché esiste un registro non pulito: prima
// si conclude il passo 7 su quello. Cartella da REGISTRO_DIR, mai repo.
// ============================================================================
import { readFileSync, writeFileSync, renameSync, readdirSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export function cartellaRegistri() {
  const dir = process.env.REGISTRO_DIR
  if (!dir) { console.error('REGISTRO_DIR mancante (cartella dei registri del collaudo)'); process.exit(1) }
  mkdirSync(dir, { recursive: true })
  return dir
}

const PREFISSO = 'collaudo-contratto-'

// scrittura ATOMICA: prima il file temporaneo, poi il rename. Se una
// delle due fallisce, il file di destinazione resta quello di prima.
export function scriviAtomica(percorso, testo, ops = { writeFileSync, renameSync }) {
  const temporaneo = `${percorso}.tmp`
  ops.writeFileSync(temporaneo, testo)
  ops.renameSync(temporaneo, percorso)
}

const apri = percorso => JSON.parse(readFileSync(percorso, 'utf8'))
const conMetodi = (percorso, dati, ops) => {
  const salva = () => scriviAtomica(percorso, JSON.stringify(dati, null, 2), ops)
  return {
    file: percorso, dati,
    // gli id si REGISTRANO prima degli INSERT
    documento(docId) { dati.docIds.push(docId); salva() },
    sonda(opKey) { dati.sonde.push(opKey); salva() },
    segna(campo, valore = true) { dati[campo] = valore; salva() },
  }
}

export function nuovoRegistro(ops = undefined) {
  const dir = cartellaRegistri()
  // BLOCCO: un registro pendente (non pulito, o illeggibile) ferma il
  // nuovo giro — i suoi identificativi vanno prima puliti col passo 7
  for (const f of readdirSync(dir).filter(x => x.startsWith(PREFISSO) && x.endsWith('.json')).sort()) {
    let dati
    try { dati = apri(join(dir, f)) } catch {
      throw new Error(`registro ILLEGGIBILE (${f}): risolverlo a mano prima di un nuovo giro — mai ignorarlo`)
    }
    if (!dati.pulito) throw new Error(`registro PENDENTE non pulito (${f}): eseguire prima il passo 7 su quel giro`)
  }
  let marca = Date.now()
  while (existsSync(join(dir, `${PREFISSO}${marca}.json`))) marca++
  const file = join(dir, `${PREFISSO}${marca}.json`)
  const dati = {
    avviato: new Date().toISOString(), pulito: false,
    docIds: [],                 // documenti creati dal collaudo (id generati qui)
    sonde: [],                  // op_key delle sonde a giornale
    expenseIds: null,           // spese confermate: conservate PRIMA di eliminare i riferimenti
    contrattoApplicato: false,
    transizioneApplicata: false,
    fotografiaBase: null,       // fotografia iniziale OBBLIGATORIA (validata prima degli effetti)
    puliziaArrivataA: -1,       // ultima istruzione del piano completata
  }
  const registro = conMetodi(file, dati, ops ?? { writeFileSync, renameSync })
  registro.segna('avviato', dati.avviato)
  return registro
}

// il registro su cui lavorare: il più recente NON pulito se ce n'è uno
// (è quello con gli identificativi pendenti), altrimenti il più recente
export function apriUltimoRegistro(ops = undefined) {
  const dir = cartellaRegistri()
  const nomi = readdirSync(dir).filter(f => f.startsWith(PREFISSO) && f.endsWith('.json')).sort()
  if (nomi.length === 0) return null
  let scelto = nomi.at(-1)
  for (const f of [...nomi].reverse()) {
    try { if (!apri(join(dir, f)).pulito) { scelto = f; break } } catch { scelto = f; break }
  }
  const percorso = join(dir, scelto)
  return conMetodi(percorso, apri(percorso), ops ?? { writeFileSync, renameSync })
}
