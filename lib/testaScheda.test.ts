// La testa della scheda (20/09/2026 sera): le prove della logica pura.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  dateTesta, arrivoTesta, percorsoTesta, oggiTesta, residuoTesta, giornoEMese,
  ORARIO_DA_DEFINIRE, NAVETTA_DA_VERIFICARE, NAVETTA_NON_RICHIESTA, CON_NAVETTA,
  SOGGIORNO_CONCLUSO, PRENOTAZIONE_ANNULLATA_TESTA, NON_IN_CASA, PROSSIMO_CAMBIO, PARTE, PRIMA_CAMERA, TORNA, PARTITA,
  RESTA_DA_INCASSARE, SALDATO_TESTA, BONIFICO_ATTESO, CONTO_DA_RILEGGERE, SEGNATA_PAGATA_TESTA,
} from './testaScheda.ts'
import { riepilogoConto } from './schedaConto.ts'
import type { SegmentoScheda } from './schedaPrenotazione.ts'

type Camera = NonNullable<SegmentoScheda['rooms']>
const AMBRA: Camera = { id: 'ambra', name: 'Ambra', base_price: 80, has_extra_bed: true, extra_bed_price: 10 }
const AMELIA: Camera = { id: 'amelia', name: 'Amelia', base_price: 70, has_extra_bed: true, extra_bed_price: 5 }
const LENA: Camera = { id: 'lena', name: 'Lena', base_price: 80, has_extra_bed: true, extra_bed_price: 10 }
const seg = (id: string, camera: Camera, check_in: string, check_out: string, extra: Partial<SegmentoScheda> = {}): SegmentoScheda => ({
  id, room_id: camera.id, check_in, check_out, status: 'confermata', num_guests: 1, price_per_night: 80,
  extra_bed: false, extra_bed_dates: [], extra_bed_total: 0, total_amount: 160, rooms: camera, group_id: 'g', ...extra,
})
// Il riferimento: Ambra 1→7, Amelia 7→11, Ambra 11→22, Lena 22→25 settembre (salvato in disordine, con un tratto annullato)
const ROSA = [
  seg('c', AMBRA, '2026-09-11', '2026-09-22', { total_amount: 880 }),
  seg('a', AMBRA, '2026-09-01', '2026-09-07', { total_amount: 480 }),
  seg('d', LENA, '2026-09-22', '2026-09-25', { total_amount: 240 }),
  seg('b', AMELIA, '2026-09-07', '2026-09-11', { price_per_night: 70, total_amount: 280 }),
  seg('x', AMBRA, '2026-09-25', '2026-09-28', { status: 'annullata' }),
]

test('le date del riferimento: «mar 1 settembre» → «ven 25 settembre», 24 notti, senza anno', () => {
  const d = dateTesta('2026-09-01', '2026-09-25', 24)
  assert.deepEqual(d.arrivo, { settimana: 'mar', giorno: 1, mese: 'settembre', anno: '' })
  assert.deepEqual(d.partenza, { settimana: 'ven', giorno: 25, mese: 'settembre', anno: '' })
  assert.equal(d.notti, '24 notti')
  assert.equal(dateTesta('2026-09-01', '2026-09-02', 1).notti, '1 notte')
})

test('a cavallo di mese e di anno: il mese lo dice ogni data; l’anno compare solo quando i due anni sono diversi', () => {
  const mese = dateTesta('2026-09-30', '2026-10-02', 2)
  assert.equal(`${mese.arrivo.giorno} ${mese.arrivo.mese}`, '30 settembre')
  assert.equal(`${mese.partenza.giorno} ${mese.partenza.mese}`, '2 ottobre')
  assert.equal(mese.arrivo.anno, '')
  const anno = dateTesta('2026-12-30', '2027-01-02', 3)
  assert.equal(anno.arrivo.anno, '2026')
  assert.equal(anno.partenza.anno, '2027')
  assert.equal(anno.partenza.settimana, 'sab')
})

test('orario e navetta: i dati veri, oppure cosa manca; un valore assente NON è «no»', () => {
  assert.deepEqual(arrivoTesta('15:10', 'si'), { orario: 'Arriva alle 15:10', navetta: CON_NAVETTA, orarioDaDefinire: false, navettaDaVerificare: false })
  assert.deepEqual(arrivoTesta(null, null), { orario: ORARIO_DA_DEFINIRE, navetta: NAVETTA_DA_VERIFICARE, orarioDaDefinire: true, navettaDaVerificare: true })
  assert.equal(arrivoTesta('', 'no').navetta, NAVETTA_NON_RICHIESTA)
  assert.equal(arrivoTesta('  ', undefined).orario, ORARIO_DA_DEFINIRE)
  assert.equal(arrivoTesta('16:00', '').navetta, NAVETTA_DA_VERIFICARE)
})

