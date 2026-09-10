// Cambia cliente (06/09/2026): la prenotazione cambia SOLO il riferimento al
// cliente; il cliente vecchio non entra in nessuna scrittura; con un errore
// di Supabase lo schermo non cambia e compare «Non salvato, riprova».
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  campiCambioCliente, filtroCambioCliente, stessoCliente, avvisiCambioCliente, provenienzaProposta,
  nuovoClienteDaModulo, messaggioCreazioneCliente, filtraClienti, salvaCambioCliente, testoDocumentiDaSpostare,
  ERRORE_NOME_MANCANTE, ERRORE_TELEFONO_MANCANTE, ERRORE_TELEFONO_CORTO, ERRORE_TELEFONO_DOPPIO, MESSAGGIO_NESSUNA_RIGA,
} from './cambiaCliente.ts'
import { MESSAGGIO_NON_SALVATO } from './scritturaSicura.ts'

const nida = { id: 'g-nida', full_name: 'Nida', phone: '393803826118', provenienza: 'altra_struttura', struttura_nome: 'Nida' }
type Cliente = { id: string; full_name: string; phone: string; provenienza?: string; struttura_nome?: string }
const prenotazioneNida: { id: string; group_id: string; guest_id: string; guest_name: string | null; guests: Cliente; [k: string]: unknown } = {
  id: 'b1', group_id: 'grp1', guest_id: 'g-nida', guest_name: 'Nida', guests: nida,
  check_in: '2026-09-06', check_out: '2026-09-07', price_per_night: 70, total_amount: 70, notes: 'arriva tardi', extra_bed_dates: ['2026-09-06'], num_guests: 2,
}

test('campi: solo guest_id e guest_name azzerato; date, prezzo, note, letti e persone NON entrano nel payload', () => {
  const campi = campiCambioCliente(prenotazioneNida, 'g-nuovo')
  assert.deepEqual(campi, { guest_id: 'g-nuovo', guest_name: null })
  assert.deepEqual(Object.keys(campi).sort(), ['guest_id', 'guest_name'])
})

test('campi: senza la colonna guest_name (prenotazioni vecchie) si scrive solo guest_id', () => {
  const { guest_name: _via, ...senzaColonna } = prenotazioneNida
  void _via
  assert.deepEqual(campiCambioCliente(senzaColonna, 'g-nuovo'), { guest_id: 'g-nuovo' })
})

test('filtro: con cambio camera si spostano tutti i segmenti (group_id), altrimenti la sola riga', () => {
  assert.deepEqual(filtroCambioCliente(prenotazioneNida), { colonna: 'group_id', valore: 'grp1' })
  assert.deepEqual(filtroCambioCliente({ id: 'b9', group_id: null }), { colonna: 'id', valore: 'b9' })
})

test('stesso cliente: scegliere di nuovo Nida non è un cambio', () => {
  assert.equal(stessoCliente(prenotazioneNida, 'g-nida'), true)
  assert.equal(stessoCliente(prenotazioneNida, 'g-nuovo'), false)
})

test('avvisi: conferma inviata e pagamenti avvisano ma non bloccano; senza nulla nessun avviso', () => {
  assert.deepEqual(avvisiCambioCliente({ pagamenti: 0, confermaInviata: false }), [])
  const a = avvisiCambioCliente({ pagamenti: 2, confermaInviata: true, nomeVecchio: 'Nida', segmenti: 2 })
  assert.equal(a.length, 3)
  assert.match(a[0], /conferma è già stata inviata a Nida/)
  assert.match(a[1], /2 movimenti di pagamento/)
  assert.match(a[2], /camere o periodi/)
  assert.match(avvisiCambioCliente({ pagamenti: 1, confermaInviata: false })[0], /un movimento di pagamento/)
})

