import { test } from 'node:test'
import assert from 'node:assert/strict'
import { causaleBonifico } from './causale.ts'
import { chiavePrenotazione, periodiCamera, leggiPrenotazioneUnica, contoPrenotazione, accordoPrenotazione, haCamereParallele, type RigaPrenotazione } from './prenotazioneUnica.ts'
const a: RigaPrenotazione = { id:'a', prenotazione_id:'p', group_id:'g', guest_id:'c', status:'confermata', check_in:'2026-09-10', check_out:'2026-09-12', total_amount:160, caparra_centesimi:15000, accordo_pagamento:'caparra_libera' }
const b = { ...a, id:'b', check_in:'2026-09-12', check_out:'2026-09-14', total_amount:180, caparra_centesimi:null }
const c = { ...a, id:'c', group_id:'h', check_out:'2026-09-16', total_amount:300, caparra_centesimi:null }
test('due camere con un cambio: conto unico, solo due periodi nel cambio', () => {
  assert.equal(chiavePrenotazione(c),'p')
  assert.deepEqual(periodiCamera(a,[c,b,a]).map(r=>r.id),['a','b'])
  assert.equal(haCamereParallele([a,b,c]),true)
  assert.deepEqual(contoPrenotazione([a,b,c],[{booking_id:'c',amount:50}]), {totaleCent:64000,ricevutiCent:5000,residuoCent:59000})
  assert.equal(accordoPrenotazione([c,b,a])?.caparra_centesimi,15000)
})
test('modifica solo letto di una camera, due salvataggi e riapertura, incasso resta unico', () => {
  let rows=[a,b,c]; const incassi=[{booking_id:'c',amount:50}]
  rows=rows.map(r=>r.id==='a'?{...r,total_amount:185}:r)
  rows=structuredClone(rows).map(r=>r.id==='a'?{...r,total_amount:185}:r)
  assert.equal(contoPrenotazione(rows,incassi).residuoCent,61500)
  assert.equal(rows[2].total_amount,300)
})
test('annullare una camera toglie il costo ma conserva il suo pagamento', () => {
  assert.deepEqual(contoPrenotazione([a,{...c,status:'annullata'}],[{booking_id:'c',amount:50}]),{totaleCent:16000,ricevutiCent:5000,residuoCent:11000})
})
test('lettura incompleta, errore, cliente o prenotazione diversi: nessun conto parziale', async () => {
  for(const response of [{data:null,error:new Error('rete')},{data:[c],error:null},{data:[a,{...c,guest_id:'altro'}],error:null},{data:[a,{...c,prenotazione_id:'altro'}],error:null}]) {
    const r=await leggiPrenotazioneUnica(a,async()=>response)
    assert.equal(r.righe.length,0); assert.ok(r.errore)
  }
  const r=await leggiPrenotazioneUnica(c,async f=>{assert.deepEqual(f,{colonna:'prenotazione_id',valore:'p'});return {data:[a,b,c],error:null}})
  assert.equal(r.errore,null);assert.equal(r.righe.length,3)
})
test('fallback solo sui legami espliciti delle prenotazioni vecchie', () => {
  assert.equal(chiavePrenotazione({id:'x',group_id:'g'}),'g')
  assert.equal(chiavePrenotazione({id:'x'}),'x')
})

test('la causale include la partenza della camera più lunga, anche se un cambio inizia dopo',()=>{
 assert.match(causaleBonifico([a,c,b],'Cliente Prova'),/10–16 set/)
})

// ══ LA RISERVA DELL'ACCORDO (21/09/2026 sera, terzo ricontrollo) ════════════
// Senza nessun accordo scritto si prendeva la PRIMA riga per data, che può
// essere una riga annullata: la sua spunta «bonifico» finiva nella conferma al
// cliente, che prometteva un pagamento anticipato mai concordato.
const conAccordo = (id: string, status: string, check_in: string, extra: Record<string, unknown> = {}) => ({
  id, status, check_in, check_out: '2026-09-28', group_id: null, prenotazione_id: 'p-29',
  total_amount: 100, caparra_centesimi: null, accordo_pagamento: null, bonifico: false, ...extra,
}) as unknown as RigaPrenotazione

test('senza accordo scritto la riserva è una riga ATTIVA, non quella annullata', () => {
  const annullata = conAccordo('a', 'annullata', '2026-09-24', { bonifico: true })
  const viva = conAccordo('b', 'confermata', '2026-09-24', { bonifico: false })
  // stesse date: prima si decideva per id, e vinceva «a», la annullata
  assert.equal(accordoPrenotazione([annullata, viva])?.id, 'b')
  assert.equal(accordoPrenotazione([viva, annullata])?.id, 'b')
  assert.equal(accordoPrenotazione([annullata, viva])?.bonifico, false, 'la spunta bonifico arrivava da una camera annullata')
  // e anche quando l'annullata comincia PRIMA
  const annullataPrima = conAccordo('a', 'annullata', '2026-09-20', { bonifico: true })
  assert.equal(accordoPrenotazione([annullataPrima, viva])?.id, 'b')
})

test('un accordo o una caparra SCRITTI valgono anche se stanno su una riga annullata', () => {
  const viva = conAccordo('b', 'confermata', '2026-09-24')
  // l'accordo è stato registrato sul tratto poi annullato: resta quello della prenotazione
  const annullataConAccordo = conAccordo('a', 'annullata', '2026-09-24', { accordo_pagamento: 'bonifico_intero' })
  assert.equal(accordoPrenotazione([annullataConAccordo, viva])?.id, 'a')
  assert.equal(accordoPrenotazione([annullataConAccordo, viva])?.accordo_pagamento, 'bonifico_intero')
  // e la caparra vince su tutto, come sempre
  const annullataConCaparra = conAccordo('a', 'annullata', '2026-09-24', { caparra_centesimi: 15000 })
  const vivaConAccordo = conAccordo('b', 'confermata', '2026-09-24', { accordo_pagamento: 'contanti' })
  assert.equal(accordoPrenotazione([vivaConAccordo, annullataConCaparra])?.caparra_centesimi, 15000)
})

test('prenotazione tutta annullata: la riserva resta la prima riga, per dire com’era', () => {
  const uno = conAccordo('a', 'annullata', '2026-09-24', { bonifico: true })
  const due = conAccordo('b', 'annullata', '2026-09-26')
  assert.equal(accordoPrenotazione([due, uno])?.id, 'a')
  assert.equal(accordoPrenotazione([] as RigaPrenotazione[])?.id, undefined)
})
