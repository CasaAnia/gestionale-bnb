// Integrazione della proposta pulizie approvata il 25/09/2026: dotazione per
// letti e ospiti, statistiche con copertura, timer, Home invariata.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { proponiAssetto, dotazioneDaAssetto, totalePezzi, proponiAssettoDaSoggiorno, recuperoDaRiga, recuperiOltre, pezziVuoti, recuperiPerVoce, type PezziPulizie } from './dotazionePulizie.ts'
import { interventiDaTabelle, statistichePulizie, csvInterventi } from './pulizieDotazioneStatistiche.ts'
import { secondiTimer, minutiTimer, totaleProposto, chiaveTimerPulizia, descriviChiave, testoCronometro } from './tempoPulizie.ts'
import { strisciaSettimane, simboliCambi } from './numeriOggi.ts'
import { pulizieAperte, cicloCambio, type Decisione } from './pulizie.ts'
import { prossimePulizie, rinviiInCorso, confermateNelGiorno, lettiProposti } from './pulizieVista.ts'
import { messaggioRifiuto } from './pulizieOperazioni.ts'

const somma = (p: PezziPulizie) => totalePezzi(p)
const lenzuola = (p: PezziPulizie) => p.sotto_matrimoniale + p.sopra_matrimoniale + p.sotto_singolo + p.sopra_singolo
const asciugamani = (p: PezziPulizie) => p.telo_doccia + p.asciugamano_viso + p.asciugamano_mani

test('dotazione: tutte le configurazioni di Ania, con i numeri esatti', () => {
  const lenaSeparati = dotazioneDaAssetto(proponiAssetto('Lena', 2, true)!)
  assert.deepEqual([lenaSeparati.sotto_matrimoniale, lenaSeparati.sotto_singolo, lenaSeparati.federe, lenaSeparati.telo_doccia, somma(lenaSeparati)], [1, 1, 6, 2, 18])
  const lenaDue = dotazioneDaAssetto(proponiAssetto('Lena', 2, false)!)
  assert.deepEqual([lenaDue.sotto_matrimoniale, lenaDue.sotto_singolo, lenaDue.federe, lenaDue.telo_doccia], [1, 0, 4, 2], 'Lena in due di norma: il solo matrimoniale')
  const ameliaDue = dotazioneDaAssetto(proponiAssetto('Amelia', 2, true)!)
  assert.deepEqual([ameliaDue.sotto_singolo, ameliaDue.sotto_matrimoniale, ameliaDue.federe, ameliaDue.telo_doccia, somma(ameliaDue)], [2, 0, 4, 2, 16])
  const ameliaUno = dotazioneDaAssetto(proponiAssetto('Amelia', 1, false)!)
  assert.deepEqual([ameliaUno.sotto_singolo, ameliaUno.federe, ameliaUno.telo_doccia], [1, 2, 1])
  const lenaQuattro = dotazioneDaAssetto(proponiAssetto('Lena', 4, true)!)
  assert.equal(somma(lenaQuattro), 28)
  assert.equal(lenzuola(lenaQuattro), 6); assert.equal(lenaQuattro.federe, 8); assert.equal(asciugamani(lenaQuattro), 12)
  assert.equal(lenaQuattro.tappeto_bagno + lenaQuattro.scendidoccia, 2)
  const lenaTre = dotazioneDaAssetto(proponiAssetto('Lena', 3, false)!)
  assert.deepEqual([lenaTre.sotto_matrimoniale, lenaTre.sotto_singolo, lenaTre.telo_doccia], [1, 1, 3], 'il terzo letto di Lena c’è anche senza «letto aggiuntivo»')
  for (const camera of ['Allegra', 'Ambra']) {
    const normale = dotazioneDaAssetto(proponiAssetto(camera, 2, false)!)
    assert.deepEqual([normale.sotto_matrimoniale, normale.sotto_singolo, normale.telo_doccia], [1, 0, 2])
    const uno = dotazioneDaAssetto(proponiAssetto(camera, 1, false, 4)!)
    assert.deepEqual([uno.sotto_matrimoniale, uno.telo_doccia, uno.federe], [1, 1, 4])
    assert.equal(dotazioneDaAssetto(proponiAssetto(camera, 1, false, 2)!).federe, 2)
  }
})

