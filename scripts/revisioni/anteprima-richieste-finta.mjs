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
import { nomeCompleto } from '../../lib/guestName.ts'

// Endpoint POST /api/richieste/web provabile in locale (pezzo 7, verifica 5B):
// segreto LOCALE «prova-locale» (mai quello vero), service key finta (il finto
// non la controlla) e chiavi Pushover NON valide, così da questa anteprima non
// può partire nessun avviso reale. Le variabili già nel processo vincono su
// .env.local. Prova: curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3214/api/richieste/web → 401
process.env.RICHIESTE_WEB_SECRET ??= 'prova-locale'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'chiave-service-finta'
process.env.PUSHOVER_TOKEN ??= 'token-non-valido-prova-locale'
process.env.PUSHOVER_USER ??= 'utente-non-valido-prova-locale'

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

function camera(id, name, bathroom_type, base_price = 80, extra_bed_price = 10, double_price = null) {
  return { id, name, bathroom_type, bathroom_note: null, base_price, has_extra_bed: true, extra_bed_price, double_price, active: true, created_at: ora }
}
const rooms = [
  camera(ROOM.amelia, 'Amelia', 'privato_interno', 70, 5),
  camera(ROOM.allegra, 'Allegra', 'privato_interno'),
  camera(ROOM.ambra, 'Ambra', 'privato_interno'),
  camera(ROOM.lena, 'Lena', 'privato_esterno', 80, 10, 90),
  { ...camera('44444444-4444-4444-8444-444444444444', 'Camera 1', 'privato_interno'), active: false },
]
const guests = [
  { id: 'aaaaaaaa-0001-4000-8000-000000000001', phone: '+39 333 000 0001', full_name: 'Ospite Finto', email: null, rating: 'normale', notes: null, created_at: ora, updated_at: ora },
  // Veste nuova della proposta (11/09/2026): una cliente che torna, con la
  // valutazione ottima e la ricevuta, per la testa del cliente e «Da controllare»
  { id: 'aaaaaaaa-0002-4000-8000-000000000002', phone: '+39 333 000 0080', full_name: 'Carmela Sabia', email: null, rating: 'ottimo', vuole_ricevuta: true, motivo_problematico: null, provenienza: 'altra_struttura', struttura_nome: 'Nida', notes: 'Dorme male con i rumori: darle la camera sul cortile.', created_at: ora, updated_at: ora },
  { id: 'aaaaaaaa-0003-4000-8000-000000000003', phone: '+39 333 000 0303', full_name: 'Rosa Archivio', email: null, rating: 'normale', vuole_ricevuta: true, motivo_problematico: null, notes: null, created_at: ora, updated_at: ora },
]
// Prenotazioni intorno a fra 10 giorni: Amelia e Ambra occupate, Allegra in
// attesa (NON conta), Lena annullata (NON conta).
const bookings = [
  { id: 'bbbbbbbb-0001-4000-8000-000000000001', room_id: ROOM.amelia, guest_id: guests[0].id, check_in: giorni(9), check_out: giorni(12), num_guests: 2, status: 'confermata', pagato: true, guest_name: 'Pagata Piena' },
  { id: 'bbbbbbbb-0002-4000-8000-000000000002', room_id: ROOM.ambra, guest_id: guests[0].id, check_in: giorni(11), check_out: giorni(13), num_guests: 1, status: 'confermata', bonifico: true, guest_name: 'Bonifico Attesa' },
  // Cambio camera: stesso group_id, Lena poi Allegra
  { id: 'bbbbbbbb-0005-4000-8000-000000000005', room_id: ROOM.lena, guest_id: guests[0].id, check_in: giorni(2), check_out: giorni(4), num_guests: 3, status: 'confermata', group_id: 'gggggggg-0001-4000-8000-000000000001', extra_bed: true, extra_bed_dates: [giorni(2), giorni(3)], guest_name: 'Cambio Camera' },
  { id: 'bbbbbbbb-0006-4000-8000-000000000006', room_id: ROOM.allegra, guest_id: guests[0].id, check_in: giorni(4), check_out: giorni(6), num_guests: 3, status: 'confermata', group_id: 'gggggggg-0001-4000-8000-000000000001', guest_name: 'Cambio Camera' },
  { id: 'bbbbbbbb-0007-4000-8000-000000000007', room_id: ROOM.lena, guest_id: guests[0].id, check_in: giorni(21), check_out: giorni(23), num_guests: 2, status: 'completata', guest_name: 'Sotto Richiesta' },
  // Quadrupla in Lena: prende ENTRAMBI i letti del pool per le notti +14 e +15
  { id: 'bbbbbbbb-0008-4000-8000-000000000008', room_id: ROOM.lena, guest_id: guests[0].id, check_in: giorni(14), check_out: giorni(16), num_guests: 4, status: 'confermata', extra_bed: true, extra_bed_dates: [giorni(14), giorni(15)], extra_bed_total: 20, guest_name: 'Quadrupla Piena' },
  // Tutte e quattro le camere occupate la notte +51: la richiesta Lis 50–53 dà il caso C con la notte scoperta in mezzo
  { id: 'bbbbbbbb-0009-4000-8000-000000000009', room_id: ROOM.amelia, guest_id: guests[0].id, check_in: giorni(51), check_out: giorni(52), num_guests: 1, status: 'confermata', guest_name: 'Buco Amelia' },
  { id: 'bbbbbbbb-0010-4000-8000-000000000010', room_id: ROOM.allegra, guest_id: guests[0].id, check_in: giorni(51), check_out: giorni(52), num_guests: 2, status: 'confermata', guest_name: 'Buco Allegra' },
  { id: 'bbbbbbbb-0011-4000-8000-000000000011', room_id: ROOM.ambra, guest_id: guests[0].id, check_in: giorni(51), check_out: giorni(52), num_guests: 2, status: 'confermata', guest_name: 'Buco Ambra' },
  { id: 'bbbbbbbb-0012-4000-8000-000000000012', room_id: ROOM.lena, guest_id: guests[0].id, check_in: giorni(51), check_out: giorni(52), num_guests: 2, status: 'confermata', guest_name: 'Buco Lena' },
  // Pezzo 10: Lena occupata le notti +71/+72/+73 → per la richiesta «Composta» (in 2 poi in 3) l'automatico propone Ambra/Allegra e il riquadro spiega Lena e Amelia
  { id: 'bbbbbbbb-0013-4000-8000-000000000013', room_id: ROOM.lena, guest_id: guests[0].id, check_in: giorni(71), check_out: giorni(74), num_guests: 2, status: 'confermata', guest_name: 'Occupa Lena' },
  { id: 'bbbbbbbb-0003-4000-8000-000000000003', room_id: ROOM.allegra, guest_id: guests[0].id, check_in: giorni(10), check_out: giorni(12), num_guests: 2, status: 'in_attesa' },
  { id: 'bbbbbbbb-0004-4000-8000-000000000004', room_id: ROOM.lena, guest_id: guests[0].id, check_in: giorni(10), check_out: giorni(12), num_guests: 2, status: 'annullata' },
  // Rosa Archivio: solo una prenotazione FUTURA, nessun soggiorno concluso
  { id: 'bbbbbbbb-0030-4000-8000-000000000030', room_id: ROOM.ambra, guest_id: 'aaaaaaaa-0003-4000-8000-000000000003', check_in: giorni(200), check_out: giorni(202), num_guests: 2, status: 'confermata', total_amount: 160, guest_name: 'Rosa Archivio' },
  // Due soggiorni conclusi di Carmela Sabia: 680 + 680 = 1.360 € nella testa del cliente
  { id: 'bbbbbbbb-0020-4000-8000-000000000020', room_id: ROOM.ambra, guest_id: guests[1].id, check_in: giorni(-400), check_out: giorni(-396), num_guests: 2, status: 'completata', total_amount: 680, guest_name: 'Carmela Sabia' },
  { id: 'bbbbbbbb-0021-4000-8000-000000000021', room_id: ROOM.ambra, guest_id: guests[1].id, check_in: giorni(-140), check_out: giorni(-132), num_guests: 2, status: 'completata', total_amount: 680, guest_name: 'Carmela Sabia' },
].map(b => ({ extra_bed: false, extra_bed_dates: [], price_per_night: 70, extra_bed_total: 0, total_amount: 140, source: 'diretta', guest_name: null, notes: null, cancelled_at: null, cancelled_reason: null, group_id: null, pagato: false, bonifico: false, created_at: ora, updated_at: ora, ...b }))

