// ============================================================================
// BACKUP LOCALE — LETTURA DELLE TABELLE, in comune fra esportazione, verifica
// e ripristino (revisione del 07/09/2026, R2 e R3).
//
// Due sorgenti con la STESSA interfaccia:
//   · PostgREST (Supabase con la service key): elenco tabelle e chiave
//     primaria dall'OpenAPI di PostgREST (`<pk/>` nella descrizione delle
//     colonne), conteggio con HEAD + `Prefer: count=exact` su `select=*`
//     (nessuna colonna «id» presunta: app_members ha user_id), pagine con
//     ORDINE STABILE sulla chiave primaria e avanzamento sulle righe davvero
//     restituite (il server può tagliare una pagina sotto il limite chiesto);
//   · PostgreSQL diretto (collaudo locale o stringa diretta): chiave primaria
//     da pg_index, count(*), select ordinato sulla chiave.
// Più i controlli di COMPLETEZZA di una tabella letta: righe = attese,
// chiave primaria presente e senza doppioni.
// Nessun segreto passa da qui verso l'esterno: la chiave resta nella closure.
// ============================================================================
import { createHash } from 'node:crypto'
import { serializzaStabile } from './backup-comune.mjs'

export const PAGINA = 1000
const ESCLUSE = new Set(['schema_migrations', 'supabase_migrations'])