test('proposta dal soggiorno: il letto aggiuntivo della notte appena passata, non il flag di oggi', () => {
  const b = { check_in: '2026-09-20', check_out: '2026-09-28', num_guests: 2, extra_bed: true, extra_bed_dates: ['2026-09-20', '2026-09-21'] }
  assert.equal(proponiAssettoDaSoggiorno('Ambra', b, '2026-09-22')!.singoli, 1, 'notte del 21 col letto')
  assert.equal(proponiAssettoDaSoggiorno('Ambra', b, '2026-09-24')!.singoli, 0, 'notte del 23 senza letto')
  assert.equal(proponiAssettoDaSoggiorno('Ambra', { ...b, extra_bed_dates: [] }, '2026-09-24')!.singoli, 1, 'senza date vale il letto per tutto il soggiorno')
  assert.deepEqual(proponiAssettoDaSoggiorno('Ambra', { ...b, num_guests: 1 }, '2026-09-24'), { matrimoniali: 1, singoli: 0, ospiti: 1, federeMatrimoniale: 4 }, 'uso singolo: proposta, ma nella scheda le federe restano da scegliere')
  assert.equal(proponiAssettoDaSoggiorno('Ambra', { ...b, num_guests: null }, '2026-09-24'), null, 'ospiti ignoti: da confermare')
  // la fotografia degli ospiti serviti comanda sul soggiorno modificato dopo
  assert.equal(proponiAssettoDaSoggiorno('Lena', { ...b, num_guests: 4 }, '2026-09-24', 3)!.ospiti, 3)
  assert.equal(lettiProposti('Ambra', { id: 'x', room_id: 'r', ...b, num_guests: 1 }, '2026-09-24'), '1 matrimoniale uso singolo · 1 completo asciugamani')
})

test('recuperi dallo storico: le lenzuola senza misura restano a parte e si segnalano, mai distribuite', () => {
  const r = recuperoDaRiga({ federe: 2, lenzuolo_sotto: 1, lenzuolo_sopra: 0, tappetino_doccia: 1, telo_doccia: 1 })!
  assert.equal(r.pezzi.scendidoccia, 1); assert.equal(r.pezzi.sotto_matrimoniale, 0); assert.equal(r.senzaMisura.lenzuolo_sotto, 1)
  const d = dotazioneDaAssetto(proponiAssetto('Ambra', 2, false)!)
  assert.deepEqual(recuperiOltre(d, { ...r.pezzi, sotto_matrimoniale: 1 }, r.senzaMisura), ['Lenzuola senza misura'])
  assert.deepEqual(recuperiOltre(d, r.pezzi, r.senzaMisura), [])
  assert.deepEqual(recuperiOltre(dotazioneDaAssetto(proponiAssetto('Ambra', 1, false, 2)!), { ...pezziVuoti(), federe: 4 }), ['Federe'], 'dato di prima oltre il limite: segnalato, non azzerato')
  const voci = recuperiPerVoce([{ federe: 2, lenzuolo_sotto: 1 }, { sotto_singolo: 2, federe: 1 }])
  assert.equal(voci.find(v => v.chiave === 'federe')!.n, 3)
  assert.equal(voci.find(v => v.chiave === 'sotto_singolo')!.n, 2)
  assert.equal(voci.find(v => v.chiave === 'lenzuolo_sotto')!.n, 1)
})

