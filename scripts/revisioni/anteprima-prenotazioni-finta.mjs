#!/usr/bin/env node
// Anteprima SENZA RETE di calendario e nuova prenotazione.
//
// Avvia un finto Supabase locale (login + PostgREST minimale su dati
// sintetici) e poi il dev server di Next con NEXT_PUBLIC_SUPABASE_URL che
// punta al finto: nessuna richiesta raggiunge il progetto vero. Serve per la
// prova UI dei blocchi che non hanno una preview sintetica propria (il
// calendario e la nuova prenotazione parlano direttamente con Supabase).
//
// Uso: node scripts/revisioni/anteprima-prenotazioni-finta.mjs
//   → finto Supabase su http://127.0.0.1:54329, app su http://localhost:3213
//   → login con qualsiasi email/password
//
// Scenario dei letti aggiuntivi (pool comune da 2), intorno al 2 set 2026:
//   3–5 set   Lena, 4 ospiti (quadrupla)            → 2/2 da sola: NERO
//   7 set     Allegra 3 ospiti + Ambra 3 ospiti     → 1+1 = 2/2: NERO
//   8 set     solo Ambra                            → 1/2: terracotta
//   10–12 set Amelia 3 ospiti, extra_bed=true SENZA extra_bed_dates (storica),
//             PAGATA                                → righe a strisce
//   11 set    + Lena 3 ospiti, BONIFICO             → 2/2: strisce con nero
// Persone che cambiano da una notte all'altra (4 set 2026, Lena tripla 90 €):
//   14–16 set Lena in 2 poi in 3, salvata NOTTE PER NOTTE (80 + 90 = 170)
//   18–20 set Lena in 2 poi in 3, salvata col VECCHIO calcolo (2 × 90 = 180):
//             la scheda mostra il totale salvato; «Modifica» ricalcola 170
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// La porta si può cambiare quando la 3213 è già occupata da un'altra prova:
//   node scripts/revisioni/anteprima-prenotazioni-finta.mjs --porta 3216
// (vale anche PORTA_APP). Il finto Supabase si sposta di conseguenza.
const daRiga = (() => { const i = process.argv.indexOf('--porta'); return i > -1 ? Number(process.argv[i + 1]) : NaN })()
const PORTA_APP = Number(daRiga || process.env.PORTA_APP || 3213)
const PORTA_FINTO = Number(process.env.PORTA_FINTO || 54329 + (PORTA_APP - 3213))
const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const LENA_ID = '19ae4611-c0a4-42ae-8530-210f9a948e9e'
const ROOM = {
  amelia: '11111111-1111-4111-8111-111111111111',
  allegra: '22222222-2222-4222-8222-222222222222',
  ambra: '33333333-3333-4333-8333-333333333333',
  lena: LENA_ID,
}
const ora = '2026-09-01T10:00:00+02:00'

function camera(id, name, base_price, has_extra_bed, bathroom_type, double_price = null) {
  return { id, name, bathroom_type, bathroom_note: null, base_price, has_extra_bed, extra_bed_price: 10, double_price, active: true, created_at: ora }
}
const rooms = [
  camera(ROOM.amelia, 'Amelia', 50, true, 'privato_interno'),
  camera(ROOM.allegra, 'Allegra', 70, true, 'privato_interno'),
  camera(ROOM.ambra, 'Ambra', 70, true, 'privato_interno'),
  camera(ROOM.lena, 'Lena', 80, true, 'privato_esterno', 90),
]

