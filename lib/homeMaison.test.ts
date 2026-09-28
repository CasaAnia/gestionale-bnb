// ============================================================================
// Home «Maison» (riferimento approvato da Ania il 28/09/2026): le prove delle
// tre novità e dei cambi dei punti 8, 11 e 16 dell'incarico.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { simboliCambi, camereDaPreparare, testaRiquadro, strisciaSettimane, TESTO_MOTIVO } from './numeriOggi.ts'
import { testoSalvato, SALVATO, CHIUSURA_DA_SOLA, DURATA_SALVATO_MS } from './salvatoMaison.ts'

const leggi = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const OGGI = '2026-09-28'
const camere = [{ id: 'amelia', name: 'Camera Amelia' }, { id: 'allegra', name: 'Camera Allegra' }, { id: 'ambra', name: 'Camera Ambra' }, { id: 'lena', name: 'Camera Lena' }]
const b = (id: string, room_id: string, check_in: string, check_out: string, extra: Record<string, unknown> = {}) =>
  ({ id, room_id, check_in, check_out, status: 'confermata', guest_id: `g-${id}`, guest_name: `Ospite ${id.toUpperCase()}`, num_guests: 2, ...extra })

// ── NOVITÀ 1: le frecce ⇄ ────────────────────────────────────────────────
test('frecce dei cambi camera: la prima SOTTO il numero, la seconda SOPRA solo con due cambi', () => {
  assert.deepEqual(simboliCambi(0), { sotto: false, sopra: false, centro: false })
  assert.deepEqual(simboliCambi(1), { sotto: true, sopra: false, centro: false })
  assert.deepEqual(simboliCambi(2), { sotto: true, sopra: true, centro: false })
  // la casella le mette nell'ordine: sopra, numero, sotto
  const casella = leggi('components/StrisciaSettimana.tsx')
  const sopra = casella.indexOf('data-cambi-sopra'), numero = casella.indexOf('{c.testo}'), sotto = casella.indexOf('data-cambi-sotto')
  assert.ok(sopra > 0 && sopra < numero && numero < sotto, 'freccia sopra, numero, freccia sotto')
})