test('statistiche: data effettiva a cavallo del mese, zero esplicito ≠ non annotato, copertura dichiarata', () => {
  const assetto = { matrimoniali: 0, singoli: 2, ospiti: 2, federe_matrimoniale: 4 }
  const cleanings = [
    { id: 'a', room_id: 'amelia', tipo: 'soggiorno' as const, stato: 'fatta', data_prevista: '2026-09-29', data_effettiva: '2026-10-01', assetto, dotazione: null, minuti: 35 },
    { id: 'b', room_id: 'lena', tipo: 'fine_soggiorno' as const, stato: 'fatta', data_prevista: '2026-09-25', data_effettiva: '2026-09-25', assetto: null, minuti: null },
    { id: 'c', room_id: 'ambra', tipo: 'cambio_camera' as const, stato: 'fatta', data_prevista: '2026-09-26', data_effettiva: '2026-09-26', assetto: { matrimoniali: 1, singoli: 0, ospiti: 1, federe_matrimoniale: 2 }, minuti: 20 },
    { id: 'd', room_id: 'ambra', tipo: 'soggiorno' as const, stato: 'rimandata', data_prevista: '2026-09-27', data_effettiva: null },
  ]
  const recuperi = [{ cleaning_id: 'a', federe: 2, telo_doccia: 1, asciugamano_viso: 1 }, { cleaning_id: 'c', federe: 0 }]
  const tutti = interventiDaTabelle(cleanings, recuperi)
  const settembre = statistichePulizie(tutti, '2026-09-01', '2026-10-01')
  assert.equal(settembre.interventi, 2, 'il rinvio non è un intervento; quella del 1° ottobre conta a ottobre')
  assert.deepEqual(settembre.perTipo.map(t => t.n), [1, 0, 1])
  assert.equal(settembre.conRecuperi, 1, 'Ambra: zero esplicito conta come annotato; Lena no')
  assert.equal(settembre.conAssetto, 1); assert.equal(settembre.conDurata, 1); assert.equal(settembre.minuti, 20)
  assert.equal(settembre.percentualeRecupero, null, 'Lena senza dati: niente percentuale')
  const ottobre = statistichePulizie(tutti, '2026-10-01', '2026-11-01')
  assert.equal(ottobre.interventi, 1); assert.equal(somma(ottobre.dotazione), 16); assert.equal(somma(ottobre.lavaggio), 12)
  assert.equal(Math.round(ottobre.percentualeRecupero! * 10) / 10, 25)
  assert.equal(ottobre.minutiMedi, 35)
  assert.equal(statistichePulizie(tutti, '2026-09-01', '2026-11-01', 'lena').minuti, 0, 'filtro camera: solo il suo tempo')
  // ogni totale si ricompone dagli interventi che lo formano
  const tutto = statistichePulizie(tutti, '2026-09-01', '2026-11-01')
  assert.equal(tutto.minuti, tutto.righe.reduce((s, r) => s + (r.minuti ?? 0), 0))
  assert.equal(somma(tutto.recuperi), tutto.righe.reduce((s, r) => s + (r.recuperi ? somma(r.recuperi) : 0), 0))
  assert.match(csvInterventi(tutto.righe, id => id), /"Amelia"|"amelia"/)
  // recuperi non letti: nessun «annotato» inventato
  assert.equal(statistichePulizie(interventiDaTabelle(cleanings, null), '2026-09-01', '2026-11-01').conRecuperi, 0)
})

test('statistiche: correzione recuperi 4 → 5 su Amelia = 11 da lavare, sempre un intervento', () => {
  const c = { id: 'a', room_id: 'amelia', tipo: 'soggiorno' as const, stato: 'fatta', data_prevista: '2026-09-26', data_effettiva: '2026-09-26', assetto: { matrimoniali: 0, singoli: 2, ospiti: 2, federe_matrimoniale: 4 }, minuti: 35 }
  const quattro = statistichePulizie(interventiDaTabelle([c], [{ cleaning_id: 'a', federe: 2, telo_doccia: 1, asciugamano_viso: 1 }]), '2026-09-01', '2026-10-01')
  const cinque = statistichePulizie(interventiDaTabelle([c], [{ cleaning_id: 'a', federe: 2, telo_doccia: 1, asciugamano_viso: 1, asciugamano_mani: 1 }]), '2026-09-01', '2026-10-01')
  assert.deepEqual([quattro.interventi, somma(quattro.lavaggio)], [1, 12])
  assert.deepEqual([cinque.interventi, somma(cinque.lavaggio)], [1, 11])
})