function richiesta(x) {
  return { id: randomUUID(), created_at: ora, camera_id: null, telefono: null, note: null, stato: 'in_attesa', proposta_inviata_at: null, chiusa_at: null, prenotazione_id: null, proposta_testo: null, proposta_soluzione: null, motivo_rifiuto: null, origine: null, condizione_pagamento: null, caparra_centesimi: null, condizione_testo: null, amelia_alternativa: false, persone_per_notte: null, proposte_precedenti: [], proposta_alternative: null, ...x }
}
const richieste = [
  richiesta({ nome: 'Anna', cognome: 'Rossi', arrivo: giorni(11), partenza: giorni(13), persone: 2, canale: 'web', created_at: fa(20), origine: 'google' }),
  richiesta({ nome: 'Marek', cognome: 'Kowalski', arrivo: giorni(20), partenza: giorni(25), persone: 3, camera_id: ROOM.lena, canale: 'whatsapp', telefono: '+39 333 000 0002', created_at: fa(60 * 11) }),
  richiesta({ nome: 'Luca', cognome: 'Bianchi', arrivo: giorni(5), partenza: giorni(6), persone: 1, canale: 'telefono', created_at: fa(60 * 30), stato: 'proposta_inviata', proposta_inviata_at: fa(60 * 3 + 20) }),
  // Timer della proposta: inviata 45 minuti fa → «scade tra 2 h 15 min» in verde (Bianchi, sopra, è scaduta da 20 min → ottone)
  richiesta({ nome: 'Marta', cognome: 'Verdi', arrivo: giorni(30), partenza: giorni(32), persone: 2, camera_id: ROOM.ambra, canale: 'whatsapp', telefono: '+39 333 000 0031', created_at: fa(60 * 2), stato: 'proposta_inviata', proposta_inviata_at: fa(45) }),
  // Sovrapposta a Rossi (stessa riga «qualsiasi»): nel calendario diventano una barra sola «2 richieste ⇄»
  richiesta({ nome: 'Piotr', cognome: 'Nowak', arrivo: giorni(12), partenza: giorni(14), persone: 2, canale: 'telefono', telefono: '+39 333 000 0009', created_at: fa(90) }),
  // 3 persone nelle notti della quadrupla: nessun letto libero → Allegra non basta (atteso «Completo» o parziale)
  richiesta({ nome: 'Tre', cognome: 'Persone', arrivo: giorni(14), partenza: giorni(16), persone: 3, camera_id: ROOM.allegra, canale: 'telefono', telefono: '+44 7700 900123', created_at: fa(30) }),
  // Pezzo 6: 1 persona per 3 notti con tutto libero → caso A in Amelia con l'alternativa Allegra disponibile
  richiesta({ nome: 'Ewa', cognome: 'Lis', arrivo: giorni(40), partenza: giorni(43), persone: 1, canale: 'whatsapp', telefono: '+48 600 000 000', created_at: fa(12) }),
  // Pezzo 6: notte +51 tutta occupata → caso C (notte scoperta in mezzo) anche nell'immagine
  richiesta({ nome: 'Jan', cognome: 'Buco', arrivo: giorni(50), partenza: giorni(53), persone: 1, canale: 'telefono', telefono: '+39 333 000 0050', created_at: fa(8) }),
  // Pezzo 9: il caso reale — in 2 la prima notte (il marito poi viene ricoverato), poi da sola per 3 notti
  richiesta({ nome: 'Marta', cognome: 'Ricovero', arrivo: giorni(60), partenza: giorni(64), persone: 2, persone_per_notte: [2, 1, 1, 1], canale: 'telefono', telefono: '+39 333 000 0060', created_at: fa(3) }),
  // Pezzo 10: il caso reale 17–21 con [2,3,3,3]: in 2 la prima notte, poi in 3
  richiesta({ nome: 'Ewa', cognome: 'Composta', arrivo: giorni(70), partenza: giorni(74), persone: 2, persone_per_notte: [2, 3, 3, 3], canale: 'whatsapp', telefono: '+39 333 000 0070', created_at: fa(2) }),
  richiesta({ nome: 'Sara', cognome: 'Verdi', arrivo: giorni(30), partenza: giorni(35), persone: 4, canale: 'web', created_at: fa(5), note: 'Chiede due camere vicine' }),
  // ── Veste nuova della proposta (11/09/2026) ──────────────────────────────
  // Tre persone con TUTTO libero: Lena, Ambra e Allegra partono spuntate,
  // Amelia resta grigia («singola: per 3 persone non va»).
  richiesta({ nome: 'Tre', cognome: 'Libere', arrivo: giorni(100), partenza: giorni(102), persone: 3, canale: 'web', telefono: '+39 333 000 0100', created_at: fa(15), origine: 'google', note: 'Arriviamo tardi, verso le 21' }),
  // Stesse date di «Tre Libere»: fa comparire la voce «Stesse date»
  richiesta({ nome: 'Silvana', cognome: 'Pari', arrivo: giorni(101), partenza: giorni(103), persone: 2, canale: 'telefono', telefono: '+39 333 000 0101', created_at: fa(10) }),
  // Due persone, tutto libero: tutte e quattro le camere proponibili
  richiesta({ nome: 'Due', cognome: 'Persone', arrivo: giorni(105), partenza: giorni(107), persone: 2, canale: 'whatsapp', telefono: '+39 333 000 0105', created_at: fa(9) }),
  // La richiesta di prova di Ania: 29–31 ottobre, tre persone, tutto libero
  richiesta({ nome: 'Anna', cognome: 'Sawicka', arrivo: '2026-10-29', partenza: '2026-10-31', persone: 3, canale: 'web', telefono: '+39 342 700 4354', created_at: fa(25) }),
  // Persone diverse da una notte all'altra, il caso del punto 4 e 5 di Ania
  richiesta({ nome: 'Anna', cognome: 'Mista', arrivo: '2026-10-29', partenza: '2026-10-31', persone: 3, persone_per_notte: [1, 3], canale: 'web', telefono: '+39 342 700 4356', created_at: fa(24) }),
  // Soggiorno lungo con le persone che cambiano: la strisciolina si raggruppa
  richiesta({ nome: 'Lunga', cognome: 'Sosta', arrivo: '2026-11-09', partenza: '2026-11-19', persone: 3, persone_per_notte: [2, 2, 2, 3, 3, 3, 2, 2, 2, 2], canale: 'telefono', telefono: '+39 342 700 4357', created_at: fa(23) }),
  // La stessa, ma con una proposta già inviata PRIMA del grassetto: il testo
  // archiviato non ha asterischi
  richiesta({ nome: 'Anna', cognome: 'Vecchia', arrivo: '2026-10-29', partenza: '2026-10-31', persone: 3, canale: 'web', telefono: '+39 342 700 4355', created_at: fa(26), stato: 'proposta_inviata', proposta_inviata_at: fa(20),
    condizione_pagamento: 'arrivo',
    proposta_testo: 'Gentile Anna,\ngrazie per aver pensato a Casa Ania per il suo soggiorno.\n\nHo verificato le date che mi ha indicato. Dal 29 al 31 ottobre, per tre persone, posso proporle tre camere:\n\n– Lena, una camera tripla. Il prezzo per le due notti è di 180 €.\n\nGrazie mille,\nAnia – Casa Ania' }),
  // La stessa Rosa che è in archivio: la testa deve dirlo
  richiesta({ nome: 'Rosa', cognome: 'Archivio', arrivo: '2026-12-05', partenza: '2026-12-07', persone: 2, canale: 'telefono', telefono: '+39 333 000 0303', created_at: fa(19) }),
  // Tre richieste sulle stesse notti (12/09/2026): il segno blu e il filtro
  richiesta({ nome: 'Prima', cognome: 'Insieme', arrivo: '2027-02-10', partenza: '2027-02-13', persone: 2, canale: 'web', telefono: '+39 333 000 0210', created_at: fa(60 * 72) }),
  richiesta({ nome: 'Seconda', cognome: 'Insieme', arrivo: '2027-02-11', partenza: '2027-02-14', persone: 2, canale: 'telefono', telefono: '+39 333 000 0211', created_at: fa(60 * 30) }),
  richiesta({ nome: 'Terza', cognome: 'Insieme', arrivo: '2027-02-12', partenza: '2027-02-15', persone: 3, canale: 'whatsapp', telefono: '+39 333 000 0212', created_at: fa(60) }),
  // Questa NON c'entra: stesse date di nessuno
  richiesta({ nome: 'Fuori', cognome: 'Gruppo', arrivo: '2027-02-20', partenza: '2027-02-22', persone: 2, canale: 'telefono', telefono: '+39 333 000 0220', created_at: fa(50) }),
  // Camera chiesta dal cliente e libera: parte spuntata solo Ambra
  richiesta({ nome: 'Chiede', cognome: 'Ambra', arrivo: giorni(115), partenza: giorni(117), persone: 2, camera_id: ROOM.ambra, canale: 'web', telefono: '+39 333 000 0115', created_at: fa(4) }),
  // Cliente che torna (stesso telefono di Carmela Sabia): «Già stata qui 2
  // volte», 1.360 € nella testa, stella e nome in grassetto (ricevuta)
  richiesta({ nome: 'Carmela', cognome: 'Sabia', arrivo: giorni(110), partenza: giorni(112), persone: 2, canale: 'web', telefono: '+39 333 000 0080', created_at: fa(6), note: 'Arriviamo col treno delle 19, se tardiamo la avviso.' }),
  // Nota lunga scritta dal sito: deve andare a capo e stare nei margini
  richiesta({ nome: 'Nota', cognome: 'Lunga', arrivo: giorni(120), partenza: giorni(122), persone: 2, canale: 'web', telefono: '+39 333 000 0120', created_at: fa(11),
    note: 'Buongiorno, saremmo io e mio marito, arriviamo in macchina nel primo pomeriggio ma non sappiamo ancora l\'ora esatta perché dipende dal traffico in tangenziale; se possibile vorremmo una camera silenziosa e un posto dove lasciare l\'auto, e le chiedo se c\'è la possibilità di lasciare i bagagli dopo la partenza fino a sera. Grazie mille.' }),
  // La richiesta di Giusi: proposta INVIATA prima del rilascio del testo per
  // tre persone, quindi il messaggio archiviato è quello vecchio
  richiesta({ nome: 'Giusi', cognome: 'Brugaletta', arrivo: '2026-10-29', partenza: '2026-10-31', persone: 3, canale: 'whatsapp', telefono: '+39 333 000 0129', created_at: fa(40), stato: 'proposta_inviata', proposta_inviata_at: fa(35), condizione_pagamento: 'arrivo',
    proposta_testo: 'Gentile Giusi,\ngrazie per aver pensato a Casa Ania per il suo soggiorno.\n\nHo verificato le date che mi ha indicato. Dal 29 al 31 ottobre ho tre camere libere che posso proporle:\n\n– Allegra, una camera matrimoniale con il balconcino e il bagno in camera. Per le notti in cui sarete in tre posso aggiungere un letto in più. Il prezzo per le 2 notti è di 180 €, a 90 € a notte.\n\n– Ambra, una camera matrimoniale con il bagno in camera. Il prezzo per le 2 notti è di 180 €, a 90 € a notte.\n\n– Lena, una camera tripla con il bagno privato appena fuori dalla porta, chiuso a chiave. Il prezzo per le 2 notti è di 180 €, a 90 € a notte.\n\nGrazie mille,\nAnia – Casa Ania' }),
  // Nessuna camera libera per tutte le notti: resta la proposta automatica
  richiesta({ nome: 'Cambio', cognome: 'Camera', arrivo: giorni(71), partenza: giorni(74), persone: 2, canale: 'telefono', telefono: '+39 333 000 0071', created_at: fa(7) }),
  richiesta({ nome: 'Paolo', cognome: 'Neri', arrivo: giorni(-3), partenza: giorni(-1), persone: 2, canale: 'telefono', created_at: fa(60 * 24 * 8), stato: 'confermata', chiusa_at: fa(60 * 24 * 7) }),
  richiesta({ nome: 'Giulia', cognome: 'Gallo', arrivo: giorni(2), partenza: giorni(4), persone: 2, canale: 'whatsapp', created_at: fa(60 * 24 * 2), stato: 'rifiutata', chiusa_at: fa(60 * 24), motivo_rifiuto: 'detto_no' }),   // rifiuto con motivo (07/09/2026): «Rifiutata da te · ha detto di no · …»
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
  // RPC conferma_richiesta: stessa logica della 0027, semplificata, in memoria
  if (url.pathname === '/rest/v1/rpc/conferma_richiesta' && req.method === 'POST') {
    const { p_richiesta_id, p_rifiuta_anche } = JSON.parse(await leggiCorpo(req) || '{}')
    const r = richieste.find(x => x.id === p_richiesta_id)
    const errore = (message) => rispondi(res, 400, { code: 'P0001', message, details: null, hint: null })
    if (!r) return errore('Richiesta non trovata')
    if (r.stato === 'confermata') return rispondi(res, 200, r.prenotazione_id)
    if (r.stato !== 'proposta_inviata' || !r.proposta_soluzione) return errore('Nessuna proposta inviata')
    const seg = r.proposta_soluzione.segmenti || []
    if (seg.length === 0) return errore('La proposta inviata non contiene camere (caso «completo»): niente da confermare')
    const MESI = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre']
    for (const s of seg) {
      for (let t = Date.parse(s.arrivo + 'T00:00:00Z'); t < Date.parse(s.partenza + 'T00:00:00Z'); t += 86400000) {
        const g = new Date(t).toISOString().slice(0, 10)
        if (bookings.some(b => b.room_id === s.camera.id && ['confermata', 'completata'].includes(b.status) && b.check_in <= g && b.check_out > g)) {
          const d = new Date(t)
          return errore(`Camera ${s.camera.name} non più disponibile la notte del ${d.getUTCDate()} ${MESI[d.getUTCMonth()]}`)
        }
      }
    }
    const tel = (r.telefono || '').replace(/\D/g, '')
    let guest = guests.find(g => (g.phone || '').replace(/\D/g, '') === tel && tel)
    if (!guest) { guest = { id: randomUUID(), phone: tel, full_name: nomeCompleto(r), email: null, rating: 'normale', notes: null, created_at: ora, updated_at: ora }; guests.push(guest) }
    const group_id = randomUUID()
    let primo = null
    for (const s of [...seg].sort((a, b) => a.arrivo.localeCompare(b.arrivo))) {
      const id = randomUUID()
      bookings.push({ id, room_id: s.camera.id, guest_id: guest.id, check_in: s.arrivo, check_out: s.partenza, num_guests: r.persone, extra_bed: s.lettoTotale > 0, extra_bed_dates: [], price_per_night: s.prezzoNotte, extra_bed_total: s.lettoTotale, total_amount: s.totale, status: 'confermata', source: r.canale === 'web' ? 'sito_web' : r.canale === 'whatsapp' ? 'whatsapp' : 'diretta', guest_name: nomeCompleto(r), notes: r.note, cancelled_at: null, cancelled_reason: null, group_id, pagato: false, bonifico: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      if (!primo) primo = id
    }
    Object.assign(r, { stato: 'confermata', chiusa_at: new Date().toISOString(), prenotazione_id: primo })
    for (const id of (p_rifiuta_anche || [])) {
      const x = richieste.find(q => q.id === id && q.id !== r.id && ['in_attesa', 'proposta_inviata'].includes(q.stato))
      if (x) Object.assign(x, { stato: 'rifiutata', chiusa_at: new Date().toISOString(), motivo_rifiuto: 'date assegnate a altro cliente' })
    }
    console.log(`[finto supabase] conferma_richiesta ${r.cognome} → prenotazione ${primo}, rifiutate ${(p_rifiuta_anche || []).length}`)
    return rispondi(res, 200, primo)
  }
  if (m && m[1] === 'richieste' && req.method === 'PATCH') {
    const corpo = JSON.parse(await leggiCorpo(req) || '{}')
    const bersaglio = interroga('richieste', new URL(url.pathname + url.search.replace(/([?&])select=[^&]*/, '$1'), `http://127.0.0.1:${PORTA_FINTO}`))
    const ids = new Set(bersaglio.map(r => r.id))
    const toccate = richieste.filter(r => ids.has(r.id))
    if (corpo.stato === 'errore') return rispondi(res, 500, { code: 'FINTO', message: 'aggiornamento fallito (simulato)', details: null, hint: null })
    toccate.forEach(r => Object.assign(r, corpo))
    console.log(`[finto supabase] PATCH richieste: ${toccate.length} riga/e →`, JSON.stringify(corpo).slice(0, 80))
    const select = url.searchParams.get('select') || '*'
    return rispondi(res, 200, toccate.map(r => applicaSelect('richieste', r, select)))
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
