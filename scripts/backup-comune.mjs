// ============================================================================
// BACKUP LOCALE DEL GESTIONALE — parte comune, pura (07/09/2026, pezzo 3;
// rivista per R3). Usata da backup-locale.mjs (esporta), backup-verifica.mjs
// (rilegge e controlla) e backup-ripristino.mjs. Nessuna rete, nessun segreto.
//
// TRE CONTROLLI DISTINTI, mai confusi:
//   1. INTEGRITÀ DEL FILE: struttura, versione, data, conteggi coerenti con
//      i dati, impronta SHA-256 (il file è quello scritto, non manomesso);
//   2. COMPLETEZZA DELL'ESPORTAZIONE: per ogni tabella righe = righe attese
//      dalla sorgente al momento della lettura, chiave primaria presente e
//      senza doppioni (registrate nel file, ricontrollate alla rilettura);
//   3. CONFRONTO COL DATABASE (solo con --confronta): conteggi e, a scelta,
//      contenuto riga per riga letti ADESSO dalla sorgente — dice quanto il
//      file è ancora attuale, non se era completo.
// ============================================================================
import { createHash } from 'node:crypto'

export const VERSIONE_ESPORTAZIONE = 2

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

// Impronta SHA-256 delle sole tabelle (nomi e righe)
export function improntaTabelle(tabelle) {
  return createHash('sha256').update(serializzaStabile(tabelle)).digest('hex')
}

// Documento da scrivere su file. `tabelle` = { nome: { righe: [...], attese,
// chiave: [...], senzaChiave } } come le legge backup-lettura. `sorgente` è
// SOLO l'host, mai chiavi o password.
export function componiEsportazione({ origine, sorgente, tabelle, creatoIl = new Date() }) {
  const ordinate = Object.fromEntries(Object.keys(tabelle).sort().map(n => {
    const t = tabelle[n]
    const dati = Array.isArray(t) ? t : t.righe
    return [n, { righe: dati.length, attese: Array.isArray(t) ? dati.length : (t.attese ?? null), chiave: Array.isArray(t) ? [] : (t.chiave ?? []), senza_chiave: Array.isArray(t) ? false : !!t.senzaChiave, dati }]
  }))
  return {
    versione: VERSIONE_ESPORTAZIONE,
    creato_il: creatoIl.toISOString(),
    origine,
    sorgente,
    limiti: 'righe dello schema public lette tabella per tabella, non in un\'unica transazione; niente schema SQL, auth.users, policy, funzioni, file dello Storage',
    tabelle: ordinate,
    impronta: improntaTabelle(Object.fromEntries(Object.entries(ordinate).map(([n, t]) => [n, t.dati]))),
  }
}

const chiaveRiga = (riga, chiave) => chiave.map(c => String(riga?.[c] ?? '')).join('')

// 1 + 2: integrità del file e completezza registrata. Torna
// { ok, integrita: [...problemi], completezza: [...problemi], riepilogo }.
export function verificaEsportazione(doc) {
  const integrita = [], completezza = []
  if (!doc || typeof doc !== 'object') return { ok: false, integrita: ['il file non contiene un oggetto JSON'], completezza: [], riepilogo: null }
  if (doc.versione !== VERSIONE_ESPORTAZIONE) integrita.push(`versione ${doc.versione} diversa da ${VERSIONE_ESPORTAZIONE}`)
  if (!doc.creato_il || Number.isNaN(Date.parse(doc.creato_il))) integrita.push('creato_il mancante o non è una data')
  if (!doc.tabelle || typeof doc.tabelle !== 'object' || Array.isArray(doc.tabelle)) {
    integrita.push('manca l’oggetto tabelle')
    return { ok: false, integrita, completezza, riepilogo: null }
  }
  const riepilogo = {}
  for (const [nome, t] of Object.entries(doc.tabelle)) {
    if (!t || !Array.isArray(t.dati)) { integrita.push(`${nome}: dati non è un elenco`); continue }
    if (t.righe !== t.dati.length) integrita.push(`${nome}: dichiarate ${t.righe} righe, trovate ${t.dati.length}`)
    const nonOggetti = t.dati.filter(r => !r || typeof r !== 'object' || Array.isArray(r)).length
    if (nonOggetti > 0) integrita.push(`${nome}: ${nonOggetti} righe non sono oggetti`)
    riepilogo[nome] = { righe: t.dati.length, attese: t.attese ?? null, chiave: Array.isArray(t.chiave) ? t.chiave : [] }
    // completezza registrata all'esportazione, ricontrollata qui
    if (t.attese === null || t.attese === undefined) completezza.push(`${nome}: righe attese non registrate (file di una versione vecchia?)`)
    else if (t.attese !== t.dati.length) completezza.push(`${nome}: lette ${t.dati.length} righe su ${t.attese} attese dalla sorgente`)
    const chiave = Array.isArray(t.chiave) ? t.chiave : []
    if (chiave.length > 0) {
      const viste = new Set(); let doppie = 0, nulle = 0
      for (const r of t.dati) {
        if (!r || typeof r !== 'object') continue
        if (chiave.some(c => r[c] === null || r[c] === undefined)) { nulle++; continue }
        const k = chiaveRiga(r, chiave); if (viste.has(k)) doppie++; else viste.add(k)
      }
      if (doppie) completezza.push(`${nome}: ${doppie} righe doppie sulla chiave primaria`)
      if (nulle) completezza.push(`${nome}: ${nulle} righe senza chiave primaria`)
    } else if (t.senza_chiave) completezza.push(`${nome}: senza chiave primaria, doppioni non controllabili`)
  }
  const attesa = improntaTabelle(Object.fromEntries(Object.entries(doc.tabelle).map(([n, t]) => [n, Array.isArray(t?.dati) ? t.dati : []])))
  if (doc.impronta !== attesa) integrita.push('impronta diversa: il contenuto non coincide con quello scritto')
  if (Object.keys(doc.tabelle).length === 0) integrita.push('nessuna tabella nel file')
  return { ok: integrita.length === 0 && completezza.length === 0, integrita, completezza, riepilogo }
}

// 3 (conteggi): differenze fra il file e i conteggi vivi
export function confrontaConteggi(riepilogoFile, conteggiVivi) {
  const differenze = []
  const n = v => (typeof v === 'number' ? v : v?.righe)
  for (const [nome, vivo] of Object.entries(conteggiVivi)) {
    if (!(nome in riepilogoFile)) differenze.push(`${nome}: nel database ma non nel file`)
    else if (n(riepilogoFile[nome]) !== vivo) differenze.push(`${nome}: file ${n(riepilogoFile[nome])} righe, database ${vivo}`)
  }
  for (const nome of Object.keys(riepilogoFile)) if (!(nome in conteggiVivi)) differenze.push(`${nome}: nel file ma non nel database`)
  return differenze
}

// Il testo non deve mai contenere una chiave: guardia usata prima di scrivere
export function contieneSegreto(testo, segreti) {
  return segreti.filter(s => s && s.length >= 12 && testo.includes(s)).length > 0
}
