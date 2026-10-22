import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { capienzaBase, capienzaCamera, tariffaCamera, lettoAggiuntivoANotte } from './tariffe.ts'
import { LENA_ID } from './lettiAggiuntivi.ts'
import { periodiDaNottiTenendoVuote, conLettoDiListino, righeDaSalvare, contoNuovaPrenotazione } from './nuovaPrenotazione.ts'
import { nottiDaSegmenti, pianoNotti, cambiaOspitiConLettoAuto, lettoAutomaticoDellaNotte, type CameraStriscia, type SegmentoNotti, type NotteStriscia } from './strisciaNotti.ts'

const camere: CameraStriscia[] = [
  {id:'amelia',name:'Amelia',base_price:70,has_extra_bed:true,extra_bed_price:5},
  {id:'allegra',name:'Allegra',base_price:80,has_extra_bed:true,extra_bed_price:10},
  {id:'ambra',name:'Ambra',base_price:80,has_extra_bed:true,extra_bed_price:10},
  {id:LENA_ID,name:'Lena',base_price:80,double_price:90,has_extra_bed:true,extra_bed_price:10},
]
const date = ['2027-02-01','2027-02-02','2027-02-03','2027-02-04']
function* combinazioni<T>(stati:T[], n:number):Generator<T[]> {
  if(n===0) {yield []; return}
  for(const primo of stati) for(const resto of combinazioni(stati,n-1)) yield [primo,...resto]
}
const leggibili = (notti:NotteStriscia[]) => notti.map(n=>[n.iso,n.cameraId,n.persone,n.letto,n.dentro])

for(const camera of camere) test(`matrice ${camera.name}: inserimento, salvataggio, riapertura e seconda modifica per tutti gli ospiti/letti`,()=>{
  const stati:{persone:number;letto:boolean}[]=[]
  for(let persone=1;persone<=capienzaCamera(camera);persone++) {
    if(persone<=capienzaBase(camera)) stati.push({persone,letto:false})
    stati.push({persone,letto:true})
  }
  let casi=0
  for(const combinazione of combinazioni(stati,4)) {
    casi++
    const notti:NotteStriscia[]=combinazione.map((s,i)=>({iso:date[i],cameraId:camera.id,camera:camera.name,dentro:true,motivo:null,parallela:false,...s}))
    const trova=(id:string|null)=>camere.find(c=>c.id===id)??null
    let id=0
    const periodi=conLettoDiListino(periodiDaNottiTenendoVuote(notti,{gruppo:'gruppo',periodi:[]},()=>`periodo-${++id}`),trova)
    const conto=contoNuovaPrenotazione(periodi,trova,{tipo:'nessuno',valore:null})
    const atteso = combinazione.reduce((somma,n)=>somma+tariffaCamera(camera,n.persone).prezzoNotte+(n.letto?lettoAggiuntivoANotte(camera,n.persone):0),0)
    assert.equal(conto.daPagareCent,Math.round(atteso*100),JSON.stringify({camera:camera.name,combinazione}))
    let salvati:SegmentoNotti[]=righeDaSalvare(periodi,trova,()=> 'gruppo').map((r,i)=>({...r,id:`salvato-${i}`,status:'confermata',rooms:camera,...(periodi[i].nottiLetto.length&&periodi[i].letto?{extra_bed_importo:periodi[i].letto!.importo,extra_bed_criterio:periodi[i].letto!.criterio}:{})}))
    assert.deepEqual(leggibili(nottiDaSegmenti(salvati)),leggibili(notti),JSON.stringify({camera:camera.name,combinazione}))
    assert.equal(Math.round(salvati.reduce((t,s)=>t+Number(s.total_amount),0)*100),conto.daPagareCent,JSON.stringify({camera:camera.name,combinazione}))
    // Riaprire e risalvare senza cambiare non altera persone, letti o conto.
    const contesto={camere,altre:[],ospiti:Math.max(...combinazione.map(s=>s.persone))}
    let piano=pianoNotti(nottiDaSegmenti(salvati),salvati,contesto)
    assert.equal(piano.errore,null)
    // Il piano può normalizzare i tratti: conta che non perda notti o alteri il conto.
    const normalizzate = [...salvati.filter(s=>!piano.annulla.includes(s.id)).map(s=>({...s,...piano.aggiorna.find(a=>a.id===s.id)?.campi})),...piano.crea.map(r=>({...r,id:`normalizzata-${++id}`,status:'confermata',rooms:camera}))]
    assert.deepEqual(leggibili(nottiDaSegmenti(normalizzate)),leggibili(notti))
    assert.equal(normalizzate.reduce((t,s)=>t+Math.round(Number(s.total_amount)*100),0),conto.daPagareCent,JSON.stringify({camera:camera.name,combinazione}))
    salvati=normalizzate
    // Due salvataggi successivi: ogni volta ripartire dai record riletti.
    for(const quanti of [capienzaCamera(camera),1]) {
      const prima=nottiDaSegmenti(salvati)
      // Un accordo uniforme resta pattuito (anche gratis); listini diversi
      // seguono invece la singola notte. Non trasformare un accordo in listino.
      const accordiPrima=salvati.filter(s=>s.extra_bed_criterio && s.extra_bed_importo!=null)
      const importiPrima=new Set(accordiPrima.map(s=>Number(s.extra_bed_importo)))
      const prezzoPattuito=importiPrima.size===1 ? Number(accordiPrima[0].extra_bed_importo) : null
      const dopo=cambiaOspitiConLettoAuto(prima,date[2],quanti,contesto,lettoAutomaticoDellaNotte(prima,date[2],contesto)).notti
      piano=pianoNotti(dopo,salvati,contesto)
      assert.equal(piano.errore,null)
      const aggiornate=new Map(piano.aggiorna.map(a=>[a.id,a.campi]))
      salvati=[...salvati.filter(s=>!piano.annulla.includes(s.id)).map(s=>({...s,...aggiornate.get(s.id)})),...piano.crea.map(r=>({...r,id:`nuovo-${++id}`,status:'confermata',rooms:camera}))]
      assert.deepEqual(leggibili(nottiDaSegmenti(salvati)),leggibili(dopo))
      assert.equal(nottiDaSegmenti(salvati).length,4)
      const contoDopo=dopo.reduce((totale,n)=>totale+tariffaCamera(camera,n.persone).prezzoNotte+(n.letto ? prezzoPattuito ?? lettoAggiuntivoANotte(camera,n.persone) : 0),0)
      assert.equal(salvati.reduce((t,s)=>t+Math.round(Number(s.total_amount)*100),0),Math.round(contoDopo*100),JSON.stringify({camera:camera.name,combinazione,quanti}))
    }
  }
  assert.equal(casi,stati.length**4)
})

