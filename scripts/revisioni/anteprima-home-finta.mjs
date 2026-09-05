#!/usr/bin/env node
// Anteprima SENZA RETE della Home «Da controllare» (versione B, 06/09/2026).
//
// Finto Supabase locale (login + PostgREST minimale su dati sintetici, come
// anteprima-prenotazioni-finta.mjs) + dev server di Next che punta al finto:
// nessuna richiesta raggiunge il progetto vero. Le date sono RELATIVE a oggi,
// così lo scenario resta valido in qualunque giorno lo si apra.
//
// Uso: node scripts/revisioni/anteprima-home-finta.mjs
//   → finto Supabase su http://127.0.0.1:54330, app su http://localhost:3215
//   → login con qualsiasi email/password
//
// Scenario (oggi = O):
//   Calendario  Amelia: «Anna Rossi» O−1→O+3 e «Marco Bianchi» O+1→O+4 → sovrapposte (alta)
//               Letti: O+10 tre camere con letto aggiuntivo → 3 su 2 (alta)
//               Cambio camera: «Lucia Verdi» Ambra O+5→O+7 poi Lena O+7→O+9 (stesso gruppo): NON compare
//   Arrivi      «Marco Bianchi» arriva domani senza orario (alta, WhatsApp + Apri arrivo);
//               «Senza Numero» domani senza orario e senza telefono (solo Apri arrivo); «Paola Neri» con orario: no
//   Pagamenti   «Giulio Gallo» Allegra O−6→O−4 pagato=true con movimenti 100 su 160 → Registra saldo
//               «Sara Sarti» Ambra O−12→O−10 non pagata → Registra saldo
//               «Elena Esposito» Lena O−20→O−18 pagata e coperta → NON compare
//   Richieste   «Carla Conti» in attesa da 3 giorni; «Dario Deluca» proposta scaduta 5 ore fa (alta, WhatsApp ghost);
//               «Franca Fabbri» in attesa da 1 ora → no; «Gino Galli» confermata → no
//   Fatture     «Enel» 95,50 € scaduta il O−5; «Iren» in scadenza O+10 → no
//   Tre numeri  arrivi oggi 1 («Arriva Oggi»), partenze oggi 1 («Parte Oggi»), camere occupate stanotte 2 su 4 (Amelia, Allegra)
//   Striscia    oggi «✓» (Ambra fatta, Allegra pronta per l'arrivo), domani «1» (parte «Arriva Oggi» da Allegra)
//   Rinvii      tabella da_controllare_rinvii IN MEMORIA (upsert accettato);
//               GET /finto/senza-rinvii?on=1 la fa sparire (PGRST205) per provare l'avviso
//   Errore      GET /finto/errore-richieste?on=1 fa fallire la lettura di `richieste`
//               («Non riesco a controllare, riprova»); GET /finto/errore-oggi?on=1 fa fallire
//               la lettura dei tre numeri (trattini + avviso con Riprova)
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const PORTA_FINTO = Number(process.env.PORTA_FINTO || 54330)
const PORTA_APP = Number(process.env.PORTA_APP || 3215)
const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const LENA_ID = '19ae4611-c0a4-42ae-8530-210f9a948e9e'
const ROOM = {
  amelia: '11111111-1111-4111-8111-111111111111',
  allegra: '22222222-2222-4222-8222-222222222222',
  ambra: '33333333-3333-4333-8333-333333333333',
  lena: LENA_ID,
}
const adesso = new Date()
const due = n => String(n).padStart(2, '0')
const ymd = d => `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`
const O = n => { const d = new Date(adesso); d.setDate(d.getDate() + n); return ymd(d) }
const oreFa = h => new Date(adesso.getTime() - h * 3600000).toISOString()
const ora = oreFa(24 * 30)

function camera(id, name, base_price, has_extra_bed, bathroom_type, double_price = null) {
  return { id, name, bathroom_type, bathroom_note: null, base_price, has_extra_bed, extra_bed_price: 10, double_price, active: true, created_at: ora }
}
const rooms = [
  camera(ROOM.amelia, 'Amelia', 50, true, 'privato_interno'),
  camera(ROOM.allegra, 'Allegra', 70, true, 'privato_interno'),
  camera(ROOM.ambra, 'Ambra', 70, true, 'privato_interno'),
  camera(ROOM.lena, 'Lena', 80, true, 'privato_esterno', 90),
]

