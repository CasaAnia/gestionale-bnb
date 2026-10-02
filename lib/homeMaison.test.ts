// ============================================================================
// Home «Maison» (riferimento approvato da Ania il 28/09/2026): le prove delle
// tre novità e dei cambi dei punti 8, 11 e 16 dell'incarico.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { simboliCambi, camereDaPreparare, testaRiquadro, strisciaSettimane, PULIZIA_RIMASTA } from './numeriOggi.ts'
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
  assert.match(riquadro, /const pulizie = `\/pulizie\?giorno=\$\{g\.giorno\}`/)
  assert.match(riquadro, /<Link href=\{pulizie\} className="nm">\{c\.camera\}<\/Link>/)
  assert.match(riquadro, /CHIUDI_RIQUADRO/)
  // Dal 02/10/2026 (pulizie-domani-riferimento.html) la data è nella testa
  // del riquadro («VENERDÌ 2 OTTOBRE · 2 CAMERE»), una volta sola
  assert.match(riquadro, /testaRiquadro\(g\.giorno, g\.oggi, camere\.length\)/)
  // fondo e bordo del riferimento: il riquadro resta quello (cambia solo il contenuto)
  const css = leggi('app/maison.css')
  assert.match(css, /\.mz-wkin \{[^}]*background: #EFE9DD; border: 1px solid #DDD3C2;/)
  assert.match(css, /\.mz-wk > button\.scelto \{ border-bottom: 2px solid var\(--m-acc\);/)
})

test('riquadro della striscia (02/10/2026): in testa «VENERDÌ 2 OTTOBRE · 2 CAMERE», per oggi «OGGI · 3 CAMERE»', () => {
  assert.equal(testaRiquadro('2026-10-02', false, 2), 'venerdì 2 ottobre · 2 camere')
  assert.equal(testaRiquadro('2026-10-01', true, 3), 'oggi · 3 camere')
  assert.equal(testaRiquadro('2026-10-03', false, 1), 'sabato 3 ottobre · 1 camera')
})

test('riquadro della striscia (02/10/2026): chi parte e chi arriva con gli orari, chi resta, il cambio camera', () => {
  const prenotazioni = [
    b('p1', 'lena', '2026-10-01', '2026-10-04', { guest_name: 'Elena Esposito', check_out_time: '10:00:00' }),   // parte il 4 alle 10
    b('a1', 'lena', '2026-10-04', '2026-10-06', { guest_name: 'Giovanni Serra', check_in_time: '16:00', bagagli_alle: '11:00:00' }),
    b('p2', 'amelia', '2026-10-01', '2026-10-04', { guest_name: 'Mario Bellini' }),                              // parte il 4 senza ora
    b('a2', 'amelia', '2026-10-04', '2026-10-06', { guest_name: 'Anna Rossi' }),                                 // arriva senza ora né bagagli
    b('s1', 'allegra', '2026-10-01', '2026-10-04', { guest_id: 'russo', guest_name: 'Fam. Russo' }),
    b('s2', 'ambra', '2026-10-04', '2026-10-07', { guest_id: 'russo', guest_name: 'Fam. Russo' }),               // cambio camera il 4
  ]
  const voci = camereDaPreparare(camere, prenotazioni as never, [], '2026-10-04', OGGI)
  const lena = voci.find(v => v.camera === 'Lena')!, amelia = voci.find(v => v.camera === 'Amelia')!, allegra = voci.find(v => v.camera === 'Allegra')!
  assert.deepEqual(lena.parte, { nome: 'Elena Esposito', ora: '10:00' })
  assert.deepEqual(lena.bagagli, { cognome: 'Serra', ora: '11:00' })
  assert.deepEqual(lena.arriva, { nome: 'Giovanni Serra', ora: '16:00' })
  assert.deepEqual(amelia.parte, { nome: 'Mario Bellini', ora: null }, '«parte Mario Bellini · orario da chiedere»')
  assert.equal(amelia.bagagli, undefined, 'ogni pezzo solo se c’è')
  assert.deepEqual(amelia.arriva, { nome: 'Anna Rossi', ora: null })
  assert.equal(allegra.motivo, 'cambio')
  assert.equal(allegra.passa, 'Fam. Russo passa in Ambra ⇄')
  // chi resta: la biancheria della 4ª notte
  const resta = camereDaPreparare(camere, [b('r1', 'ambra', '2026-09-28', '2026-10-06', { guest_name: 'Lucia Ferri' })] as never, [], '2026-10-02', OGGI)
  assert.deepEqual(resta.map(v => [v.camera, v.resta]), [['Ambra', 'Lucia Ferri resta · biancheria della 4ª notte']])
  // la pulizia rimasta di oggi resta «pulizia rimasta da completare»
  const rimasta = camereDaPreparare(camere, [b('x1', 'lena', '2026-09-25', '2026-09-27')] as never, [], OGGI, OGGI)
  assert.deepEqual(rimasta.map(v => v.rimasta), [PULIZIA_RIMASTA])
  // le camere del riquadro sono esattamente il numero della casella
  const giorno = strisciaSettimane(camere, prenotazioni as never, [], OGGI).find(g => g.giorno === '2026-10-04')!
  assert.equal(giorno.camere!.length, giorno.daFare)
})

