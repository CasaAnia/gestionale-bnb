// ============================================================================
// I MESSAGGI AL MOMENTO GIUSTO (punto 6, 21/09/2026).
//
// Qui si prova la SCELTA: in che fase è il soggiorno e quali messaggi si
// consigliano, nell'ordine esatto approvato da Ania. Date sintetiche, nessun
// orologio: «oggi» arriva da fuori.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { faseMessaggi, messaggiUtili, TUTTI_I_MESSAGGI, UTILI_ADESSO, TITOLO_CONFERMA, SOTTOTITOLO_CONFERMA } from './messaggiFase.ts'
import { MESSAGGI_SCHEDA, MESSAGGIO_ANNULLAMENTO, type TipoMessaggio } from './messaggiPrenotazione.ts'
import type { SegmentoScheda } from './schedaPrenotazione.ts'

let n = 0
const tratto = (check_in: string, check_out: string, extra: Partial<SegmentoScheda> = {}): SegmentoScheda =>
  ({ id: `b${++n}`, check_in, check_out, status: 'confermata', num_guests: 2, ...extra }) as SegmentoScheda

const etichette = (fase: Parameters<typeof messaggiUtili>[0]) => messaggiUtili(fase).map(m => m.label)
const tipi = (fase: Parameters<typeof messaggiUtili>[0]) => messaggiUtili(fase).map(m => m.tipo)

// ── La fase, dalle date della prenotazione intera ───────────────────────────

test('prima, durante e dopo: un soggiorno semplice', () => {
  const soggiorno = [tratto('2026-09-10', '2026-09-13')]
  assert.equal(faseMessaggi(soggiorno, '2026-09-01'), 'prima')
  assert.equal(faseMessaggi(soggiorno, '2026-09-09'), 'prima', 'il giorno prima dell’arrivo è ancora «prima»')
  assert.equal(faseMessaggi(soggiorno, '2026-09-11'), 'durante')
  assert.equal(faseMessaggi(soggiorno, '2026-09-30'), 'dopo')
})

test('il giorno dell’ARRIVO è già «durante», il giorno della PARTENZA è già «dopo»', () => {
  const soggiorno = [tratto('2026-09-10', '2026-09-13')]
  assert.equal(faseMessaggi(soggiorno, '2026-09-10'), 'durante', 'arrivo oggi: è cominciato')
  assert.equal(faseMessaggi(soggiorno, '2026-09-13'), 'dopo', 'partenza oggi: è finito')
  // una notte sola: arriva e riparte
  const unaNotte = [tratto('2026-09-10', '2026-09-11')]
  assert.equal(faseMessaggi(unaNotte, '2026-09-10'), 'durante')
  assert.equal(faseMessaggi(unaNotte, '2026-09-11'), 'dopo')
})

test('col cambio camera il soggiorno resta UNO: non è «concluso» al primo cambio', () => {
  // Lena 24 → 26, poi Ambra 26 → 28: il 26 è il giorno del cambio, non la fine
  const cambio = [tratto('2026-09-24', '2026-09-26'), tratto('2026-09-26', '2026-09-28')]
  assert.equal(faseMessaggi(cambio, '2026-09-23'), 'prima')
  assert.equal(faseMessaggi(cambio, '2026-09-26'), 'durante', 'il giorno del cambio camera NON è una partenza')
  assert.equal(faseMessaggi(cambio, '2026-09-27'), 'durante')
  assert.equal(faseMessaggi(cambio, '2026-09-28'), 'dopo')
  // e l'ordine dei tratti non conta: le date si guardano tutte
  const alContrario = [tratto('2026-09-26', '2026-09-28'), tratto('2026-09-24', '2026-09-26')]
  assert.equal(faseMessaggi(alContrario, '2026-09-25'), 'durante')
})

test('con una pausa in mezzo si resta «durante», non «dopo»', () => {
  // Amelia 19 → 21 set, due notti fuori, Allegra 23 → 25 set
  const conPausa = [tratto('2026-09-19', '2026-09-21'), tratto('2026-09-23', '2026-09-25')]
  assert.equal(faseMessaggi(conPausa, '2026-09-21'), 'durante', 'la pausa non chiude il soggiorno')
  assert.equal(faseMessaggi(conPausa, '2026-09-22'), 'durante')
  assert.equal(faseMessaggi(conPausa, '2026-09-25'), 'dopo')
})

test('due camere nelle stesse notti: una fase sola, dall’ultima partenza', () => {
  // lei in Lena 20 → 22, la sorella in Amelia 20 → 24
  const insieme = [tratto('2026-09-20', '2026-09-22'), tratto('2026-09-20', '2026-09-24')]
  assert.equal(faseMessaggi(insieme, '2026-09-22'), 'durante', 'una camera è partita, il soggiorno no')
  assert.equal(faseMessaggi(insieme, '2026-09-24'), 'dopo')
})

