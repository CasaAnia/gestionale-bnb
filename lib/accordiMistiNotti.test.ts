import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pianoNotti, nottiDaSegmenti, cambiaOspitiConLettoAuto, lettoAutomaticoDellaNotte, cambiaCamera, type SegmentoNotti, type CameraStriscia, type PianoNotti } from './strisciaNotti.ts'
import { LENA_ID } from './lettiAggiuntivi.ts'

const allegra:CameraStriscia={id:'allegra',name:'Allegra',base_price:80,has_extra_bed:true,extra_bed_price:10}
const ambra:CameraStriscia={...allegra,id:'ambra',name:'Ambra'}
const lena:CameraStriscia={...allegra,id:LENA_ID,name:'Lena',double_price:90}
const camere=[allegra,ambra,lena]
const ctx={camere,altre:[],ospiti:3}
const prima='2027-03-01', seconda='2027-03-02'
function riga(id:string,camera:CameraStriscia,dal:string,al:string,extra:Partial<SegmentoNotti>={}):SegmentoNotti {
  return {id,room_id:camera.id,rooms:camera,status:'confermata',check_in:dal,check_out:al,num_guests:3,extra_bed:true,extra_bed_dates:[dal],price_per_night:80,extra_bed_total:10,total_amount:90,...extra}
}
function applica(righe:SegmentoNotti[],p:PianoNotti):SegmentoNotti[] {
  assert.equal(p.errore,null)
  return [...righe.filter(r=>!p.annulla.includes(r.id)).map(r=>({...r,...p.aggiorna.find(a=>a.id===r.id)?.campi})),...p.crea.map((r,i)=>({...r,id:`nuovo-${i}`,status:'confermata',rooms:camere.find(c=>c.id===r.room_id)}))]
}
const totale=(righe:SegmentoNotti[])=>righe.reduce((s,r)=>s+Math.round(Number(r.total_amount)*100),0)

for(const inverso of [false,true]) test(`R4: accordo manuale e listino non si sovrascrivono, anche invertendo le righe (${inverso})`,()=>{
  const righe=[riga('manuale',allegra,prima,seconda,{extra_bed_importo:5,extra_bed_criterio:'notte',extra_bed_total:5,total_amount:85}),riga('listino',allegra,seconda,'2027-03-03',{extra_bed_importo:10,extra_bed_criterio:'notte'})]
  if(inverso) righe.reverse()
  const piano=pianoNotti(nottiDaSegmenti(righe),righe,ctx)
  assert.equal(piano.errore,null)
  assert.equal(piano.tratti.reduce((s,t)=>s+t.pienoCent,0),17500)
  assert.deepEqual(applica(righe,piano).sort((a,b)=>a.check_in.localeCompare(b.check_in)),[...righe].sort((a,b)=>a.check_in.localeCompare(b.check_in)))
})

test('R4: accordo totale non si moltiplica spezzando il suo tratto e non invade quello a listino',()=>{
  const letto=[prima,seconda]
  let righe=[riga('totale',allegra,prima,'2027-03-03',{extra_bed_dates:letto,extra_bed_importo:30,extra_bed_criterio:'totale',extra_bed_total:30,total_amount:190}),riga('listino',ambra,'2027-03-03','2027-03-05',{extra_bed_dates:['2027-03-03','2027-03-04'],extra_bed_importo:10,extra_bed_criterio:'notte',extra_bed_total:20,total_amount:180})]
  const notti=cambiaCamera(nottiDaSegmenti(righe),seconda,ambra,ctx)
  righe=applica(righe,pianoNotti(notti,righe,ctx))
  assert.equal(totale(righe),37000)
  assert.equal(righe.filter(r=>r.extra_bed_criterio==='totale').reduce((s,r)=>s+Number(r.extra_bed_total),0),30)
  for(let i=0;i<2;i++) {
    righe=applica(righe,pianoNotti(nottiDaSegmenti(righe),righe,ctx))
    assert.equal(totale(righe),37000)
  }
})

