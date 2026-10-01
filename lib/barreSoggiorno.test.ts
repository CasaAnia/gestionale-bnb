import { test } from 'node:test'
import assert from 'node:assert/strict'
import { barreSoggiorno, nottiPagateBarra } from './barreSoggiorno.ts'
const a={id:'a',group_id:'g',room_id:'lena',check_in:'2026-10-11',check_out:'2026-10-12',num_guests:2,total_amount:80,status:'confermata'}
const b={...a,id:'b',check_in:'2026-10-12',check_out:'2026-10-18',num_guests:1,total_amount:480}
test('una sola barra 11→18, ospiti 2→1 e totale 560; originali intatti',()=>{
 const originali=[a,b], copia=structuredClone(originali), barre=barreSoggiorno(originali)
 assert.equal(barre.length,1);assert.equal(barre[0].check_in,a.check_in);assert.equal(barre[0].check_out,b.check_out)
 assert.equal(barre[0].total_amount,560);assert.equal(barre[0].ospitiPeriodo,'2 → 1 ospiti')
 assert.deepEqual(barre[0].trattiBarra,originali);assert.deepEqual(originali,copia)
 assert.equal(barre.filter(r=>r.check_out>'2026-10-13'&&r.check_in<'2026-10-20').length,1)
})
test('vero cambio, pausa e prenotazioni indipendenti rimangono separati',()=>{
 for(const secondo of [{...b,room_id:'ambra'},{...b,check_in:'2026-10-14'},{...b,group_id:'altro'}])assert.equal(barreSoggiorno([a,secondo]).length,2)
 assert.deepEqual(barreSoggiorno([a]),[a])
})
test('acconti lungo tutti i tratti senza falso tutto pagato',()=>{
 const barra=barreSoggiorno([a,b])[0]
 assert.equal(nottiPagateBarra(barra,{a:-1,b:2}),3)
 assert.equal(nottiPagateBarra(barra,{a:-1,b:-1}),-1)
 assert.equal(nottiPagateBarra(barra,{b:-1}),undefined)
})
test('2→3→2 una sola scheda, senza perdere le notti del letto',()=>{
 const c={...b,id:'c',check_in:'2026-10-14',num_guests:2}
 const medio={...b,check_out:c.check_in,num_guests:3,extra_bed:true}
 const barra=barreSoggiorno([a,medio,c])[0]
 assert.equal(barra.ospitiPeriodo,'2 → 3 → 2 ospiti')
 assert.deepEqual(barra.extra_bed_dates,['2026-10-12','2026-10-13'])
})