test('i tratti annullati non spostano la fase; annullata tutta è «annullata»', () => {
  // un tratto è stato annullato e allungava il soggiorno: non conta
  const con = [tratto('2026-09-10', '2026-09-12'), tratto('2026-09-12', '2026-09-20', { status: 'annullata' })]
  assert.equal(faseMessaggi(con, '2026-09-13'), 'dopo', 'il tratto annullato non tiene aperto il soggiorno')
  assert.equal(faseMessaggi([tratto('2026-08-20', '2026-08-22', { status: 'annullata' })], '2026-09-21'), 'annullata')
  assert.equal(faseMessaggi([], '2026-09-21'), 'annullata', 'senza tratti attivi non c’è un soggiorno')
  // annullata vuol dire TUTTE le camere annullate, non una
  const tutteAnnullate = [tratto('2026-09-24', '2026-09-26', { status: 'annullata' }), tratto('2026-09-24', '2026-09-28', { status: 'annullata' })]
  assert.equal(faseMessaggi(tutteAnnullate, '2026-09-21'), 'annullata')
})

// ── REGRESSIONE (verifica indipendente del 21/09/2026 sera) ────────────────
// Il difetto: la scheda passava lo stato della SOLA riga aperta, e una
// prenotazione con una camera annullata e una confermata diventava
// «annullata» se si entrava dal link della riga annullata. Adesso la fase non
// può nemmeno ricevere lo stato di una riga: conta solo quanti tratti attivi
// ci sono.
test('prenotazione MISTA: una camera annullata e una confermata → la stessa fase da qualunque riga si apra', () => {
  const annullata = tratto('2026-09-24', '2026-09-26', { id: 'A', status: 'annullata' })
  const confermata = tratto('2026-09-24', '2026-09-28', { id: 'B', status: 'confermata' })
  const righe = [annullata, confermata]
  // le stesse righe, nei due ordini in cui la scheda può caricarle
  assert.equal(faseMessaggi(righe, '2026-09-21'), 'prima')
  assert.equal(faseMessaggi([confermata, annullata], '2026-09-21'), 'prima')
  // e i suggerimenti sono quelli di «prima», non quelli dell'annullata
  assert.deepEqual(messaggiUtili(faseMessaggi(righe, '2026-09-21')).map(m => m.tipo),
    ['conferma', 'richiesta_orario', 'dati_bonifico', 'pagamento_ricevuto'])
  // la camera annullata non allunga nemmeno il soggiorno
  const piuLunga = [tratto('2026-09-10', '2026-09-12'), tratto('2026-09-12', '2026-09-30', { status: 'annullata' })]
  assert.equal(faseMessaggi(piuLunga, '2026-09-20'), 'dopo')
})

test('date mancanti o rovinate: «incerta», non si indovina un soggiorno', () => {
  assert.equal(faseMessaggi([tratto('', '2026-09-12')], '2026-09-21'), 'incerta')
  assert.equal(faseMessaggi([tratto('2026-09-10', 'boh')], '2026-09-21'), 'incerta')
  assert.equal(faseMessaggi([tratto('2026-09-10', '2026-09-12')], ''), 'incerta')
  // un'ora attaccata alla data non è un errore: si legge il giorno
  assert.equal(faseMessaggi([tratto('2026-09-10', '2026-09-12')], '2026-09-11T22:00:00+02:00'), 'durante')
})

// ── REGRESSIONE (stessa verifica): date che sembrano date ma non lo sono ────
test('giorni che sul calendario non esistono, e partenza prima dell’arrivo: «incerta»', () => {
  // mese 13 e giorno 40 passavano per buoni perché si guardavano solo le cifre
  assert.equal(faseMessaggi([tratto('2026-13-40', '2026-13-41')], '2026-09-21'), 'incerta')
  assert.equal(faseMessaggi([tratto('2026-02-30', '2026-03-02')], '2026-09-21'), 'incerta', 'il 30 febbraio non esiste')
  assert.equal(faseMessaggi([tratto('2026-00-10', '2026-01-12')], '2026-09-21'), 'incerta')
  assert.equal(faseMessaggi([tratto('2026-09-10', '2026-09-12')], '2026-13-01'), 'incerta', 'nemmeno «oggi» può essere una data finta')
  // partenza PRIMA dell'arrivo: prima veniva fuori «prima», come se il
  // soggiorno dovesse ancora cominciare
  assert.equal(faseMessaggi([tratto('2026-09-28', '2026-09-24')], '2026-09-21'), 'incerta')
  // e nemmeno zero notti: arrivo e partenza lo stesso giorno
  assert.equal(faseMessaggi([tratto('2026-09-28', '2026-09-28')], '2026-09-21'), 'incerta')
  // il 29 febbraio di un bisestile è un giorno vero e resta buono
  assert.equal(faseMessaggi([tratto('2028-02-28', '2028-02-29')], '2028-02-28'), 'durante')
  // una riga rovinata fra le buone basta a non fidarsi
  const mista = [tratto('2026-09-24', '2026-09-26'), tratto('2026-13-01', '2026-13-05')]
  assert.equal(faseMessaggi(mista, '2026-09-21'), 'incerta')
})

