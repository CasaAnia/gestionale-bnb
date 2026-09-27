import {test} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {databasePulizieFinto} from './pulizie-db-finto.mjs'
import {preparaMancatoArrivo} from './mancato-arrivo-db-finto.mjs'
import {fotoMancatoArrivo,contoMancatoArrivo} from '../../lib/mancatoArrivo.ts'
import {contoPrenotazione} from '../../lib/prenotazioneUnica.ts'
import {pulizieDiOggi} from '../../lib/pulizieOggi.ts'
import {eccezioniMancatiArrivi} from '../../lib/daControllare.ts'
import {incassiCent,ricaviSoggiornoCent} from '../../lib/statistiche/intervallo.ts'

test('Mancato arrivo: credito 50%, notti libere, nessuna pulizia, incasso separato e idempotente',async()=>{
 const oggi=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome'}).format(new Date())
 const rooms=[{id:randomUUID(),name:'Ambra'}]
 const booking={id:randomUUID(),room_id:rooms[0].id,guest_id:randomUUID(),status:'confermata',check_in:oggi,check_out:'2026-12-31',num_guests:2,total_amount:301.01,pagato:false}
 const db=await databasePulizieFinto(rooms,[booking],[],{con0059:true})
 try{
  await preparaMancatoArrivo(db,[booking])
  const call=async(id,r)=>(await db.query('select gestisci_mancato_arrivo($1,$2) r',[id,JSON.stringify(r)])).rows[0].r
  const read=async()=>({b:(await db.query('select row_to_json(b) r from bookings b')).rows.map(x=>x.r),p:(await db.query('select row_to_json(p) r from payments p')).rows.map(x=>x.r)})
  const richiesta={azione:'segna',booking_id:booking.id,ricevuto:0,righe:fotoMancatoArrivo([booking])},op=randomUUID()
  const risposta=await call(op,richiesta)
  assert.equal(risposta.dovuto,15051);assert.equal(risposta.righe[0].total_amount,301.01)
  assert.deepEqual(await call(op,richiesta),risposta)
  for(let i=0;i<2;i++){
   const {b,p}=await read();assert.equal(b[0].status,'annullata');assert.equal(p.length,0)
   assert.equal(contoPrenotazione(b,p).residuoCent,15051)
   assert.equal(eccezioniMancatiArrivi(b,p).length,1)
   assert.equal(pulizieDiOggi(rooms,b,[],oggi).filter(x=>x.stato==='da_fare').length,0)
   assert.equal(ricaviSoggiornoCent(b,oggi,'2027-01-01'),0)
  }
  const pagamento={azione:'incassa',booking_id:booking.id,dovuto:15051,ricevuto:0,importo:5051,data:oggi,metodo:'bonifico'},key=randomUUID()
  await call(key,pagamento);await call(key,pagamento)
  await assert.rejects(call(randomUUID(),pagamento),/incassi sono cambiati/)
  let {b,p}=await read();assert.equal(p.length,1);assert.equal(contoMancatoArrivo(b,p).residuo,10000)
  await call(randomUUID(),{...pagamento,ricevuto:5051,importo:10000})
  for(let i=0;i<2;i++){
   ({b,p}=await read());assert.equal(p.length,2);assert.equal(contoPrenotazione(b,p).residuoCent,0);assert.equal(b[0].pagato,true)
   assert.equal(eccezioniMancatiArrivi(b,p).length,0);assert.equal(incassiCent(p,oggi,'2027-01-01'),15051)
  }
  await assert.rejects(call(key,{...pagamento,importo:1}),/Chiave operazione/)
  await assert.rejects(call(randomUUID(),{...pagamento,ricevuto:15051,importo:1}),/superiore al residuo/)
 }finally{await db.close()}
})

test('Più camere: metà esatta del totale, incassi precedenti conservati, conto cambiato e anonimo rifiutati',async()=>{
 const oggi=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome'}).format(new Date()),g=randomUUID()
 const rooms=[{id:randomUUID(),name:'Ambra'},{id:randomUUID(),name:'Allegra'}]
 const bookings=rooms.map((r,i)=>({id:randomUUID(),room_id:r.id,guest_id:g,prenotazione_id:g,status:'confermata',check_in:oggi,check_out:'2026-12-31',num_guests:1,total_amount:i?100.02:100.01}))
 const payments=[{id:randomUUID(),booking_id:bookings[1].id,amount:20,method:'contanti',paid_on:oggi}]
 const db=await databasePulizieFinto(rooms,bookings,[],{con0059:true})
 try {
  await preparaMancatoArrivo(db,bookings,payments)
  const r={azione:'segna',booking_id:bookings[0].id,ricevuto:2000,righe:fotoMancatoArrivo(bookings)}
  const call=(r)=>db.query('select gestisci_mancato_arrivo($1,$2) r',[randomUUID(),JSON.stringify(r)])
  await assert.rejects(call({...r,ricevuto:0}),/incassi sono cambiati/)
  await assert.rejects(call({...r,righe:fotoMancatoArrivo([{...bookings[0],total_amount:1},bookings[1]])}),/prenotazione è cambiata/)
  const out=(await call(r)).rows[0].r
  assert.equal(out.dovuto,10002);assert.equal(out.ricevuto,2000)
  assert.equal(out.righe.reduce((n,b)=>n+b.mancato_arrivo_centesimi,0),10002)
  assert.equal(contoPrenotazione(out.righe,payments).residuoCent,8002)
  assert.equal((await db.query('select count(*)::int n from payments')).rows[0].n,1)
  await db.exec('reset role; set role anon;')
  await assert.rejects(call(r),/permission denied/)
 }finally{await db.close()}
})