// --- chiave di riga e impronta, per confronti riga per riga ------------------
export function chiaveRiga(riga, chiave) {
  return chiave.length > 0 ? chiave.map(c => String(riga?.[c] ?? '')).join('') : serializzaStabile(riga)
}
// Valori UGUALI scritti in modo diverso dalle due sorgenti (scoperto col primo
// backup reale del 07/09/2026, verificato contro il database ripristinato):
// PostgREST manda i numeri come numeri JSON e i timestamptz in UTC
// («2026-08-29T07:57:37.71277+00:00»); node-pg, coi testi del server, manda i
// numeric come stringhe («80», «80.00») e i timestamptz nel fuso della sessione
// («2026-08-29 09:57:37.71277+02»). La forma canonica dipende dal TIPO REALE
// della colonna (OpenAPI di PostgREST o information_schema), mai dall'aspetto
// del testo: un telefono «0123» resta diverso da «123», un testo con la T
// resta diverso da uno con lo spazio. I numeri si canonicalizzano come TESTO
// (zeri iniziali/finali, segno, forma esponenziale) senza passare da Number:
// «9007199254740992» e «9007199254740993» restano diversi. Gli istanti con
// fuso vanno in UTC coi decimali dei secondi come sono (i microsecondi
// restano); quelli senza fuso cambiano solo il separatore. Testo, date, JSON e
// tutto il resto: confronto esatto (i JSON in ordine stabile delle chiavi,
// perché il file li scrive con le chiavi ordinate e jsonb no).
export function categoriaTipo(tipo) {
  const t = String(tipo || '').toLowerCase().replace(/\(.*\)/, '').trim()
  if (/^(numeric|decimal|integer|bigint|smallint|double precision|real)$/.test(t)) return 'numero'
  if (t === 'timestamp with time zone') return 'istante'
  if (t === 'timestamp without time zone') return 'istante_locale'
  return null
}
// «1.5e+21» → «1500000000000000000000», «1e-07» → «0.0000001»: spostamento
// testuale della virgola, nessuna aritmetica in virgola mobile
function senzaEsponente(s) {
  const m = /^([+-]?)(\d+)(?:\.(\d+))?e([+-]?\d+)$/i.exec(s)
  if (!m) return s
  const cifre = m[2] + (m[3] || ''); const esp = Number(m[4]); let punto = m[2].length + esp
  let intero, dec
  if (punto <= 0) { intero = '0'; dec = '0'.repeat(-punto) + cifre }
  else if (punto >= cifre.length) { intero = cifre + '0'.repeat(punto - cifre.length); dec = '' }
  else { intero = cifre.slice(0, punto); dec = cifre.slice(punto) }
  return m[1] + intero + (dec ? '.' + dec : '')
}
export function numeroCanonico(v) {
  let s = typeof v === 'number' ? (Number.isInteger(v) && !Number.isSafeInteger(v) ? BigInt(v).toString() : String(v)) : String(v).trim()
  s = senzaEsponente(s)
  const m = /^([+-])?0*(\d*)(?:\.(\d*?)0*)?$/.exec(s)
  if (!m || !/\d/.test(s)) return s   // NaN, Infinity, testo non numerico: esatto («0.0» e «-0.0» sono zero)
  const intero = m[2] || '0'; const dec = m[3] || ''
  const negativo = m[1] === '-' && !(intero === '0' && dec === '')
  return (negativo ? '-' : '') + intero + (dec ? '.' + dec : '')
}
const ISTANTE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}(?::?\d{2})?)?$/
export function istanteCanonico(v, conFuso) {
  if (typeof v !== 'string') return v
  const m = ISTANTE.exec(v)
  if (!m) return v
  const frazione = (m[7] || '').replace(/0+$/, '').replace(/^\.$/, '')
  if (!conFuso || !m[8]) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${frazione}`
  let scarto = 0
  if (m[8] !== 'Z') { const segno = m[8][0] === '-' ? -1 : 1; const cifre = m[8].slice(1).replace(':', ''); scarto = segno * (Number(cifre.slice(0, 2)) * 60 + Number(cifre.slice(2) || 0)) }
  // secondi interi con Date.UTC (aritmetica intera sui millisecondi), decimali come testo
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])) - scarto * 60000
  return new Date(ms).toISOString().slice(0, 19) + frazione + 'Z'
}
export function normalizzaValore(v, tipo) {
  if (v === null || v === undefined) return v
  switch (categoriaTipo(tipo)) {
    case 'numero': return typeof v === 'number' || typeof v === 'string' ? numeroCanonico(v) : v
    case 'istante': return istanteCanonico(v, true)
    case 'istante_locale': return istanteCanonico(v, false)
    default: return v
  }
}
// `tipi` = { colonna: tipo SQL } della tabella viva; senza tipi confronto esatto
const normalizzaRiga = (riga, tipi) => Object.fromEntries(Object.entries(riga ?? {}).map(([c, v]) => [c, normalizzaValore(v, tipi?.[c])]))
export const improntaRiga = (riga, tipi) => createHash('sha256').update(serializzaStabile(normalizzaRiga(riga, tipi))).digest('hex')

// Controllo di completezza di una tabella letta dalla sorgente
export function controllaCompletezza(nome, righe, attese, chiave) {
  const problemi = []
  if (attese !== null && attese !== undefined && righe.length !== attese) problemi.push(`${nome}: lette ${righe.length} righe, la sorgente ne dichiara ${attese}`)
  if (chiave.length > 0) {
    const viste = new Set()
    let nulle = 0, doppie = 0
    for (const r of righe) {
      if (chiave.some(c => r?.[c] === null || r?.[c] === undefined)) { nulle++; continue }
      const k = chiaveRiga(r, chiave)
      if (viste.has(k)) doppie++; else viste.add(k)
    }
    if (nulle > 0) problemi.push(`${nome}: ${nulle} righe senza chiave primaria`)
    if (doppie > 0) problemi.push(`${nome}: ${doppie} righe doppie sulla chiave primaria (${chiave.join(', ')})`)
  }
  return problemi
}

// Confronto riga per riga di due letture della stessa tabella (per chiave)
export function confrontaRighe(nome, chiave, righeFile, righeVive, tipi) {
  const a = new Map(righeFile.map(r => [chiaveRiga(r, chiave), improntaRiga(r, tipi)]))
  const b = new Map(righeVive.map(r => [chiaveRiga(r, chiave), improntaRiga(r, tipi)]))
  let mancanti = 0, inPiu = 0, diverse = 0
  for (const [k, h] of b) { if (!a.has(k)) mancanti++; else if (a.get(k) !== h) diverse++ }
  for (const k of a.keys()) if (!b.has(k)) inPiu++
  const differenze = []
  if (mancanti) differenze.push(`${nome}: ${mancanti} righe del database mancano nel file`)
  if (inPiu) differenze.push(`${nome}: ${inPiu} righe del file non sono più nel database`)
  if (diverse) differenze.push(`${nome}: ${diverse} righe con contenuto diverso`)
  return differenze
}

// --- PostgREST -----------------------------------------------------------------
function totaleDaContentRange(testata) {
  const m = /\/(\d+|\*)\s*$/.exec(testata || '')
  return m && m[1] !== '*' ? Number(m[1]) : null
}

export function chiaviDaOpenApi(api) {
  const out = []
  for (const [nome, def] of Object.entries(api?.definitions || {})) {
    if (ESCLUSE.has(nome)) continue
    const colonne = Object.entries(def.properties || {})
    const pk = colonne.filter(([, p]) => /<pk\/>/.test(String(p.description || ''))).map(([c]) => c)
    // Senza chiave primaria (viste): ordine su tutte le colonne, dichiarato
    out.push({ nome, chiave: pk, ordine: pk.length > 0 ? pk : colonne.map(([c]) => c), senzaChiave: pk.length === 0 })
  }
  return out.sort((x, y) => x.nome.localeCompare(y.nome))
}

// Tipo SQL di ogni colonna dall'OpenAPI (campo `format`), per il confronto per tipo
export function tipiDaOpenApi(api) {
  const out = {}
  for (const [nome, def] of Object.entries(api?.definitions || {})) out[nome] = Object.fromEntries(Object.entries(def.properties || {}).map(([c, p]) => [c, p.format || null]))
  return out
}

export function sorgentePostgrest({ url, chiave, pagina = PAGINA, fetchImpl = fetch }) {
  const base = url.replace(/\/$/, '')
  const testate = { apikey: chiave, Authorization: `Bearer ${chiave}`, 'Accept-Profile': 'public' }
  const chiama = async (percorso, extra = {}, metodo = 'GET') => {
    const r = await fetchImpl(`${base}/rest/v1${percorso}`, { method: metodo, headers: { ...testate, ...extra } })
    if (!r.ok) throw new Error(`HTTP ${r.status} su ${percorso}: ${(await r.text()).slice(0, 200)}`)
    return r
  }
  return {
    tipo: 'postgrest',
    host: new URL(base).host,
    async tabelle() {
      const api = await (await chiama('/')).json()
      const t = chiaviDaOpenApi(api)
      if (t.length === 0) throw new Error('PostgREST non espone nessuna tabella: controlla URL e chiave')
      const tipi = tipiDaOpenApi(api)
      return t.map(x => ({ ...x, tipi: tipi[x.nome] || {} }))
    },
    async conta(nome) {
      const r = await chiama(`/${nome}?select=*`, { Prefer: 'count=exact', 'Range-Unit': 'items', Range: '0-0' }, 'HEAD')
      const n = totaleDaContentRange(r.headers.get('content-range'))
      if (n === null) throw new Error(`${nome}: il server non ha restituito il conteggio (Content-Range)`)
      return n
    },
    async leggi(t) {
      const ordine = t.ordine.map(c => `${c}.asc`).join(',')
      const righe = []
      let attese = null
      for (let offset = 0; ; ) {
        const r = await chiama(`/${t.nome}?select=*&order=${ordine}&offset=${offset}&limit=${pagina}`, { Prefer: 'count=exact' })
        const blocco = await r.json()
        if (attese === null) attese = totaleDaContentRange(r.headers.get('content-range'))
        righe.push(...blocco)
        if (blocco.length === 0) break
        offset += blocco.length            // il server può restituire MENO del limite (max-rows): si avanza sulle righe vere
        if (attese !== null && offset >= attese) break
      }
      return { righe, attese }
    },
    async chiudi() {},
  }
}

// --- PostgreSQL diretto -------------------------------------------------------
export async function sorgentePostgres({ urlDb }) {
  const { default: pg } = await import('pg')
  // Fedeltà dei valori (scoperta col ripristino di collaudo, 07/09/2026): node-pg
  // trasforma date e timestamp in oggetti Date → una `date` a mezzanotte locale
  // diventa il GIORNO PRIMA in ISO/UTC e i timestamp perdono i microsecondi.
  // Si tengono i testi del server così come sono (come fa PostgREST).
  for (const oid of [1082, 1083, 1114, 1184, 1186, 1266]) pg.types.setTypeParser(oid, v => v)   // date, time, timestamp, timestamptz, interval, timetz
  const client = new pg.Client({ connectionString: urlDb })
  await client.connect()
  let host = 'postgres'
  try { host = new URL(urlDb).host } catch { /* non è un URL */ }
  const q = (nome) => `public."${nome.replace(/"/g, '""')}"`
  return {
    tipo: 'postgres',
    host,
    client,
    async tabelle() {
      const { rows } = await client.query(`
        select t.table_name as nome,
               coalesce((select array_agg(a.attname::text order by k.ord)
                           from pg_index i
                           join pg_class c on c.oid = i.indrelid
                           join pg_namespace n on n.oid = c.relnamespace
                           join unnest(i.indkey) with ordinality k(attnum, ord) on true
                           join pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum
                          where i.indisprimary and n.nspname = 'public' and c.relname = t.table_name), '{}') as chiave,
               (select array_agg(column_name::text order by ordinal_position) from information_schema.columns c where c.table_schema = 'public' and c.table_name = t.table_name) as colonne,
               (select jsonb_object_agg(column_name, data_type) from information_schema.columns c where c.table_schema = 'public' and c.table_name = t.table_name) as tipi
          from information_schema.tables t
         where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
         order by t.table_name`)
      return rows.filter(r => !ESCLUSE.has(r.nome)).map(r => ({ nome: r.nome, chiave: r.chiave, ordine: r.chiave.length > 0 ? r.chiave : r.colonne, senzaChiave: r.chiave.length === 0, tipi: r.tipi || {} }))
    },
    async conta(nome) {
      const r = await client.query(`select count(*)::int as n from ${q(nome)}`)
      return r.rows[0].n
    },
    async leggi(t) {
      const ordine = t.ordine.map(c => `"${c.replace(/"/g, '""')}" asc`).join(', ')
      const attese = await this.conta(t.nome)
      const r = await client.query(`select * from ${q(t.nome)} order by ${ordine}`)
      return { righe: r.rows, attese }
    },
    async chiudi() { await client.end() },
  }
}

// Sorgente dalle variabili d'ambiente (mai stampate). Postgres se --postgres.
export async function sorgenteDaAmbiente(usaPostgres, env = process.env) {
  if (usaPostgres) {
    const urlDb = env.DATABASE_URL || ''
    if (!urlDb) throw new Error('manca DATABASE_URL nell’ambiente')
    return sorgentePostgres({ urlDb })
  }
  const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  const chiave = env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url) throw new Error('manca SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) nell’ambiente: Node non legge .env.local da solo, vedi docs/backup.md')
  if (!chiave) throw new Error('manca SUPABASE_SERVICE_ROLE_KEY nell’ambiente: la chiave non si legge da nessun file')
  return sorgentePostgrest({ url, chiave })
}
