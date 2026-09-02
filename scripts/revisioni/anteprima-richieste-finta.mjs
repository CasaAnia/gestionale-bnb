#!/usr/bin/env node
// Anteprima SENZA RETE delle Richieste di prenotazione (pezzo 1 di 8).
//
// Come anteprima-prenotazioni-finta.mjs: un finto Supabase locale (login +
// PostgREST minimale) e il dev server di Next puntato su di lui. Nessuna
// richiesta raggiunge il progetto vero. In più qui la tabella `richieste`
// ACCETTA gli inserimenti (in memoria, persi alla chiusura) per provare il
// modulo "Nuova richiesta" fino in fondo. Cognome «Errore» → il finto
// risponde 500, per vedere il messaggio d'errore a schermo.
//
// Uso: node scripts/revisioni/anteprima-richieste-finta.mjs
//   → finto Supabase su http://127.0.0.1:54330, app su http://localhost:3214
//   → login con qualsiasi email/password
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

const PORTA_FINTO = Number(process.env.PORTA_FINTO || 54330)
const PORTA_APP = Number(process.env.PORTA_APP || 3214)
const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const ROOM = {
  amelia: '11111111-1111-4111-8111-111111111111',
  allegra: '22222222-2222-4222-8222-222222222222',
  ambra: '33333333-3333-4333-8333-333333333333',
  lena: '19ae4611-c0a4-42ae-8530-210f9a948e9e',
}
const ora = new Date().toISOString()
const fa = (min) => new Date(Date.now() - min * 60000).toISOString()
const giorni = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

function camera(id, name, bathroom_type) {
  return { id, name, bathroom_type, bathroom_note: null, base_price: 70, has_extra_bed: true, extra_bed_price: 10, active: true, created_at: ora }
}
const rooms = [
  camera(ROOM.amelia, 'Amelia', 'privato_interno'),
  camera(ROOM.allegra, 'Allegra', 'privato_interno'),
  camera(ROOM.ambra, 'Ambra', 'privato_interno'),
  camera(ROOM.lena, 'Lena', 'privato_esterno'),
  { ...camera('44444444-4444-4444-8444-444444444444', 'Camera 1', 'privato_interno'), active: false },
]
const guests = [{ id: 'aaaaaaaa-0001-4000-8000-000000000001', phone: '+39 333 000 0001', full_name: 'Ospite Finto', email: null, rating: 'normale', notes: null, created_at: ora, updated_at: ora }]
// Prenotazioni intorno a fra 10 giorni: Amelia e Ambra occupate, Allegra in
// attesa (NON conta), Lena annullata (NON conta).
const bookings = [
  { id: 'bbbbbbbb-0001-4000-8000-000000000001', room_id: ROOM.amelia, guest_id: guests[0].id, check_in: giorni(9), check_out: giorni(12), num_guests: 2, status: 'confermata', pagato: true, guest_name: 'Pagata Piena' },
  { id: 'bbbbbbbb-0002-4000-8000-000000000002', room_id: ROOM.ambra, guest_id: guests[0].id, check_in: giorni(11), check_out: giorni(13), num_guests: 1, status: 'confermata', bonifico: true, guest_name: 'Bonifico Attesa' },
  // Cambio camera: stesso group_id, Lena poi Allegra
  { id: 'bbbbbbbb-0005-4000-8000-000000000005', room_id: ROOM.lena, guest_id: guests[0].id, check_in: giorni(2), check_out: giorni(4), num_guests: 3, status: 'confermata', group_id: 'gggggggg-0001-4000-8000-000000000001', extra_bed: true, extra_bed_dates: [giorni(2), giorni(3)], guest_name: 'Cambio Camera' },
  { id: 'bbbbbbbb-0006-4000-8000-000000000006', room_id: ROOM.allegra, guest_id: guests[0].id, check_in: giorni(4), check_out: giorni(6), num_guests: 3, status: 'confermata', group_id: 'gggggggg-0001-4000-8000-000000000001', guest_name: 'Cambio Camera' },
  { id: 'bbbbbbbb-0007-4000-8000-000000000007', room_id: ROOM.lena, guest_id: guests[0].id, check_in: giorni(21), check_out: giorni(23), num_guests: 2, status: 'completata', guest_name: 'Sotto Richiesta' },
  { id: 'bbbbbbbb-0003-4000-8000-000000000003', room_id: ROOM.allegra, guest_id: guests[0].id, check_in: giorni(10), check_out: giorni(12), num_guests: 2, status: 'in_attesa' },
  { id: 'bbbbbbbb-0004-4000-8000-000000000004', room_id: ROOM.lena, guest_id: guests[0].id, check_in: giorni(10), check_out: giorni(12), num_guests: 2, status: 'annullata' },
].map(b => ({ extra_bed: false, extra_bed_dates: [], price_per_night: 70, extra_bed_total: 0, total_amount: 140, source: 'diretta', guest_name: null, notes: null, cancelled_at: null, cancelled_reason: null, group_id: null, pagato: false, bonifico: false, created_at: ora, updated_at: ora, ...b }))