let g = 0
function ospite(full_name, phone) {
  g += 1
  return { id: `aaaaaaaa-${due(g).padStart(4, '0')}-4000-8000-${String(g).padStart(12, '0')}`, phone, full_name, email: null, document_type: null, document_number: null, nationality: null, birth_date: null, birth_place: null, rating: 'normale', notes: null, created_at: ora, updated_at: ora }
}
const G = {
  anna: ospite('Anna Rossi', '+39 333 000 0001'),
  marco: ospite('Marco Bianchi', '+39 333 000 0002'),
  lucia: ospite('Lucia Verdi', '+39 333 000 0003'),
  paola: ospite('Paola Neri', '+39 333 000 0004'),
  giulio: ospite('Giulio Gallo', '+39 333 000 0005'),
  sara: ospite('Sara Sarti', '+39 333 000 0006'),
  elena: ospite('Elena Esposito', '+39 333 000 0007'),
  letto1: ospite('Letto Uno', '+39 333 000 0008'),
  letto2: ospite('Letto Due', '+39 333 000 0009'),
  letto3: ospite('Letto Tre', '+39 333 000 0010'),
  senza: ospite('Senza Numero', null),      // arriva domani senza orario e SENZA telefono (ritocchi 07/09/2026)
  oggiIn: ospite('Arriva Oggi', '+39 333 000 0011'),
  oggiOut: ospite('Parte Oggi', '+39 333 000 0012'),
}
const guests = Object.values(G)

let n = 0
function prenotazione(room_id, guest_id, check_in, check_out, num_guests, extra) {
  n += 1
  const id = `bbbbbbbb-${String(n).padStart(4, '0')}-4000-8000-${String(n).padStart(12, '0')}`
  return {
    id, room_id, guest_id, check_in, check_out, num_guests,
    extra_bed: false, extra_bed_dates: [], price_per_night: 80, extra_bed_total: 0,
    total_amount: 160, discount_type: null, discount_value: null,
    status: 'confermata', source: 'diretta', guest_name: null, notes: null,
    cancelled_at: null, cancelled_reason: null, group_id: null,
    pagato: false, bonifico: false, color: null, check_in_time: null, shuttle: null,
    created_at: ora, updated_at: ora,
    ...extra,
  }
}
const GRUPPO_LUCIA = 'cccccccc-1111-4000-8000-000000000001'
const bookings = [
  prenotazione(ROOM.amelia, G.anna.id, O(-1), O(3), 2, { total_amount: 320, check_in_time: '14:00' }),
  prenotazione(ROOM.amelia, G.marco.id, O(1), O(4), 2, { total_amount: 240 }),                 // sovrapposta + arrivo domani senza orario
  prenotazione(ROOM.ambra, G.lucia.id, O(5), O(7), 2, { group_id: GRUPPO_LUCIA, total_amount: 140 }),
  prenotazione(ROOM.lena, G.lucia.id, O(7), O(9), 2, { group_id: GRUPPO_LUCIA, total_amount: 160 }),
  prenotazione(ROOM.allegra, G.paola.id, O(1), O(3), 2, { check_in_time: '16:30' }),
  prenotazione(ROOM.lena, G.senza.id, O(1), O(2), 1, { total_amount: 80 }),                    // domani, senza orario né numero
  prenotazione(ROOM.allegra, G.oggiIn.id, O(0), O(1), 2, { check_in_time: '15:00' }),          // tre numeri: arriva oggi
  prenotazione(ROOM.ambra, G.oggiOut.id, O(-3), O(0), 2, { pagato: true }),                    // tre numeri: parte oggi
  prenotazione(ROOM.allegra, G.giulio.id, O(-6), O(-4), 2, { status: 'completata', pagato: true }),
  prenotazione(ROOM.ambra, G.sara.id, O(-12), O(-10), 2, { status: 'completata' }),
  prenotazione(ROOM.lena, G.elena.id, O(-20), O(-18), 2, { status: 'completata', pagato: true }),
  prenotazione(ROOM.allegra, G.letto1.id, O(10), O(12), 3, { extra_bed: true, extra_bed_dates: [O(10), O(11)], extra_bed_total: 20, total_amount: 180 }),
  prenotazione(ROOM.ambra, G.letto2.id, O(10), O(12), 3, { extra_bed: true, extra_bed_dates: [O(10), O(11)], extra_bed_total: 20, total_amount: 180 }),
  prenotazione(ROOM.lena, G.letto3.id, O(10), O(11), 3, { extra_bed: true, extra_bed_dates: [O(10)], extra_bed_total: 10, total_amount: 100 }),
]
const P = id => bookings.find(b => b.guest_id === id).id
const payments = [
  { id: 'dddddddd-0001-4000-8000-000000000001', booking_id: P(G.giulio.id), amount: 100, method: 'contanti', paid_on: O(-6), created_at: ora },
  { id: 'dddddddd-0002-4000-8000-000000000002', booking_id: P(G.elena.id), amount: 160, method: 'bonifico', paid_on: O(-20), created_at: ora },
]
// Pulizie segnate (08/09/2026, striscia «solo da fare»): la partenza di Giulio da Allegra
// e quella di «Parte Oggi» da Ambra sono fatte → oggi la casella mostra «✓»; domani
// resta da fare la partenza di «Arriva Oggi» da Allegra → «1»
const cleanings = [
  { id: 'cccccccc-0001-4000-8000-000000000001', room_id: ROOM.allegra, booking_id: P(G.giulio.id), tipo: 'fine_soggiorno', stato: 'fatta', data_prevista: O(-4), data_effettiva: O(-4), prossima_data: null, cambio_biancheria: true, note: null, created_at: new Date(adesso.getTime() - 4 * 86400000).toISOString() },
  { id: 'cccccccc-0002-4000-8000-000000000002', room_id: ROOM.ambra, booking_id: P(G.oggiOut.id), tipo: 'fine_soggiorno', stato: 'fatta', data_prevista: O(0), data_effettiva: O(0), prossima_data: null, cambio_biancheria: true, note: null, created_at: adesso.toISOString() },
]