test('timer: istanti del server, scarto dell’orologio, arrotondamento solo alla fine', () => {
  const t = { chiave: 'k', trascorsi: 90, avviato_at: '2026-09-25T10:00:00.000Z', versione: 3 }
  const server = Date.parse('2026-09-25T10:01:00.000Z')
  assert.equal(secondiTimer(t, server - 5000, 5000), 150, 'telefono indietro di 5 s: corretto con lo scarto')
  assert.equal(secondiTimer({ ...t, avviato_at: null }, server + 999999, 0), 90, 'in pausa non conta')
  assert.equal(minutiTimer(150), 3); assert.equal(minutiTimer(120), 2); assert.equal(minutiTimer(0), 0)
  assert.equal(testoCronometro(330), '5:30')
  assert.equal(chiaveTimerPulizia('b1', 'soggiorno', '2026-09-26'), 'pulizia:b1:soggiorno:2026-09-26')
  assert.notEqual(chiaveTimerPulizia('b1', 'soggiorno', '2026-09-26'), chiaveTimerPulizia('b1', 'soggiorno', '2026-09-30'), 'la pulizia dopo non eredita il timer')
  assert.deepEqual(descriviChiave('fuori:2026-09-25:corridoio', () => null), { tipo: 'fuori', nome: 'Corridoio', data: '2026-09-25' })
})

test('fuori camera: il timer si somma al totale salvato in modo dichiarato, mai due volte', () => {
  assert.deepEqual(totaleProposto(20, 15 * 60, '20'), { minuti: 35, testo: '20 min salvati + 15 dal timer = 35 min. Controlla e salva.' })
  assert.match(totaleProposto(20, 60, '30').testo, /avevi scritto 30, non salvati/)
  assert.equal(totaleProposto(null, 61, '').minuti, 2)
})

test('Home: IV pulizie con tre cambi camera — le frecce sono un sottoinsieme, non pulizie in più', () => {
  const camere = ['a', 'b', 'c', 'd'].map(id => ({ id, name: id }))
  const giorno = '2026-09-26'
  const pren = [
    { id: 'a1', room_id: 'a', check_in: '2026-09-22', check_out: giorno, status: 'confermata', guest_id: 'g1', group_id: 'G1' },
    { id: 'a2', room_id: 'b', check_in: giorno, check_out: '2026-09-29', status: 'confermata', guest_id: 'g1', group_id: 'G1' },
    { id: 'b1', room_id: 'b', check_in: '2026-09-22', check_out: giorno, status: 'confermata', guest_id: 'g2', group_id: 'G2' },
    { id: 'b2', room_id: 'c', check_in: giorno, check_out: '2026-09-29', status: 'confermata', guest_id: 'g2', group_id: 'G2' },
    { id: 'c1', room_id: 'c', check_in: '2026-09-22', check_out: giorno, status: 'confermata', guest_id: 'g3', group_id: 'G3' },
    { id: 'c2', room_id: 'd', check_in: giorno, check_out: '2026-09-29', status: 'confermata', guest_id: 'g3', group_id: 'G3' },
    { id: 'd1', room_id: 'd', check_in: '2026-09-22', check_out: giorno, status: 'confermata', guest_id: 'g4' },
  ]
  const g = strisciaSettimane(camere, pren, [], '2026-09-25').find(x => x.giorno === giorno)!
  assert.equal(g.daFare, 4, 'quattro camere da preparare')
  assert.equal(g.cambi, 3, 'di cui tre cambi camera')
  assert.deepEqual(simboliCambi(g.cambi), { sotto: true, sopra: true, centro: true })
  // confermarne una non cambia il numero dei cambi: scende solo il «da fare»
  const fatta: Decisione = { id: 'f', room_id: 'd', booking_id: 'd1', tipo: 'fine_soggiorno', stato: 'fatta', data_prevista: giorno, data_effettiva: giorno, created_at: `${giorno}T10:00:00Z` }
  const dopo = strisciaSettimane(camere, pren, [fatta], giorno)[0]
  assert.deepEqual([dopo.daFare, dopo.fatte, dopo.cambi], [3, 1, 3])
  assert.equal(confermateNelGiorno([fatta], giorno), 1)
})

