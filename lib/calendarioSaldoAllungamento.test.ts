import test from 'node:test'
import assert from 'node:assert/strict'
import { nottiPagate } from './calendarioNastro.ts'
import { nottiPagate as pagateVecchie, coloreGiorno, COLORE_PAGATO } from './calendarioBarre.ts'
import { statoScheda } from './calendarioSchede.ts'
import { contoRiquadro } from './riquadroPremuto.ts'
import { barreSoggiorno, nottiPagateBarra } from './barreSoggiorno.ts'
const camera={id:'ambra',name:'Ambra'}
const r={id:'a',room_id:'ambra',prenotazione_id:'p',group_id:'g',check_in:'2030-10-21',check_out:'2030-10-25',price_per_night:80,total_amount:320,num_guests:2,pagato:true,status:'confermata'}
test('saldo di tre notti, quarta aggiunta: flag storico non copre il residuo',()=>{
 for(const copertura of [nottiPagate([r],{a:240},[camera]),pagateVecchie([r],{a:240})]){
  assert.equal(copertura.a,3)
  assert.notEqual(statoScheda(r,false,true),'pagato')
  const ctx={nottiPagate:copertura,lettiExtra:new Map<string,number>()}
  assert.equal(coloreGiorno(r,'2030-10-23',ctx),COLORE_PAGATO)
  assert.notEqual(coloreGiorno(r,'2030-10-24',ctx),COLORE_PAGATO)
 }
})
test('secondo allungamento e riapertura, saldo successivo, storico senza movimenti',()=>{
 const lungo={...r,check_out:'2030-10-26',total_amount:400}
 for(const value of [lungo,JSON.parse(JSON.stringify(lungo))])assert.equal(nottiPagate([value],{a:240},[camera]).a,3)
 assert.equal(nottiPagate([lungo],{a:400},[camera]).a,-1)
 assert.equal(statoScheda(lungo,true),'pagato')
 assert.equal(nottiPagate([r],{},[camera]).a,undefined)
 assert.equal(statoScheda(r),'pagato')
})
test('tratti uniti e camere aggiunte: zero esplicito prevale sulla spunta',()=>{
 const a={...r,check_out:'2030-10-24',total_amount:240}
 const b={...r,id:'b',check_in:'2030-10-24',total_amount:80}
 const map=nottiPagate([a,b],{a:240},[camera])
 assert.deepEqual(map,{a:3,b:0})
 const barra=barreSoggiorno([a,b])[0]
 assert.equal(nottiPagateBarra(barra,map),3)
 assert.notEqual(statoScheda(barra,false,true),'pagato')
 assert.equal(nottiPagateBarra(barra,{a:0,b:0}),0)
 const altra={...b,group_id:'altra',room_id:'lena'}
 assert.equal(nottiPagate([a,altra],{a:240},[camera]).b,0)
})

test('riquadro calendario: flag obsoleto non nasconde gli80rimasti',()=>{
 const conto=contoRiquadro([r],[{booking_id:'a',amount:240,method:'contanti'}]);
 assert.equal(conto.saldato,false);assert.match(conto.linea.map(x=>x.testo).join(''),/restano 80/);
 assert.equal(statoScheda(r,false),'pagato');
})


test('pagamenti su tratto annullato coprono lo stesso conto, non altre prenotazioni',()=>{
 const annullata={...r,id:'annullata',status:'annullata',total_amount:999}
 const altra={...r,id:'altra',prenotazione_id:'altro'}
 const tutte=[r,annullata,annullata,altra]
 assert.equal(nottiPagate([r],{a:240,annullata:20,altra:999},[camera],tutte).a,3)
 assert.equal(nottiPagate([r],{a:240,annullata:80},[camera],tutte).a,-1)
 assert.equal(nottiPagate([r],{annullata:320},[camera],tutte).a,-1)
 assert.equal(contoRiquadro([r,annullata],[{booking_id:'a',amount:240,method:'contanti'},{booking_id:'annullata',amount:80,method:'bonifico'}]).saldato,true)
})