function richiesta(x) {
  return { id: randomUUID(), created_at: ora, camera_id: null, telefono: null, note: null, stato: 'in_attesa', proposta_inviata_at: null, chiusa_at: null, prenotazione_id: null, ...x }
}
const richieste = [
  richiesta({ nome: 'Anna', cognome: 'Rossi', arrivo: giorni(11), partenza: giorni(13), persone: 2, canale: 'web', created_at: fa(20) }),
  richiesta({ nome: 'Marek', cognome: 'Kowalski', arrivo: giorni(20), partenza: giorni(25), persone: 3, camera_id: ROOM.lena, canale: 'whatsapp', telefono: '+39 333 000 0002', created_at: fa(60 * 11) }),
  richiesta({ nome: 'Luca', cognome: 'Bianchi', arrivo: giorni(5), partenza: giorni(6), persone: 1, canale: 'telefono', created_at: fa(60 * 30), stato: 'proposta_inviata', proposta_inviata_at: fa(60 * 3) }),
  // Sovrapposta a Rossi (stessa riga «qualsiasi»): nel calendario diventano una barra sola «2 richieste ⇄»
  richiesta({ nome: 'Piotr', cognome: 'Nowak', arrivo: giorni(12), partenza: giorni(14), persone: 2, canale: 'telefono', telefono: '+39 333 000 0009', created_at: fa(90) }),
  richiesta({ nome: 'Sara', cognome: 'Verdi', arrivo: giorni(30), partenza: giorni(35), persone: 4, canale: 'web', created_at: fa(5), note: 'Chiede due camere vicine' }),
  richiesta({ nome: 'Paolo', cognome: 'Neri', arrivo: giorni(-3), partenza: giorni(-1), persone: 2, canale: 'telefono', created_at: fa(60 * 24 * 8), stato: 'confermata', chiusa_at: fa(60 * 24 * 7) }),
  richiesta({ nome: 'Giulia', cognome: 'Gallo', arrivo: giorni(2), partenza: giorni(4), persone: 2, canale: 'whatsapp', created_at: fa(60 * 24 * 2), stato: 'rifiutata', chiusa_at: fa(60 * 24) }),
  richiesta({ nome: 'Vecchia', cognome: 'Chiusa', arrivo: giorni(-120), partenza: giorni(-118), persone: 1, canale: 'web', created_at: fa(60 * 24 * 130), stato: 'confermata', chiusa_at: fa(60 * 24 * 120) }),
]

const payments = [{ id: 'pppppppp-0001-4000-8000-000000000001', booking_id: 'bbbbbbbb-0006-4000-8000-000000000006', amount: 70 }]
const tabelle = { rooms, guests, bookings, richieste, payments }
const chiaveEsterna = {
  bookings: { guests: 'guest_id', rooms: 'room_id' },
  richieste: { rooms: 'camera_id' },
}

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
    case 'in': return String(a).replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, '')).includes(String(valore))
    default: return true
  }
}
function applicaSelect(tabella, riga, select) {
  if (!select || select === '*') return { ...riga }
  const out = {}
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
      const fk = chiaveEsterna[tabella]?.[tab]
      const collegata = (tabelle[tab] || []).find(r => r.id === riga[fk])
      out[tab] = collegata ? applicaSelect(tab, collegata, cols) : null
    } else if (p === '*') Object.assign(out, riga)
    else out[p] = riga[p]
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
  return righe.map(r => applicaSelect(tabella, r, url.searchParams.get('select') || '*'))
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
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Range',
}
function rispondi(res, stato, corpo, extra = {}) {
  res.writeHead(stato, { 'Content-Type': 'application/json', ...cors, ...extra })
  res.end(corpo === undefined ? '' : JSON.stringify(corpo))
}
const leggiCorpo = req => new Promise(ok => { let s = ''; req.on('data', c => { s += c }); req.on('end', () => ok(s)) })

const finto = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORTA_FINTO}`)
  if (req.method === 'OPTIONS') return rispondi(res, 204)
  if (url.pathname === '/auth/v1/token') return rispondi(res, 200, sessione())
  if (url.pathname === '/auth/v1/user') return rispondi(res, 200, utente)
  if (url.pathname === '/auth/v1/logout') return rispondi(res, 204)
  const m = url.pathname.match(/^\/rest\/v1\/(\w+)$/)
  if (m && (req.method === 'GET' || req.method === 'HEAD')) {
    const righe = interroga(m[1], url)
    const range = { 'Content-Range': righe.length ? `0-${righe.length - 1}/${righe.length}` : `*/0` }
    if (req.method === 'HEAD') { res.writeHead(200, { ...cors, ...range }); return res.end() }
    if ((req.headers.accept || '').includes('vnd.pgrst.object')) {
      if (righe.length === 0) return rispondi(res, 406, { code: 'PGRST116', message: 'nessuna riga', details: null, hint: null })
      return rispondi(res, 200, righe[0])
    }
    return rispondi(res, 200, righe, range)
  }
  if (m && m[1] === 'richieste' && req.method === 'POST') {
    const corpo = JSON.parse(await leggiCorpo(req) || '{}')
    const nuove = (Array.isArray(corpo) ? corpo : [corpo]).map(r => richiesta(r))
    if (nuove.some(r => r.cognome === 'Errore')) return rispondi(res, 500, { code: 'FINTO', message: 'errore simulato dal finto Supabase', details: null, hint: null })
    if (nuove.some(r => !(r.partenza > r.arrivo))) return rispondi(res, 400, { code: '23514', message: 'new row violates check constraint "richieste_partenza_dopo_arrivo"', details: null, hint: null })
    richieste.push(...nuove)
    console.log(`[finto supabase] +${nuove.length} richiesta/e (${richieste.length} in tutto)`)
    const select = url.searchParams.get('select') || '*'
    const out = nuove.map(r => applicaSelect('richieste', r, select))
    if ((req.headers.accept || '').includes('vnd.pgrst.object')) return rispondi(res, 201, out[0])
    return rispondi(res, 201, out)
  }
  if (m) return rispondi(res, 403, { code: 'ANTEPRIMA', message: 'scrittura non ammessa nella preview sintetica' })
  rispondi(res, 404, { message: `non gestito: ${req.method} ${url.pathname}` })
})

finto.listen(PORTA_FINTO, '127.0.0.1', () => {
  console.log(`[finto supabase] http://127.0.0.1:${PORTA_FINTO} (${richieste.length} richieste sintetiche)`)
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
