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
// Arrivo e navetta (21/09/2026, proposta approvata): Carmela Sabia, primo
// tratto — atterra a LINATE alle 15:00, in struttura CIRCA 16:00–17:00,
// navetta con MASSIMO, prelievo 15:30. check_in_time resta 16:00 (l'ora in
// struttura), mai le 15:00 di Linate.
//   GET /finto/senza-0058?on=1  le colonne nuove non esistono: salvando
//   l'arrivo l'app riscrive solo check_in_time e shuttle e lo dice a schermo
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
  // Nuova scheda prenotazione (13/09/2026): Carmela Sabia, cliente ottima che
  // vuole la ricevuta, già stata qui due volte (1.360 €), passaparola; adesso
  // 10–17 set con due cambi camera (Lena → Amelia → Lena), 550 € in contanti.
  { ...ospite('aaaaaaaa-0018-4000-8000-000000000018', 'Carmela Sabia', '+39 333 000 0018'),
    rating: 'ottimo', vuole_ricevuta: true, provenienza: 'passaparola', struttura_nome: null,
    notes: 'Vuole la camera silenziosa, dorme male con i rumori.' },
  // Striscia delle notti (13/09/2026): un soggiorno lungo (10 notti) e uno con
  // una pausa in mezzo, per provare la striscia che scorre e la notte «libera».
  ospite('aaaaaaaa-0019-4000-8000-000000000019', 'Dieci Notti', '+39 333 000 0019'),
  ospite('aaaaaaaa-0020-4000-8000-000000000020', 'Con Pausa', '+39 333 000 0020'),
  // Lo sconto quando cambia il soggiorno (17/09/2026): tre casi per il foglio
  // «Il soggiorno si allunga» — vedi le prenotazioni più sotto
  ospite('aaaaaaaa-0021-4000-8000-000000000021', 'Sconto A Notte', '+39 333 000 0021'),
  ospite('aaaaaaaa-0022-4000-8000-000000000022', 'Due Camere Sconto', '+39 333 000 0022'),
  ospite('aaaaaaaa-0023-4000-8000-000000000023', 'Letto Per Due', '+39 333 000 0023'),
  // e il caso della percentuale (18/09/2026): il foglio propone «Tengo il 10 % di sconto»
  ospite('aaaaaaaa-0024-4000-8000-000000000024', 'Dieci Per Cento', '+39 333 000 0024'),
  // La striscia che va a capo (20/09/2026): il caso di Rosa Macauda, 24 notti
  // con tre cambi camera, e la copertura dei pagamenti (regola fissa n. 9)
  ospite('aaaaaaaa-0025-4000-8000-000000000025', 'Ventiquattro Notti', '+39 333 000 0025'),
  // Il conto della scheda (20/09/2026 sera): sconto in percentuale con i
  // centesimi (12,5 % su 210 = 183,75) e un anticipo con la nota
  ospite('aaaaaaaa-0026-4000-8000-000000000026', 'Centesimi Sconto', '+39 333 000 0026'),
  // Verifica del 20/09/2026: in FONDO, così gli indici guests[n] di sopra non si spostano
  ospite('aaaaaaaa-0027-4000-8000-000000000027', 'Pausa Poi Cambio', '+39 333 000 0027'),
  ospite('aaaaaaaa-0028-4000-8000-000000000028', 'Due Camere Saldate', '+39 333 000 0028'),
  // Verifica indipendente del 21/09/2026 sera (punto 6): in FONDO, stessa regola
  ospite('aaaaaaaa-0029-4000-8000-000000000029', 'Camera Annullata', '+39 333 000 0029'),
]
const NIDA = guests[14]
const CAMBIO = guests[16]
const GRUPPO_CAMBIO = 'cccccccc-0017-4000-8000-000000000017'
const CARMELA = guests[17]
const GRUPPO_CARMELA = 'cccccccc-0018-4000-8000-000000000018'
const GRUPPO_LEI = 'cccccccc-0040-4000-8000-000000000040'
const GRUPPO_SORELLA = 'cccccccc-0041-4000-8000-000000000041'
const PRENOTAZIONE_PARALLELA = 'dddddddd-0040-4000-8000-000000000040'

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
  // In camera dorme un'altra persona (10/09/2026): serve per la sezione
  // «Persone in arrivo», che si vede SOLO in questo caso.
  prenotazione(ROOM.lena, guests[5].id, '2026-09-14', '2026-09-16', 3,
    { extra_bed: true, extra_bed_dates: ['2026-09-15'], price_per_night: 80, extra_bed_total: 10, total_amount: 170,
      extra_phone_1_name: 'Marco Riva', extra_phone_1: '393330000099', chi_e: 'il figlio' }),
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
  // Inserimento vero (14/09/2026): la situazione in cui si è bloccata Ania —
  // 30 set → 4 ott: le prime due notti non c'è NIENTE di libero, il 2 e il 3
  // resta libera solo Lena, con uno dei due letti di casa già impegnato da
  // Amelia. È la situazione di Ania: serve per provare la striscia notte per
  // notte e il giro intero (Lena, 3 ospiti, letto in più, sconto, salvataggio).
  prenotazione(ROOM.amelia, 'aaaaaaaa-0004-4000-8000-000000000004', '2026-09-30', '2026-10-05', 2,
    { extra_bed: true, extra_bed_dates: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'], price_per_night: 70, extra_bed_total: 20, total_amount: 350 }),
  prenotazione(ROOM.allegra, 'aaaaaaaa-0008-4000-8000-000000000008', '2026-10-02', '2026-10-04', 2,
    { price_per_night: 70, total_amount: 140 }),
  prenotazione(ROOM.ambra, 'aaaaaaaa-0010-4000-8000-000000000010', '2026-09-30', '2026-10-06', 2,
    { price_per_night: 70, total_amount: 420 }),
  // e le prime due notti piene per tutti: 30 set e 1 ott niente, 2 e 3 ott Lena
  prenotazione(ROOM.allegra, 'aaaaaaaa-0009-4000-8000-000000000009', '2026-09-30', '2026-10-02', 2,
    { price_per_night: 70, total_amount: 140 }),
  prenotazione(ROOM.lena, 'aaaaaaaa-0005-4000-8000-000000000005', '2026-09-30', '2026-10-02', 2,
    { price_per_night: 80, total_amount: 160 }),
  // Carmela Sabia (nuova scheda, 13/09/2026): due soggiorni conclusi in Ambra
  // e il soggiorno di adesso su tre tratti — Lena 12–14 (160), Amelia 14–16
  // in una (130), Lena 16–18 in tre col letto incluso (180) = 470 €, pagati
  // in contanti all'arrivo (movimento sul primo tratto). Orario e navetta.
  // Le date sono le uniche in cui Lena e Amelia sono libere in questo
  // scenario: così la prova non crea sovrapposizioni con le altre prove.
  prenotazione(ROOM.ambra, CARMELA.id, '2025-08-12', '2025-08-20', 2, { status: 'completata', price_per_night: 85, total_amount: 680, pagato: true }),
  prenotazione(ROOM.ambra, CARMELA.id, '2026-04-29', '2026-05-04', 2, { status: 'completata', price_per_night: 136, total_amount: 680, pagato: true, check_in_time: '16:00', shuttle: 'no' }),
  prenotazione(ROOM.lena, CARMELA.id, '2026-09-12', '2026-09-14', 2,
    { group_id: GRUPPO_CARMELA, price_per_night: 80, total_amount: 160, notes: 'Chiede un cuscino in più.',
      // «Arrivo e navetta» (21/09/2026), il caso del riferimento approvato:
      // atterra a Linate alle 15:00, Ania stima che sia in casa fra le 16 e
      // le 17, la va a prendere Massimo alle 15:30. check_in_time resta l'ora
      // IN STRUTTURA (16:00), mai quella di Linate.
      arrivo_tipo: 'luogo', arrivo_luogo: 'linate', arrivo_luogo_altro: null,
      arrivo_ora_da: '15:00', arrivo_ora_a: null,
      arrivo_struttura_da: '16:00', arrivo_struttura_a: '17:00',
      navetta: 'massimo', navetta_prelievo: '15:30',
      check_in_time: '16:00', shuttle: 'si',
      extra_phone_1_name: 'Marco Riva', extra_phone_1: '3334567890', chi_e: 'il figlio', extra_phone_2: '3339876543' }),
  prenotazione(ROOM.amelia, CARMELA.id, '2026-09-14', '2026-09-16', 1,
    { group_id: GRUPPO_CARMELA, price_per_night: 65, total_amount: 130 }),
  prenotazione(ROOM.lena, CARMELA.id, '2026-09-16', '2026-09-18', 3,
    { group_id: GRUPPO_CARMELA, price_per_night: 90, extra_bed: true, extra_bed_dates: ['2026-09-16', '2026-09-17'], extra_bed_total: 0, total_amount: 180 }),
  // Camere in parallelo (17/09/2026): lei in Lena 3–5 nov poi Ambra 5–7 nov
  // (cambio camera, un gruppo) e la sorella in Amelia 3–6 nov (un altro
  // gruppo), nella stessa prenotazione (prenotazione_id). Le notti sono
  // libere per tutti in questo scenario.
  prenotazione(ROOM.lena, CAMBIO.id, '2026-11-03', '2026-11-05', 2,
    { group_id: GRUPPO_LEI, prenotazione_id: PRENOTAZIONE_PARALLELA, price_per_night: 80, total_amount: 160 }),
  prenotazione(ROOM.ambra, CAMBIO.id, '2026-11-05', '2026-11-07', 2,
    { group_id: GRUPPO_LEI, prenotazione_id: PRENOTAZIONE_PARALLELA, price_per_night: 70, total_amount: 140 }),
  prenotazione(ROOM.amelia, CAMBIO.id, '2026-11-03', '2026-11-06', 1,
    { group_id: GRUPPO_SORELLA, prenotazione_id: PRENOTAZIONE_PARALLELA, price_per_night: 65, total_amount: 195 }),
  // Striscia delle notti (13/09/2026): dieci notti di fila in Allegra
  prenotazione(ROOM.allegra, 'aaaaaaaa-0019-4000-8000-000000000019', '2026-10-05', '2026-10-15', 2,
    { price_per_night: 70, total_amount: 700 }),
  // e un soggiorno con una pausa: in Ambra 20–22 e di nuovo 23–25 (la notte
  // del 22 non dorme qui), due tratti dello stesso soggiorno
  prenotazione(ROOM.ambra, 'aaaaaaaa-0020-4000-8000-000000000020', '2026-10-20', '2026-10-22', 2,
    { group_id: 'cccccccc-0020-4000-8000-000000000020', price_per_night: 70, total_amount: 140 }),
  prenotazione(ROOM.ambra, 'aaaaaaaa-0020-4000-8000-000000000020', '2026-10-23', '2026-10-25', 2,
    { group_id: 'cccccccc-0020-4000-8000-000000000020', price_per_night: 70, total_amount: 140 }),
  // Lo sconto quando cambia il soggiorno (17/09/2026), il caso di Ania: Allegra
  // 29 → 30 nov in tre, 80 + 10 di letto = 90 portati a 85 (prezzo finale).
  // Con «Cambia date» al 2 dic (Allegra libera) il foglio propone «Mantieni
  // 5 € di sconto a notte»: 3 × 85 = 255; poi «Cambio camera» in Ambra dal 30
  // (Ambra qui costa 70 + 10 = 80: tolti 5 fa 75, gli importi veri).
  prenotazione(ROOM.allegra, 'aaaaaaaa-0021-4000-8000-000000000021', '2026-11-29', '2026-11-30', 3,
    { extra_bed: true, extra_bed_dates: ['2026-11-29'], price_per_night: 80, extra_bed_total: 10,
      discount_type: 'target_total', discount_value: 85, total_amount: 85, check_in_time: '16:00' }),
  // Camere contemporanee col prezzo finale: lei in Lena 20 → 22 nov (160,
  // quota 150) e la sorella in Amelia nelle stesse notti (130, quota 120):
  // 270 concordati in tutto. Allungando una linea il foglio NON divide lo
  // sconto per i giorni: chiede il totale dell'intero soggiorno.
  prenotazione(ROOM.lena, 'aaaaaaaa-0022-4000-8000-000000000022', '2026-11-20', '2026-11-22', 2,
    { group_id: 'cccccccc-0022-4000-8000-000000000022', prenotazione_id: 'dddddddd-0022-4000-8000-000000000022',
      price_per_night: 80, total_amount: 150, discount_type: 'target_total', discount_value: 150 }),
  prenotazione(ROOM.amelia, 'aaaaaaaa-0022-4000-8000-000000000022', '2026-11-20', '2026-11-22', 1,
    { group_id: 'cccccccc-0023-4000-8000-000000000023', prenotazione_id: 'dddddddd-0022-4000-8000-000000000022',
      price_per_night: 65, total_amount: 120, discount_type: 'target_total', discount_value: 120 }),
  // La striscia che va a capo (20/09/2026), il caso di Rosa Macauda: 24 notti,
  // Ambra 1 → 7 set (480), Amelia 7 → 11 (280), Ambra 11 → 22 (880), Lena
  // 22 → 25 (240), una prenotazione sola. Sul telefono entrano 7 notti per
  // riga: quattro righe. Due pagamenti da 400, interi (regola n. 9).
  prenotazione(ROOM.ambra, 'aaaaaaaa-0025-4000-8000-000000000025', '2026-09-01', '2026-09-07', 1,
    { id: 'bbbbbbbb-2501-4000-8000-000000002501', group_id: 'cccccccc-0025-4000-8000-000000000025', prenotazione_id: 'dddddddd-0025-4000-8000-000000000025', price_per_night: 80, total_amount: 480, check_in_time: '16:00' }),
  prenotazione(ROOM.amelia, 'aaaaaaaa-0025-4000-8000-000000000025', '2026-09-07', '2026-09-11', 1,
    { id: 'bbbbbbbb-2502-4000-8000-000000002502', group_id: 'cccccccc-0025-4000-8000-000000000025', prenotazione_id: 'dddddddd-0025-4000-8000-000000000025', price_per_night: 70, total_amount: 280 }),
  prenotazione(ROOM.ambra, 'aaaaaaaa-0025-4000-8000-000000000025', '2026-09-11', '2026-09-22', 1,
    { id: 'bbbbbbbb-2503-4000-8000-000000002503', group_id: 'cccccccc-0025-4000-8000-000000000025', prenotazione_id: 'dddddddd-0025-4000-8000-000000000025', price_per_night: 80, total_amount: 880 }),
  prenotazione(ROOM.lena, 'aaaaaaaa-0025-4000-8000-000000000025', '2026-09-22', '2026-09-25', 1,
    { id: 'bbbbbbbb-2504-4000-8000-000000002504', group_id: 'cccccccc-0025-4000-8000-000000000025', prenotazione_id: 'dddddddd-0025-4000-8000-000000000025', price_per_night: 80, total_amount: 240 }),
  // Letto messo a mano per due ospiti (dormono separati, accordo 10 € a notte
  // della 0048) e pagamenti già presenti: Allegra 10 → 12 dic, 2 × 90 = 180
  // concordati 170, già SALDATA. Accorciando a una notte il nuovo totale è 85
  // e i 170 incassati superano il totale: il foglio lo dice, i pagamenti restano.
  prenotazione(ROOM.allegra, 'aaaaaaaa-0023-4000-8000-000000000023', '2026-12-10', '2026-12-12', 2,
    { extra_bed: true, extra_bed_dates: ['2026-12-10', '2026-12-11'], extra_bed_importo: 10, extra_bed_criterio: 'notte',
      price_per_night: 80, extra_bed_total: 20, discount_type: 'target_total', discount_value: 170, total_amount: 170, pagato: true }),
  // Il 10 % di sconto (18/09/2026): Ambra 5 → 7 dic in due, 2 × 80 = 160 − 16 = 144.
  // Allungando a tre notti il foglio propone «Tengo il 10 % di sconto» (216).
  prenotazione(ROOM.ambra, 'aaaaaaaa-0024-4000-8000-000000000024', '2026-12-05', '2026-12-07', 2,
    { price_per_night: 80, discount_type: 'percentage', discount_value: 10, total_amount: 144 }),
  // Verifica del 20/09/2026 (punto 2): «Pausa Poi Cambio», Amelia 19 → 21 set,
  // pausa la notte del 21 e del 22, Allegra 23 → 25 set: oggi (20 set) la testa
  // deve dire «Parte: 21 settembre, torna: 23 settembre», non «Prossimo cambio»
  prenotazione(ROOM.amelia, 'aaaaaaaa-0027-4000-8000-000000000027', '2026-09-19', '2026-09-21', 1,
    { prenotazione_id: 'dddddddd-0027-4000-8000-000000000027', price_per_night: 65, total_amount: 130, check_in_time: '15:00' }),
  prenotazione(ROOM.allegra, 'aaaaaaaa-0027-4000-8000-000000000027', '2026-09-23', '2026-09-25', 1,
    { prenotazione_id: 'dddddddd-0027-4000-8000-000000000027', price_per_night: 70, total_amount: 140 }),
  // Verifica del 20/09/2026 (punto 3): «Due Camere Saldate», Lena + Allegra
  // 20 → 22 set nelle stesse notti, legate SOLO da prenotazione_id (group_id
  // assente), 160 € interi sulla prima riga, segno «pagato» non messo: il
  // conto è 160/160 e «Da controllare» non deve dire «restano 0 €»
  prenotazione(ROOM.lena, 'aaaaaaaa-0028-4000-8000-000000000028', '2026-09-20', '2026-09-22', 2,
    { id: 'bbbbbbbb-2801-4000-8000-000000002801', prenotazione_id: 'dddddddd-0028-4000-8000-000000000028', group_id: null, price_per_night: 80, total_amount: 80, check_in_time: '16:00' }),
  prenotazione(ROOM.allegra, 'aaaaaaaa-0028-4000-8000-000000000028', '2026-09-20', '2026-09-22', 1,
    { id: 'bbbbbbbb-2802-4000-8000-000000002802', prenotazione_id: 'dddddddd-0028-4000-8000-000000000028', group_id: null, price_per_night: 70, total_amount: 80, check_in_time: '16:00' }),
  // Centesimi Sconto (20/09/2026 sera): Allegra 15 → 18 dic, 3 × 70 = 210,
  // sconto 12,5 % → 183,75 concordati; 100 € di anticipo con la nota.
  prenotazione(ROOM.allegra, 'aaaaaaaa-0026-4000-8000-000000000026', '2026-12-15', '2026-12-18', 2,
    { id: 'bbbbbbbb-2601-4000-8000-000000002601', price_per_night: 70, discount_type: 'percentage', discount_value: 12.5, total_amount: 183.75, accordo_pagamento: 'caparra_meta', caparra_centesimi: 10000, caparra_entro: '2026-12-01', bonifico: true }),
  // Punto 6, verifica indipendente del 21/09/2026 sera: prenotazione MISTA.
  // Una prenotazione sola (stesso prenotazione_id) con la camera Allegra
  // ANNULLATA 24 -> 26 set e la camera Amelia CONFERMATA 24 -> 28 set. Serve a
  // provare nel percorso vero della pagina che i messaggi consigliati sono gli
  // stessi da tutte e due le righe: prima del punto 6 corretto, entrando dalla
  // riga annullata la scheda proponeva i messaggi dell'annullamento.
  //   riga annullata:  /scheda/bbbbbbbb-2901-4000-8000-000000002901
  //   riga confermata: /scheda/bbbbbbbb-2902-4000-8000-000000002902
  // La riga annullata porta anche la spunta BONIFICO, e nessun accordo è stato
  // scritto da nessuna parte: serve al terzo rilievo (21/09/2026 sera). Prima
  // la riserva di accordoPrenotazione prendeva questa riga e la conferma
  // prometteva alla cliente «si salda in anticipo con bonifico bancario», con
  // IBAN, mentre l'unica camera viva dice «pagamento all'arrivo».
  prenotazione(ROOM.allegra, 'aaaaaaaa-0029-4000-8000-000000000029', '2026-09-24', '2026-09-26', 2,
    { id: 'bbbbbbbb-2901-4000-8000-000000002901', prenotazione_id: 'dddddddd-0029-4000-8000-000000000029', group_id: null,
      status: 'annullata', cancelled_at: ora, cancelled_reason: 'La cliente ha lasciato una camera sola',
      price_per_night: 70, total_amount: 140, check_in_time: '16:00', bonifico: true }),
  prenotazione(ROOM.amelia, 'aaaaaaaa-0029-4000-8000-000000000029', '2026-09-24', '2026-09-28', 2,
    { id: 'bbbbbbbb-2902-4000-8000-000000002902', prenotazione_id: 'dddddddd-0029-4000-8000-000000000029', group_id: null,
      price_per_night: 65, total_amount: 260, check_in_time: '16:00' }),
]
// «Letto Per Due» si cerca per cliente, non per posizione: in fondo alla lista si aggiungono altri casi
const LETTO_PER_DUE = bookings.find(b => b.guest_id === 'aaaaaaaa-0023-4000-8000-000000000023')
const CARMELA_PRIMO_TRATTO = bookings.find(b => b.group_id === GRUPPO_CARMELA)
const documenti_cliente = [
  { id: 'dddddddd-0001-4000-8000-000000000001', guest_id: NIDA.id, percorso: `${NIDA.id}/dddddddd-0001-4000-8000-000000000001.jpg`, etichetta: 'carta_identita', lato: 'fronte', nome_file: 'IMG_1.jpeg', dimensione: 700000, created_at: ora },
  { id: 'dddddddd-0002-4000-8000-000000000002', guest_id: NIDA.id, percorso: `${NIDA.id}/dddddddd-0002-4000-8000-000000000002.jpg`, etichetta: 'carta_identita', lato: 'retro', nome_file: 'IMG_2.jpeg', dimensione: 700000, created_at: ora },
]
// Messaggi partiti dal gestionale (parte MESSAGGI e CRONOLOGIA della scheda nuova)
const booking_whatsapp_log = [
  { id: '77777777-0001-4000-8000-000000000001', booking_id: 'bbbbbbbb-0024-4000-8000-0000000000024', message_type: 'conferma', message_text: '…', sent: true, created_at: '2026-09-02T11:30:00+02:00' },
  { id: '77777777-0002-4000-8000-000000000002', booking_id: 'bbbbbbbb-0024-4000-8000-0000000000024', message_type: 'modifica', message_text: '…', sent: true, created_at: '2026-09-08T18:05:00+02:00' },
]
const strutture = [{ nome: 'Umana' }, { nome: 'Nida' }, { nome: 'RB (Rosa Bianca)' }, { nome: 'Elyse' }, { nome: 'BM (Borgo Manzoni)' }]
// Il contante di Carmela (470 €, all'arrivo del 12 set) sul primo tratto
const payments = [
  { id: 'ffffffff-0001-4000-8000-000000000001', booking_id: CARMELA_PRIMO_TRATTO.id, amount: 470, method: 'contanti', paid_on: '2026-09-12', created_at: ora },
  // «Letto Per Due» ha già pagato tutto (170 €, bonifico)
  { id: 'ffffffff-0002-4000-8000-000000000002', booking_id: LETTO_PER_DUE.id, amount: 170, method: 'bonifico', paid_on: '2026-09-15', created_at: ora },
  // Ventiquattro Notti: due pagamenti da 400, interi (regola fissa n. 9,
  // 20/09/2026): coprono Ambra 1→7 e Amelia 7→11, fino alla notte del 10 set
  { id: 'ffffffff-0003-4000-8000-000000000003', booking_id: 'bbbbbbbb-2501-4000-8000-000000002501', amount: 400, method: 'contanti', paid_on: '2026-09-07', created_at: ora },
  { id: 'ffffffff-0004-4000-8000-000000000004', booking_id: 'bbbbbbbb-2501-4000-8000-000000002501', amount: 400, method: 'contanti', paid_on: '2026-09-16', created_at: ora },
  // Due Camere Saldate: 160 € interi sulla prima riga (regola fissa n. 9)
  { id: 'ffffffff-0006-4000-8000-000000000006', booking_id: 'bbbbbbbb-2801-4000-8000-000000002801', amount: 160, method: 'contanti', paid_on: '2026-09-20', created_at: ora },
  // Centesimi Sconto: 100 € di anticipo via bonifico, con la nota
  { id: 'ffffffff-0005-4000-8000-000000000005', booking_id: 'bbbbbbbb-2601-4000-8000-000000002601', amount: 100, method: 'bonifico', paid_on: '2026-12-01', note: 'Anticipo arrivato il 1° dicembre, causale «Casa Ania»', created_at: ora },
  // Camera Annullata (21/09/2026 sera): 100 € di anticipo registrati sulla riga
  // poi ANNULLATA. Per il conto unico valgono per tutta la prenotazione: il
  // conto è 260 − 100 = 160, e i dati bonifico devono chiedere 160, non 260.
  { id: 'ffffffff-0007-4000-8000-000000000007', booking_id: 'bbbbbbbb-2901-4000-8000-000000002901', amount: 100, method: 'bonifico', paid_on: '2026-09-20', created_at: ora },
]
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
  // Scheda nuova (13/09/2026): una modifica e un pagamento sul soggiorno di Carmela
  // (minuti NEGATIVI = dopo il 1° set, così la storia va in ordine)
  evento(6, 'bbbbbbbb-0024-4000-8000-0000000000024', -60 * 24 * 5, 'date', { check_in: '2026-09-12', check_out: '2026-09-13' }, { check_in: '2026-09-12', check_out: '2026-09-14' }),
  evento(7, 'bbbbbbbb-0024-4000-8000-0000000000024', -60 * 24 * 11, 'pagamento_aggiunto', null, { importo: 470, metodo: 'contanti', data: '2026-09-12' }),
]
// R1 (revisione 07/09/2026): spese del tracker vecchio in memoria, con
// GET /finto/perdi-risposta-spese?on=1 il POST SALVA la riga ma chiude la
// connessione senza rispondere (risposta persa): «Riprova» deve riconciliare
const family_groups = [{ id: 'eeeeeeee-0001-4000-8000-000000000001', name: 'Casa Ania', sort: 1, ambito: 'azienda', color: null, created_at: ora }]
const family_categories = []
const family_product_rules = []
const family_expenses = []
// Camere TENUTE da una proposta (15/09/2026): il calendario le disegna
// tratteggiate. Tre casi apposta, tutti intorno al 20 settembre:
//   · Bruni Marta  — Ambra 20→22, paga all'ARRIVO, mandata poco fa  → barra
//     bianca tratteggiata, ancora tenuta (3 ore), con il letto in più;
//   · Conti Luigi  — Allegra 20→22, CAPARRA, mandata dieci ore fa   → barra a
//     righine, ancora tenuta (24 ore);
//   · Vitale Rosa  — Amelia 24→26, paga all'arrivo, mandata ieri    → tenuta
//     SCADUTA: barra smorzata, la camera si può dare.
// Contate da ADESSO davvero, non dal «primo settembre» finto degli altri dati:
// una tenuta si vede solo se è ancora viva rispetto all'orologio di chi guarda.
const oraMeno = (minuti) => new Date(Date.now() - minuti * 60000).toISOString()
const richiestaFinta = (id, nome, cognome, telefono, condizione, minutiFa, segmenti, extra = {}) => ({
  id, nome, cognome, telefono, stato: 'proposta_inviata',
  condizione_pagamento: condizione, caparra_centesimi: condizione === 'caparra' ? 8500 : null,
  created_at: oraMeno(minutiFa + 120), proposta_inviata_at: oraMeno(minutiFa),
  arrivo: segmenti[0].arrivo, partenza: segmenti[segmenti.length - 1].partenza,
  persone: 2, camera_id: segmenti[0].camera.id, canale: 'sito', chiusa_at: null,
  prenotazione_id: null, chiusura_motivo: null, motivo_rifiuto: null,
  proposta_soluzione: { caso: 'completa', segmenti }, proposta_alternative: null, ...extra,
})
const segmentoFinto = (cameraId, nome, arrivo, partenza, lettoNotti = [], totale = 170) => ({
  camera: { id: cameraId, name: nome, active: true }, arrivo, partenza,
  notti: lettoNotti.length || 2, totale, prezzoNotte: 80, lettoNotti, lettoTotale: lettoNotti.length * 10,
  personeNotti: lettoNotti.length > 0 ? [3, 3] : [2, 2],
})
const richieste = [
  richiestaFinta('dddd0001-0001-4000-8000-000000000001', 'Marta', 'Bruni', '+393331112221', 'arrivo', 30,
    [segmentoFinto(ROOM.ambra, 'Ambra', '2026-09-20', '2026-09-22', ['2026-09-20', '2026-09-21'], 190)]),
  richiestaFinta('dddd0002-0002-4000-8000-000000000002', 'Luigi', 'Conti', '+393331112222', 'caparra', 60 * 10,
    [segmentoFinto(ROOM.allegra, 'Allegra', '2026-09-20', '2026-09-22', [], 170)]),
  richiestaFinta('dddd0003-0003-4000-8000-000000000003', 'Rosa', 'Vitale', '+393331112223', 'arrivo', 60 * 20,
    [segmentoFinto(ROOM.amelia, 'Amelia', '2026-09-24', '2026-09-26', [], 140)]),
]
const tabelle = { rooms, guests, bookings, payments, cleanings, documenti_cliente, strutture, booking_events, booking_whatsapp_log, family_groups, family_categories, family_product_rules, family_expenses, richieste }
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
// Il conto della scheda (20/09/2026 sera): GET /finto/errore-pagamenti?on=1
// fa fallire la LETTURA dei pagamenti → la scheda non mostra il conto (mai
// «Già ricevuto 0 €» per un errore di lettura); ?on=0 spegne.
let errorePagamenti = false
// Scritture a metà (revisione del 17/09/2026): GET /finto/errore-dopo-scritture?n=1
// fa riuscire le prime n PATCH su bookings e fallire le successive (500);
// con &modo=persa le successive vengono SCRITTE ma la risposta si perde
// (connessione chiusa): il caso della risposta persa alla prima scrittura.
let erroreDopoScritture = null
let modoPersa = false
let patchRiuscite = 0
// Il foglio del prezzo (17/09/2026): GET /finto/errore-sposta-notti?modo=errore
// fa fallire la RPC sposta_notti (500, niente scritto); ?modo=persa la fa
// SCRIVERE ma risponde 503 come un gateway caduto (la risposta persa: chiudere
// la connessione non serve, Chrome riprova da solo la richiesta sul socket
// riusato e la scrittura arriva due volte); ?modo=0 spegne. Vale per la
// chiamata successiva soltanto.
let erroreSpostaNotti = null
// Il foglio «Aggiungi pagamento» approvato (20/09/2026 sera): le RPC della
// 0049 sulle prenotazioni con prenotazione_id (Ventiquattro Notti), finte ma
// con le stesse regole: idempotenti per p_chiave, importo a due decimali,
// risposta con contratto 'prenotazione_v1'. Interruttori, per la chiamata
// successiva soltanto: GET /finto/errore-pagamento?modo=errore (500, niente
// scritto) · ?modo=persa (SCRIVE, poi risponde 503 come un gateway caduto) ·
// ?modo=caduta (503 PRIMA di scrivere) · ?modo=tardiva&dopo=ms (503 subito,
// scrittura confermata DOPO: le letture intanto non la vedono, le chiamate
// successive sullo stesso soggiorno aspettano) · ?modo=0 spegne.
// GET /finto/pagamento-esterno?booking_id=…&amount=… aggiunge
// un incasso «da un altro telefono» mentre il foglio è aperto.
let errorePagamentoRpc = null
// modo=tardiva&dopo=ms (21/09/2026): la funzione risponde 503 SUBITO (il gateway
// ha mollato) ma la scrittura è ANCORA IN CORSO e si conferma dopo `dopo` ms
// (come una transazione non ancora confermata): intanto le letture non la
// vedono e le altre chiamate sullo stesso soggiorno aspettano, come sul lock.
let ritardoScrittura = 3000
const scrittureInCorso = new Map()   // soggiorno → Promise della scrittura tardiva
// Punto 5 (verifica del 20/09/2026): la funzione server finta accetta anche le
// cifre attese della proposta 0057 (p_totale_atteso, p_ricevuti_attesi) e si
// ferma con CONTO_CAMBIATO se il conto è diverso. Interruttori:
//   GET /finto/totale-esterno?booking_id=…&total_amount=…   cambia il totale «da un altro telefono», subito
//   GET /finto/pagamento-durante-rpc?booking_id=…&amount=…  alla PROSSIMA chiamata aggiunge un incasso DENTRO la
//                                                          funzione, prima del controllo (la finestra fra rilettura e scrittura)
//   GET /finto/senza-0057?on=1|0                            la firma con le cifre attese non esiste (PGRST202): l'app richiama senza
let pagamentoDuranteRpc = null
let senza0057 = false
//   GET /finto/senza-rpc-pagamenti?on=1|0                   registra_acconto/segna_pagato NON esistono (PGRST202): l'app senza
//                                                          prenotazione_id ripiega sull'INSERT (nessuna chiave: tentativo «senzaChiave»);
//                                                          errore-pagamento?modo=persa|caduta vale anche per quel POST
let senzaRpcPagamenti = false
//   GET /finto/senza-0058?on=1|0                            le colonne di «Arrivo e navetta» NON esistono (PGRST204 sulla prima
//                                                          che arriva): l'app riscrive solo check_in_time e shuttle e lo dice
const COLONNE_0058 = ['arrivo_tipo', 'arrivo_luogo', 'arrivo_luogo_altro', 'arrivo_ora_da', 'arrivo_ora_a', 'arrivo_struttura_da', 'arrivo_struttura_a', 'navetta', 'navetta_prelievo']
let senza0058 = false
//   GET /finto/camera-durante-rpc?prenotazione_id=…&room_id=…&total_amount=…  alla PROSSIMA registrazione aggiunge una
//                                                          camera alla prenotazione SUBITO DOPO aver scritto il movimento
//                                                          (fra l'acconto e il bollino: il caso del saldo inventato)
let cameraDuranteRpc = null
function leggiCorpo(req) {
  return new Promise(resolve => { let t = ''; req.on('data', c => { t += c }); req.on('end', () => { try { resolve(t ? JSON.parse(t) : null) } catch { resolve(null) } }) })
}