test('rinvii ripetuti e salto: nessuna fatta, la giornata giusta, niente pulizia intermedia oltre il checkout', () => {
  const b = { id: 's', room_id: 'amelia', check_in: '2026-09-21', check_out: '2026-10-05', status: 'confermata', guest_id: 'o' }
  const r1: Decisione = { id: 'r1', room_id: 'amelia', booking_id: 's', tipo: 'soggiorno', stato: 'rimandata', data_prevista: '2026-09-25', prossima_data: '2026-09-26', created_at: '2026-09-25T09:00:00Z' }
  const r2: Decisione = { id: 'r2', room_id: 'amelia', booking_id: 's', tipo: 'soggiorno', stato: 'rimandata', data_prevista: '2026-09-26', prossima_data: '2026-09-28', created_at: '2026-09-26T09:00:00Z' }
  const striscia = strisciaSettimane([{ id: 'amelia' }], [b], [r1, r2], '2026-09-26')
  assert.deepEqual(striscia.slice(0, 3).map(g => g.daFare), [0, 0, 1], 'secondo rinvio: da fare il 28')
  assert.equal(pulizieAperte([b], 'amelia', '2026-09-28', [r1, r2]).length, 1)
  assert.equal(rinviiInCorso([r1, r2], '2026-09-26').length, 1, 'una sola voce per la stessa pulizia')
  const fatta: Decisione = { id: 'f', room_id: 'amelia', booking_id: 's', tipo: 'soggiorno', stato: 'fatta', data_prevista: '2026-09-28', data_effettiva: '2026-09-28', created_at: '2026-09-28T11:00:00Z' }
  assert.equal(cicloCambio([b], b, [r1, r2, fatta]).due, '2026-10-02', 'il ciclo riparte dalla data effettiva')
  assert.equal(rinviiInCorso([r1, r2, fatta], '2026-09-28').length, 0)
  const salto: Decisione = { id: 'sa', room_id: 'amelia', booking_id: 's', tipo: 'soggiorno', stato: 'saltata', data_prevista: '2026-10-02', prossima_data: '2026-10-06', created_at: '2026-10-02T09:00:00Z' }
  assert.equal(cicloCambio([b], b, [r1, r2, fatta, salto]).due, null, 'oltre il checkout: nessuna pulizia intermedia')
  const prossime = prossimePulizie([b], ['amelia'], '2026-10-02', [r1, r2, fatta, salto])
  assert.deepEqual(prossime.map(p => [p.data, p.tipo]), [['2026-10-05', 'fine_soggiorno']])
})

test('rifiuti del database in italiano corretto; guardie: niente elementi della prova nel percorso vero', () => {
  assert.match(messaggioRifiuto('Lenzuola senza misura da riportare'), /misura giusta/)
  assert.match(messaggioRifiuto('boh'), /Non salvato/)
  const pagina = readFileSync(new URL('../app/pulizie/page.tsx', import.meta.url), 'utf8')
  for (const vietato of ['PROPOSTA DA PROVARE', 'Giorno della prova', 'giornata di esempio', 'localStorage', "'2026-09-25'"]) assert.ok(!pagina.includes(vietato), vietato)
  for (const approvato of ['Camere, tempo di lavoro e biancheria, nello stesso registro.', 'Registra pulizia', 'Salta questo cambio', 'Prossime pulizie', 'Rinvii e salti', 'Ogni intervento, con i suoi numeri']) assert.ok(pagina.includes(approvato), approvato)
  const scheda = readFileSync(new URL('../components/SchedaPulizia.tsx', import.meta.url), 'utf8')
  for (const approvato of ['max-w-xl max-h-[90dvh] overflow-y-auto bg-cream', 'items-end sm:items-center', 'Segna il recuperato', 'Niente recuperato', 'Minuti effettivi', 'Conferma pulizia']) assert.ok(scheda.includes(approvato), approvato)
  // Home: nessuna striscia «da fare / fatta» portata dall'anteprima
  const home = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8') + readFileSync(new URL('../components/StrisciaSettimana.tsx', import.meta.url), 'utf8')
  assert.ok(!/da fare\s*\/|\/\s*\d+ fatt/.test(home))
  assert.ok(!home.includes('TempiFuoriCamera') && !home.includes('TimerPulizia'))
})