function ospite(id, full_name, phone) {
  return { id, phone, full_name, email: null, document_type: null, document_number: null, nationality: null, birth_date: null, birth_place: null, rating: 'normale', notes: null, created_at: ora, updated_at: ora }
}
const guests = [
  ospite('aaaaaaaa-0001-4000-8000-000000000001', 'Famiglia Quadrupla', '+39 333 000 0001'),
  ospite('aaaaaaaa-0002-4000-8000-000000000002', 'Coppia Allegra', '+39 333 000 0002'),
  ospite('aaaaaaaa-0003-4000-8000-000000000003', 'Coppia Ambra', '+39 333 000 0003'),
  { ...ospite('aaaaaaaa-0004-4000-8000-000000000004', 'Storico Amelia', '+39 333 000 0004'),
    notes: 'Cammina male: camera al piano di sotto.' },
  ospite('aaaaaaaa-0005-4000-8000-000000000005', 'Bonifico Lena', '+39 333 000 0005'),
  ospite('aaaaaaaa-0006-4000-8000-000000000006', 'Due Poi Tre', '+39 333 000 0006'),
  ospite('aaaaaaaa-0007-4000-8000-000000000007', 'Vecchio Calcolo', '+39 333 000 0007'),
  ospite('aaaaaaaa-0008-4000-8000-000000000008', 'Primo Allegra', '+39 333 000 0008'),
  ospite('aaaaaaaa-0009-4000-8000-000000000009', 'Secondo Allegra', '+39 333 000 0009'),
  ospite('aaaaaaaa-0010-4000-8000-000000000010', 'Primo Ambra', '+39 333 000 0010'),
  ospite('aaaaaaaa-0011-4000-8000-000000000011', 'Secondo Ambra', '+39 333 000 0011'),
  ospite('aaaaaaaa-0012-4000-8000-000000000012', 'Parte Oggi', '+39 333 000 0012'),
  ospite('aaaaaaaa-0013-4000-8000-000000000013', 'Arriva Oggi', '+39 333 000 0013'),
  ospite('aaaaaaaa-0014-4000-8000-000000000014', 'Richiesta Dal Sito', '+39 333 000 0014'),
  // Cambia cliente (06/09/2026): la struttura «Nida» con provenienza sul cliente (0037)
  { ...ospite('aaaaaaaa-0015-4000-8000-000000000015', 'Nida', '393803826118'), provenienza: 'altra_struttura', struttura_nome: 'Nida' },
  { ...ospite('aaaaaaaa-0016-4000-8000-000000000016', 'Anna Kowalska', '393331234567'), provenienza: 'passaparola', struttura_nome: null },
  // Cambio camera (10/09/2026): cliente che è già stato qui due volte e che
  // adesso dorme in due camere nello stesso soggiorno. Serve per la prova
  // della sezione «Soggiorno con cambio camera» e dei soggiorni precedenti.
  { ...ospite('aaaaaaaa-0017-4000-8000-000000000017', 'Giulia Bianchi', '+39 333 000 0017'),
    notes: 'Allergica alla polvere: niente coperte di lana.' },
]
const NIDA = guests[14]
const CAMBIO = guests[16]
const GRUPPO_CAMBIO = 'cccccccc-0017-4000-8000-000000000017'

