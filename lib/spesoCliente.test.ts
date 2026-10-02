// Quanto ha speso il cliente sulla scheda del Calendario (Ania, 02/10/2026)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spesoPrimaCent, spesoConQuestaCent, formeCifra } from './spesoCliente.ts'
import { clienteFoglietto } from './calendarioFoglietto.ts'
import { euroScheda } from './schedaPrenotazione.ts'

const leggi = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const OGGI = '2026-10-02'
const camere = [{ id: 'ambra', name: 'Ambra' }, { id: 'lena', name: 'Lena' }]
const r = (id: string, extra: Record<string, unknown>) => ({ id, room_id: 'ambra', guest_id: 'rosa', guest_name: 'Rosa Bianchi', status: 'completata', check_in: '2026-08-01', check_out: '2026-08-04', total_amount: 300, ...extra })

test('lo stesso numero del foglietto: i soggiorni conclusi più il conto di questa', () => {
  const prima1 = r('p1', {}), prima2 = r('p2', { check_in: '2026-09-01', check_out: '2026-09-03', room_id: 'lena', total_amount: 200 })
  const annullata = r('p3', { check_in: '2026-09-10', check_out: '2026-09-12', status: 'annullata' })   // non conta
  const questa = [r('q1', { prenotazione_id: 'Q', status: 'confermata', check_in: '2026-10-05', check_out: '2026-10-08', total_amount: 480 }),
    r('q2', { prenotazione_id: 'Q', status: 'confermata', room_id: 'lena', check_in: '2026-10-08', check_out: '2026-10-10', total_amount: 400 })]
  const tutte = [prima1, prima2, annullata, ...questa]
  assert.equal(spesoPrimaCent(questa[0] as never, tutte as never, camere, OGGI), 50000)
  const cent = spesoConQuestaCent(questa[0] as never, questa as never, tutte as never, camere, OGGI)
  assert.equal(cent, 138000)
  // la riga «Cliente» del foglietto dice la stessa cifra
  const riga = clienteFoglietto(2, null, false, 50000, 88000)
  assert.equal(riga.find(p => p.tipo === 'mat')?.testo, formeCifra(cent!)[0])
  assert.equal(formeCifra(cent!)[0], '1.380 €')
  // un mancato arrivo della prenotazione conta, come nel foglietto
  const mancato = r('q3', { prenotazione_id: 'Q', status: 'annullata', mancato_arrivo_centesimi: 5000 })
  assert.equal(spesoConQuestaCent(questa[0] as never, [...questa, mancato] as never, tutte as never, camere, OGGI), 143000)
  // conto non leggibile: niente cifra
  assert.equal(spesoConQuestaCent(questa[0] as never, [{ ...questa[0], total_amount: null }] as never, tutte as never, camere, OGGI), null)
})

test('le forme della cifra, dalla più lunga: quella del foglietto → «1.381 €» → «1.381»', () => {
  assert.deepEqual(formeCifra(138050), [euroScheda(138050), '1.381 €', '1.381'])   // la prima è quella del foglietto
  assert.deepEqual(formeCifra(138000), ['1.380 €', '1.380'])
  assert.deepEqual(formeCifra(9000), ['90 €', '90'])
})

test('la scheda del nastro: cifra attaccata al nome (6 px, mai in fondo: Ania 02/10/2026), Cormorant 13 peso 600, nome che non si stringe; nel Calendario sì, nelle Richieste no', () => {
  const scheda = leggi('components/calendario/SchedaPrenotazione.tsx')
  assert.match(scheda, /<b className="con-speso"><span data-nome>/)
  assert.match(scheda, /<CifraSpeso cent=\{speso\} \/>/)
  const css = leggi('app/maison.css')
  assert.match(css, /\.cal-scheda-in \.tx > b\.con-speso > \[data-nome\] \{ flex: none; white-space: nowrap; \}/)
  assert.match(css, /\.cal-scheda-in \.tx > b\.con-speso > \.spe \{ flex: none; margin-left: 0; padding-left: 6px; font-family: var\(--m-disp\); font-size: 13px; font-weight: 600; color: #8C3B2E; \}/)
  assert.match(leggi('app/calendario/page.tsx'), /speso=\{spesoPerBooking\[booking\.id\]\}/)
  assert.doesNotMatch(leggi('components/richieste/NastroRichieste.tsx'), /speso=/)
  // il foglietto usa la stessa funzione
  assert.match(leggi('components/calendario/FogliettoPrenotazione.tsx'), /spesoPrimaCent: spesoPrimaCent\(prenotazione, tutte, camere, oggi\)/)
})