let r = 0
function richiesta(nome, cognome, stato, arrivo, partenza, created_at, proposta_inviata_at = null) {
  r += 1
  return { id: `eeeeeeee-${String(r).padStart(4, '0')}-4000-8000-${String(r).padStart(12, '0')}`, created_at, nome, cognome, arrivo, partenza, persone: 2, camera_id: null, canale: 'telefono', telefono: '+39 333 111 0000', note: null, stato, proposta_inviata_at, chiusa_at: null, prenotazione_id: null, origine: null, persone_per_notte: null, proposta_testo: null, proposta_soluzione: null }
}
// Provenienza (08/09/2026): colonne della proposta 0036 sulle richieste/prenotazioni e tabella strutture;
// GET /finto/senza-strutture?on=1 simula la 0036 NON applicata (campo nascosto con avviso)
const strutture = ['Umana', 'Nida', 'RB (Rosa Bianca)', 'Elyse', 'BM (Borgo Manzoni)'].map(nome => ({ nome, created_at: ora }))
for (const b of bookings) { b.provenienza = b.provenienza ?? 'non_so'; b.struttura_nome = b.struttura_nome ?? null }
bookings.find(b => b.guest_id === G.giulio.id).provenienza = 'altra_struttura'; bookings.find(b => b.guest_id === G.giulio.id).struttura_nome = 'Nida'
bookings.find(b => b.guest_id === G.sara.id).provenienza = 'altra_struttura'; bookings.find(b => b.guest_id === G.sara.id).struttura_nome = 'Umana'
bookings.find(b => b.guest_id === G.elena.id).provenienza = 'google'
bookings.find(b => b.guest_id === G.anna.id).provenienza = 'passaparola'
const richieste = [
  richiesta('Carla', 'Conti', 'in_attesa', O(8), O(11), oreFa(72)),
  richiesta('Dario', 'Deluca', 'proposta_inviata', O(12), O(14), oreFa(30), oreFa(5)),
  richiesta('Franca', 'Fabbri', 'in_attesa', O(15), O(17), oreFa(1)),
  richiesta('Gino', 'Galli', 'confermata', O(2), O(4), oreFa(100)),
]
for (const r of richieste) { r.provenienza = 'non_so'; r.struttura_nome = null }
richieste[1].provenienza = 'altra_struttura'; richieste[1].struttura_nome = 'Nida'
const family_documents = [
  { id: 'ffffffff-0001-4000-8000-000000000001', kind: 'fattura', status: 'approvata_da_pagare', doc_total: 95.5, supplier: 'Enel', invoice_number: '123', document_date: O(-30), due_date: O(-5), upload_ambito: 'azienda', error_message: null, note: null, doc_total_derivato: false, created_at: ora },
  { id: 'ffffffff-0002-4000-8000-000000000002', kind: 'fattura', status: 'approvata_da_pagare', doc_total: 40, supplier: 'Iren', invoice_number: '456', document_date: O(-10), due_date: O(10), upload_ambito: 'azienda', error_message: null, note: null, doc_total_derivato: false, created_at: ora },
]
const da_controllare_rinvii = []

const tabelle = { rooms, guests, bookings, payments, cleanings, richieste, family_documents, da_controllare_rinvii, strutture }
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
      const collegata = (tabelle[tab] || []).find(x => x.id === riga[fk])
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
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(chiave)) continue
    const m = valore.match(/^(\w+)\.(.*)$/)
    if (!m) continue
    righe = righe.filter(x => confronta(x[chiave], m[1], m[2]))
  }
  const order = url.searchParams.get('order')
  if (order) {
    const [col, dir] = order.split('.')
    righe.sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (dir === 'desc' ? -1 : 1))
  }
  const limit = url.searchParams.get('limit')
  if (limit) righe = righe.slice(0, Number(limit))
  return righe.map(x => applicaSelect(x, url.searchParams.get('select') || '*'))
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
function leggiCorpo(req) {
  return new Promise(resolve => { let s = ''; req.on('data', c => { s += c }); req.on('end', () => { try { resolve(JSON.parse(s || 'null')) } catch { resolve(null) } }) })
}

