import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildChangeGroups, getUpcomingRoomChanges, coloriCatene } from './roomChanges.ts'
import { numeriOggi, cambiCameraPerGiorno } from './numeriOggi.ts'
const a = { id:'a',room_id:'lena',guest_id:'ospite',group_id:'gruppo',check_in:'2026-10-11',check_out:'2026-10-12',num_guests:2,status:'confermata' }
const b = { ...a,id:'b',check_in:'2026-10-12',check_out:'2026-10-18',num_guests:1 }
test('variare ospiti in Lena non crea cambio camera, arrivo o partenza intermedi',()=>{
 const rows=[a,b], groups=buildChangeGroups(rows)
 assert.deepEqual(groups.roomChangeEdges,[])
 assert.deepEqual(groups.edges,[{fromId:'a',toId:'b'}])
 assert.deepEqual(groups.chainKeyOf,{})
 assert.deepEqual(coloriCatene(rows),{})
 assert.deepEqual(getUpcomingRoomChanges(rows,{lena:'Lena'},['2026-10-12']),[])
 assert.deepEqual(cambiCameraPerGiorno(rows),{})
 assert.deepEqual(numeriOggi(rows,[{id:'lena'}],'2026-10-12'),{arriviOggi:0,partenzeOggi:0,camereOccupate:1,camereTotali:1})
 assert.equal(numeriOggi(rows,[],'2026-10-11').arriviOggi,1)
 assert.equal(numeriOggi(rows,[],'2026-10-18').partenzeOggi,1)
})
test('vero cambio camera resta riconosciuto e non crea un nuovo arrivo',()=>{
 const rows=[a,{...b,room_id:'ambra'}]
 assert.equal(getUpcomingRoomChanges(rows,{lena:'Lena',ambra:'Ambra'},['2026-10-12'])[0].toRoom,'Ambra')
 assert.deepEqual(cambiCameraPerGiorno(rows),{'2026-10-12':1})
 assert.equal(numeriOggi(rows,[],'2026-10-12').arriviOggi,0)
})
test('stessa camera con pausa mantiene partenza e arrivo separati',()=>{
 const rows=[a,{...b,check_in:'2026-10-14'}]
 assert.deepEqual(buildChangeGroups(rows).edges,[])
 assert.equal(numeriOggi(rows,[],'2026-10-12').partenzeOggi,1)
 assert.equal(numeriOggi(rows,[],'2026-10-14').arriviOggi,1)
})
