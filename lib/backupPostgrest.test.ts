// R2 e R3 della revisione del 07/09/2026: il percorso PostgREST VERO degli
// script di backup (scripts/backup-lettura, backup-locale.esporta,
// backup-verifica.confrontaConSorgente) contro un server sintetico locale che
// imita Supabase: OpenAPI con <pk/>, app_members con user_id (niente «id»),
// una tabella da 1001 righe, taglio del server a 1000 righe per pagina
// (max-rows) anche se si chiede di più, Content-Range con il totale. Più un
// server «cattivo» che ignora l'ordine e restituisce pagine sovrapposte:
// l'esportazione si deve FERMARE, mai scrivere un file incompleto.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { sorgentePostgrest } from '../scripts/backup-lettura.mjs'
import { esporta } from '../scripts/backup-locale.mjs'
import { confrontaConSorgente } from '../scripts/backup-verifica.mjs'
import { verificaEsportazione } from '../scripts/backup-comune.mjs'

const CHIAVE = 'chiave-finta-di-prova-lunga-abbastanza'
const MAX_ROWS = 1000

type Riga = Record<string, unknown>
const dati: Record<string, { pk: string[]; righe: Riga[] }> = {
  app_members: { pk: ['user_id'], righe: [{ user_id: 'u1', role: 'owner' }, { user_id: 'u2', role: 'member' }] },
  grande: { pk: ['id'], righe: Array.from({ length: 1001 }, (_, i) => ({ id: i + 1, v: `r${i + 1}` })) },
  rooms: { pk: ['id'], righe: [{ id: 'r1', name: 'Ambra' }] },
}
let ignoraOrdine = false      // server «cattivo»: pagine senza ordine stabile e sovrapposte
let chiamate: string[] = []

function openapi() {
  const definitions: Record<string, unknown> = {}
  for (const [nome, t] of Object.entries(dati)) {
    const properties: Record<string, unknown> = {}
    for (const c of Object.keys(t.righe[0])) properties[c] = t.pk.includes(c) ? { description: 'Note:\nThis is a Primary Key.<pk/>', type: 'string' } : { type: 'string' }
    definitions[nome] = { properties }
  }
  return { definitions }
}

let server: Server
let url = ''
before(async () => {
  server = createServer((req, res) => {
    const u = new URL(req.url || '/', 'http://x')
    chiamate.push(`${req.method} ${u.pathname}${u.search}`)
    if (req.headers.apikey !== CHIAVE) { res.writeHead(401); res.end('{}'); return }
    if (u.pathname === '/rest/v1/') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(openapi())); return }
    const nome = u.pathname.replace('/rest/v1/', '')
    const t = dati[nome]
    if (!t) { res.writeHead(404); res.end('{}'); return }
    // select=id su una tabella senza id: 400 come PostgREST vero (R2)
    const select = u.searchParams.get('select') || '*'
    if (select !== '*' && !Object.keys(t.righe[0]).includes(select)) { res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ code: '42703', message: `column ${nome}.${select} does not exist` })); return }
    const totale = t.righe.length
    if (req.method === 'HEAD') { res.writeHead(206, { 'content-range': `0-0/${totale}` }); res.end(); return }
    const offset = Number(u.searchParams.get('offset') || 0)
    const limite = Math.min(Number(u.searchParams.get('limit') || MAX_ROWS), MAX_ROWS)   // max-rows del server
    let righe = [...t.righe]
    const ordine = u.searchParams.get('order')
    if (ordine && !ignoraOrdine) {
      const [col, dir] = ordine.split(',')[0].split('.')
      righe.sort((a, b) => (String(a[col]).padStart(12, '0') < String(b[col]).padStart(12, '0') ? -1 : 1) * (dir === 'desc' ? -1 : 1))
    } else if (ignoraOrdine && nome === 'grande') {
      // pagine «ammissibili» senza ordine: prima 1–1000, poi di nuovo l'1 (mai il 1001)
      righe = offset === 0 ? righe.slice(0, 1000) : [t.righe[0]]
      res.writeHead(200, { 'content-type': 'application/json', 'content-range': `${offset}-${offset + righe.length - 1}/${totale}` }); res.end(JSON.stringify(righe)); return
    }
    const pagina = righe.slice(offset, offset + limite)
    res.writeHead(200, { 'content-type': 'application/json', 'content-range': `${offset}-${offset + pagina.length - 1}/${totale}` })
    res.end(JSON.stringify(pagina))
  })
  await new Promise<void>(ok => server.listen(0, '127.0.0.1', ok))
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})
after(() => server.close())

