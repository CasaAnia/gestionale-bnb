import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from '../../node_modules/typescript/lib/typescript.js';
import {rigaDaSalvare,lettoProposto} from '../../lib/prenotazioneComposta.ts';
import {contoSoggiorno,residuoDaPagare} from '../../lib/conto.ts';
import {scriviPoiAggiorna} from '../../lib/scritturaSicura.ts';

const source=fs.readFileSync(new URL('../../app/prenotazioni/[id]/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const functions={};
function visit(n){
  if(ts.isFunctionDeclaration(n)&&['apriLetto','salvaLetto'].includes(n.name?.text))functions[n.name.text]=ts.transpileModule(n.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  ts.forEachChild(n,visit);
}
visit(ast);
function pagina(overrides={}, {senzaAccordo=false,errore=null}={}) {
const nights=['2026-10-01','2026-10-02','2026-10-03','2026-10-04'];
const camera={id:'ambra',name:'Ambra',base_price:80,has_extra_bed:true,extra_bed_price:10};
let persisted={id:'prova',group_id:'gruppo',room_id:'ambra',check_in:'2026-10-01',check_out:'2026-10-05',num_guests:2,price_per_night:80,total_amount:340,extra_bed:true,extra_bed_dates:nights,extra_bed_total:20,extra_bed_importo:20,extra_bed_criterio:'totale',rooms:camera};
persisted={...persisted,...overrides};
let current=structuredClone(persisted);
const altroPeriodo={id:'altro-periodo',total_amount:160,extra_bed_total:0};
let gruppo=[structuredClone(persisted),structuredClone(altroPeriodo)];
const writes=[];
let ui={};
async function invoke(name){
  const scope={booking:current,id:current.id,getDaysBetween:()=>nights,lettoProposto,
    setLettoNotti:v=>ui.notti=v,setLettoImporto:v=>ui.importo=v,setLettoCriterio:v=>ui.criterio=v,
    setLettoAccordoVecchio:v=>ui.vecchio=v,setErroreLetto:v=>ui.errore=v,setLettoAperto:v=>ui.aperto=v,
    checkDisponibilita:()=>Promise.resolve(),setSalvandoLetto:v=>ui.salvando=v,
    salvandoLetto:false,LENA_ID:'lena',extraBedsPerDay:{},lettoNotti:ui.notti,lettoImporto:ui.importo,lettoCriterio:ui.criterio,
    rigaDaSalvare,contoSoggiorno,scriviPoiAggiorna,
    supabase:{from:()=>({update:campi=>({eq:async()=>{
      writes.push(structuredClone(campi));
      if(errore)return {error:errore};
      if(senzaAccordo&&Object.hasOwn(campi,'extra_bed_importo'))return {error:{code:'PGRST204',message:"Could not find the 'extra_bed_importo' column of 'bookings' in the schema cache"}};
      persisted={...persisted,...structuredClone(campi)};return {error:null};
    }})})},
    setBooking:v=>{current=v;},setTentativoCronologia:()=>{},
    setGroupBookings:v=>{gruppo=typeof v==='function'?v(gruppo):v;},
  };
  return await new Function(...Object.keys(scope),`${functions[name]};return ${name}();`)(...Object.values(scope));
}
return {ui,writes,invoke,altroPeriodo,get saved(){return persisted;},get current(){return current;},get gruppo(){return gruppo;},riapriPagina(){current=structuredClone(persisted);}};
}

test('letto 20 → 30: totale, residuo e accordo dopo due salvataggi e riapertura',async()=>{
  const p=pagina();
  await p.invoke('apriLetto');
  assert.equal(p.ui.importo,20);assert.equal(p.ui.criterio,'totale');
  p.ui.importo=30;
  await p.invoke('salvaLetto');
  assert.equal(p.saved.total_amount,350);
  assert.equal(p.current.total_amount,350);
  assert.equal(p.saved.extra_bed_importo,30);
  assert.equal(residuoDaPagare(p.current.total_amount,[{amount:100}]),250);
  assert.equal(p.gruppo.reduce((tot,r)=>tot+r.total_amount,0),510);
  assert.deepEqual(p.gruppo[1],p.altroPeriodo);
  await p.invoke('apriLetto');
  assert.equal(p.ui.importo,30);
  await p.invoke('salvaLetto');
  p.riapriPagina();await p.invoke('apriLetto');
  assert.equal(p.ui.importo,30);assert.equal(p.ui.criterio,'totale');
  assert.equal(p.saved.total_amount,350);
});

test('caso UI: camera 160 + letto 10 → 25 porta il totale a 185',async()=>{
  const p=pagina({check_out:'2026-10-03',extra_bed_dates:['2026-10-01','2026-10-02'],extra_bed_importo:10,extra_bed_total:10,total_amount:170});
  await p.invoke('apriLetto');p.ui.importo=25;await p.invoke('salvaLetto');
  assert.equal(p.saved.total_amount,185);
});

for(const [criterio,importo,costo,totale] of [['notte',10,40,360],['ogni4',25,25,345],['totale',0,0,320]]){
  test(`ricalcolo con criterio ${criterio} e importo ${importo}`,async()=>{
    const p=pagina();await p.invoke('apriLetto');p.ui.importo=importo;p.ui.criterio=criterio;
    await p.invoke('salvaLetto');
    assert.equal(p.saved.extra_bed_total,costo);assert.equal(p.saved.total_amount,totale);
    assert.equal(p.saved.extra_bed_criterio,criterio);
  });
}

test('togliere il letto sottrae il supplemento senza toccare gli altri periodi',async()=>{
  const p=pagina();await p.invoke('apriLetto');p.ui.notti=[];await p.invoke('salvaLetto');
  assert.equal(p.saved.total_amount,320);assert.equal(p.saved.extra_bed_importo,null);
  assert.equal(p.saved.extra_bed_criterio,null);assert.deepEqual(p.gruppo[1],p.altroPeriodo);
});

test('lo sconto percentuale si applica anche al nuovo importo del letto',async()=>{
  const p=pagina({discount_type:'percentage',discount_value:10,total_amount:306});
  await p.invoke('apriLetto');p.ui.importo=30;await p.invoke('salvaLetto');
  assert.equal(p.saved.total_amount,315);assert.equal(p.saved.discount_value,10);
});

test('il totale concordato con sconto resta il totale concordato',async()=>{
  const p=pagina({discount_type:'target_total',discount_value:300,total_amount:300});
  await p.invoke('apriLetto');p.ui.importo=30;await p.invoke('salvaLetto');
  assert.equal(p.saved.total_amount,300);assert.equal(p.saved.extra_bed_total,30);
});

test('salvataggio senza variazione economica conserva il totale storico personalizzato',async()=>{
  const p=pagina({total_amount:310,extra_bed_importo:null,extra_bed_criterio:null});
  await p.invoke('apriLetto');p.ui.importo=20;p.ui.criterio='totale';await p.invoke('salvaLetto');
  assert.equal(p.saved.total_amount,310);assert.equal(p.saved.extra_bed_importo,20);
});

test('colonne accordo assenti: totale corretto, coppia omessa, editor e avviso restano',async()=>{
  const p=pagina({}, {senzaAccordo:true});await p.invoke('apriLetto');p.ui.importo=30;
  await p.invoke('salvaLetto');
  assert.equal(p.writes.length,2);
  assert.ok(!Object.hasOwn(p.writes[1],'extra_bed_importo'));
  assert.ok(!Object.hasOwn(p.writes[1],'extra_bed_criterio'));
  assert.equal(p.saved.total_amount,350);assert.equal(p.ui.importo,30);
  assert.equal(p.ui.aperto,true);assert.match(p.ui.errore,/criterio non è stato registrato/);
});

test('cambiare solo il letto conserva la differenza del prezzo storico concordato',async()=>{
  const p=pagina({check_out:'2026-10-03',extra_bed_dates:['2026-10-01','2026-10-02'],total_amount:160});
  await p.invoke('apriLetto');p.ui.importo=30;p.ui.criterio='notte';await p.invoke('salvaLetto');
  // Camera 160 + letto 20, concordati 160: restano i 20 di riduzione storica.
  assert.equal(p.saved.extra_bed_total,60);assert.equal(p.saved.total_amount,200);
  p.riapriPagina();await p.invoke('apriLetto');await p.invoke('salvaLetto');
  assert.equal(p.saved.total_amount,200);
  p.ui.notti=[];await p.invoke('salvaLetto');
  assert.equal(p.saved.total_amount,140);
});

test('un totale concordato inferiore al letto non può diventare negativo in silenzio',async()=>{
  const p=pagina({total_amount:10});await p.invoke('apriLetto');p.ui.notti=[];
  await p.invoke('salvaLetto');
  assert.equal(p.writes.length,0);assert.equal(p.current.total_amount,10);
  assert.equal(p.ui.aperto,true);assert.equal(p.ui.salvando,false);
  assert.match(p.ui.errore,/Rivedi il prezzo concordato/);
});

test('scrittura fallita: scheda e gruppo conservano i valori salvati',async()=>{
  const p=pagina({}, {errore:{message:'Servizio non disponibile'}});
  await p.invoke('apriLetto');p.ui.importo=30;await p.invoke('salvaLetto');
  assert.equal(p.saved.total_amount,340);assert.equal(p.current.total_amount,340);
  assert.equal(p.gruppo[0].total_amount,340);assert.equal(p.ui.aperto,true);
  assert.match(p.ui.errore,/Non salvato/);
});