test('ospiti e cambi: «1 ospite · 3 cambi camera» e tutti i nomi, anche ripetuti (quattro periodi = tre cambi)', () => {
  assert.deepEqual(percorsoTesta(ROSA), { sopra: '1 ospite · 3 cambi camera', camere: 'Ambra ⇄ Amelia ⇄ Ambra ⇄ Lena' })
  // una camera sola: niente cambi inventati
  assert.deepEqual(percorsoTesta([seg('a', LENA, '2026-09-10', '2026-09-12', { num_guests: 2 })]), { sopra: '2 ospiti', camere: 'Lena' })
  // un cambio solo: singolare
  assert.deepEqual(percorsoTesta([seg('a', LENA, '2026-09-10', '2026-09-12'), seg('b', AMELIA, '2026-09-12', '2026-09-14')]), { sopra: '1 ospite · 1 cambio camera', camere: 'Lena ⇄ Amelia' })
  // ritorno nella stessa camera dopo un'altra: due cambi, tre nomi
  assert.deepEqual(percorsoTesta([seg('a', LENA, '2026-09-10', '2026-09-12'), seg('b', AMELIA, '2026-09-12', '2026-09-14'), seg('c', LENA, '2026-09-14', '2026-09-16')]).camere, 'Lena ⇄ Amelia ⇄ Lena')
  // due camere nelle stesse notti: «+», non un cambio
  const parallele = [seg('p1', LENA, '2026-09-10', '2026-09-12', { group_id: 'g1', num_guests: 2 }), seg('p2', AMELIA, '2026-09-10', '2026-09-12', { group_id: 'g2' })]
  assert.deepEqual(percorsoTesta(parallele), { sopra: '3 ospiti · 2 camere insieme', camere: 'Lena + Amelia' })
})

test('il riferimento al 20 settembre: «Oggi · 20 settembre», «In Ambra», «Prossimo cambio: 22 settembre → Lena»', () => {
  assert.deepEqual(oggiTesta(ROSA, '2026-09-20', 'confermata'), { sopra: 'Oggi · 20 settembre', titolo: 'In Ambra', prossimo: { testo: PROSSIMO_CAMBIO, forte: '22 settembre → Lena' } })
})

test('col passare dei giorni: al 22 «In Lena» e poi la partenza il 25; al 24 idem; il 25 (giorno della partenza) il soggiorno è concluso', () => {
  assert.deepEqual(oggiTesta(ROSA, '2026-09-22', 'confermata'), { sopra: 'Oggi · 22 settembre', titolo: 'In Lena', prossimo: { testo: PARTE, forte: '25 settembre' } })
  assert.equal(oggiTesta(ROSA, '2026-09-24', 'confermata').titolo, 'In Lena')
  // la notte della partenza non è del soggiorno
  assert.deepEqual(oggiTesta(ROSA, '2026-09-25', 'confermata'), { sopra: 'Oggi · 25 settembre', titolo: SOGGIORNO_CONCLUSO, prossimo: { testo: PARTITA, forte: '25 settembre' } })
  assert.equal(oggiTesta(ROSA, '2026-10-03', 'completata').titolo, SOGGIORNO_CONCLUSO)
  // il giorno del cambio la notte è già nella camera nuova; il 10 (ultima notte in Amelia) il prossimo cambio è l'11
  assert.equal(oggiTesta(ROSA, '2026-09-07', 'confermata').titolo, 'In Amelia')
  assert.deepEqual(oggiTesta(ROSA, '2026-09-10', 'confermata').prossimo, { testo: PROSSIMO_CAMBIO, forte: '11 settembre → Ambra' })
  // il primo giorno: in Ambra, prossimo cambio il 7
  assert.deepEqual(oggiTesta(ROSA, '2026-09-01', 'confermata'), { sopra: 'Oggi · 1 settembre', titolo: 'In Ambra', prossimo: { testo: PROSSIMO_CAMBIO, forte: '7 settembre → Amelia' } })
})

test('prenotazione futura: «Arriva l’1 settembre» (elisione della regola n. 3) e la prima camera, senza «In …»', () => {
  assert.deepEqual(oggiTesta(ROSA, '2026-08-20', 'confermata'), { sopra: 'Oggi · 20 agosto', titolo: "Arriva l'1 settembre", prossimo: { testo: PRIMA_CAMERA, forte: 'Ambra' } })
  assert.equal(oggiTesta([seg('a', LENA, '2026-10-18', '2026-10-20')], '2026-09-20', 'confermata').titolo, 'Arriva il 18 ottobre')
  // l'anno, se l'arrivo è in un altro anno
  assert.equal(oggiTesta([seg('a', LENA, '2027-01-08', '2027-01-10')], '2026-12-20', 'confermata').titolo, "Arriva l'8 gennaio 2027")
})

