// ============================================================================
// BACKUP LOCALE DEL GESTIONALE — parte comune, pura (07/09/2026, pezzo 3).
// Usata da backup-locale.mjs (esporta) e backup-verifica.mjs (rilegge e
// controlla). Nessuna rete, nessun segreto: qui passano solo i dati.
// ============================================================================
import { createHash } from 'node:crypto'

export const VERSIONE_ESPORTAZIONE = 1

// Nome del file datato, ora locale: gestionale-backup-2026-09-07-1432.json
export function nomeFileBackup(d = new Date()) {
  const due = n => String(n).padStart(2, '0')
  return `gestionale-backup-${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}-${due(d.getHours())}${due(d.getMinutes())}.json`
}

// JSON stabile: chiavi ordinate a ogni livello, Date → ISO, bigint → stringa
export function serializzaStabile(valore) {
  return JSON.stringify(valore, (chiave, v) => {
    if (typeof v === 'bigint') return v.toString()
    if (v instanceof Date) return v.toISOString()
    if (v && typeof v === 'object' && !Array.isArray(v)) return Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]]))
    return v
  })
}

// Impronta SHA-256 delle sole tabelle (nomi e righe), per dire «quello che
// rileggo è quello che ho scritto»
export function improntaTabelle(tabelle) {
  return createHash('sha256').update(serializzaStabile(tabelle)).digest('hex')
}

// Documento da scrivere su file. `origine` dice da dove vengono i dati
// («postgrest» = Supabase via API con la service key, «postgres» = database
// diretto); `sorgente` è SOLO l'host, mai chiavi o password.
export function componiEsportazione({ origine, sorgente, tabelle, creatoIl = new Date() }) {
  const ordinate = Object.fromEntries(Object.keys(tabelle).sort().map(n => [n, { righe: tabelle[n].length, dati: tabelle[n] }]))
  return {
    versione: VERSIONE_ESPORTAZIONE,
    creato_il: creatoIl.toISOString(),
    origine,
    sorgente,
    tabelle: ordinate,
    impronta: improntaTabelle(Object.fromEntries(Object.entries(ordinate).map(([n, t]) => [n, t.dati]))),
  }
}

// Controllo di integrità di un'esportazione riletta: struttura, conteggi per
// tabella, impronta. Torna { ok, problemi[], riepilogo }.
export function verificaEsportazione(doc) {
  const problemi = []
  if (!doc || typeof doc !== 'object') return { ok: false, problemi: ['il file non contiene un oggetto JSON'], riepilogo: null }
  if (doc.versione !== VERSIONE_ESPORTAZIONE) problemi.push(`versione ${doc.versione} diversa da ${VERSIONE_ESPORTAZIONE}`)
  if (!doc.creato_il || Number.isNaN(Date.parse(doc.creato_il))) problemi.push('creato_il mancante o non è una data')
  if (!doc.tabelle || typeof doc.tabelle !== 'object' || Array.isArray(doc.tabelle)) {
    problemi.push('manca l’oggetto tabelle')
    return { ok: false, problemi, riepilogo: null }
  }
  const riepilogo = {}
  for (const [nome, t] of Object.entries(doc.tabelle)) {
    if (!t || !Array.isArray(t.dati)) { problemi.push(`${nome}: dati non è un elenco`); continue }
    if (t.righe !== t.dati.length) problemi.push(`${nome}: dichiarate ${t.righe} righe, trovate ${t.dati.length}`)
    const nonOggetti = t.dati.filter(r => !r || typeof r !== 'object' || Array.isArray(r)).length
    if (nonOggetti > 0) problemi.push(`${nome}: ${nonOggetti} righe non sono oggetti`)
    riepilogo[nome] = t.dati.length
  }
  const attesa = improntaTabelle(Object.fromEntries(Object.entries(doc.tabelle).map(([n, t]) => [n, Array.isArray(t?.dati) ? t.dati : []])))
  if (doc.impronta !== attesa) problemi.push('impronta diversa: il contenuto non coincide con quello scritto')
  if (Object.keys(doc.tabelle).length === 0) problemi.push('nessuna tabella nel file')
  return { ok: problemi.length === 0, problemi, riepilogo }
}

// Confronto dei conteggi con una sorgente viva (stessa origine, dopo l'export):
// differenze = tabelle in più/in meno o con un numero di righe diverso
export function confrontaConteggi(riepilogoFile, conteggiVivi) {
  const differenze = []
  for (const [nome, n] of Object.entries(conteggiVivi)) {
    if (!(nome in riepilogoFile)) differenze.push(`${nome}: nel database ma non nel file`)
    else if (riepilogoFile[nome] !== n) differenze.push(`${nome}: file ${riepilogoFile[nome]} righe, database ${n}`)
  }
  for (const nome of Object.keys(riepilogoFile)) if (!(nome in conteggiVivi)) differenze.push(`${nome}: nel file ma non nel database`)
  return differenze
}

// Il testo non deve mai contenere una chiave: guardia usata prima di scrivere
export function contieneSegreto(testo, segreti) {
  return segreti.filter(s => s && s.length >= 12 && testo.includes(s)).length > 0
}