test('provenienza proposta: da Nida → «Altra struttura → Nida»; da un cliente Google → Google; senza cliente → Non so', () => {
  assert.deepEqual(provenienzaProposta(nida, [{ nome: 'Nida' }]), { provenienza: 'altra_struttura', struttura: 'Nida' })
  // cliente che si chiama come una struttura nota ma senza provenienza salvata
  assert.deepEqual(provenienzaProposta({ id: 'x', full_name: 'Umana', provenienza: 'non_so' }, [{ nome: 'Umana' }, { nome: 'Nida' }]), { provenienza: 'altra_struttura', struttura: 'Umana' })
  assert.deepEqual(provenienzaProposta({ id: 'y', full_name: 'Mario Rossi', provenienza: 'google' }, []), { provenienza: 'google', struttura: '' })
  assert.deepEqual(provenienzaProposta(null, []), { provenienza: 'non_so', struttura: '' })
})

test('nuovo cliente: «Nome Cognome» prima il nome, telefono a cifre col 39, provenienza solo con le colonne', () => {
  const m = { nome: ' Anna ', cognome: 'Kowalska', telefono: '+39 333 123 4567', provenienza: 'altra_struttura' as const, struttura: 'Nida' }
  assert.deepEqual(nuovoClienteDaModulo(m, true), { ok: true, campi: { full_name: 'Anna Kowalska', phone: '393331234567', provenienza: 'altra_struttura', struttura_nome: 'Nida' } })
  assert.deepEqual(nuovoClienteDaModulo({ ...m, telefono: '3331234567' }, false), { ok: true, campi: { full_name: 'Anna Kowalska', phone: '393331234567' } })
  assert.deepEqual(nuovoClienteDaModulo({ ...m, cognome: '' }, false), { ok: true, campi: { full_name: 'Anna', phone: '393331234567' } })
  // Iniziali maiuscole anche se scritte in minuscolo (Ania, 06/09/2026)
  assert.equal((nuovoClienteDaModulo({ ...m, nome: 'liliana', cognome: 'micali' }, false) as { ok: true; campi: { full_name: string } }).campi.full_name, 'Liliana Micali')
})

test('nuovo cliente: senza nome o telefono non si crea nulla, con un messaggio chiaro', () => {
  const base = { nome: '', cognome: '', telefono: '3331234567', provenienza: 'non_so' as const, struttura: '' }
  assert.deepEqual(nuovoClienteDaModulo(base, true), { ok: false, errore: ERRORE_NOME_MANCANTE })
  assert.deepEqual(nuovoClienteDaModulo({ ...base, nome: 'Anna', telefono: '' }, true), { ok: false, errore: ERRORE_TELEFONO_MANCANTE })
  assert.deepEqual(nuovoClienteDaModulo({ ...base, nome: 'Anna', telefono: '12345' }, true), { ok: false, errore: ERRORE_TELEFONO_CORTO })
})

test('telefono già in archivio (guests.phone UNIQUE): messaggio dedicato, non «riprova»', () => {
  assert.equal(messaggioCreazioneCliente({ code: '23505', message: 'duplicate key value violates unique constraint "guests_phone_key"' }), ERRORE_TELEFONO_DOPPIO)
  assert.equal(messaggioCreazioneCliente({ code: '42501', message: 'permission denied' }), 'Cliente non creato, riprova')
})

test('ricerca: per nome o telefono, il cliente attuale mai in lista, ordine per nome', () => {
  const clienti = [nida, { id: 'g2', full_name: 'Rosa Macauda', phone: '393391179302' }, { id: 'g3', full_name: 'Anna Rossi', phone: '393331234567' }]
  assert.deepEqual(filtraClienti('', clienti, 'g-nida').map(c => c.id), ['g3', 'g2'])
  assert.deepEqual(filtraClienti('rosa mac', clienti, 'g-nida').map(c => c.id), ['g2'])
  assert.deepEqual(filtraClienti('333 123', clienti, 'g-nida').map(c => c.id), ['g3'])
  assert.deepEqual(filtraClienti('nida', clienti, 'g-nida'), [])
})

