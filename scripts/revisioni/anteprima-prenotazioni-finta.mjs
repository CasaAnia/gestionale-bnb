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
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const PORTA_FINTO = Number(process.env.PORTA_FINTO || 54329)
const PORTA_APP = Number(process.env.PORTA_APP || 3213)
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
  ospite('aaaaaaaa-0004-4000-8000-000000000004', 'Storico Amelia', '+39 333 000 0004'),
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
]

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
]
const payments = []
// Storico pulizie (migrazione 0018): vuoto, così la pagina Pulizie mostra solo le automatiche
const cleanings = []

const tabelle = { rooms, guests, bookings, payments, cleanings }
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

function interroga(tabella, url) {
  let righe = [...(tabelle[tabella] || [])]
  for (const [chiave, valore] of url.searchParams) {
    if (['select', 'order', 'limit', 'offset'].includes(chiave)) continue
    const m = valore.match(/^(\w+)\.(.*)$/)
    if (!m) continue
    righe = righe.filter(r => confronta(r[chiave], m[1], m[2]))
  }
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
// Si accende/spegne senza riavviare: GET /finto/errore-richieste-web?on=1|0
let erroreRichiesteWeb = process.env.FINTO_ERRORE_RICHIESTE_WEB === '1'

const finto = createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORTA_FINTO}`)
  if (req.method === 'OPTIONS') return rispondi(res, 204)
  if (url.pathname === '/finto/errore-richieste-web') {
    erroreRichiesteWeb = url.searchParams.get('on') === '1'
    return rispondi(res, 200, { erroreRichiesteWeb })
  }
  if (erroreRichiesteWeb && url.pathname === '/rest/v1/bookings' && url.searchParams.get('source') === 'eq.sito_web') {
    return rispondi(res, 500, { code: 'FINTO', message: 'errore simulato sulla lettura delle richieste dal sito', details: null, hint: null })
  }
  if (url.pathname === '/auth/v1/token') return rispondi(res, 200, sessione())
  if (url.pathname === '/auth/v1/user') return rispondi(res, 200, utente)
  if (url.pathname === '/auth/v1/logout') return rispondi(res, 204)
  const m = url.pathname.match(/^\/rest\/v1\/(\w+)$/)
  if (m && req.method === 'GET') {
    const righe = interroga(m[1], url)
    const accept = req.headers.accept || ''
    if (accept.includes('vnd.pgrst.object')) {
      if (righe.length === 0) return rispondi(res, 406, { code: 'PGRST116', message: 'nessuna riga', details: null, hint: null })
      return rispondi(res, 200, righe[0])
    }
    return rispondi(res, 200, righe, { 'Content-Range': `0-${righe.length}/${righe.length}` })
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