let n = 0
function prenotazione(room_id, guest_id, check_in, check_out, num_guests, extra) {
  n += 1
  const id = `bbbbbbbb-${String(n).padStart(4, '0')}-4000-8000-00000000000${n}`
  return {
    id, room_id, guest_id, check_in, check_out, num_guests,
    extra_bed: false, extra_bed_dates: [], price_per_night: 80, extra_bed_total: 0,
    total_amount: 160, discount_type: null, discount_value: null,
    status: 'confermata', source: 'diretta', guest_name: null, notes: null,
    cancelled_at: null, cancelled_reason: null, group_id: null,
    pagato: false, bonifico: false, color: null,
    created_at: ora, updated_at: ora,
    ...extra,
  }
}
const bookings = [
  prenotazione(ROOM.lena, guests[0].id, '2026-09-03', '2026-09-05', 4,
    { extra_bed: true, extra_bed_dates: ['2026-09-03', '2026-09-04'], extra_bed_total: 20 }),
  prenotazione(ROOM.allegra, guests[1].id, '2026-09-07', '2026-09-08', 3,
    { extra_bed: true, extra_bed_dates: ['2026-09-07'], extra_bed_total: 10 }),
  prenotazione(ROOM.ambra, guests[2].id, '2026-09-07', '2026-09-09', 3,
    { extra_bed: true, extra_bed_dates: ['2026-09-07', '2026-09-08'], extra_bed_total: 20 }),
  // Prenotazione storica: extra_bed=true ma senza giorni espliciti.
  prenotazione(ROOM.amelia, guests[3].id, '2026-09-10', '2026-09-12', 3,
    { extra_bed: true, extra_bed_dates: null, extra_bed_total: 20, pagato: true }),
  prenotazione(ROOM.lena, guests[4].id, '2026-09-11', '2026-09-12', 3,
    { extra_bed: true, extra_bed_dates: ['2026-09-11'], extra_bed_total: 10, bonifico: true }),
  // Lena in 2 la prima notte e in 3 la seconda: 80 + 90 = 170 (notte più economica + resto)
  prenotazione(ROOM.lena, guests[5].id, '2026-09-14', '2026-09-16', 3,
    { extra_bed: true, extra_bed_dates: ['2026-09-15'], price_per_night: 80, extra_bed_total: 10, total_amount: 170 }),
  // Stessa situazione salvata col vecchio calcolo (tariffa a 3 su entrambe le notti)
  prenotazione(ROOM.lena, guests[6].id, '2026-09-18', '2026-09-20', 3,
    { extra_bed: true, extra_bed_dates: ['2026-09-19'], price_per_night: 90, extra_bed_total: 0, total_amount: 180 }),
  // Pulizie automatiche (04/09/2026): Allegra, partenza il 1° set e nuovo arrivo il 2 →
  // pulizia automatica del 1° set; il secondo parte il 4 senza arrivo vicino → la segna Ania
  prenotazione(ROOM.allegra, guests[7].id, '2026-08-29', '2026-09-01', 2, { status: 'completata' }),
  prenotazione(ROOM.allegra, guests[8].id, '2026-09-02', '2026-09-04', 2),
  // Ambra: partenza e arrivo lo stesso giorno (2 set) → automatica del 2 set
  prenotazione(ROOM.ambra, guests[9].id, '2026-08-30', '2026-09-02', 2, { status: 'completata' }),
  prenotazione(ROOM.ambra, guests[10].id, '2026-09-02', '2026-09-06', 2),
  // Amelia: partenza e arrivo OGGI (4 set) → in «Oggi» la card ha l'etichetta «automatica», niente pulsanti, priorità URGENTE
  prenotazione(ROOM.amelia, guests[11].id, '2026-09-01', '2026-09-04', 1),
  prenotazione(ROOM.amelia, guests[12].id, '2026-09-04', '2026-09-07', 1, { check_in_time: '15:00' }),
  // Errori di salvataggio visibili (05/09/2026): richiesta dal sito in attesa.
  // Le scritture qui sono rifiutate (403): «Conferma prenotazione» deve
  // mostrare «Non salvato, riprova» e lasciare la scheda in attesa.
  prenotazione(ROOM.ambra, guests[13].id, '2026-09-22', '2026-09-24', 2, { status: 'in_attesa', source: 'sito_web' }),
  // Parte 2 (05/09/2026): prenotazione annullata per provare «Motivo annullamento» → Salva rifiutato
  prenotazione(ROOM.allegra, guests[13].id, '2026-08-20', '2026-08-22', 2, { status: 'annullata', cancelled_at: ora, cancelled_reason: 'Prova' }),
  // Cambia cliente (06/09/2026): prenotazione a nome della struttura Nida in Amelia
  // (come quella vera del 6 set), col nome «Nida» anche sulla riga e 2 documenti
  // caricati sul cliente Nida. Qui le scritture del cambio sono accettate in
  // memoria (POST guests, PATCH bookings/documenti_cliente); interruttore
  // GET /finto/errore-cambio-cliente?on=1 per far fallire il PATCH e vedere «Non salvato, riprova».
  prenotazione(ROOM.amelia, NIDA.id, '2026-09-06', '2026-09-07', 2, { guest_name: 'Nida', price_per_night: 70, total_amount: 70, group_id: 'cccccccc-0016-4000-8000-000000000016', notes: 'Arriva verso le 18' }),
  prenotazione(ROOM.allegra, NIDA.id, '2026-09-08', '2026-09-09', 2, { guest_name: 'Nida', price_per_night: 70, total_amount: 70 }),
  // Cambio camera (10/09/2026): due soggiorni conclusi + un soggiorno solo su
  // due camere (Lena, poi Ambra) con orario e navetta registrati.
  prenotazione(ROOM.ambra, CAMBIO.id, '2026-06-12', '2026-06-15', 2, { status: 'completata', price_per_night: 70, total_amount: 210 }),
  prenotazione(ROOM.allegra, CAMBIO.id, '2026-08-01', '2026-08-03', 2, { status: 'completata', price_per_night: 70, total_amount: 140 }),
  prenotazione(ROOM.lena, CAMBIO.id, '2026-09-24', '2026-09-26', 2,
    { group_id: GRUPPO_CAMBIO, price_per_night: 80, total_amount: 160, check_in_time: '18:30', shuttle: 'si', bonifico: true,
      notes: 'Arriva in treno, chiede la navetta alle 18:30.' }),
  prenotazione(ROOM.ambra, CAMBIO.id, '2026-09-26', '2026-09-28', 2,
    { group_id: GRUPPO_CAMBIO, price_per_night: 70, total_amount: 140 }),
]
const documenti_cliente = [
  { id: 'dddddddd-0001-4000-8000-000000000001', guest_id: NIDA.id, percorso: `${NIDA.id}/dddddddd-0001-4000-8000-000000000001.jpg`, etichetta: 'carta_identita', lato: 'fronte', nome_file: 'IMG_1.jpeg', dimensione: 700000, created_at: ora },
  { id: 'dddddddd-0002-4000-8000-000000000002', guest_id: NIDA.id, percorso: `${NIDA.id}/dddddddd-0002-4000-8000-000000000002.jpg`, etichetta: 'carta_identita', lato: 'retro', nome_file: 'IMG_2.jpeg', dimensione: 700000, created_at: ora },
]
const strutture = [{ nome: 'Umana' }, { nome: 'Nida' }, { nome: 'RB (Rosa Bianca)' }, { nome: 'Elyse' }, { nome: 'BM (Borgo Manzoni)' }]
const payments = []
// Storico pulizie (migrazione 0018): vuoto, così la pagina Pulizie mostra solo le automatiche
const cleanings = []

