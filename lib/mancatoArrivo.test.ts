import {test} from 'node:test'
import assert from 'node:assert/strict'
import {pulizieDiOggi} from './pulizieOggi.ts'
import {contoPrenotazione} from './prenotazioneUnica.ts'
import {contoMancatoArrivo} from './mancatoArrivo.ts'
import {ricaviSoggiornoCent,incassiCent} from './statistiche/intervallo.ts'

test('Mancato arrivo non chiude la pulizia precedente e il nuovo ospite ha un conto separato',()=>{
 const oggi='2026-09-27',rooms=[{id:'r',name:'Ambra'}]
 const prima={id:'prima',room_id:'r',status:'completata',check_in:'2026-09-24',check_out:oggi,total_amount:240}
 const mancato={id:'no',room_id:'r',status:'annullata',check_in:oggi,check_out:'2026-09-29',total_amount:160,mancato_arrivo_centesimi:8000}
 const aperte=pulizieDiOggi(rooms,[prima,mancato],[],oggi).filter(v=>v.stato==='da_fare')
 assert.equal(aperte.length,1);assert.equal(aperte[0].daSegnare?.booking_id,'prima')
 const nuovo={id:'nuovo',room_id:'r',status:'confermata',check_in:oggi,check_out:'2026-09-29',total_amount:180}
 const pagamenti=[{booking_id:'no',amount:80,paid_on:oggi},{booking_id:'nuovo',amount:180,paid_on:oggi}]
 assert.equal(contoPrenotazione([mancato],pagamenti).residuoCent,0)
 assert.equal(contoPrenotazione([nuovo],pagamenti).ricevutiCent,18000)
 assert.equal(contoMancatoArrivo([mancato],pagamenti).originale,16000)
 assert.equal(ricaviSoggiornoCent([mancato,nuovo],oggi,'2026-09-30'),18000)
 assert.equal(incassiCent(pagamenti,oggi,'2026-09-30'),26000)
 const fatta={id:'c',room_id:'r',booking_id:'prima',tipo:'fine_soggiorno' as const,stato:'fatta' as const,data_prevista:oggi,data_effettiva:oggi,created_at:oggi+'T10:00:00Z'}
 assert.equal(pulizieDiOggi(rooms,[prima,mancato],[fatta],oggi).filter(v=>v.stato==='da_fare').length,0)
})
