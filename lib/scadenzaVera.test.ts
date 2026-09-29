// SCADENZA CORRETTA (Richieste «Maison», novità 14f del 29/09/2026): il timer,
// «Da guardare», il bollino blu e la chiusura automatica usano la durata VERA
// dell'opzione — 3 ore per chi paga all'arrivo, 24 con caparra, pagamento
// completo o condizioni personalizzate. Il testo del messaggio non cambia.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scadenzaProposta, daGuardare, oreOpzioneProposta, type Richiesta } from './richieste.ts'
import { bolliniRichieste } from './richiesteContatore.ts'
import { daNotificare, daChiudere } from './richiesteScadenze.ts'
import { oreOpzione, scadenzaOpzione } from './opzioni.ts'
import { ORE_RISPOSTA_PROPOSTA } from './condizioniPrenotazione.ts'

const inviata = '2026-09-29T08:00:00Z'
const r = (condizione_pagamento: string | null): Richiesta => ({
  id: condizione_pagamento ?? 'vecchia', created_at: '2026-09-29T07:00:00Z', nome: 'Anna', cognome: 'Rinaldi', arrivo: '2026-10-10', partenza: '2026-10-12',
  persone: 2, camera_id: null, canale: 'web', telefono: null, note: null, stato: 'proposta_inviata', proposta_inviata_at: inviata,
  chiusa_at: null, prenotazione_id: null, condizione_pagamento,
})
const ore = (h: number) => new Date(Date.parse(inviata) + h * 3600000)

test('la durata dell’opzione: 3 ore all’arrivo (e senza condizione), 24 con caparra, completo, personalizzata', () => {
  assert.equal(oreOpzioneProposta('arrivo'), 3)
  assert.equal(oreOpzioneProposta(null), 3)
  for (const c of ['caparra', 'completo', 'personalizzata']) assert.equal(oreOpzioneProposta(c), 24)
  // lib/opzioni e il timer usano la stessa regola
  for (const c of ['arrivo', 'caparra', null]) assert.equal(oreOpzione(c), oreOpzioneProposta(c))
  assert.equal(scadenzaOpzione(r('caparra'))?.toISOString(), ore(24).toISOString())
  // il messaggio dice ancora «entro 3 ore» per chi paga all'arrivo: il numero non cambia
  assert.equal(ORE_RISPOSTA_PROPOSTA, 3)
})

test('caso 3 ore (all’arrivo): scade dopo 3 ore, poi «Da guardare» e niente bollino blu', () => {
  const a = r('arrivo')
  assert.deepEqual(scadenzaProposta(a, ore(1)), { scaduta: false, testo: 'Proposta inviata · scade tra 2 h' })
  assert.equal(scadenzaProposta(a, ore(4))?.scaduta, true)
  assert.equal(daGuardare([a], ore(4)).length, 1)
  assert.deepEqual(bolliniRichieste([a], ore(1)), { nuove: 0, inAttesaRisposta: 1 })
  assert.deepEqual(bolliniRichieste([a], ore(4)), { nuove: 0, inAttesaRisposta: 0 })
})

test('caso 24 ore (con caparra): dopo 4 ore NON è scaduta, «scade tra 20 h»; scade alla ventiquattresima', () => {
  const c = r('caparra')
  assert.deepEqual(scadenzaProposta(c, ore(4)), { scaduta: false, testo: 'Proposta inviata · scade tra 20 h' })
  assert.equal(daGuardare([c], ore(4)).length, 0)
  assert.deepEqual(bolliniRichieste([c], ore(4)), { nuove: 0, inAttesaRisposta: 1 })
  assert.equal(scadenzaProposta(c, ore(25))?.scaduta, true)
  assert.equal(daGuardare([c], ore(25)).length, 1)
})

test('chiusura automatica con la stessa durata: notifica alla scadenza vera, chiusura 24 ore dopo', () => {
  const righe = [r('arrivo'), r('caparra')]
  // dopo 4 ore: si notifica solo quella all'arrivo
  assert.deepEqual(daNotificare(righe, ore(4)).map(x => x.id), ['arrivo'])
  // dopo 25 ore: anche quella con caparra; si chiude solo quella all'arrivo (3 + 24 = 27 ore? no: 25 < 27)
  assert.deepEqual(daNotificare(righe, ore(25)).map(x => x.id), ['arrivo', 'caparra'])
  assert.deepEqual(daChiudere(righe, ore(26)).map(x => x.id), [])
  assert.deepEqual(daChiudere(righe, ore(27)).map(x => x.id), ['arrivo'])
  // con caparra: chiusa 24 ore dopo la scadenza vera, cioè a 48 ore dall'invio
  assert.deepEqual(daChiudere(righe, ore(47.9)).map(x => x.id), ['arrivo'])
  assert.deepEqual(daChiudere(righe, ore(48)).map(x => x.id), ['arrivo', 'caparra'])
})