// Cronologia (07/09/2026, proposta 0042): righe che in produzione scrivono i trigger.
// Sulla prima prenotazione (Lena, 3–5 set): cambio camera, date, totale, un acconto e il cambio cliente.
// GET /finto/senza-cronologia?on=1 simula la 0042 NON applicata (tabella assente → avviso nella scheda).
const evento = (i, booking_id, minutiFa, tipo, prima, dopo) => ({ id: `99999999-${String(i).padStart(4, '0')}-4000-8000-000000000000`, n: i, booking_id, soggiorno: booking_id, created_at: new Date((minutiFa === 0 ? Date.now() : Date.parse(ora)) - minutiFa * 60000).toISOString(), tipo, prima, dopo, autore: null })
const booking_events = [
  evento(1, bookings[0].id, 60 * 50, 'camera', { camera: 'Ambra' }, { camera: 'Lena' }),
  evento(2, bookings[0].id, 60 * 50, 'date', { check_in: '2026-09-03', check_out: '2026-09-04' }, { check_in: '2026-09-03', check_out: '2026-09-05' }),
  evento(3, bookings[0].id, 60 * 50, 'totale', { totale: 80 }, { totale: 180 }),
  evento(4, bookings[0].id, 60 * 26, 'pagamento_aggiunto', null, { importo: 50, metodo: 'contanti', data: '2026-08-31' }),
  evento(5, bookings[0].id, 60 * 3, 'cliente', { cliente: 'Vecchio Nome', guest_id: null }, { cliente: guests[0].full_name, guest_id: guests[0].id }),
]
// R1 (revisione 07/09/2026): spese del tracker vecchio in memoria, con
// GET /finto/perdi-risposta-spese?on=1 il POST SALVA la riga ma chiude la
// connessione senza rispondere (risposta persa): «Riprova» deve riconciliare
const family_groups = [{ id: 'eeeeeeee-0001-4000-8000-000000000001', name: 'Casa Ania', sort: 1, ambito: 'azienda', color: null, created_at: ora }]
const family_categories = []
const family_product_rules = []
const family_expenses = []
const tabelle = { rooms, guests, bookings, payments, cleanings, documenti_cliente, strutture, booking_events, family_groups, family_categories, family_product_rules, family_expenses }
const chiaveEsterna = { guests: 'guest_id', rooms: 'room_id' }

// --- PostgREST minimale ---------------------------------------------------
function confronta(valore, op, atteso) {
  const a = atteso === 'null' ? null : atteso
  switch (op) {
    case 'eq': return String(valore) === String(a)
    case 'neq': return String(valore) !== String(a)
    case 'lt': return String(valore) < String(a)
    case 'lte': return String(valore) <= String(a)
    case 'gt': return String(valore) > String(a)
    case 'gte': return String(valore) >= String(a)
    case 'is': return a === null ? valore == null : String(valore) === String(a)
    case 'ilike': {
      const re = new RegExp('^' + String(a).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i')
      return re.test(String(valore ?? ''))
    }
    case 'in': return String(a).replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, '')).includes(String(valore))
    default: return true
  }
}

