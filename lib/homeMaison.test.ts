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