test('documenti sul cliente di partenza: proposta di spostarli con il conteggio; senza documenti nessuna riga', () => {
  assert.equal(testoDocumentiDaSpostare(0, 'Nida'), null)
  assert.equal(testoDocumentiDaSpostare(1, 'Nida'), 'Sposta anche il documento caricato su Nida al cliente nuovo')
  assert.equal(testoDocumentiDaSpostare(2, 'Nida'), 'Sposta anche i 2 documenti caricati su Nida al cliente nuovo')
  assert.equal(testoDocumentiDaSpostare(2, null), 'Sposta anche i 2 documenti caricati al cliente nuovo')
})

// ── Salvataggio con esito controllato ──────────────────────────────────────

test('salvataggio: con errore di Supabase la scheda resta su Nida e compare «Non salvato, riprova»', async () => {
  let booking = { ...prenotazioneNida }
  const scritture: unknown[] = []
  const messaggio = await salvaCambioCliente(
    () => { scritture.push(campiCambioCliente(booking, 'g-nuovo')); return Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied for table bookings' } }) },
    () => { booking = { ...booking, guest_id: 'g-nuovo', guest_name: null } },
  )
  assert.equal(messaggio, MESSAGGIO_NON_SALVATO)
  assert.equal(booking.guest_id, 'g-nida')
  assert.equal(booking.guest_name, 'Nida')
  assert.equal(scritture.length, 1)
})

test('salvataggio: senza rete lo dice e non cambia nulla', async () => {
  let cambiato = false
  const messaggio = await salvaCambioCliente(() => Promise.reject(new TypeError('Failed to fetch')), () => { cambiato = true })
  assert.match(messaggio ?? '', /Non salvato, riprova/)
  assert.equal(cambiato, false)
})

test('salvataggio: zero righe toccate (prenotazione sparita) → messaggio, schermo fermo', async () => {
  let cambiato = false
  const messaggio = await salvaCambioCliente(() => Promise.resolve({ data: [], error: null }), () => { cambiato = true })
  assert.equal(messaggio, MESSAGGIO_NESSUNA_RIGA)
  assert.equal(cambiato, false)
})

test('salvataggio riuscito: la prenotazione passa al cliente nuovo, il cliente vecchio non è toccato, il resto è identico', async () => {
  let booking = { ...prenotazioneNida }
  const clienteVecchio = { ...nida }
  const tabellaGuests = new Map<string, Cliente>([[nida.id, nida], ['g-nuovo', { id: 'g-nuovo', full_name: 'Anna Kowalska', phone: '393331234567' }]])
  const messaggio = await salvaCambioCliente(
    () => Promise.resolve({ data: [{ id: 'b1' }], error: null }),
    () => { booking = { ...booking, ...campiCambioCliente(booking, 'g-nuovo'), guests: tabellaGuests.get('g-nuovo')! } },
  )
  assert.equal(messaggio, null)
  assert.equal(booking.guest_id, 'g-nuovo')
  assert.equal(booking.guest_name, null)
  assert.equal(booking.guests.full_name, 'Anna Kowalska')
  assert.deepEqual(tabellaGuests.get('g-nida'), clienteVecchio)
  // tutto il resto identico
  const { guest_id: _a, guest_name: _b, guests: _c, ...restoPrima } = prenotazioneNida
  const { guest_id: _d, guest_name: _e, guests: _f, ...restoDopo } = booking
  void _a; void _b; void _c; void _d; void _e; void _f
  assert.deepEqual(restoDopo, restoPrima)
})

test('camere parallele e cambi camera passano insieme al cliente nuovo', () => {
  assert.deepEqual(filtroCambioCliente({id:'a',group_id:'g',prenotazione_id:'p'}),{colonna:'prenotazione_id',valore:'p'})
})
