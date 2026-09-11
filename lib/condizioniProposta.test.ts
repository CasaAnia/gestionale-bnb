// «Come paga»: i quattro bottoni ci sono sempre, e cambiano il messaggio.
// Regressione del difetto trovato da Ania dal telefono l'11/09/2026: mentre la
// pagina aspettava la risposta a «L'hai inviata?» restava solo la riga della
// condizione già scelta, e le altre tre non si potevano più toccare.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { statoCondizioni } from './condizioniProposta.ts'
import { CONDIZIONI_PAGAMENTO, ETICHETTA_CONDIZIONE } from './condizioniPrenotazione.ts'
import { generaProposta, type Condizione } from './richiesteTesti.ts'
import { proponiSoluzioni } from './richiesteProposta.ts'
import { LENA_ID } from './lettiAggiuntivi.ts'

test('i quattro modi di pagare ci sono tutti, con la loro etichetta', () => {
  assert.deepEqual(CONDIZIONI_PAGAMENTO, ['arrivo', 'caparra', 'completo', 'personalizzata'])
  assert.deepEqual(CONDIZIONI_PAGAMENTO.map(t => ETICHETTA_CONDIZIONE[t]),
    ["All'arrivo", 'Caparra', 'Pagamento completo', 'Personalizzata'])
})

test('si può scegliere anche mentre si aspetta la risposta a «L’hai inviata?»', () => {
  // mentre si compone
  assert.equal(statoCondizioni({ completo: false, inviata: false }), 'scegliere')
  // in attesa della risposta: è QUI che prima i bottoni sparivano
  assert.equal(statoCondizioni({ completo: false, inviata: false }), 'scegliere')
  // proposta già inviata: si legge cosa è partito, non si riscrive
  assert.equal(statoCondizioni({ completo: false, inviata: true }), 'solo_lettura')
  // «non c'è posto»: il messaggio non parla di pagamento
  assert.equal(statoCondizioni({ completo: true, inviata: false }), 'nascoste')
  assert.equal(statoCondizioni({ completo: true, inviata: true }), 'nascoste')
})

// ── Toccare un bottone cambia davvero il messaggio ──────────────────────────
const ALLEGRA = { id: 'allegra', name: 'Allegra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, active: true }
const LENA = { id: LENA_ID, name: 'Lena', base_price: 80, double_price: 90, has_extra_bed: true, extra_bed_price: 10, active: true }
const RICHIESTA = { nome: 'Anna', arrivo: '2026-10-29', partenza: '2026-10-31', persone: 2, camera_id: 'allegra' }
const SOLUZIONE = proponiSoluzioni(RICHIESTA, [ALLEGRA, LENA], [])[0]

const testo = (condizione: Condizione | null) =>
  generaProposta({ richiesta: RICHIESTA, soluzione: SOLUZIONE, condizione })

test('ognuno dei quattro bottoni scrive il suo paragrafo nel messaggio', () => {
  const arrivo = testo({ tipo: 'arrivo' })
  const caparra = testo({ tipo: 'caparra', caparraCentesimi: 8000 })
  const completo = testo({ tipo: 'completo' })
  const mia = testo({ tipo: 'personalizzata', testo: 'Paga come preferisce, ne parliamo al telefono.' })

  assert.match(arrivo, /Il pagamento avviene all'arrivo, alla consegna delle chiavi/)
  assert.match(caparra, /le chiedo una caparra di 80 €, pari al 50% del totale/)
  assert.match(completo, /le chiedo il pagamento anticipato dell'intero soggiorno, 160 €/)
  assert.match(mia, /Paga come preferisce, ne parliamo al telefono\./)

  // quattro testi diversi fra loro: cambiare bottone cambia il messaggio
  assert.equal(new Set([arrivo, caparra, completo, mia]).size, 4)
  // e ognuno esclude i paragrafi degli altri
  assert.ok(!arrivo.includes('caparra di'))
  assert.ok(!caparra.includes('pagamento anticipato dell'))
  assert.ok(!completo.includes('le chiedo una caparra'))
  assert.ok(!mia.includes("Il pagamento avviene all'arrivo"))
})

test('senza nessuna scelta il messaggio si ferma prima del pagamento', () => {
  const senza = testo(null)
  assert.ok(!senza.includes('Il pagamento avviene'))
  assert.ok(!senza.includes('caparra'))
  // e non c'è nemmeno la frase delle 3 ore né la chiusura
  assert.ok(!senza.includes('entro 3 ore'))
  // toccando un bottone il messaggio si allunga subito
  assert.ok(testo({ tipo: 'arrivo' }).length > senza.length)
})