// ── I suggerimenti, nell'ordine approvato ───────────────────────────────────

test('PRIMA dell’arrivo, l’ordine esatto deciso da Ania', () => {
  assert.deepEqual(tipi('prima'), ['conferma', 'richiesta_orario', 'dati_bonifico', 'pagamento_ricevuto'])
  assert.deepEqual(etichette('prima'), [
    'Conferma · solo testo', 'Richiesta orario', 'Dati bonifico', 'Pagamento ricevuto',
  ])
})

test('«Pagamento ricevuto» si propone anche PRIMA dell’arrivo: serve per acconti e anticipi', () => {
  assert.ok(tipi('prima').includes('pagamento_ricevuto'))
  assert.ok(tipi('durante').includes('pagamento_ricevuto'))
})

test('DURANTE e DOPO, l’ordine approvato', () => {
  assert.deepEqual(tipi('durante'), ['pagamento_ricevuto', 'modifica', 'libero'])
  assert.deepEqual(etichette('durante'), ['Pagamento ricevuto', 'Modifica soggiorno', 'Messaggio libero'])
  assert.deepEqual(tipi('dopo'), ['ringraziamento', 'libero'])
  assert.deepEqual(etichette('dopo'), ['Ringraziamento', 'Messaggio libero'])
})

test('annullata e incerta: niente messaggi che danno per vivo un soggiorno che non c’è', () => {
  assert.deepEqual(tipi('annullata'), ['annullamento', 'libero'])
  assert.deepEqual(tipi('incerta'), ['libero'])
  for (const fase of ['annullata', 'incerta'] as const) {
    for (const tipo of ['conferma', 'richiesta_orario', 'modifica', 'ringraziamento', 'dati_bonifico'] as TipoMessaggio[]) {
      assert.equal(tipi(fase).includes(tipo), false, `«${tipo}» non si consiglia con la fase «${fase}»`)
    }
  }
})

// ── Niente si perde ─────────────────────────────────────────────────────────

test('TUTTI I MESSAGGI sono nove, nell’ordine approvato, con l’annullamento in fondo', () => {
  assert.deepEqual(TUTTI_I_MESSAGGI.map(m => m.label), [
    'Conferma · solo testo', 'Dati bonifico', 'Richiesta orario', 'Pagamento ricevuto',
    'Modifica soggiorno', 'Messaggio libero', 'Promemoria bonifico', 'Ringraziamento',
    'Messaggio di annullamento',
  ])
  assert.equal(TUTTI_I_MESSAGGI.at(-1)?.tipo, 'annullamento')
  // nessun doppione, e ogni tipo compare una volta sola
  const tutti = TUTTI_I_MESSAGGI.map(m => m.tipo)
  assert.equal(new Set(tutti).size, tutti.length)
})

test('in qualunque fase ogni messaggio resta raggiungibile, e i consigliati sono un sottoinsieme', () => {
  const tutti = new Set(TUTTI_I_MESSAGGI.map(m => m.tipo))
  // i nove sono gli otto della lista più l'annullamento: niente è rimasto fuori
  assert.deepEqual([...tutti].sort(), [...MESSAGGI_SCHEDA.map(m => m.tipo), MESSAGGIO_ANNULLAMENTO.tipo].sort())
  for (const fase of ['prima', 'durante', 'dopo', 'annullata', 'incerta'] as const) {
    const utili = messaggiUtili(fase)
    assert.ok(utili.length > 0, `la fase «${fase}» non consiglia niente`)
    for (const m of utili) {
      assert.ok(tutti.has(m.tipo), `«${m.tipo}» non sta fra tutti i messaggi`)
      // l'etichetta è la STESSA nei due posti: nessun nome inventato per il suggerimento
      assert.equal(m.label, TUTTI_I_MESSAGGI.find(x => x.tipo === m.tipo)?.label)
    }
    assert.equal(new Set(utili.map(m => m.tipo)).size, utili.length, `doppioni fra i consigliati di «${fase}»`)
  }
})

test('la conferma con immagine non è un messaggio della lista: sta a parte, sempre in cima', () => {
  // il tasto grande apre ConfermaWhatsApp: non ha un tipo di testo suo
  assert.equal(TUTTI_I_MESSAGGI.some(m => m.label === TITOLO_CONFERMA), false)
  assert.equal(TITOLO_CONFERMA, 'Conferma prenotazione')
  assert.equal(SOTTOTITOLO_CONFERMA, 'Immagine e testo')
  // «Conferma · solo testo» invece è il messaggio testuale, e resta raggiungibile
  assert.ok(TUTTI_I_MESSAGGI.some(m => m.tipo === 'conferma'))
  assert.equal(UTILI_ADESSO, 'Utili adesso')
})
