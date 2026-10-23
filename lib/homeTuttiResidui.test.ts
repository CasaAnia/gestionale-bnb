import test from 'node:test'
import assert from 'node:assert/strict'
import {daIncassare} from './statistiche/intervallo.ts'
import {vociDaIncassare,partenzeConResiduo,incassatiOggi,statoSoggiorno} from './incassiHome.ts'
import {eccezioniPagamenti} from './daControllare.ts'
import {contoPrenotazione} from './prenotazioneUnica.ts'
const b=(id:string,extra={})=>({id,room_id:'ambra',check_in:'2030-01-01',check_out:'2030-01-03',status:'confermata',total_amount:160,...extra})
test('tutti i residui:senza acconto,futuri,parziali e mancato arrivo,senza prezzo originale doppio',()=>{
 const rows=[b('zero'),b('future',{check_in:'2031-01-01',check_out:'2031-01-03'}),b('partial'),b('noShow',{status:'annullata',total_amount:80,mancato_arrivo_centesimi:40_00}),b('cancel',{status:'annullata'}),b('paid'),b('pending',{status:'in_attesa'})]
 const pag=[{id:'p',booking_id:'partial',amount:60,paid_on:null},{id:'q',booking_id:'paid',amount:160,paid_on:null}]
 const out=daIncassare(rows,pag)
 assert.equal(out.length,4)
 assert.deepEqual(Object.fromEntries(out.map(x=>[x.id,x.residuoCent])),{future:16000,zero:16000,partial:10000,noShow:4000})
 const voci=vociDaIncassare(rows,pag,'2030-02-01')
 assert.equal(voci.reduce((n,x)=>n+x.residuoCent,0),46000)
 assert.equal(voci.find(x=>x.id==='noShow')?.stato,'Mancato arrivo · da incassare')
 assert.equal(voci.find(x=>x.id==='noShow')?.mancatoArrivo,true)
})
test('una prenotazione su due camere,righe duplicate e pagamenti su annullati:stesso conto una volta',()=>{
 const rows=[b('a',{prenotazione_id:'p',group_id:'g1',total_amount:200}),b('z',{prenotazione_id:'p',group_id:'g2',total_amount:300}),b('old',{prenotazione_id:'p',status:'annullata',total_amount:999})]
 const pay=[{id:'pay',booking_id:'old',amount:100,paid_on:null}]
 const out=daIncassare([...rows,rows[0]],pay)
 assert.equal(out.length,1);assert.equal(out[0].residuoCent,40000)
 assert.equal(out[0].ricevutoCent,contoPrenotazione(rows,pay).ricevutiCent)
 assert.equal(vociDaIncassare(rows,pay,'2030-02-01')[0].residuoCent,40000)
 assert.match(eccezioniPagamenti(rows,pay,'2030-01-02')[0].motivo,/registrati 100 € su 500 €/)
})
test('stesso movimento letto due volte conta una volta;due versamenti uguali con ID diversi restano due',()=>{
 const p={id:'p',booking_id:'a',amount:40,paid_on:null}
 assert.equal(daIncassare([b('a')],[p,p])[0].ricevutoCent,4000)
 assert.equal(daIncassare([b('a')],[p,{...p,id:'q'}])[0].ricevutoCent,8000)
})
test('saldo,oltreincasso,1centesimo e storico senza movimenti rispettano il conto',()=>{
 assert.equal(daIncassare([b('a',{total_amount:100.01})],[{booking_id:'a',amount:100,paid_on:null}])[0].residuoCent,1)
 assert.deepEqual(daIncassare([b('a')],[{booking_id:'a',amount:160,paid_on:null}]),[])
 assert.deepEqual(daIncassare([b('a')],[{booking_id:'a',amount:170,paid_on:null}]),[])
 assert.deepEqual(daIncassare([b('a',{pagato:true})],[]),[])
 assert.equal(daIncassare([b('a',{pagato:true})],[{booking_id:'a',amount:80,paid_on:null}])[0].residuoCent,8000)
})
test('pagamento del mancato arrivo riduce il credito,al saldo sparisce e i dati restano intatti',()=>{
 const rows=[b('n',{status:'annullata',total_amount:80,mancato_arrivo_centesimi:4000})]
 const before=JSON.stringify(rows)
 assert.equal(daIncassare(rows,[{booking_id:'n',amount:10,paid_on:null}])[0].residuoCent,3000)
 assert.deepEqual(daIncassare(rows,[{booking_id:'n',amount:40,paid_on:null}]),[])
 assert.equal(JSON.stringify(rows),before)
})

test('partenze e incassati oggi:stesso residuo con centesimi e pagamenti su righe annullate',()=>{
 const rows=[b('a',{total_amount:100.30}),b('old',{status:'annullata',group_id:'g',total_amount:80})].map(x=>({...x,group_id:'g'}))
 const pay=[{id:'p',booking_id:'old',amount:100,paid_on:'2030-01-03'}]
 assert.equal(partenzeConResiduo([rows[0]],rows,pay)[0].residuoCent,30)
 assert.match(incassatiOggi(rows,pay,'2030-01-03')[0].testo,/acconto/)
 assert.equal(incassatiOggi(rows,[pay[0],pay[0]],'2030-01-03').length,1)
 const paid=[...pay,{id:'q',booking_id:'a',amount:0.30,paid_on:'2030-01-03'}]
 assert.deepEqual(partenzeConResiduo([rows[0]],rows,paid),[])
 assert.match(incassatiOggi(rows,paid,'2030-01-03')[1].testo,/saldo completo/)
})
test('due camere in partenza:una sola voce per lo stesso conto;futuro di un altro anno riconoscibile',()=>{
 const rows=[b('a',{prenotazione_id:'p'}),b('z',{prenotazione_id:'p',room_id:'lena'})]
 assert.equal(partenzeConResiduo(rows,rows,[]).length,1)
 assert.equal(partenzeConResiduo(rows,rows,[])[0].residuoCent,32000)
 assert.match(statoSoggiorno('2031-06-01','2031-06-02','2030-01-01'),/2031/)
})

test('incasso su annullamento ordinario non diventa un saldo di soggiorno,nessun debito inventato',()=>{
 const rows=[b('cancel',{status:'annullata'})]
 const pay=[{id:'p',booking_id:'cancel',amount:20,paid_on:'2030-01-03'}]
 assert.deepEqual(daIncassare(rows,pay),[])
 assert.match(incassatiOggi(rows,pay,'2030-01-03')[0].testo,/acconto/)
})