test('R4: gratis concordato resta gratis, un tratto senza accordo usa il proprio listino',()=>{
  const righe=[riga('gratis',lena,prima,seconda,{num_guests:4,price_per_night:90,extra_bed_total:0,total_amount:90,extra_bed_importo:0,extra_bed_criterio:'notte'}),riga('listino',ambra,seconda,'2027-03-03')]
  const dopo=applica(righe,pianoNotti(nottiDaSegmenti(righe),righe,{...ctx,ospiti:4}))
  assert.equal(totale(dopo),18000)
  assert.equal(dopo.find(r=>r.id==='gratis')?.extra_bed_importo,0)
  assert.equal(dopo.find(r=>r.id==='listino')?.extra_bed_importo??null,null)
})

test('R4: riduzione, salvataggio, riapertura e ripristino conservano accordo manuale e prezzi camera',()=>{
  let righe=[riga('manuale',allegra,prima,seconda,{price_per_night:60,extra_bed_importo:5,extra_bed_criterio:'notte',extra_bed_total:5,total_amount:65}),riga('listino',ambra,seconda,'2027-03-03',{extra_bed_importo:10,extra_bed_criterio:'notte'})]
  for(const [persone,atteso] of [[1,15000],[3,15500],[1,15000],[3,15500]]) {
    const notti=nottiDaSegmenti(righe)
    const dopo=cambiaOspitiConLettoAuto(notti,prima,persone,ctx,lettoAutomaticoDellaNotte(notti,prima,ctx)).notti
    righe=applica(righe,pianoNotti(dopo,righe,ctx))
    assert.equal(totale(righe),atteso)
    assert.equal(righe.find(r=>r.check_in===prima)?.price_per_night,60)
    assert.equal(righe.find(r=>r.check_in===prima)?.extra_bed_importo,5)
    assert.equal(righe.find(r=>r.check_in===seconda)?.total_amount,90)
  }
})

test('R4: gratis in Lena non si perde passando per una capienza dove il listino è già zero',()=>{
  let righe=[riga('gratis',lena,prima,seconda,{num_guests:4,price_per_night:90,extra_bed_total:0,total_amount:90,extra_bed_importo:0,extra_bed_criterio:'notte'}),riga('listino',ambra,seconda,'2027-03-03')]
  const contesto={...ctx,ospiti:4}
  for(const [persone,atteso] of [[3,18000],[1,17000],[4,18000]]) {
    const notti=nottiDaSegmenti(righe)
    righe=applica(righe,pianoNotti(cambiaOspitiConLettoAuto(notti,prima,persone,contesto,lettoAutomaticoDellaNotte(notti,prima,contesto)).notti,righe,contesto))
    assert.equal(totale(righe),atteso)
    assert.equal(righe.find(r=>r.check_in===prima)?.extra_bed_importo,0)
    assert.equal(righe.find(r=>r.check_in===seconda)?.total_amount,90)
  }
})

test('R4: ogni4 segue soltanto le sue notti, anche spezzate e rilette',()=>{
  const date=['2027-03-01','2027-03-02','2027-03-03','2027-03-04','2027-03-05']
  let righe=[riga('ogni4',allegra,prima,'2027-03-06',{extra_bed_dates:date,extra_bed_importo:20,extra_bed_criterio:'ogni4',extra_bed_total:40,total_amount:440}),riga('listino',ambra,'2027-03-06','2027-03-07',{extra_bed_importo:10,extra_bed_criterio:'notte'})]
  righe=applica(righe,pianoNotti(cambiaCamera(nottiDaSegmenti(righe),'2027-03-03',ambra,ctx),righe,ctx))
  assert.equal(totale(righe),53000)
  for(let i=0;i<2;i++) {
    righe=applica(righe,pianoNotti(nottiDaSegmenti(righe),righe,ctx))
    assert.equal(totale(righe),53000)
    assert.equal(righe.filter(r=>r.extra_bed_criterio==='ogni4').reduce((s,r)=>s+Number(r.extra_bed_total),0),40)
  }
  const notti=nottiDaSegmenti(righe)
  righe=applica(righe,pianoNotti(cambiaOspitiConLettoAuto(notti,prima,1,ctx,true).notti,righe,ctx))
  assert.equal(totale(righe),51000)
})

