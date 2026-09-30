import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from '../../node_modules/typescript/lib/typescript.js';
import {rigaDaSalvare,lettoProposto} from '../../lib/prenotazioneComposta.ts';
import {contoSoggiorno,residuoDaPagare} from '../../lib/conto.ts';
import {salvaInSequenza} from '../../lib/prenotazioneScritture.ts';
import {capienzaCamera,capienzaBase} from '../../lib/tariffe.ts';

// Dal 10/09/2026 (296c3b3, «Il soggiorno si cambia tutto insieme») il letto
// non ha più un salvataggio suo (salvaLetto): si apre con «Il soggiorno»
// (apriSoggiorno → apriLetto) e si salva con salvaSoggiorno, insieme a date,
// ospiti e tariffa. Ricostruito il 30/09/2026 (R5 dell'audit Codex): le prove
// eseguono le funzioni VERE della pagina su quel percorso, con un Supabase
// finto; ogni chiamata legge lo stato come React lo darebbe al rendering.
const source=fs.readFileSync(new URL('../../app/prenotazioni/[id]/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const NOMI=['getDaysBetween','apriLetto','apriSoggiorno','chiudiSoggiorno','pianoSoggiorno','verificaDate','salvaSoggiorno'];
const pezzi={};
const js=n=>ts.transpileModule(n.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
function visit(n){
  if(ts.isFunctionDeclaration(n)&&NOMI.includes(n.name?.text))pezzi[n.name.text]=js(n);
  if(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)==='unaCameraSola'))pezzi.unaCameraSola=js(n);
  ts.forEachChild(n,visit);
}
visit(ast);
for(const nome of [...NOMI,'unaCameraSola'])assert.ok(pezzi[nome],`funzione ${nome} trovata nella pagina`);
const corpo=Object.values(pezzi).join('\n');
function pagina(overrides={}, {senzaAccordo=false,errore=null}={}) {
const camera={id:'ambra',name:'Ambra',base_price:80,has_extra_bed:true,extra_bed_price:10,max_guests:3};
const nights=['2026-10-01','2026-10-02','2026-10-03','2026-10-04'];
let persisted={id:'prova',group_id:'gruppo',room_id:'ambra',status:'confermata',check_in:'2026-10-01',check_out:'2026-10-05',num_guests:2,price_per_night:80,total_amount:340,extra_bed:true,extra_bed_dates:nights,extra_bed_total:20,extra_bed_importo:20,extra_bed_criterio:'totale',rooms:camera};
persisted={...persisted,...overrides};
let current=structuredClone(persisted);
const writes=[];
const ui={aperto:false,salvando:false};
async function invoke(name){
  const set=k=>v=>{ui[k]=typeof v==='function'?v(ui[k]):v};
  const scope={booking:current,id:current.id,groupBookings:[current],righePrenotazione:[current],
    haCamereParallele:()=>false,computeStayPlan:()=>{throw new Error('una camera sola: non si passa dal piano del cambio camera')},
    lettoProposto,rigaDaSalvare,contoSoggiorno,capienzaCamera,capienzaBase,salvaInSequenza,LENA_ID:'lena',formatDateShort:d=>d,
    checkDisponibilita:()=>Promise.resolve(),
    lettoNotti:ui.notti,lettoImporto:ui.importo,lettoCriterio:ui.criterio,ospitiForm:ui.ospiti,tariffaForm:ui.tariffa,
    dateForm:ui.date,stayForm:ui.date,salvandoSoggiorno:!!ui.salvando,conflittoSoggiorno:ui.conflitto??null,
    setLettoNotti:set('notti'),setLettoAuto:set('auto'),setLettoImporto:set('importo'),setLettoCriterio:set('criterio'),
    setLettoAccordoVecchio:set('vecchio'),setDateForm:set('date'),setStayForm:()=>{},setStayConflict:()=>{},
    setOspitiForm:set('ospiti'),setTariffaForm:set('tariffa'),setTariffaToccata:()=>{},
    setErroreSalvaSoggiorno:set('errore'),setConflittoSoggiorno:set('conflitto'),setSoggiornoAperto:set('aperto'),
    setSalvandoSoggiorno:set('salvando'),setAvvisoScheda:set('avviso'),
    setBooking:v=>{current=v},setGroupBookings:()=>{},router:{replace:()=>assert.fail('la camera aperta non sparisce')},
    // la rilettura vera è provata in conto-prenotazione.test.mjs: qui si rilegge la riga salvata
    rileggiScheda:async()=>{current=structuredClone(persisted);return null},
    supabase:{from:()=>{
      const lettura={select:()=>lettura,eq:()=>lettura,neq:()=>lettura,lt:()=>lettura,gt:()=>lettura,then:(ok,ko)=>Promise.resolve({data:[],error:null}).then(ok,ko)};
      return {select:()=>lettura,update:campi=>({eq:async()=>{
        writes.push(structuredClone(campi));
        if(errore)return {error:errore};
        if(senzaAccordo&&Object.hasOwn(campi,'extra_bed_importo'))return {error:{code:'PGRST204',message:"Could not find the 'extra_bed_importo' column of 'bookings' in the schema cache"}};
        persisted={...persisted,...structuredClone(campi)};return {error:null};
      }})};
    }},
  };
  return await new Function(...Object.keys(scope),`${corpo};return ${name}();`)(...Object.values(scope));
}
// i vecchi nomi delle prove: aprire il letto = aprire «Il soggiorno», salvarlo = salvaSoggiorno
const api={apriLetto:'apriSoggiorno',salvaLetto:'salvaSoggiorno'};
return {ui,writes,invoke:n=>invoke(api[n]??n),get saved(){return persisted;},get current(){return current;},riapriPagina(){current=structuredClone(persisted);}};
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
  // una camera sola: si scrive solo la sua riga (il cambio camera ha il suo piano, computeStayPlan)
  assert.ok(p.writes.every(w=>!Object.hasOwn(w,'status')));
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

test('togliere il letto sottrae il supplemento e cancella l\'accordo',async()=>{
  const p=pagina();await p.invoke('apriLetto');p.ui.notti=[];await p.invoke('salvaLetto');
  assert.equal(p.saved.total_amount,320);assert.equal(p.saved.extra_bed_importo,null);
  assert.equal(p.saved.extra_bed_criterio,null);assert.equal(p.saved.extra_bed,false);
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

// ── Il totale concordato a mano (30/09/2026) ─────────────────────────────
// Le regole di salvaLetto (fino al 10/09/2026), riprese in salvaSoggiorno dopo
// l'audit Codex R5: un totale scritto a mano, diverso da tariffa × notti +
// letto e senza uno sconto registrato, non si riscrive col listino.
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
  assert.equal(p.ui.aperto,true);assert.match(p.ui.errore,/tranne come avete concordato il prezzo del letto/);assert.equal(p.ui.vecchio,true);
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

test('scrittura fallita: la scheda conserva i valori salvati e il modulo resta aperto',async()=>{
  const p=pagina({}, {errore:{message:'Servizio non disponibile'}});
  await p.invoke('apriLetto');p.ui.importo=30;await p.invoke('salvaLetto');
  assert.equal(p.saved.total_amount,340);assert.equal(p.current.total_amount,340);
  assert.equal(p.ui.aperto,true);assert.equal(p.ui.salvando,false);
  assert.match(p.ui.errore,/Non salvato/);
});

test('totale concordato a mano e date cambiate: niente scritto, avviso, e tornando alle date si salva',async()=>{
  const p=pagina({total_amount:310});await p.invoke('apriLetto');
  p.ui.date={check_in:'2026-10-01',check_out:'2026-10-06'};
  await p.invoke('salvaLetto');
  assert.equal(p.writes.length,0);assert.equal(p.saved.total_amount,310);
  assert.equal(p.ui.aperto,true);assert.equal(p.ui.salvando,false);
  assert.match(p.ui.errore,/concordato a mano \(€310 invece di €340 dal listino\)/);
  p.ui.date={check_in:'2026-10-01',check_out:'2026-10-05'};p.ui.importo=30;
  await p.invoke('salvaLetto');
  assert.equal(p.saved.total_amount,320,'310 − 20 + 30: la riduzione di 30 resta');
});

test('totale concordato a mano e tariffa cambiata: ci si ferma lo stesso',async()=>{
  const p=pagina({total_amount:310});await p.invoke('apriLetto');p.ui.tariffa='90';
  await p.invoke('salvaLetto');
  assert.equal(p.writes.length,0);assert.match(p.ui.errore,/concordato a mano/);
});

test('totale concordato a mano e una persona in più: resta la riduzione',async()=>{
  const p=pagina({total_amount:310});await p.invoke('apriLetto');p.ui.ospiti='3';
  await p.invoke('salvaLetto');
  assert.equal(p.saved.total_amount,310);assert.equal(p.saved.num_guests,3);
});

test('prenotazione col listino (nessun totale a mano): cambiando le date il conto segue il listino',async()=>{
  const p=pagina();await p.invoke('apriLetto');
  p.ui.date={check_in:'2026-10-01',check_out:'2026-10-06'};
  await p.invoke('salvaLetto');
  assert.equal(p.ui.errore??null,null);
  assert.equal(p.saved.total_amount,p.saved.price_per_night*5+p.saved.extra_bed_total);
});

test('sconto «porta il totale a» registrato: resta lo sconto, non scatta il blocco del totale a mano',async()=>{
  const p=pagina({discount_type:'target_total',discount_value:300,total_amount:300});await p.invoke('apriLetto');
  p.ui.date={check_in:'2026-10-01',check_out:'2026-10-06'};
  await p.invoke('salvaLetto');
  assert.equal(p.ui.errore??null,null);assert.equal(p.saved.total_amount,300);assert.equal(p.saved.discount_value,300);
});