test('esportazione via PostgREST: app_members con user_id, 1001 righe con taglio del server a 1000, tutte lette una volta sola', async () => {
  chiamate = []; ignoraOrdine = false
  const s = sorgentePostgrest({ url, chiave: CHIAVE, pagina: 5000 })   // si chiede 5000: il server ne dà 1000, si avanza sulle righe vere
  const doc = await esporta(s, () => true)
  assert.deepEqual(Object.keys(doc.tabelle), ['app_members', 'grande', 'rooms'])
  assert.equal(doc.tabelle.grande.righe, 1001)
  assert.equal(doc.tabelle.grande.attese, 1001)
  assert.equal(new Set(doc.tabelle.grande.dati.map((r: Riga) => r.id)).size, 1001)
  assert.deepEqual(doc.tabelle.app_members.chiave, ['user_id'])
  assert.ok(chiamate.some(c => c.includes('/grande?select=*&order=id.asc&offset=0')), 'ordine stabile sulla chiave')
  assert.ok(chiamate.some(c => c.includes('offset=1000')), 'seconda pagina dopo il taglio del server')
  assert.ok(!chiamate.some(c => c.includes('select=id')), 'nessuna colonna «id» presunta')
  const v = verificaEsportazione(JSON.parse(JSON.stringify(doc)))
  assert.equal(v.ok, true)
  // confronto con la sorgente: conteggi (HEAD count=exact, nessun select=id) e contenuti
  const differenze = await confrontaConSorgente(doc, v.riepilogo, s, true)
  assert.deepEqual(differenze, [])
  assert.ok(chiamate.some(c => c.startsWith('HEAD /rest/v1/app_members?select=*')))
})

test('server che ignora l’ordine e restituisce pagine sovrapposte (la riproduzione della revisione): l’esportazione si ferma, nessun file «integro» incompleto', async () => {
  ignoraOrdine = true
  const s = sorgentePostgrest({ url, chiave: CHIAVE })
  await assert.rejects(() => esporta(s, () => true), (e: Error) => /INCOMPLETA/.test(e.message) && /grande: 1 righe doppie/.test(e.message) && /grande: lette 1001 righe, la sorgente ne dichiara 1001/.test(e.message) === false)
  ignoraOrdine = false
})

test('confronto dopo una modifica nella sorgente: conteggi uguali ma contenuto diverso viene detto solo con «contenuti»', async () => {
  const s = sorgentePostgrest({ url, chiave: CHIAVE })
  const doc = await esporta(s, () => true)
  const v = verificaEsportazione(JSON.parse(JSON.stringify(doc)))
  dati.rooms.righe[0].name = 'Ambra rinnovata'
  assert.deepEqual(await confrontaConSorgente(doc, v.riepilogo, s, false), [])
  assert.deepEqual(await confrontaConSorgente(doc, v.riepilogo, s, true), ['rooms: 1 righe con contenuto diverso'])
  dati.grande.righe.push({ id: 1002, v: 'nuova' })
  assert.deepEqual(await confrontaConSorgente(doc, v.riepilogo, s, false), ['grande: file 1001 righe, database 1002'])
  dati.grande.righe.pop(); dati.rooms.righe[0].name = 'Ambra'
})

test('senza URL o chiave nell’ambiente lo script si ferma prima di toccare la rete, e dice che .env.local non basta', async () => {
  const { sorgenteDaAmbiente } = await import('../scripts/backup-lettura.mjs')
  await assert.rejects(() => sorgenteDaAmbiente(false, {} as NodeJS.ProcessEnv), /manca SUPABASE_URL .*\.env\.local/)
  await assert.rejects(() => sorgenteDaAmbiente(false, { SUPABASE_URL: url } as unknown as NodeJS.ProcessEnv), /manca SUPABASE_SERVICE_ROLE_KEY/)
})