test('R4: due accordi distinti di 30 non diventano un unico 30',()=>{
  let righe=[riga('uno',allegra,prima,seconda,{extra_bed_importo:30,extra_bed_criterio:'totale',extra_bed_total:30,total_amount:110}),riga('due',ambra,seconda,'2027-03-03',{extra_bed_importo:30,extra_bed_criterio:'totale',extra_bed_total:30,total_amount:110}),riga('listino',allegra,'2027-03-03','2027-03-04',{extra_bed_importo:10,extra_bed_criterio:'notte'})]
  for(let i=0;i<2;i++) {
    righe=applica(righe,pianoNotti(nottiDaSegmenti(righe),righe,ctx))
    assert.equal(totale(righe),31000)
    assert.equal(righe.find(r=>r.id==='uno')?.total_amount,110)
    assert.equal(righe.find(r=>r.id==='due')?.total_amount,110)
  }
})

test('R4: se l’identità di due totali non è più ricostruibile, non inventa quote e non prepara scritture',()=>{
  let righe=[riga('uno',allegra,prima,seconda,{extra_bed_importo:30,extra_bed_criterio:'totale',extra_bed_total:30,total_amount:110}),riga('due',ambra,seconda,'2027-03-03',{extra_bed_importo:30,extra_bed_criterio:'totale',extra_bed_total:30,total_amount:110}),riga('listino',allegra,'2027-03-03','2027-03-04',{extra_bed_importo:10,extra_bed_criterio:'notte'})]
  const primaModifica=cambiaOspitiConLettoAuto(nottiDaSegmenti(righe),prima,1,ctx,true).notti
  righe=applica(righe,pianoNotti(primaModifica,righe,ctx))
  assert.equal(totale(righe),28000)
  const copia=structuredClone(righe)
  const rimetti=cambiaOspitiConLettoAuto(nottiDaSegmenti(righe),prima,3,ctx,false).notti
  const incerto=pianoNotti(rimetti,righe,ctx)
  assert.match(incerto.errore??'',/ambigui/)
  assert.deepEqual([incerto.aggiorna,incerto.crea,incerto.annulla],[[],[],[]])
  assert.deepEqual(righe,copia)
})

test('R4: quote storiche incoerenti o righe sovrapposte si fermano senza cambiare prezzi',()=>{
  const a=riga('uno',allegra,prima,seconda,{extra_bed_importo:30,extra_bed_criterio:'totale',extra_bed_total:17,total_amount:97})
  const b=riga('due',ambra,seconda,'2027-03-03',{extra_bed_importo:30,extra_bed_criterio:'totale',extra_bed_total:12,total_amount:92})
  const c=riga('listino',allegra,'2027-03-03','2027-03-04',{extra_bed_importo:10,extra_bed_criterio:'notte'})
  const righe=[a,b,c]
  const piano=pianoNotti(nottiDaSegmenti(righe),righe,ctx)
  assert.match(piano.errore??'',/ambigui/)
  assert.deepEqual([piano.aggiorna,piano.crea,piano.annulla],[[],[],[]])
  const sovrapposte=[{...a,extra_bed_importo:5,extra_bed_criterio:'notte'}, {...a,id:'altra',extra_bed_importo:10,extra_bed_criterio:'notte'}]
  const ambiguo=pianoNotti(nottiDaSegmenti([sovrapposte[0]]),sovrapposte,ctx)
  assert.match(ambiguo.errore??'',/ambigui/)
})