function applicaSelect(riga, select) {
  if (!select || select === '*') return { ...riga }
  const out = {}
  // colonne semplici e risorse incorporate: a,b,tab(c,d)
  const parti = []
  let livello = 0, corrente = ''
  for (const ch of select) {
    if (ch === '(') livello++
    if (ch === ')') livello--
    if (ch === ',' && livello === 0) { parti.push(corrente); corrente = '' } else corrente += ch
  }
  if (corrente) parti.push(corrente)
  for (const p of parti.map(s => s.trim())) {
    const m = p.match(/^(\w+)\((.*)\)$/)
    if (m) {
      const [, tab, cols] = m
      const fk = chiaveEsterna[tab]
      const collegata = (tabelle[tab] || []).find(r => r.id === riga[fk])
      out[tab] = collegata ? applicaSelect(collegata, cols) : null
    } else if (p === '*') {
      Object.assign(out, riga)
    } else {
      out[p] = riga[p]
    }
  }
  return out
}

// Le righe (vere, non copie) che passano i filtri dell'URL
function righeFiltrate(tabella, url) {
  let righe = [...(tabelle[tabella] || [])]
  for (const [chiave, valore] of url.searchParams) {
    if (['select', 'order', 'limit', 'offset'].includes(chiave)) continue
    // or=(a.eq.x,b.ilike.%q%): basta che una condizione valga (07/09/2026:
    // prima l'«or» veniva ignorato e la ricerca per nome/telefono della
    // Nuova prenotazione «trovava» sempre qualcuno nei contatti extra)
    if (chiave === 'or') {
      const condizioni = valore.replace(/^\(|\)$/g, '').split(',').map(c => c.match(/^(\w+)\.(\w+)\.(.*)$/)).filter(Boolean)
      righe = righe.filter(r => condizioni.some(([, col, op, att]) => confronta(r[col], op, att)))
      continue
    }
    const m = valore.match(/^(\w+)\.(.*)$/)
    if (!m) continue
    righe = righe.filter(r => confronta(r[chiave], m[1], m[2]))
  }
  return righe
}

function interroga(tabella, url) {
  let righe = righeFiltrate(tabella, url)
  const order = url.searchParams.get('order')
  if (order) {
    const [col, dir] = order.split('.')
    righe.sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (dir === 'desc' ? -1 : 1))
  }
  const limit = url.searchParams.get('limit')
  if (limit) righe = righe.slice(0, Number(limit))
  return righe.map(r => applicaSelect(r, url.searchParams.get('select') || '*'))
}

