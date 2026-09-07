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
export const improntaRiga = riga => createHash('sha256').update(serializzaStabile(riga)).digest('hex')

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
export function confrontaRighe(nome, chiave, righeFile, righeVive) {
  const a = new Map(righeFile.map(r => [chiaveRiga(r, chiave), improntaRiga(r)]))
  const b = new Map(righeVive.map(r => [chiaveRiga(r, chiave), improntaRiga(r)]))
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
      return t
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
               (select array_agg(column_name::text order by ordinal_position) from information_schema.columns c where c.table_schema = 'public' and c.table_name = t.table_name) as colonne
          from information_schema.tables t
         where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
         order by t.table_name`)
      return rows.filter(r => !ESCLUSE.has(r.nome)).map(r => ({ nome: r.nome, chiave: r.chiave, ordine: r.chiave.length > 0 ? r.chiave : r.colonne, senzaChiave: r.chiave.length === 0 }))
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