// Il caso a schermo aveva il + spento a due persone solo perché un'altra
// notte aveva un letto facoltativo: proteggere anche il collegamento della UI.
test('nuova prenotazione: i letti delle altre notti non abbassano la capienza della notte aperta', () => {
  const pagina = readFileSync(new URL('../app/nuova-prenotazione/page.tsx', import.meta.url), 'utf8')
  assert.match(pagina, /ospitiPossibili=\{ospitiPossibiliNotte\(cameraNotte, capienzaCamera\(cameraNotte\)\)\}/)
})

test('Lena 2→3: accordo manuale totale conservato insieme alla differenza di tariffa e al cambio camera', () => {
  const lena=camere[3]
  const originale:SegmentoNotti={id:'manuale',room_id:lena.id,rooms:lena,status:'confermata',check_in:date[0],check_out:date[2],num_guests:3,extra_bed:true,extra_bed_dates:[date[1]],price_per_night:80,extra_bed_total:40,total_amount:200,extra_bed_importo:30,extra_bed_criterio:'totale'}
  const contesto={camere,altre:[],ospiti:3}
  const notti=nottiDaSegmenti([originale]).map((n,i)=>i===0?{...n,persone:1}:n)
  const piano=pianoNotti(notti,[originale],contesto)
  assert.equal(piano.errore,null)
  assert.equal(piano.tratti.reduce((t,r)=>t+r.pienoCent,0),20000)
  const cambio=notti.map((n,i)=>i===1?{...n,cameraId:camere[2].id,camera:camere[2].name}:n)
  const spostato=pianoNotti(cambio,[originale],contesto)
  assert.equal(spostato.errore,null)
  assert.equal(spostato.tratti.reduce((t,r)=>t+r.pienoCent,0),19000)
  assert.equal(spostato.tratti.reduce((t,r)=>t+r.notti,0),2)
})

test('Lena mista storica: base massima vecchia non diventa un sovrapprezzo; tariffa manuale resta concordata', () => {
  const camera=camere[3]
  const contesto={camere,altre:[],ospiti:3}
  for(const [salvata,totalePrima,attesa,totaleDopo] of [[80,170,90,180],[90,180,90,180],[75,160,85,170]]) {
    const originale:SegmentoNotti={id:'storica',room_id:camera.id,rooms:camera,status:'confermata',check_in:date[0],check_out:date[2],num_guests:3,extra_bed:true,extra_bed_dates:[date[1]],price_per_night:salvata,extra_bed_total:10,total_amount:totalePrima}
    const prima=nottiDaSegmenti([originale])
    const dopo=cambiaOspitiConLettoAuto(prima,date[0],3,contesto,false).notti
    const piano=pianoNotti(dopo,[originale],contesto)
    assert.equal(piano.errore,null)
    assert.equal(piano.tratti[0].aNotte,attesa)
    assert.equal(piano.tratti.reduce((t,r)=>t+r.pienoCent,0),totaleDopo*100)
  }
})