test('riquadro della striscia (02/10/2026): nomi in Cormorant 21, testo Jost 13,5, orari Cormorant 17 peso 600, «Vedi nelle Pulizie ›», didascalia nuova', () => {
  const casella = leggi('components/StrisciaSettimana.tsx')
  assert.match(casella, /export const DIDASCALIA_STRISCIA = 'Camere da preparare nei prossimi 7 giorni · tocca un giorno per vedere chi parte e chi arriva'/)
  assert.match(casella, /<Link href=\{pulizie\} className="mz-lnk vedi" data-vedi-pulizie>\{VEDI_NELLE_PULIZIE\}<\/Link>/)
  assert.match(casella, /parte \{c\.parte\.nome\} · \{ORARIO_DA_CHIEDERE\}/)
  const css = leggi('app/maison.css')
  assert.match(css, /\.mz-wkin \.ey \{[^}]*font-size: 11px; letter-spacing: \.2em; text-transform: uppercase; color: var\(--m-acc\);/)
  assert.match(css, /\.mz-wkin \.r \.nm \{ font-size: 21px;/)
  assert.match(css, /\.mz-wkin \.r \.de \{[^}]*font-size: 13\.5px;/)
  assert.match(css, /\.mz-wkin \.r \.de em \{[^}]*font-family: var\(--m-disp\); font-weight: 600; font-size: 17px;/)
  assert.match(css, /\.mz-wkin \.r \.de em\.a \{ color: #7a5f2c; \}/)
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

test('«Rimanda o salta» come foglio (01/10/2026): linguette a filo, data a filo, «Annulla» e «Conferma», stesse date', () => {
  const c = leggi('components/ControlliPulizia.tsx')
  const home = c.slice(c.indexOf('if (home) {'))
  assert.match(home, /<FoglioRimanda camera=\{camera\}/)
  assert.match(home, /salvato=\{salvato\} onFineSalvato=\{fineSalvato\}/)
  const f = leggi('components/pulizie/FoglioRimanda.tsx')
  assert.match(f, /'Rimanda al' : 'Prossima il'/)
  assert.match(f, /Nessun altro cambio prima della partenza del/)
  assert.match(f, /azione="Conferma"/)
  assert.match(f, /Salta questo cambio/)
  // le stesse date di prima
  assert.match(f, /const base = pulizia\.data_prevista > oggi \? pulizia\.data_prevista : oggi/)
  assert.match(f, /addDaysStr\(base, 1\)/)
  assert.match(f, /addDaysStr\(pulizia\.data_prevista, 4\)/)
  assert.match(f, /data <= pulizia\.data_prevista/)
  assert.match(leggi('components/maison/FoglioMaison.tsx'), /\{salvato && <SalvatoMaison salvato=\{salvato\}/)
})

test('conferma B: lo stesso componente in Arrivo, Pulizia, Pagamento (anche Segna pagato), Rimanda/Salta', () => {
  for (const f of ['components/scheda/FoglioArrivo.tsx', 'components/SchedaPulizia.tsx', 'components/scheda/FoglioPagamento.tsx']) {
    assert.match(leggi(f), /salvato=\{salvato\} onFineSalvato=/, `${f} non usa la conferma B`)
  }
  assert.match(leggi('components/maison/FoglioMaison.tsx'), /\{salvato && <SalvatoMaison salvato=\{salvato\}/)
  assert.match(leggi('components/ControlliPulizia.tsx'), /salvato=\{salvato\} onFineSalvato=\{fineSalvato\}/)
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

// ── Leggibilità dal telefono: prova «E» (Ania, 28/09/2026) ───────────────
test('Home dal telefono: le misure stanno nelle variabili --home-*, Mac invariato, prova E sotto lg', () => {
  const css = leggi('app/maison.css')
  const mac = css.match(/\.maison, \.mz \{\s*--home-ui-font[^}]*\}/)?.[0] ?? ''
  for (const v of ['--home-ui-font: var(--m-ui)', '--home-mut: #8A8072', '--home-gutter: 22px', '--home-fs-sec: 11.5px', '--home-fs-info: 12.5px', '--home-fw-sec: 300', '--home-fs-lnk: 10px', '--home-fs-cap: 9.5px'])
    assert.ok(mac.includes(v), `Mac: ${v}`)
  const tel = css.match(/@media \(max-width: 1023px\) \{\s*\.maison \{[^}]*\}/)?.[0] ?? ''
  for (const v of ['--home-ui-font: var(--font-figtree), Figtree', '--home-mut: #6E6558', '--home-gutter: 16px', '--home-fs-sec: 13px', '--home-fs-info: 13.5px', '--home-fw-sec: 400', '--home-fs-lnk: 10.5px', '--home-fs-cap: 10.5px'])
    assert.ok(tel.includes(v), `telefono: ${v}`)
  assert.match(leggi('app/layout.tsx'), /Figtree\(\{[^)]*weight: \['400', '500', '600'\]/)
})

// ── Sfondo dal telefono: prova «C» (Ania, 28/09/2026) ───────────────────
test('sfondo della Home: bianco dal telefono E dal Mac (29/09/2026); fili con --home-line; il crema resta nei fogli e nel riquadro', () => {
  const css = leggi('app/maison.css')
  assert.match(css, /:root:has\(\.mz-home\) \{ --home-bg: #FFFFFF; --home-line: #E8E3DA; \}/)
  assert.equal(/:root:has\(\.mz-home\) \{\s*--home-bg: #F6F2EA/.test(css), false, 'niente più eccezione crema dal Mac')
  assert.match(css, /\.mz-home \.mz-wkin \{ background: #F6F2EA; \}/)
  assert.match(css, /\.maison\.mz-home \{ --m-bg: var\(--home-bg\); --m-line: var\(--home-line\); \}/)
  assert.match(css, /body:has\(\.mz-home\) \{ background: var\(--home-bg\); \}/)
  // i fogli dal basso restano crema
  assert.match(css, /\.mz-foglio \{[^}]*background: #F6F2EA/)
  assert.match(leggi('app/page.tsx'), /className="maison mz-home /)
  assert.match(leggi('components/BottomNav.tsx'), /background: 'var\(--home-bg, #F6F2EA\)', borderTop: '1px solid var\(--home-line, #E1D9CB\)'/)
})

// ── Nome come link e matita a filo nei riquadri arrivo (28/09/2026) ─────
test('riquadro arrivo: il nome è un link a /scheda/<id> col filo d\'ottone, oggi e domani; la matita è un\'icona a filo, non un carattere', () => {
  const src = leggi('components/ArriviOggi.tsx')
  const riquadro = src.slice(src.indexOf('function Riquadro('), src.indexOf('export default function ArriviOggi'))
  assert.match(riquadro, /<Link href=\{hrefScheda\(b\.id, 'home'\)\} aria-label=\{`Apri prenotazione di \$\{nome\}`\} className="nm mz-nome-link">\{nome\}<\/Link>/)
  assert.match(riquadro, /const nome = nomeConAltri\(b\)/)
  // lo stesso riquadro per gli arrivi di oggi e di domani
  assert.match(src, /\{oggi\.map\(b => <Riquadro /)
  assert.match(src, /\{domani\.map\(b => <Riquadro /)
  // il filo vince sulla regola globale della Home che toglie le sottolineature
  const css = leggi('app/maison.css')
  assert.match(css, /\[data-senza-sottolinea\] \.mz-nome-link \{ text-decoration: underline !important; text-decoration-color: rgba\(168,137,79,\.6\) !important; text-underline-offset: 5px !important; text-decoration-thickness: 1px !important;/)
  assert.match(css, /\.mz-nome-link::before \{[^}]*height: 44px/)
  // matita: SVG a filo, niente ✎
  assert.doesNotMatch(riquadro, /✎/)
  assert.match(riquadro, /className="pen" onClick=\{\(\) => onApri\(b\)\} aria-label=\{`Modifica arrivo di [^`]*`\}>\{ICONA_MATITA\}<\/button>/)
  assert.match(src, /export const ICONA_MATITA = <svg viewBox="0 0 24 24"/)
  assert.match(css, /\.mz-arr \.ora \.pen svg \{ width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 1\.4;/)
  assert.match(css, /\.mz-arr \.ora \.pen \{[^}]*align-self: center;[^}]*color: #6E6558;/)
  assert.match(css, /\.mz-arr \.ora \.pen::before \{[^}]*width: 44px; height: 44px;/)
})
