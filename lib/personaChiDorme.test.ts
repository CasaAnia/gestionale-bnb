// ============================================================================
// «CHI DORME IN CAMERA» (Ania, 22/10/2026): le voci di «Chi è», la persona
// che si modifica senza toccare le altre, la spunta dalla scheda salvata e i
// due campi Nome/Cognome allineati nei fogli.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { personaInScrittura, personaSostituita } from './personaChiDorme.ts'
import { CHI_E_VOCI, COLONNA_NON_E_LEI, type PersonaConLei } from './nuovaPrenotazione.ts'
import { campiChiDormeScheda, stessoChiDorme, personeDaPrenotazione, MANCA_CHI_DORME } from './conLeiScheda.ts'

const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const teresa: PersonaConLei = { id: 'uno', nome: 'Teresa Bianchi', chiE: 'Mamma', telefono: '3405551122' }
const ugo: PersonaConLei = { id: 'due', nome: 'Ugo De Luca', chiE: 'il cognato', telefono: '' }

test('le voci di «Chi è» sono quelle chieste, e «Altro» per scriverla a mano', () => {
  assert.deepEqual(CHI_E_VOCI, ['Sorella', 'Fratello', 'Mamma', 'Papà', 'Figlia', 'Figlio', 'Marito', 'Moglie', 'Amica', 'Amico'])
  const conLei = leggi('components/nuova/ConLei.tsx')
  assert.match(conLei, /export const ALTRO = 'Altro'/)
  // le due veste usano le stesse voci e lo stesso «Altro» col campo libero
  for (const file of ['components/nuova/ConLei.tsx', 'components/nuova/ChiDormeInCamera.tsx']) {
    const s = leggi(file)
    assert.match(s, /\{CHI_E_VOCI\.map\(v => \(/, file)
    assert.match(s, /dati="chi-altro" acceso=\{f\.libero\} onClick=\{f\.scegliAltro\}>\{ALTRO\}/, file)
    assert.match(s, /data-campo="persona-chi" value=\{f\.chiE\}/, file)
  }
})

test('modificare una persona riparte dai suoi dati: voce accesa, oppure «Altro» col testo', () => {
  assert.deepEqual(personaInScrittura(teresa), { nome: 'Teresa', cognome: 'Bianchi', telefono: '3405551122', chiE: 'Mamma', libero: false })
  assert.deepEqual(personaInScrittura(ugo), { nome: 'Ugo', cognome: 'De Luca', telefono: '', chiE: 'il cognato', libero: true })
  // una voce salvata in minuscolo si riconosce lo stesso
  assert.equal(personaInScrittura({ ...teresa, chiE: 'mamma' }).chiE, 'Mamma')
  assert.equal(personaInScrittura({ ...teresa, chiE: '' }).libero, false)
  assert.deepEqual(personaInScrittura(null), { nome: '', cognome: '', telefono: '', chiE: '', libero: false })
})

test('la persona modificata cambia al suo posto, le altre restano identiche', () => {
  const prima = [teresa, ugo]
  const dopo = personaSostituita(prima, 'due', { nome: 'Ugo De Luca', chiE: 'Fratello', telefono: '3331112222' })
  assert.deepEqual(dopo[0], teresa)
  assert.deepEqual(dopo[1], { id: 'due', nome: 'Ugo De Luca', chiE: 'Fratello', telefono: '3331112222' })
  assert.equal(dopo.length, 2)
  // l'elenco di partenza non si tocca
  assert.equal(prima[1].chiE, 'il cognato')
})

test('dalla scheda: si scrivono SOLO le colonne di chi dorme, e la spunta se la riga ce l\'ha', () => {
  const campi = campiChiDormeScheda([teresa], true, true)
  assert.deepEqual(Object.keys(campi).sort(), ['chi_e', 'chi_e_2', 'extra_phone_1', 'extra_phone_1_name', 'extra_phone_2', 'extra_phone_2_name', COLONNA_NON_E_LEI].sort())
  assert.equal(campi[COLONNA_NON_E_LEI], true)
  assert.equal(campi.extra_phone_2_name, null)
  // senza la colonna della 0061 la spunta non si scrive
  assert.equal(COLONNA_NON_E_LEI in campiChiDormeScheda([teresa], true, false), false)
  // niente cliente, ospiti, letti, date, prezzi, conto
  for (const k of ['guest_id', 'guest_name', 'num_guests', 'extra_bed', 'check_in', 'check_out', 'room_id', 'price_per_night', 'total_amount', 'discount_value', 'accordo_pagamento'])
    assert.equal(k in campi, false, k)
})

test('dalla scheda: cambia qualcosa solo se cambiano le persone o la spunta', () => {
  const riga = { id: 'b1', extra_phone_1_name: 'Teresa Bianchi', extra_phone_1: '3405551122', chi_e: 'Mamma', [COLONNA_NON_E_LEI]: false }
  const persone = personeDaPrenotazione(riga)
  assert.equal(stessoChiDorme(persone, false, true, riga), true)
  assert.equal(stessoChiDorme(persone, true, true, riga), false)
  assert.equal(stessoChiDorme(persone, true, false, riga), true, 'senza colonna la spunta non conta')
  assert.equal(stessoChiDorme([{ ...persone[0], chiE: 'Sorella' }], false, true, riga), false)
})

test('il foglio della scheda: chi ha prenotato resta, la spunta si legge dalla riga, niente salvataggio a vuoto', () => {
  const s = leggi('components/scheda/FoglioConLei.tsx')
  assert.match(s, /const colonnaNonELei = COLONNA_NON_E_LEI in \(booking as Record<string, unknown>\)/)
  assert.match(s, /useState\(\(\) => nonELeiDaRiga\(booking as Record<string, unknown>\)\)/)
  assert.match(s, /if \(nonELei && persone\.length === 0\) \{ setErrore\(MANCA_CHI_DORME\); return \}/)
  assert.match(MANCA_CHI_DORME, /togli la spunta/)
  // scrittura: solo i campi di chi dorme, su tutte le camere della prenotazione, in una richiesta
  assert.match(s, /aggiornaInUnColpo\(ids, campi\)/)
  assert.equal(/guest_id|num_guests|guest_name/.test(s), false, 'il foglio scrive anche il cliente o gli ospiti')
  // la pagina passa chi ha prenotato, che qui si guarda soltanto
  assert.match(leggi('app/scheda/[id]/page.tsx'), /<FoglioConLei booking=\{booking\} righe=\{righe\}\s+intestataria=\{\{ nome: nomeOspite\(booking\)/)
})

test('ogni persona in elenco ha «Modifica», nell\'inserimento e nella scheda', () => {
  const conLei = leggi('components/nuova/ConLei.tsx')
  assert.match(conLei, /export const MODIFICA_PERSONA = 'Modifica'/)
  assert.match(conLei, /onModifica=\{\(\) => f\.apri\(p\)\}/)
  assert.match(conLei, /personaSostituita\(persone, inModifica, dati\)/)
  assert.match(leggi('components/nuova/ChiDormeInCamera.tsx'), /onModifica=\{\(\) => f\.apri\(p\)\}/)
})

test('Nome e Cognome in cima a un foglio stanno alla stessa altezza (iPhone, 22/10/2026)', () => {
  const css = leggi('app/fogli.css')
  assert.match(css, /\.mz \.mz-foglio h2 \+ \.corpo > \[data-campi-nome-cognome\]:first-child > \* > :first-child \{ margin-top: 0 !important; \}/)
})
