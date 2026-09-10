// Revisione: esegue il corpo reale di salva(), con dipendenze e custodia finte.
// Non è una prova della UI né del database remoto. Nessun sorgente applicativo modificato.
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from '../../node_modules/typescript/lib/typescript.js';
import {problemi,rigaDaSalvare} from '../../lib/prenotazioneComposta.ts';
import {conInizialiONull} from '../../lib/maiuscole.ts';
import {payloadValutazione,valutazioneDi,colonnaRicevutaPresente} from '../../lib/valutazione.ts';
import {nomeSuPrenotazione} from '../../lib/clienteTelefono.ts';

import {colonnaMancante} from '../../lib/colonnaMancante.ts';
const path=new URL('../../app/nuova/page.tsx',import.meta.url);
const source=fs.readFileSync(path,'utf8');
const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let savedFunction;
function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='salva')savedFunction=n;ts.forEachChild(n,visit);}
visit(ast);
assert.ok(savedFunction);
const code=ts.transpileModule(savedFunction.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const cameras=[{id:'ambra',name:'Ambra',base_price:80,has_extra_bed:true,extra_bed_price:10},{id:'allegra',name:'Allegra',base_price:80,has_extra_bed:true,extra_bed_price:10}];
const first={id:'p1',gruppo:'g1',roomId:'ambra',checkIn:'2026-10-01',checkOut:'2026-10-05',ospiti:2,nottiLetto:[],letto:null,tariffa:80};

async function run(overrides={},options={}){
  const out={errors:[],attempts:[],stored:[],guestWrites:[],warnings:[],routes:[]};
  const scope={
    problemi,rigaDaSalvare,conInizialiONull,payloadValutazione,valutazioneDi,colonnaMancante,problematicoOk:null,setProblematico:()=>{},setNuovo:()=>{},calcolaNomeSuPrenotazione:nomeSuPrenotazione,
    periodi:[first],trovaCamera:id=>cameras.find(c=>c.id===id),lettiAltrui:new Map(),scelto:true,
    nuovo:null,cliente:{id:'cliente-prova',full_name:'Cliente Prova',rating:'normale'},
    strutture:{disponibile:false,lista:[]},provenienza:{provenienza:null,struttura:''},
    accordo:{modo:'contanti',importo:null,data:'',ora:''},orario:'',oraCompleta:t=>/^\d{2}:\d{2}$/.test(t),
    totale:320,pieno:320,conflitti:[],nomeSuQuesta:null,gruppoDaUrl:'',prenotazioneDaUrl:'',sconto:null,contatti:[],
    salvando:false,salvata:null,note:'',navetta:'',chi:'prenota',caparra:null,euro:n=>`${n} €`,
    setErrori:v=>out.errors=v,setSalvando:()=>{},setAvvisoSalvataggio:v=>out.warnings.push(v),
    setCliente:v=>{out.customer=v;},setAvvisoProvenienza:()=>{},setSalvata:v=>{out.saved=v;},
    messaggioErroreDati:e=>e.message,router:{push:v=>out.routes.push(v)},
    cercaSchedaPerTelefono:async()=>({scheda:options.existingGuest||null}),
    ...overrides,
  };
  scope.supabase={from(table){return {insert(payload){
    const rows=Array.isArray(payload)?payload:[payload];
    if(table==='guests'){
      out.guestWrites.push(payload);
      const result=Object.hasOwn(payload,'note')?{data:null,error:{code:'PGRST204',message:"Could not find the 'note' column of 'guests' in the schema cache"}}:{data:{...payload,id:'nuovo-cliente'},error:null};
      return {select:()=>({single:async()=>result})};
    }
    out.attempts.push(structuredClone(rows));
    const missingColumn=(options.missingColumns||[]).find(c=>rows.some(r=>Object.hasOwn(r,c)));
    const schemaError=missingColumn?{code:options.missingCode||'PGRST204',message:options.missingCode==='42703'?`column "${missingColumn}" of relation "bookings" does not exist`:`Could not find the '${missingColumn}' column of 'bookings' in the schema cache`}:null;
    const negative=rows.some(r=>r.caparra_centesimi<0);
    const missing=options.missingAgreement&&rows.some(r=>Object.hasOwn(r,'accordo_pagamento'));
    const error=schemaError|| (negative?{code:'23514',message:'new row for relation "bookings" violates check constraint "bookings_caparra_centesimi_check"'}:missing?{code:'PGRST204',message:"Could not find the 'accordo_pagamento' column in the schema cache"}:null);
    const saved=error?null:rows.map((r,i)=>({...r,id:`prenotazione-${out.stored.length+i}`}));
    if(saved)out.stored.push(...saved);
    return {select:async()=>({data:saved,error})};
  }}}};
  await new Function(...Object.keys(scope),`${code}; return salva();`)(...Object.values(scope));
  return out;
}






test('colonne assenti PostgREST: salva il resto, dichiara la perdita e resta sulla pagina', async()=>{
  const result=await run({}, {missingColumns:['prenotazione_id','extra_bed_importo','extra_bed_criterio']});
  assert.equal(result.stored.length,1);
  assert.equal(result.attempts.length,3);
  assert.equal(result.routes.length,0);
  assert.ok(result.saved);
  assert.match(result.warnings.filter(Boolean).join(' '),/prenotazione_id/);
  assert.match(result.warnings.filter(Boolean).join(' '),/extra_bed_criterio/);
  assert.equal(result.stored[0].accordo_pagamento,'contanti');
});

test('non elimina una colonna obbligatoria per far riuscire il salvataggio', async()=>{
  const result=await run({}, {missingColumns:['room_id']});
  assert.equal(result.stored.length,0);
  assert.equal(result.attempts.length,1);
  assert.ok(result.errors.length);
});

function extract(source, name){
  const tree=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let node;
  function scan(n){if(ts.isFunctionDeclaration(n)&&n.name?.text===name)node=n;ts.forEachChild(n,scan);}
  scan(tree); assert.ok(node, name);
  return ts.transpileModule(node.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
}
function invoke(code,name,scope){return new Function(...Object.keys(scope),`${code};return ${name}();`)(...Object.values(scope));}

const codiceCliente=extract(source,'salvaDatiCliente');
test('nota e motivo del cliente esistente restano separati dopo due salvataggi e riaperture', async()=>{
  let cliente={id:'cliente-prova',full_name:'Cliente Prova',phone:'393330000000',rating:'problematico',vuole_ricevuta:false,notes:'Preferisce il cortile',motivo_problematico:'Motivo precedente'};
  let persisted=structuredClone(cliente);
  const save=async(motivo)=>{
    const scope={cliente,modifica:{nome:cliente.full_name,telefono:cliente.phone,valutazione:'problematico',ricevuta:false,nota:cliente.notes,motivo},conInizialiONull,payloadValutazione,colonnaRicevutaPresente,colonnaMancante,
      supabase:{from:()=>({update:fields=>({eq:async()=>{persisted={...persisted,...fields};return {error:null};}})})},
      setCliente:value=>{cliente=value;},setModifica:()=>{},setErroreModifica:value=>{if(value)assert.fail(value);}};
    await invoke(codiceCliente,'salvaDatiCliente',scope);
    assert.equal(persisted.notes,'Preferisce il cortile');
    assert.equal(persisted.motivo_problematico,motivo);
    cliente=structuredClone(persisted);
  };
  await save('Ha fumato in camera');
  await save('Ha fumato e lasciato la camera sporca');
});

test('motivo non registrabile: non cancella la nota e lascia aperta la modifica', async()=>{
  const cliente={id:'cliente-prova',full_name:'Cliente Prova',phone:'393330000000',rating:'problematico',notes:'Preferisce il cortile'};
  const sent=[],errors=[];let closed=false,updated=false;
  await invoke(codiceCliente,'salvaDatiCliente',{cliente,modifica:{nome:cliente.full_name,telefono:cliente.phone,valutazione:'problematico',ricevuta:false,nota:cliente.notes,motivo:'Ha fumato'},conInizialiONull,payloadValutazione,colonnaRicevutaPresente,colonnaMancante,
    supabase:{from:()=>({update:fields=>({eq:async()=>{sent.push(fields);return {error:{code:'PGRST204',message:"Could not find the 'motivo_problematico' column of 'guests' in the schema cache"}};}})})},
    setCliente:()=>{updated=true;},setModifica:()=>{closed=true;},setErroreModifica:v=>{if(v)errors.push(v);}});
  assert.equal(sent.length,1);assert.equal(sent[0].notes,cliente.notes);assert.equal(sent[0].motivo_problematico,'Ha fumato');
  assert.equal(closed,false);assert.equal(updated,false);assert.match(errors.join(' '),/Nessuna modifica/);
});