// ── NOVITÀ 2: il riquadro sotto la striscia ─────────────────────────────
test('riquadro della striscia: un tocco non naviga, segna il giorno e apre il riquadro; il nome della camera porta a Pulizie', () => {
  const casella = leggi('components/StrisciaSettimana.tsx')
  const bottoni = casella.slice(casella.indexOf('giorni.map'), casella.indexOf('function RiquadroGiorno'))
  assert.equal(/<Link/.test(bottoni), false, 'la casella non è più un link')
  assert.match(bottoni, /<button key=\{g\.giorno\} type="button"/)
  assert.match(bottoni, /scelto === g\.giorno \? 'scelto' : ''/)
  const riquadro = casella.slice(casella.indexOf('function RiquadroGiorno'))
  assert.match(riquadro, /href=\{`\/pulizie\?giorno=\$\{g\.giorno\}`\}/)
  assert.match(riquadro, /CHIUDI_RIQUADRO/)
  // la data non si ripete nel riquadro
  assert.equal(/etichettaGiornoBreve|dataBreve|toLocaleDateString/.test(riquadro), false)
  // fondo e bordo del riferimento
  const css = leggi('app/maison.css')
  assert.match(css, /\.mz-wkin \{[^}]*background: #EFE9DD; border: 1px solid #DDD3C2;/)
  assert.match(css, /\.mz-wk > button\.scelto \{ border-bottom: 2px solid var\(--m-acc\);/)
})

test('riquadro della striscia: prima riga «N camere da preparare · N cambio camera ⇄»', () => {
  assert.equal(testaRiquadro(2, 1), '2 camere da preparare · 1 cambio camera ⇄')
  assert.equal(testaRiquadro(1, 0), '1 camera da preparare')
  assert.equal(testaRiquadro(3, 2), '3 camere da preparare · 2 cambi camera ⇄')
})

test('riquadro della striscia: le camere, il motivo e il prossimo arrivo SOLO se c’è l’orario', () => {
  const prenotazioni = [
    b('p1', 'allegra', '2026-10-01', '2026-10-04'),                                            // parte il 4
    b('a1', 'allegra', '2026-10-04', '2026-10-06', { arrivo_tipo: 'struttura', arrivo_struttura_ora_da: '16:00', arrivo_struttura_ora_a: '17:00', check_in_time: '16:00' }),
    b('p2', 'amelia', '2026-10-01', '2026-10-04'),                                             // parte il 4
    b('a2', 'amelia', '2026-10-04', '2026-10-06'),                                             // arriva senza orario
    b('s1', 'lena', '2026-10-01', '2026-10-04', { guest_id: 'russo', guest_name: 'Fam. Russo' }),
    b('s2', 'ambra', '2026-10-04', '2026-10-07', { guest_id: 'russo', guest_name: 'Fam. Russo' }), // cambio camera il 4
  ]
  const voci = camereDaPreparare(camere, prenotazioni as never, [], '2026-10-04', OGGI)
  const allegra = voci.find(v => v.camera === 'Allegra')!, amelia = voci.find(v => v.camera === 'Amelia')!, lena = voci.find(v => v.camera === 'Lena')!
  assert.equal(allegra.testoMotivo, TESTO_MOTIVO.partenza)
  assert.equal(allegra.testoMotivo, 'partenza in giornata')
  assert.equal(allegra.arrivo, '16:00–17:00', 'con l’orario il prossimo arrivo c’è')
  // PROSSIMO ARRIVO ASSENTE SENZA ORARIO: la riga non c'è
  assert.equal(amelia.arrivo, undefined)
  assert.equal(lena.motivo, 'cambio')
  assert.equal(lena.testoMotivo, '⇄ cambio camera')
  assert.equal(lena.chiVaDove, 'Fam. Russo va in Ambra')
  // le camere del riquadro sono esattamente il numero della casella
  const giorno = strisciaSettimane(camere, prenotazioni as never, [], OGGI).find(g => g.giorno === '2026-10-04')!
  assert.equal(giorno.camere!.length, giorno.daFare)
  const casella = leggi('components/StrisciaSettimana.tsx')
  assert.match(casella, /\{c\.arrivo && <p className="de" data-prossimo-arrivo>/)
})

// ── 19bis: la conferma di salvataggio B ──────────────────────────────────
test('conferma di salvataggio B: «Salvato», cosa e ora, chiusura dopo 1,2 secondi, un componente per tutti i fogli', () => {
  assert.equal(SALVATO, 'Salvato')
  assert.equal(CHIUSURA_DA_SOLA, 'il foglio si chiude da solo fra un istante')
  assert.equal(DURATA_SALVATO_MS, 1200)
  assert.equal(testoSalvato('Arrivo di Paolo Conti', new Date('2026-09-28T09:42:00Z')), 'Arrivo di Paolo Conti · 11:42')
  const css = leggi('app/maison.css')
  assert.match(css, /\.mz-salvato::before \{[^}]*background: rgba\(246,242,234,\.85\)/)
})

// ── 11: Pulizie di oggi ──────────────────────────────────────────────────
import { rigaBiancheria, pulizieDiOggi } from './pulizieOggi.ts'
test('pulizie di oggi: il cambio biancheria dice «Nome, Nª notte · resta fino al …» (con l’elisione) e niente prossimo arrivo in pagina', () => {
  assert.equal(rigaBiancheria('Giovanni Serra', 4, '2026-10-05'), 'Giovanni Serra, 4ª notte · resta fino al 5 ottobre')
  assert.equal(rigaBiancheria('Giovanni Serra', 4, '2026-10-01'), 'Giovanni Serra, 4ª notte · resta fino all\'1 ottobre')
  assert.equal(rigaBiancheria('Giovanni Serra', 4, '2026-10-08'), 'Giovanni Serra, 4ª notte · resta fino all\'8 ottobre')
  const lungo = b('s', 'allegra', '2026-09-24', '2026-10-05', { guest_name: 'Giovanni Serra' })
  const [v] = pulizieDiOggi(camere, [lungo] as never, [], OGGI)
  assert.equal(v.tipo, 'soggiorno')
  assert.equal(v.biancheria, 'Giovanni Serra, 4ª notte · resta fino al 5 ottobre')
  const pagina = leggi('components/PulizieOggi.tsx')
  assert.match(pagina, /v\.tipo === 'soggiorno'\s*\? v\.biancheria && <p className="pr" data-biancheria>/)
})

test('pulizie di oggi: l’orario del prossimo arrivo compare SOLO se c’è (mai «orario da chiedere»)', () => {
  const parte = b('p', 'amelia', '2026-09-25', OGGI, { guest_name: 'Marta Bellini' })
  const senzaOra = b('a', 'amelia', OGGI, '2026-09-30', { guest_name: 'Paolo Conti' })
  const [v] = pulizieDiOggi(camere, [parte, senzaOra] as never, [], OGGI)
  assert.equal(v.prossimo, 'Paolo Conti · oggi')
  const conOra = { ...senzaOra, check_in_time: '16:00' }
  assert.equal(pulizieDiOggi(camere, [parte, conOra] as never, [], OGGI)[0].prossimo, 'Paolo Conti · oggi · 16:00')
  assert.equal(/orario da chiedere/i.test(leggi('components/PulizieOggi.tsx') + leggi('lib/pulizieOggi.ts')), false)
})

test('pulizie di oggi: con l’arrivo lo stesso giorno NON sono più automatiche (niente «registrata da sola»)', () => {
  const parte = b('p', 'amelia', '2026-09-25', OGGI)
  const entra = b('a', 'amelia', OGGI, '2026-09-30')
  const voci = pulizieDiOggi(camere, [parte, entra] as never, [], OGGI)
  assert.deepEqual(voci.map(v => v.stato), ['da_fare'])
  assert.ok(voci[0].daSegnare, 'la voce si segna con «Pulita»')
  for (const f of ['lib/pulizieOggi.ts', 'components/PulizieOggi.tsx', 'app/pulizie/page.tsx']) assert.equal(/registrata da sola/.test(leggi(f)), false, f)
})

test('«Rimanda o salta» nella veste nuova: selettore a filo, data a filo, «Annulla» e «Conferma» pieno, stesse date', () => {
  const c = leggi('components/ControlliPulizia.tsx')
  const home = c.slice(c.indexOf('if (home) {'))
  assert.match(home, /className="mz-inl"/)
  assert.match(home, /'Rimanda al' : 'Salta questa · prossima il'/)
  assert.match(home, /Nessun altro cambio prima della partenza del/)
  assert.match(home, /className="mz-cta"[^>]*>\{occupata \? 'Salvo…' : 'Conferma'\}/)
  // le stesse date di prima
  assert.match(home, /addDaysStr\(pulizia\.data_prevista > oggi \? pulizia\.data_prevista : oggi, 1\)/)
  assert.match(home, /addDaysStr\(pulizia\.data_prevista, 4\)/)
  assert.match(home, /<SalvatoMaison salvato=\{salvato\} onFine=\{fineSalvato\} \/>/)
})

test('conferma B: lo stesso componente in Arrivo, Pulizia, Pagamento (anche Segna pagato), Rimanda/Salta', () => {
  for (const f of ['components/scheda/FoglioArrivo.tsx', 'components/SchedaPulizia.tsx', 'components/scheda/FoglioPagamento.tsx']) {
    assert.match(leggi(f), /salvato=\{salvato\} onFineSalvato=/, `${f} non usa la conferma B`)
  }
  assert.match(leggi('components/maison/FoglioMaison.tsx'), /\{salvato && <SalvatoMaison salvato=\{salvato\}/)
  assert.match(leggi('components/ControlliPulizia.tsx'), /<SalvatoMaison salvato=\{salvato\} onFine=\{fineSalvato\} \/>/)
  // «Segna pagato» della giornata apre lo stesso foglio del pagamento
  assert.match(leggi('components/maison/PagamentoDaHome.tsx'), /<FoglioPagamento /)
  assert.match(leggi('components/ArriviOggi.tsx'), /<PagamentoDaHome bookingId=\{pagamento\}/)
  // i testi dei due modi di salvare restano per l'errore: «Non salvato, riprova» non cambia
  assert.match(leggi('lib/scritturaSicura.ts'), /MESSAGGIO_NON_SALVATO = 'Non salvato, riprova'/)
})

// ── 15–16: Da incassare, Incassati oggi, due soli metodi ─────────────────
import { vociDaIncassare, partenzeConResiduo, incassatiOggi, rigaConto, statoSoggiorno } from './incassiHome.ts'
import { METODI_PAGAMENTO } from './statistiche/pagato.ts'
import { MODI_PAGAMENTO } from './pagamentoFoglio.ts'
import { daIncassare } from './statistiche/intervallo.ts'
const euroT = (c: number) => `${c / 100} €`

test('Da incassare: stesse voci e stesse cifre di daIncassare, con stato, come paga, camere, date e acconto', () => {
  const pren = [
    b('m', 'amelia', '2026-09-25', OGGI, { total_amount: 360, guest_name: 'Marta Bellini', bonifico: true, rooms: { name: 'Camera Amelia' } }),
    b('r1', 'lena', '2026-09-25', '2026-09-27', { total_amount: 200, group_id: 'g', guest_name: 'Fam. Russo', accordo_pagamento: 'contanti', rooms: { name: 'Camera Lena' } }),
    b('r2', 'ambra', '2026-09-27', '2026-10-01', { total_amount: 340, group_id: 'g', guest_name: 'Fam. Russo', rooms: { name: 'Camera Ambra' } }),
    b('z', 'allegra', '2026-09-20', '2026-09-22', { total_amount: 100, guest_name: 'Senza Acconto' }),
  ]
  const pag = [{ booking_id: 'm', amount: 120, paid_on: '2026-09-20', method: 'bonifico' }, { booking_id: 'r1', amount: 390, paid_on: '2026-09-25', method: 'contanti' }]
  const voci = vociDaIncassare(pren as never, pag as never, OGGI)
  assert.deepEqual(voci.map(v => v.residuoCent), daIncassare(pren as never, pag as never).map(d => d.residuoCent))
  const marta = voci.find(v => v.nome === 'Marta Bellini')!
  assert.equal(marta.stato, 'Partita oggi · bonifico')
  assert.equal(rigaConto(marta, euroT), 'Totale 360 € · ricevuti 120 € (acconto del 20 set) · resta')
  const russo = voci.find(v => v.nome === 'Fam. Russo')!
  assert.equal(russo.stato, 'In casa · contanti')
  assert.equal(russo.camere, 'Lena → Ambra')
  assert.equal(russo.residuoCent, 15000)
  // chi non ha mai pagato non è «da incassare» (regola di prima): è un'eccezione di Da controllare
  assert.equal(voci.some(v => v.nome === 'Senza Acconto'), false)
  assert.equal(statoSoggiorno('2026-10-02', '2026-10-05', OGGI), 'Arriva il 2 ott')
})

test('La giornata: le partenze di oggi compaiono SOLO con un residuo; Incassati oggi dice metodo e saldo/acconto', () => {
  const parte = b('m', 'amelia', '2026-09-25', OGGI, { total_amount: 360, guest_name: 'Marta Bellini', rooms: { name: 'Camera Amelia' } })
  const saldata = b('s', 'lena', '2026-09-26', OGGI, { total_amount: 160, guest_name: 'Giovanni Serra', rooms: { name: 'Camera Lena' } })
  const pag = [{ booking_id: 'm', amount: 120, paid_on: '2026-09-20', method: 'bonifico' }, { booking_id: 's', amount: 160, paid_on: OGGI, method: 'contanti' }]
  const partenze = partenzeConResiduo([parte, saldata] as never, [parte, saldata] as never, pag as never)
  assert.deepEqual(partenze.map(p => [p.nome, p.camera, p.residuoCent]), [['Marta Bellini', 'Amelia', 24000]])
  const oggi = incassatiOggi([parte, saldata] as never, pag as never, OGGI)
  assert.deepEqual(oggi.map(p => [p.nome, p.testo, p.importoCent]), [['Giovanni Serra', 'contanti · saldo completo', 16000]])
})

test('come si paga: SOLO due scelte, Contanti e Bonifico, ovunque si sceglie il metodo; i vecchi restano leggibili', () => {
  assert.deepEqual(METODI_PAGAMENTO.map(m => m.label), ['Contanti', 'Bonifico'])
  assert.deepEqual(MODI_PAGAMENTO.map(m => m.testo), ['Contanti', 'Bonifico'])
  // nessuna pagina propone più «Carta» o «Altro» fra i metodi di pagamento degli ospiti
  for (const f of ['components/scheda/FoglioPagamento.tsx', 'app/prenotazioni/[id]/page.tsx', 'app/scheda/[id]/page.tsx']) {
    assert.equal(/<option value="carta"|<option value="altro"|'Carta'|'Altro'/.test(leggi(f)), false, f)
  }
  // la lettura dei movimenti storici con «carta» e «altro» resta
  assert.match(leggi('lib/pagamentoFoglio.ts'), /v === 'carta' \? 'carta' : v === 'altro' \? 'altro'/)
})