// --- Auth finta ------------------------------------------------------------
const utente = {
  id: 'cccccccc-0000-4000-8000-000000000000', aud: 'authenticated', role: 'authenticated',
  email: 'revisione@locale', email_confirmed_at: ora, app_metadata: { provider: 'email' },
  user_metadata: {}, created_at: ora, updated_at: ora,
}
function b64url(obj) { return Buffer.from(JSON.stringify(obj)).toString('base64url') }
function sessione() {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const token = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: utente.id, aud: 'authenticated', role: 'authenticated', email: utente.email, exp, iat: exp - 3600, session_id: 'finta' })}.firma-finta`
  return { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'refresh-finto', user: utente }
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Range',
}
function rispondi(res, stato, corpo, extra = {}) {
  res.writeHead(stato, { 'Content-Type': 'application/json', ...cors, ...extra })
  res.end(corpo === undefined ? '' : JSON.stringify(corpo))
}

// Errori di salvataggio visibili (05/09/2026): interruttore per far fallire
// la lettura delle richieste dal sito (bookings con source=eq.sito_web).
let senzaCronologia = process.env.FINTO_SENZA_CRONOLOGIA === '1'
let perdiRispostaSpese = false
let spese503 = false   // salva la riga ma risponde 503 (il gateway dice errore dopo che il database ha scritto)
// Si accende/spegne senza riavviare: GET /finto/errore-richieste-web?on=1|0
let erroreRichiesteWeb = process.env.FINTO_ERRORE_RICHIESTE_WEB === '1'
// Cambia cliente (06/09/2026): quando è acceso il PATCH su bookings fallisce
let erroreCambioCliente = false
function leggiCorpo(req) {
  return new Promise(resolve => { let t = ''; req.on('data', c => { t += c }); req.on('end', () => { try { resolve(t ? JSON.parse(t) : null) } catch { resolve(null) } }) })
}

const finto = createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORTA_FINTO}`)
  if (req.method === 'OPTIONS') return rispondi(res, 204)
  if (url.pathname === '/finto/errore-richieste-web') {
    erroreRichiesteWeb = url.searchParams.get('on') === '1'
    return rispondi(res, 200, { erroreRichiesteWeb })
  }
  if (url.pathname === '/finto/senza-cronologia') { senzaCronologia = url.searchParams.get('on') === '1'; return rispondi(res, 200, { senzaCronologia }) }
  if (senzaCronologia && url.pathname === '/rest/v1/booking_events') {
    return rispondi(res, 404, { code: 'PGRST205', message: "Could not find the table 'public.booking_events' in the schema cache", details: null, hint: null })
  }
  if (url.pathname === '/finto/perdi-risposta-spese') { perdiRispostaSpese = url.searchParams.get('on') === '1'; return rispondi(res, 200, { perdiRispostaSpese }) }
  if (url.pathname === '/finto/spese-503') { spese503 = url.searchParams.get('on') === '1'; return rispondi(res, 200, { spese503 }) }
  if (url.pathname === '/finto/spese') return rispondi(res, 200, family_expenses)
  if (url.pathname === '/finto/errore-cambio-cliente') {
    erroreCambioCliente = url.searchParams.get('on') === '1'
    return rispondi(res, 200, { erroreCambioCliente })
  }
  if (erroreRichiesteWeb && url.pathname === '/rest/v1/bookings' && url.searchParams.get('source') === 'eq.sito_web') {
    return rispondi(res, 500, { code: 'FINTO', message: 'errore simulato sulla lettura delle richieste dal sito', details: null, hint: null })
  }
  if (url.pathname === '/auth/v1/token') return rispondi(res, 200, sessione())
  if (url.pathname === '/auth/v1/user') return rispondi(res, 200, utente)
  if (url.pathname === '/auth/v1/logout') return rispondi(res, 204)
  const m = url.pathname.match(/^\/rest\/v1\/(\w+)$/)
  // HEAD con count=exact (07/09/2026): il conteggio dei documenti del cliente nella
  // scheda prenotazione (RigaDocumentiPrenotazione) legge solo Content-Range
  if (m && req.method === 'HEAD') {
    const righe = interroga(m[1], url)
    return rispondi(res, 200, undefined, { 'Content-Range': `0-${righe.length}/${righe.length}` })
  }
  if (m && m[1] === 'family_expenses' && req.method === 'POST') {
    return leggiCorpo(req).then(corpo => {
      const righe = (Array.isArray(corpo) ? corpo : [corpo]).map(r => ({ id: randomUUID(), created_at: new Date().toISOString(), ...r }))
      for (const r of righe) {
        if (family_expenses.some(x => x.id === r.id)) return rispondi(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint "family_expenses_pkey"' })
        family_expenses.push(r)
      }
      console.log(`[finto supabase] spesa salvata: ${righe.map(r => `${r.id.slice(0, 8)} ${r.amount}`).join(', ')}${perdiRispostaSpese ? ' — RISPOSTA PERSA' : ''}`)
      if (perdiRispostaSpese) { res.socket.destroy(); return }
      if (spese503) return rispondi(res, 503, { message: 'upstream connect error' })
      return rispondi(res, 201, righe)
    })
  }
  if (m && req.method === 'GET') {
    const righe = interroga(m[1], url)
    const accept = req.headers.accept || ''
    if (accept.includes('vnd.pgrst.object')) {
      if (righe.length === 0) return rispondi(res, 406, { code: 'PGRST116', message: 'nessuna riga', details: null, hint: null })
      return rispondi(res, 200, righe[0])
    }
    return rispondi(res, 200, righe, { 'Content-Range': `0-${righe.length}/${righe.length}` })
  }
  // Cambia cliente (06/09/2026): le sole scritture accettate, in memoria
  if (m && req.method === 'POST' && m[1] === 'guests') {
    return leggiCorpo(req).then(corpo => {
      const riga = Array.isArray(corpo) ? corpo[0] : corpo
      if (!riga || !riga.phone) return rispondi(res, 400, { code: '23502', message: 'null value in column "phone"' })
      if (guests.some(g => String(g.phone).replace(/\D/g, '') === String(riga.phone).replace(/\D/g, ''))) return rispondi(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint "guests_phone_key"' })
      const nuovo = { ...ospite(`aaaaaaaa-${String(guests.length + 1).padStart(4, '0')}-4000-8000-0000000000${String(guests.length + 1).padStart(2, '0')}`, riga.full_name ?? null, riga.phone), provenienza: 'non_so', struttura_nome: null, ...riga }
      guests.push(nuovo)
      const accept = req.headers.accept || ''
      return rispondi(res, 201, accept.includes('vnd.pgrst.object') ? applicaSelect(nuovo, url.searchParams.get('select') || '*') : [applicaSelect(nuovo, url.searchParams.get('select') || '*')])
    })
  }
  if (m && req.method === 'PATCH' && (m[1] === 'bookings' || m[1] === 'documenti_cliente' || m[1] === 'guests')) {
    return leggiCorpo(req).then(corpo => {
      const chiavi = Object.keys(corpo || {})
      if (m[1] === 'bookings' && chiavi.some(k => !['guest_id', 'guest_name'].includes(k))) return rispondi(res, 403, { code: 'ANTEPRIMA', message: 'scrittura non ammessa nella preview sintetica' })
      if (m[1] === 'bookings' && erroreCambioCliente) return rispondi(res, 500, { code: 'FINTO', message: 'errore simulato sul cambio cliente' })
      const righe = righeFiltrate(m[1], url)
      // R4 (revisione 07/09/2026): trigger sintetico della 0042 — il cambio cliente
      // aggiunge DAVVERO una riga di cronologia, così la scheda deve rileggerla
      if (m[1] === 'bookings' && 'guest_id' in corpo) {
        for (const r of righe) {
          const prima = guests.find(g => g.id === r.guest_id), dopo = guests.find(g => g.id === corpo.guest_id)
          booking_events.push(evento(booking_events.length + 1, r.id, 0, 'cliente', { cliente: prima?.full_name ?? null, guest_id: r.guest_id }, { cliente: dopo?.full_name ?? null, guest_id: corpo.guest_id }))
        }
      }
      for (const r of righe) Object.assign(r, corpo)
      console.log(`[finto supabase] PATCH ${m[1]} ${righe.length} righe ←`, JSON.stringify(corpo))
      return rispondi(res, 200, righe.map(r => applicaSelect(r, url.searchParams.get('select') || '*')))
    })
  }
  if (m && req.method === 'POST' && m[1] === 'strutture') return rispondi(res, 201, [])
  // Nuova prenotazione (07/09/2026): l'inserimento in bookings si accetta in
  // memoria, per provare «prima camera → Aggiungi cambio camera → seconda camera»
  if (m && req.method === 'POST' && m[1] === 'bookings') {
    return leggiCorpo(req).then(corpo => {
      const riga = Array.isArray(corpo) ? corpo[0] : corpo
      if (!riga || !riga.room_id || !riga.guest_id) return rispondi(res, 400, { code: '23502', message: 'room_id o guest_id mancante' })
      const nuova = prenotazione(riga.room_id, riga.guest_id, riga.check_in, riga.check_out, riga.num_guests ?? 1, { ...riga })
      bookings.push(nuova)
      console.log(`[finto supabase] +1 prenotazione (${nuova.room_id.slice(-4)}, ${nuova.check_in}, cliente ${nuova.guest_id.slice(-4)}, guest_name ${nuova.guest_name ?? '—'})`)
      return rispondi(res, 201, [nuova])
    })
  }
  if (m) {
    // Scritture: rifiutate apposta. L'anteprima è solo lettura di dati finti.
    return rispondi(res, 403, { code: 'ANTEPRIMA', message: 'scrittura non ammessa nella preview sintetica' })
  }
  rispondi(res, 404, { message: `non gestito: ${req.method} ${url.pathname}` })
})

finto.listen(PORTA_FINTO, '127.0.0.1', () => {
  console.log(`[finto supabase] http://127.0.0.1:${PORTA_FINTO} (${bookings.length} prenotazioni sintetiche)`)
  const next = spawn(path.join(radice, 'node_modules', '.bin', 'next'), ['dev', '-p', String(PORTA_APP)], {
    cwd: radice,
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${PORTA_FINTO}`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'chiave-anon-finta',
    },
  })
  const chiudi = () => { next.kill(); finto.close(); process.exit(0) }
  process.on('SIGINT', chiudi)
  process.on('SIGTERM', chiudi)
  next.on('exit', code => { finto.close(); process.exit(code ?? 0) })
})