test('R4: due totali distinti si conservano anche senza un terzo tratto a listino',()=>{
  const righe=[riga('uno',allegra,prima,seconda,{extra_bed_importo:30,extra_bed_criterio:'totale',extra_bed_total:30,total_amount:110}),riga('due',allegra,seconda,'2027-03-03',{extra_bed_importo:30,extra_bed_criterio:'totale',extra_bed_total:30,total_amount:110})]
  const piano=pianoNotti(nottiDaSegmenti(righe),righe,ctx)
  assert.equal(piano.errore,null)
  assert.equal(totale(applica(righe,piano)),22000)
  assert.deepEqual([piano.aggiorna,piano.crea,piano.annulla],[[],[],[]])
})

test('R4: allungare ai bordi continua l’accordo adiacente, come nel caso uniforme',()=>{
  const righe=[riga('manuale',allegra,prima,seconda,{extra_bed_importo:5,extra_bed_criterio:'notte',extra_bed_total:5,total_amount:85}),riga('listino',allegra,seconda,'2027-03-03',{extra_bed_importo:10,extra_bed_criterio:'notte'})]
  const notti=nottiDaSegmenti(righe)
  const primaNuova={...notti[0],iso:'2027-02-28'}
  const dopoNuova={...notti[1],iso:'2027-03-03'}
  const piano=pianoNotti([primaNuova,...notti,dopoNuova],righe,ctx)
  assert.equal(piano.errore,null)
  assert.equal(piano.tratti.length,2)
  assert.deepEqual(piano.tratti.map(t=>[t.check_in,t.check_out,t.pienoCent]),[['2027-02-28','2027-03-02',17000],['2027-03-02','2027-03-04',18000]])
})

test('R4: misti e sconto percentuale o totale concordato conservano gli importi pattuiti',()=>{
  const comuni=[riga('manuale',allegra,prima,seconda,{extra_bed_importo:5,extra_bed_criterio:'notte',extra_bed_total:5,total_amount:85}),riga('listino',ambra,seconda,'2027-03-03',{extra_bed_importo:10,extra_bed_criterio:'notte'})]
  const percentuali=comuni.map(r=>({...r,discount_type:'percentage',discount_value:10,total_amount:Number(r.total_amount)*0.9}))
  assert.equal(totale(applica(percentuali,pianoNotti(nottiDaSegmenti(percentuali),percentuali,ctx))),15750)
  const concordate=comuni.map((r,i)=>({...r,discount_type:'target_total',discount_value:i===0?68:72,total_amount:i===0?68:72}))
  assert.equal(totale(applica(concordate,pianoNotti(nottiDaSegmenti(concordate),concordate,ctx))),14000)
  const invarianti=structuredClone(concordate)
  const cambio=cambiaOspitiConLettoAuto(nottiDaSegmenti(concordate),prima,1,ctx,true).notti
  const piano=pianoNotti(cambio,concordate,ctx)
  assert.equal(piano.errore,null)
  assert.equal(totale(applica(concordate,piano)),14000)
  assert.deepEqual(concordate,invarianti)
})

test('R4: un accordo manuale non diventa automatico solo passando da una camera col medesimo listino',()=>{
  const amelia:CameraStriscia={id:'amelia',name:'Amelia',base_price:70,has_extra_bed:true,extra_bed_price:5}
  const contesto={...ctx,camere:[...camere,amelia]}
  let righe=[riga('manuale',allegra,prima,seconda,{num_guests:2,extra_bed_importo:5,extra_bed_criterio:'notte',extra_bed_total:5,total_amount:85}),riga('listino',ambra,seconda,'2027-03-03',{extra_bed_importo:10,extra_bed_criterio:'notte'})]
  for(const camera of [amelia,allegra]) {
    righe=applica(righe,pianoNotti(cambiaCamera(nottiDaSegmenti(righe),prima,camera,contesto),righe,contesto))
    assert.equal(righe.find(r=>r.check_in===prima)?.extra_bed_importo,5)
    assert.equal(righe.find(r=>r.check_in===seconda)?.total_amount,90)
  }
  assert.equal(totale(righe),17500)
})