test('annullata: stato coerente, nessun evento futuro; senza tratti attivi lo stesso', () => {
  assert.deepEqual(oggiTesta(ROSA, '2026-09-20', 'annullata'), { sopra: 'Oggi · 20 settembre', titolo: PRENOTAZIONE_ANNULLATA_TESTA, prossimo: null })
  assert.equal(oggiTesta([seg('x', AMBRA, '2026-09-25', '2026-09-28', { status: 'annullata' })], '2026-09-20', 'confermata').titolo, PRENOTAZIONE_ANNULLATA_TESTA)
  // annullata: le camere si leggono lo stesso, per dire com'era
  assert.deepEqual(percorsoTesta([seg('x', AMBRA, '2026-09-25', '2026-09-28', { status: 'annullata', num_guests: 2 })]), { sopra: '2 ospiti', camere: 'Ambra' })
})

test('due camere insieme: «In Lena + Amelia»; una pausa nel soggiorno: «Stanotte non in casa» e quando torna', () => {
  const parallele = [seg('p1', LENA, '2026-09-19', '2026-09-22', { group_id: 'g1' }), seg('p2', AMELIA, '2026-09-19', '2026-09-22', { group_id: 'g2' })]
  assert.deepEqual(oggiTesta(parallele, '2026-09-20', 'confermata'), { sopra: 'Oggi · 20 settembre', titolo: 'In Lena + Amelia', prossimo: { testo: PARTE, forte: '22 settembre' } })
  // Amelia va via prima: il prossimo cambio è «solo Lena»
  const sfalsate = [seg('p1', LENA, '2026-09-19', '2026-09-24', { group_id: 'g1' }), seg('p2', AMELIA, '2026-09-19', '2026-09-22', { group_id: 'g2' })]
  assert.deepEqual(oggiTesta(sfalsate, '2026-09-20', 'confermata').prossimo, { testo: PROSSIMO_CAMBIO, forte: '22 settembre → Lena' })
  const conPausa = [seg('a', LENA, '2026-10-20', '2026-10-22', { group_id: 'g1' }), seg('b', LENA, '2026-10-23', '2026-10-25', { group_id: 'g2' })]
  assert.deepEqual(oggiTesta(conPausa, '2026-10-22', 'confermata'), { sopra: 'Oggi · 22 ottobre', titolo: NON_IN_CASA, prossimo: { testo: TORNA, forte: '23 ottobre → Lena' } })
  // la sera prima della pausa: parte domani e torna il 23
  assert.deepEqual(oggiTesta(conPausa, '2026-10-21', 'confermata').prossimo, { testo: PARTE, forte: '22 ottobre, torna: 23 ottobre' })
})

test('il residuo in testa viene dal conto: 1.080 €; saldato → «Saldato» e 0 €; conto non letto → niente cifra, mai 0 €; bonifico atteso', () => {
  assert.deepEqual(residuoTesta(riepilogoConto({ totaleCent: 188000, ricevutiCent: 80000 })), { etichetta: RESTA_DA_INCASSARE, importo: '1.080 €' })
  assert.deepEqual(residuoTesta(riepilogoConto({ totaleCent: 55000, ricevutiCent: 55000 })), { etichetta: SALDATO_TESTA, importo: '0 €' })
  assert.deepEqual(residuoTesta(null), { etichetta: CONTO_DA_RILEGGERE, importo: null })
  // il vecchio segno «pagato» senza i movimenti: la cifra vera resta, come nel conto
  assert.deepEqual(residuoTesta(riepilogoConto({ totaleCent: 68000, ricevutiCent: 0 }, true)), { etichetta: SEGNATA_PAGATA_TESTA, importo: '680 €' })
  // annullata: niente cifra
  assert.deepEqual(residuoTesta(riepilogoConto({ totaleCent: 0, ricevutiCent: 0 }), false, true), { etichetta: PRENOTAZIONE_ANNULLATA_TESTA, importo: null })
  assert.deepEqual(residuoTesta(riepilogoConto({ totaleCent: 30000, ricevutiCent: 0 }), true), { etichetta: BONIFICO_ATTESO, importo: '300 €' })
  // «bonifico atteso» lo decide la pagina con statoConto (accordo bonifico e niente ricevuto): qui si scrive soltanto
})

test('«22 settembre», e «2 gennaio 2027» quando l’anno non è quello di riferimento', () => {
  assert.equal(giornoEMese('2026-09-22'), '22 settembre')
  assert.equal(giornoEMese('2026-09-22', 2026), '22 settembre')
  assert.equal(giornoEMese('2027-01-02', 2026), '2 gennaio 2027')
})