const finto = createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORTA_FINTO}`)
  if (req.method === 'OPTIONS') return rispondi(res, 204)
  if (url.pathname === '/finto/errore-dopo-scritture') {
    const n = url.searchParams.get('n')
    erroreDopoScritture = n === null || n === '' ? null : Number(n)
    modoPersa = url.searchParams.get('modo') === 'persa'
    patchRiuscite = 0
    return rispondi(res, 200, { erroreDopoScritture, modoPersa })
  }
  if (url.pathname === '/finto/errore-sposta-notti') {
    const modo = url.searchParams.get('modo')
    erroreSpostaNotti = modo === 'errore' || modo === 'persa' ? modo : null
    return rispondi(res, 200, { erroreSpostaNotti })
  }
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
  if (url.pathname === '/finto/errore-pagamenti') { errorePagamenti = url.searchParams.get('on') === '1'; return rispondi(res, 200, { errorePagamenti }) }
  // modo=caduta: la connessione cade PRIMA di scrivere (503 senza codice): esito incerto per l'app, ma niente registrato
  if (url.pathname === '/finto/errore-pagamento') {
    const modo = url.searchParams.get('modo'); errorePagamentoRpc = ['errore', 'persa', 'caduta', 'tardiva'].includes(modo) ? modo : null
    if (url.searchParams.get('dopo')) ritardoScrittura = Number(url.searchParams.get('dopo'))
    return rispondi(res, 200, { errorePagamentoRpc, ritardoScrittura, scrittureInCorso: [...scrittureInCorso.keys()] })
  }
  if (url.pathname === '/finto/totale-esterno') {
    const b = bookings.find(x => x.id === url.searchParams.get('booking_id')), total_amount = Number(url.searchParams.get('total_amount'))
    if (!b || !(total_amount >= 0)) return rispondi(res, 400, { message: 'booking_id o total_amount mancante' })
    b.total_amount = total_amount
    console.log(`[finto supabase] totale ESTERNO ${total_amount} su ${b.id.slice(-4)}`)
    return rispondi(res, 200, b)
  }
  if (url.pathname === '/finto/pagamento-durante-rpc') {
    pagamentoDuranteRpc = { booking_id: url.searchParams.get('booking_id'), amount: Number(url.searchParams.get('amount')) }
    return rispondi(res, 200, { pagamentoDuranteRpc })
  }
  if (url.pathname === '/finto/camera-durante-rpc') {
    cameraDuranteRpc = { prenotazione_id: url.searchParams.get('prenotazione_id'), room_id: url.searchParams.get('room_id'), total_amount: Number(url.searchParams.get('total_amount') || 160) }
    return rispondi(res, 200, { cameraDuranteRpc })
  }
  if (url.pathname === '/finto/senza-0057') { senza0057 = url.searchParams.get('on') === '1'; return rispondi(res, 200, { senza0057 }) }
  if (url.pathname === '/finto/senza-0058') { senza0058 = url.searchParams.get('on') === '1'; return rispondi(res, 200, { senza0058 }) }
  if (url.pathname === '/finto/senza-rpc-pagamenti') { senzaRpcPagamenti = url.searchParams.get('on') === '1'; return rispondi(res, 200, { senzaRpcPagamenti }) }
  if (url.pathname === '/finto/pagamento-esterno') {
    const booking_id = url.searchParams.get('booking_id'), amount = Number(url.searchParams.get('amount'))
    if (!bookings.some(b => b.id === booking_id) || !(amount > 0)) return rispondi(res, 400, { message: 'booking_id o amount mancante' })
    const nuovo = { id: randomUUID(), booking_id, amount, method: 'contanti', paid_on: '2026-09-20', created_at: new Date().toISOString() }
    payments.push(nuovo)
    console.log(`[finto supabase] +1 pagamento ESTERNO (${amount} su ${booking_id.slice(-4)})`)
    return rispondi(res, 200, nuovo)
  }
  if (errorePagamenti && req.method === 'GET' && url.pathname === '/rest/v1/payments') {
    return rispondi(res, 500, { code: 'FINTO', message: 'errore simulato sulla lettura dei pagamenti', details: null, hint: null })
  }
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
  const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/)
  // sposta_notti (proposta 0053), finta (17/09/2026): aggiorna, crea e annulla
  // insieme, poi ricontrolla che nessuna camera sia presa due volte e che i
  // letti di casa restino due, come fa il database. Le risposte d'errore
  // hanno la forma di quelle vere (23P01, LETTI_FINITI).
  if (rpc && rpc[1] === 'sposta_notti' && req.method === 'POST') {
    return leggiCorpo(req).then(corpo => {
      const modoGuasto = erroreSpostaNotti
      erroreSpostaNotti = null
      if (modoGuasto === 'errore') {
        console.log('[finto supabase] RPC sposta_notti: errore simulato, niente scritto')
        return rispondi(res, 500, { code: 'FINTO', message: 'errore simulato sul salvataggio delle notti' })
      }
      const prima = bookings.map(b => ({ ...b }))
      const create = []
      for (const a of corpo.p_aggiorna || []) {
        const r = bookings.find(b => b.id === a.id)
        if (!r) return rispondi(res, 400, { code: 'P0001', message: `il tratto ${a.id} non c'è più: ricarica la scheda` })
        Object.assign(r, a.campi, { updated_at: new Date().toISOString() })
      }
      for (const c of corpo.p_crea || []) {
        n += 1
        const nuovo = { ...prenotazione(c.room_id, c.guest_id, c.check_in, c.check_out, c.num_guests, {}), ...c, id: `bbbbbbbb-${String(n).padStart(4, '0')}-4000-8000-00000000000${n}` }
        bookings.push(nuovo)
        create.push({ id: nuovo.id, check_in: nuovo.check_in })
      }
      for (const id of corpo.p_annulla || []) {
        const r = bookings.find(b => b.id === id)
        if (r) Object.assign(r, { status: 'annullata', cancelled_at: new Date().toISOString(), cancelled_reason: corpo.p_motivo || null })
      }
      const vive = bookings.filter(b => b.status === 'confermata' || b.status === 'completata')
      const siToccano = (x, y) => x.room_id === y.room_id && x.check_in < y.check_out && y.check_in < x.check_out
      const ripristina = () => { bookings.length = 0; bookings.push(...prima) }
      // come il vincolo della 0051: si controllano le righe TOCCATE contro tutte
      // le altre (lo scenario finto ha già sovrapposizioni volute, per «Da controllare»)
      const toccate = new Set([...(corpo.p_aggiorna || []).map(a => a.id), ...create.map(c => c.id)])
      for (const x of vive.filter(b => toccate.has(b.id))) for (const y of vive) if (x.id !== y.id && siToccano(x, y)) {
        console.log(`[finto supabase] RPC sposta_notti rifiutata: ${x.id} e ${y.id} nella stessa camera`)
        ripristina()
        return rispondi(res, 409, { code: '23P01', message: 'conflicting key value violates exclusion constraint "bookings_camera_non_due_volte"' })
      }
      const nottiFra = (dal, al) => { const out = []; for (let t = Date.parse(dal + 'T00:00:00Z'); t < Date.parse(al + 'T00:00:00Z'); t += 86400000) out.push(new Date(t).toISOString().slice(0, 10)); return out }
      const lettiPerNotte = {}
      for (const b of vive) {
        const notti = (b.extra_bed_dates && b.extra_bed_dates.length) ? b.extra_bed_dates : (b.extra_bed ? nottiFra(b.check_in, b.check_out) : [])
        const quanti = b.room_id === ROOM.lena && Number(b.num_guests) >= 4 ? 2 : 1
        for (const g of notti) lettiPerNotte[g] = (lettiPerNotte[g] || 0) + quanti
      }
      if (Object.values(lettiPerNotte).some(q => q > 2)) {
        ripristina()
        return rispondi(res, 400, { code: 'P0001', message: 'LETTI_FINITI: letti aggiuntivi esauriti in quella notte' })
      }
      console.log(`[finto supabase] RPC sposta_notti ← aggiorna ${(corpo.p_aggiorna || []).length}, crea ${create.length}, annulla ${(corpo.p_annulla || []).length}${modoGuasto === 'persa' ? ' — RISPOSTA PERSA' : ''}`)
      if (modoGuasto === 'persa') return rispondi(res, 503, { message: 'upstream connect error' })
      return rispondi(res, 200, { create })
    })
  }
  const soggiornoDi = b => b.prenotazione_id || b.group_id || b.id
  const righeSoggiorno = soggiorno => bookings.filter(b => soggiornoDi(b) === soggiorno)
  if (rpc && senzaRpcPagamenti && ['registra_acconto_prenotazione', 'registra_acconto', 'segna_pagato_prenotazione', 'segna_pagato'].includes(rpc[1])) {
    return rispondi(res, 404, { code: 'PGRST202', message: `Could not find the function public.${rpc[1]} in the schema cache`, details: null, hint: null })
  }
  if (rpc && (rpc[1] === 'registra_acconto_prenotazione' || rpc[1] === 'registra_acconto') && req.method === 'POST') {
    return leggiCorpo(req).then(async corpo => {
      const modoGuasto = errorePagamentoRpc
      errorePagamentoRpc = null
      // una scrittura tardiva ancora in corso sullo stesso soggiorno: si aspetta (il lock)
      const b00 = bookings.find(x => x.id === corpo?.p_booking_id)
      if (b00 && scrittureInCorso.has(soggiornoDi(b00))) { console.log(`[finto supabase] RPC ${rpc[1]} in fila dietro la scrittura tardiva`); await scrittureInCorso.get(soggiornoDi(b00)) }
      // il wrapper delle pagine vecchie si ferma sulle camere parallele (0049)
      if (rpc[1] === 'registra_acconto') {
        const b0 = bookings.find(x => x.id === corpo?.p_booking_id)
        if (b0 && new Set(righeSoggiorno(soggiornoDi(b0)).map(r => r.group_id || r.id)).size > 1) return rispondi(res, 400, { code: 'P0001', message: 'PAGINA_DA_AGGIORNARE: apri la scheda aggiornata per il conto di tutte le camere' })
      }
      if (modoGuasto === 'errore') { console.log(`[finto supabase] RPC ${rpc[1]}: errore simulato (certo, P0001), niente scritto`); return rispondi(res, 400, { code: 'P0001', message: 'ERRORE_SIMULATO: la registrazione del pagamento è stata rifiutata', details: null, hint: null }) }
      if (modoGuasto === 'caduta') { console.log(`[finto supabase] RPC ${rpc[1]}: connessione caduta PRIMA di scrivere (503), niente scritto`); return rispondi(res, 503, { message: 'upstream connect error' }) }
      const b = bookings.find(x => x.id === corpo?.p_booking_id)
      if (!b) return rispondi(res, 400, { code: 'P0001', message: 'PRENOTAZIONE_NON_TROVATA' })
      if (!['confermata', 'completata'].includes(b.status)) return rispondi(res, 400, { code: 'P0001', message: 'PRENOTAZIONE_NON_MODIFICABILE' })
      if (!corpo.p_chiave) return rispondi(res, 400, { code: 'P0001', message: 'CHIAVE_NULLA' })
      const amount = Number(corpo.p_amount)
      if (!(amount > 0) || Math.round(amount * 100) / 100 !== amount) return rispondi(res, 400, { code: 'P0001', message: 'IMPORTO_NON_VALIDO' })
      const soggiorno = soggiornoDi(b)
      const conAttesi = 'p_totale_atteso' in corpo || 'p_ricevuti_attesi' in corpo
      if (conAttesi && senza0057) {
        console.log(`[finto supabase] RPC ${rpc[1]} con le cifre attese: 0057 non applicata (PGRST202)`)
        return rispondi(res, 404, { code: 'PGRST202', message: `Could not find the function public.${rpc[1]}(p_amount, p_booking_id, p_chiave, p_metodo, p_paid_on, p_ricevuti_attesi, p_totale_atteso) in the schema cache`, details: null, hint: null })
      }
      const esistente = payments.find(p => p.chiave_operazione === corpo.p_chiave)
      if (esistente) {
        if (esistente.soggiorno !== soggiorno || esistente.amount !== amount || esistente.method !== (corpo.p_metodo || 'contanti') || esistente.paid_on !== corpo.p_paid_on) return rispondi(res, 400, { code: 'P0001', message: 'CHIAVE_RIUSATA' })
        console.log('[finto supabase] RPC registra_acconto_prenotazione: chiave già applicata, nessuna riga nuova')
        return rispondi(res, 200, { contratto: 'prenotazione_v1', movimento_id: esistente.id, booking_id: esistente.booking_id, importo: esistente.amount, soggiorno, gia_presente: true })
      }
      // la finestra fra la rilettura dell'app e la scrittura: un incasso che arriva proprio adesso
      if (pagamentoDuranteRpc) {
        const d = pagamentoDuranteRpc; pagamentoDuranteRpc = null
        payments.push({ id: randomUUID(), booking_id: d.booking_id, amount: d.amount, method: 'contanti', paid_on: '2026-09-20', created_at: new Date().toISOString() })
        console.log(`[finto supabase] +1 pagamento DURANTE la funzione (${d.amount} su ${String(d.booking_id).slice(-4)})`)
      }
      if (conAttesi) {
        if ((corpo.p_totale_atteso == null) !== (corpo.p_ricevuti_attesi == null)) return rispondi(res, 400, { code: 'P0001', message: 'CONTO_ATTESO_INCOMPLETO' })
        const righe = righeSoggiorno(soggiorno)
        const idsSogg = new Set(righe.map(r => r.id))
        const totale = righe.filter(r => ['confermata', 'completata'].includes(r.status)).reduce((s, r) => s + Number(r.total_amount), 0)
        const ricevuti = payments.filter(p => idsSogg.has(p.booking_id)).reduce((s, p) => s + Number(p.amount), 0)
        if (Math.round(totale * 100) !== Math.round(Number(corpo.p_totale_atteso) * 100) || Math.round(ricevuti * 100) !== Math.round(Number(corpo.p_ricevuti_attesi) * 100)) {
          console.log(`[finto supabase] RPC registra_acconto_prenotazione: CONTO_CAMBIATO (totale ${totale} atteso ${corpo.p_totale_atteso}, ricevuti ${ricevuti} attesi ${corpo.p_ricevuti_attesi})`)
          return rispondi(res, 400, { code: 'P0001', message: 'CONTO_CAMBIATO', details: JSON.stringify({ totale, ricevuti, totale_atteso: corpo.p_totale_atteso, ricevuti_attesi: corpo.p_ricevuti_attesi }), hint: null })
        }
      }
      const nuovo = { id: randomUUID(), booking_id: b.id, amount, method: corpo.p_metodo || 'contanti', paid_on: corpo.p_paid_on, chiave_operazione: corpo.p_chiave, soggiorno, created_at: new Date().toISOString() }
      if (modoGuasto === 'tardiva') {
        const attesa = new Promise(fine => setTimeout(() => { payments.push(nuovo); scrittureInCorso.delete(soggiorno); console.log(`[finto supabase] scrittura TARDIVA confermata: ${amount} ${nuovo.method} su ${b.id.slice(-4)} (chiave …${String(corpo.p_chiave).slice(-4)})`); fine() }, ritardoScrittura))
        scrittureInCorso.set(soggiorno, attesa)
        console.log(`[finto supabase] RPC ${rpc[1]} ← ${amount}: risposta 503 SUBITO, scrittura ancora in corso (arriva fra ${ritardoScrittura} ms)`)
        return rispondi(res, 503, { message: 'upstream request timeout' })
      }
      payments.push(nuovo)
      if (cameraDuranteRpc) {
        const c = cameraDuranteRpc; cameraDuranteRpc = null
        const prima = bookings.find(x => x.prenotazione_id === c.prenotazione_id) || b
        bookings.push(prenotazione(c.room_id, prima.guest_id, prima.check_in, prima.check_out, 1, { prenotazione_id: c.prenotazione_id, group_id: null, price_per_night: c.total_amount, total_amount: c.total_amount }))
        console.log(`[finto supabase] +1 CAMERA aggiunta subito dopo il movimento (${c.total_amount} € su prenotazione …${String(c.prenotazione_id).slice(-4)})`)
      }
      console.log(`[finto supabase] RPC ${rpc[1]} ← ${amount} ${nuovo.method} ${nuovo.paid_on} su ${b.id.slice(-4)}${modoGuasto === 'persa' ? ' — RISPOSTA PERSA' : ''}`)
      if (modoGuasto === 'persa') return rispondi(res, 503, { message: 'upstream connect error' })
      return rispondi(res, 200, { contratto: 'prenotazione_v1', movimento_id: nuovo.id, booking_id: b.id, importo: amount, soggiorno, gia_presente: false })
    })
  }
  if (rpc && (rpc[1] === 'segna_pagato_prenotazione' || rpc[1] === 'segna_pagato') && req.method === 'POST') {
    return leggiCorpo(req).then(async corpo => {
      const b = bookings.find(x => x.id === corpo?.p_booking_id)
      if (!b) return rispondi(res, 400, { code: 'P0001', message: 'PRENOTAZIONE_NON_TROVATA' })
      if (scrittureInCorso.has(soggiornoDi(b))) { console.log(`[finto supabase] RPC ${rpc[1]} in fila dietro la scrittura tardiva`); await scrittureInCorso.get(soggiornoDi(b)) }
      if (!corpo.p_chiave) return rispondi(res, 400, { code: 'P0001', message: 'CHIAVE_NULLA' })
      if ('p_mancante_atteso' in corpo && senza0057) return rispondi(res, 404, { code: 'PGRST202', message: `Could not find the function public.${rpc[1]}(p_booking_id, p_chiave, p_mancante_atteso, p_metodo, p_paid_on) in the schema cache`, details: null, hint: null })
      const soggiorno = soggiornoDi(b)
      const vive = righeSoggiorno(soggiorno).filter(r => ['confermata', 'completata'].includes(r.status))
      const ids = new Set(righeSoggiorno(soggiorno).map(r => r.id))
      const totale = vive.reduce((s, r) => s + Math.round(Number(r.total_amount) * 100), 0)
      const ricevuti = payments.filter(p => ids.has(p.booking_id)).reduce((s, p) => s + Math.round(Number(p.amount) * 100), 0)
      const mancante = Math.max(0, totale - ricevuti)
      let movimento = payments.find(p => p.chiave_operazione === corpo.p_chiave) || null
      // il mancante atteso (0057): con un conto diverso niente saldo inventato e niente bollino
      if (!movimento && corpo.p_mancante_atteso != null && mancante !== Math.round(Number(corpo.p_mancante_atteso) * 100)) {
        console.log(`[finto supabase] RPC ${rpc[1]}: CONTO_CAMBIATO (mancante ${mancante / 100} atteso ${corpo.p_mancante_atteso})`)
        return rispondi(res, 400, { code: 'P0001', message: 'CONTO_CAMBIATO', details: JSON.stringify({ totale: totale / 100, ricevuti: ricevuti / 100, mancante: mancante / 100, mancante_atteso: corpo.p_mancante_atteso }), hint: null })
      }
      if (!movimento && mancante > 0) {
        movimento = { id: randomUUID(), booking_id: b.id, amount: mancante / 100, method: corpo.p_metodo || 'contanti', paid_on: corpo.p_paid_on, chiave_operazione: corpo.p_chiave, soggiorno, created_at: new Date().toISOString() }
        payments.push(movimento)
      }
      for (const r of vive) r.pagato = true
      console.log(`[finto supabase] RPC segna_pagato_prenotazione ← ${vive.length} tratti, movimento ${movimento ? movimento.amount : 'nessuno'}`)
      return rispondi(res, 200, { contratto: 'prenotazione_v1', movimento_id: movimento ? movimento.id : null, booking_id: b.id, importo: movimento ? movimento.amount : 0, pagato: true, soggiorno, segmenti_aggiornati: vive.length })
    })
  }
  if (rpc) {
    return rispondi(res, 404, { code: 'PGRST202', message: `Could not find the function public.${rpc[1]} in the schema cache`, details: null, hint: null })
  }
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
  // Liberare una camera tenuta (15/09/2026): la richiesta cambia stato, non sparisce
  if (m && req.method === 'PATCH' && m[1] === 'richieste') {
    return leggiCorpo(req).then(corpo => {
      const righe = righeFiltrate('richieste', url)
      for (const r of righe) Object.assign(r, corpo)
      // il nome per intero lo compone solo lib/guestName: qui basta il cognome
      console.log(`[finto supabase] richieste aggiornate: ${righe.map(r => `${r.cognome} → ${r.stato}/${r.motivo_rifiuto ?? '-'}`).join(', ') || 'nessuna'}`)
      return rispondi(res, 200, righe)
    })
  }
  if (m && req.method === 'PATCH' && (m[1] === 'bookings' || m[1] === 'documenti_cliente' || m[1] === 'guests')) {
    return leggiCorpo(req).then(corpo => {
      const chiavi = Object.keys(corpo || {})
      const AMMESSI = ['guest_id', 'guest_name', 'pagato', 'bonifico', 'check_in', 'check_out', 'num_guests', 'price_per_night', 'room_id',
        'extra_bed', 'extra_bed_dates', 'extra_bed_total', 'extra_bed_importo', 'extra_bed_criterio',
        'total_amount', 'discount_type', 'discount_value', 'check_in_time', 'shuttle', 'updated_at',
        // «Arrivo e navetta» (proposta 0058, 21/09/2026)
        ...(senza0058 ? [] : COLONNE_0058),
        'status', 'cancelled_at', 'cancelled_reason', 'group_id', 'accordo_pagamento', 'caparra_centesimi', 'caparra_entro',
        // i fogli della scheda nuova del 17/09/2026: nota e colore, «con lei», il legame fra le camere
        'notes', 'color', 'source', 'extra_phone_1', 'extra_phone_1_name', 'chi_e', 'extra_phone_2', 'extra_phone_2_name', 'chi_e_2', 'prenotazione_id']
      // Con senza-0058 le colonne nuove non esistono: si risponde come
      // PostgREST quando una colonna manca davvero (PGRST204), non col 403
      // della preview, così l'app prova la strada del ripiego vera.
      const fuori = chiavi.filter(k => !AMMESSI.includes(k))
      if (m[1] === 'bookings' && senza0058 && fuori.some(k => COLONNE_0058.includes(k))) {
        const manca = fuori.find(k => COLONNE_0058.includes(k))
        return rispondi(res, 400, { code: 'PGRST204', message: `Could not find the '${manca}' column of 'bookings' in the schema cache` })
      }
      if (m[1] === 'bookings' && fuori.length) return rispondi(res, 403, { code: 'ANTEPRIMA', message: `scrittura non ammessa nella preview sintetica: ${fuori.join(', ')}` })
      if (m[1] === 'bookings' && erroreCambioCliente) return rispondi(res, 500, { code: 'FINTO', message: 'errore simulato sul cambio cliente' })
      let perdiRisposta = false
      if (m[1] === 'bookings' && erroreDopoScritture !== null) {
        if (patchRiuscite >= erroreDopoScritture) {
          if (!modoPersa) return rispondi(res, 500, { code: 'FINTO', message: `errore simulato dopo ${patchRiuscite} scritture` })
          perdiRisposta = true   // si scrive lo stesso, poi la risposta non parte
        }
        patchRiuscite += 1
      }
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
      console.log(`[finto supabase] PATCH ${m[1]} ${righe.length} righe ←`, JSON.stringify(corpo), perdiRisposta ? '(risposta persa)' : '')
      if (perdiRisposta) { res.socket.destroy(); return }
      return rispondi(res, 200, righe.map(r => applicaSelect(r, url.searchParams.get('select') || '*')))
    })
  }
  if (m && req.method === 'POST' && m[1] === 'strutture') return rispondi(res, 201, [])
  if (m && req.method === 'POST' && m[1] === 'payments') {
    return leggiCorpo(req).then(corpo => {
      const riga = Array.isArray(corpo) ? corpo[0] : corpo
      if (!riga || !riga.booking_id || !(Number(riga.amount) > 0)) return rispondi(res, 400, { code: '23502', message: 'booking_id o amount mancante' })
      const modoGuasto = errorePagamentoRpc; errorePagamentoRpc = null
      if (modoGuasto === 'caduta') { console.log('[finto supabase] POST payments: connessione caduta PRIMA di scrivere (503)'); return rispondi(res, 503, { message: 'upstream connect error' }) }
      const nuovo = { id: randomUUID(), booking_id: riga.booking_id, amount: Number(riga.amount), method: riga.method || 'contanti', paid_on: riga.paid_on || '2026-09-10', chiave_operazione: null, created_at: new Date().toISOString() }
      payments.push(nuovo)
      if (modoGuasto === 'persa') { console.log(`[finto supabase] POST payments ← ${nuovo.amount} — RISPOSTA PERSA`); return rispondi(res, 503, { message: 'upstream connect error' }) }
      console.log(`[finto supabase] +1 pagamento (${nuovo.amount} ${nuovo.method} su ${nuovo.booking_id.slice(-4)})`)
      const accept = req.headers.accept || ''
      return rispondi(res, 201, accept.includes('vnd.pgrst.object') ? nuovo : [nuovo])
    })
  }
  // La nota del pagamento (proposta 0055): PATCH sulla riga appena nata, solo `note`
  if (m && req.method === 'PATCH' && m[1] === 'payments') {
    return leggiCorpo(req).then(corpo => {
      const chiavi = Object.keys(corpo || {})
      if (chiavi.some(k => k !== 'note')) return rispondi(res, 403, { code: 'ANTEPRIMA', message: `scrittura non ammessa nella preview sintetica: ${chiavi.join(', ')}` })
      const righe = righeFiltrate('payments', url)
      for (const r of righe) r.note = corpo.note
      console.log(`[finto supabase] PATCH payments ${righe.length} righe ← nota «${corpo.note}»`)
      return rispondi(res, 200, righe.map(r => applicaSelect(r, url.searchParams.get('select') || '*')))
    })
  }
  if (m && req.method === 'DELETE' && m[1] === 'payments') {
    const righe = righeFiltrate('payments', url)
    for (const r of righe) payments.splice(payments.indexOf(r), 1)
    console.log(`[finto supabase] DELETE payments ${righe.length} righe`)
    // come PostgREST con «return=representation» (.select() dopo delete): le righe tolte
    return rispondi(res, 200, righe.map(r => applicaSelect(r, url.searchParams.get('select') || '*')))
  }
  // Nuova prenotazione (07/09/2026): l'inserimento in bookings si accetta in
  // memoria, per provare «prima camera → Aggiungi cambio camera → seconda camera»
  if (m && req.method === 'POST' && m[1] === 'bookings') {
    return leggiCorpo(req).then(corpo => {
      const riga = Array.isArray(corpo) ? corpo[0] : corpo
      if (!riga || !riga.room_id || !riga.guest_id) return rispondi(res, 400, { code: '23502', message: 'room_id o guest_id mancante' })
      // con senza-0058 l'inserimento deve cavarsela togliendo le colonne nuove
      if (senza0058) {
        const manca = Object.keys(riga).find(k => COLONNE_0058.includes(k))
        if (manca) return rispondi(res, 400, { code: 'PGRST204', message: `Could not find the '${manca}' column of 'bookings' in the schema cache` })
      }
      const nuova = prenotazione(riga.room_id, riga.guest_id, riga.check_in, riga.check_out, riga.num_guests ?? 1, { ...riga })
      bookings.push(nuova)
      console.log(`[finto supabase] +1 prenotazione (${nuova.room_id.slice(-4)}, ${nuova.check_in}, cliente ${nuova.guest_id.slice(-4)}, guest_name ${nuova.guest_name ?? '—'})`)
      const accept = req.headers.accept || ''
      const scelta = applicaSelect(nuova, url.searchParams.get('select') || '*')
      return rispondi(res, 201, accept.includes('vnd.pgrst.object') ? scelta : [scelta])
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