// Interruttori (senza riavviare): GET /finto/senza-rinvii?on=1|0 · GET /finto/errore-richieste?on=1|0
let senzaRinvii = process.env.FINTO_SENZA_RINVII === '1'
let erroreRichieste = process.env.FINTO_ERRORE_RICHIESTE === '1'
// Tre numeri (07/09/2026): GET /finto/errore-oggi?on=1 fa fallire la lettura delle prenotazioni di oggi (check_in=lte.…)
let erroreOggi = process.env.FINTO_ERRORE_OGGI === '1'
let senzaStrutture = process.env.FINTO_SENZA_STRUTTURE === '1'

const finto = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORTA_FINTO}`)
  if (req.method === 'OPTIONS') return rispondi(res, 204)
  if (url.pathname === '/finto/senza-rinvii') { senzaRinvii = url.searchParams.get('on') === '1'; return rispondi(res, 200, { senzaRinvii }) }
  if (url.pathname === '/finto/errore-richieste') { erroreRichieste = url.searchParams.get('on') === '1'; return rispondi(res, 200, { erroreRichieste }) }
  if (url.pathname === '/finto/errore-oggi') { erroreOggi = url.searchParams.get('on') === '1'; return rispondi(res, 200, { erroreOggi }) }
  if (url.pathname === '/finto/senza-strutture') { senzaStrutture = url.searchParams.get('on') === '1'; return rispondi(res, 200, { senzaStrutture }) }
  if (senzaStrutture && url.pathname === '/rest/v1/strutture') {
    return rispondi(res, 404, { code: 'PGRST205', message: "Could not find the table 'public.strutture' in the schema cache", details: null, hint: null })
  }
  if (erroreOggi && url.pathname === '/rest/v1/bookings' && (url.searchParams.get('check_in') || '').startsWith('lte.')) {
    return rispondi(res, 500, { code: 'FINTO', message: 'errore simulato sulla lettura delle prenotazioni di oggi', details: null, hint: null })
  }
  if (url.pathname === '/auth/v1/token') return rispondi(res, 200, sessione())
  if (url.pathname === '/auth/v1/user') return rispondi(res, 200, utente)
  if (url.pathname === '/auth/v1/logout') return rispondi(res, 204)
  const m = url.pathname.match(/^\/rest\/v1\/(\w+)$/)
  if (m && m[1] === 'da_controllare_rinvii' && senzaRinvii) {
    return rispondi(res, 404, { code: 'PGRST205', message: "Could not find the table 'public.da_controllare_rinvii' in the schema cache", details: null, hint: null })
  }
  if (m && m[1] === 'richieste' && erroreRichieste) {
    return rispondi(res, 500, { code: 'FINTO', message: 'errore simulato sulla lettura delle richieste', details: null, hint: null })
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
  if (m && m[1] === 'da_controllare_rinvii' && req.method === 'POST') {
    // upsert su chiave, in memoria: il rinvio vale finché il finto resta acceso
    const corpo = await leggiCorpo(req)
    const righe = Array.isArray(corpo) ? corpo : [corpo]
    for (const riga of righe) {
      if (!riga?.chiave) return rispondi(res, 400, { code: '23502', message: 'chiave mancante' })
      const i = da_controllare_rinvii.findIndex(x => x.chiave === riga.chiave)
      const nuova = { chiave: riga.chiave, fino_a: riga.fino_a, created_at: new Date().toISOString() }
      if (i >= 0) da_controllare_rinvii[i] = nuova; else da_controllare_rinvii.push(nuova)
    }
    console.log(`[finto supabase] rinvii: ${da_controllare_rinvii.map(x => `${x.chiave}→${x.fino_a}`).join(', ')}`)
    return rispondi(res, 201, righe)
  }
  if (m) return rispondi(res, 403, { code: 'ANTEPRIMA', message: 'scrittura non ammessa nella preview sintetica' })
  rispondi(res, 404, { message: `non gestito: ${req.method} ${url.pathname}` })
})

finto.listen(PORTA_FINTO, '127.0.0.1', () => {
  console.log(`[finto supabase] http://127.0.0.1:${PORTA_FINTO} (oggi ${ymd(adesso)}, ${bookings.length} prenotazioni, ${richieste.length} richieste)`)
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
