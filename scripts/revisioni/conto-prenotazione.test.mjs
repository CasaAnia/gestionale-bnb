// Percorso effettivo della pagina -> adattatori reali -> SQL 0049 in PGlite.
// SQL sequenziale e dati sintetici: non prova PostgREST né concorrenza reale.
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from '../../node_modules/typescript/lib/typescript.js';
import { PGlite } from '@electric-sql/pglite';
import * as account from '../../lib/prenotazioneUnica.ts';
import * as paid from '../../lib/statistiche/pagato.ts';
import { leggiMemoria,scriviMemoria } from '../../lib/memoriaBrowser.ts';
import { leggiConEsito,MESSAGGIO_RILETTURA } from '../../lib/prenotazioneScritture.ts';
import { scriviPoiAggiorna } from '../../lib/scritturaSicura.ts';
import { righeStorico } from '../../lib/storicoCliente.ts';
import { oraCompleta } from '../../lib/ora.ts';
const file=fs.readFileSync(new URL('../../app/prenotazioni/[id]/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('page.tsx',file,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const extracted={};
function visit(n){if(ts.isFunctionDeclaration(n)&&['aggiungiAcconto','segnaPagato','rileggiScheda','salvaAccordo','cancelBooking','conclusiDelCliente'].includes(n.name?.text))extracted[n.name.text]=ts.transpileModule(n.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;ts.forEachChild(n,visit)}visit(ast);
const toRest=r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v instanceof Date ? (['check_in','check_out','paid_on'].includes(k)?v.toISOString().slice(0,10):v.toISOString()) : typeof v==='bigint'?Number(v):v]));
const id=n=>`bbbbbbbb-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function pagina(){
 const db=new PGlite();
 const sqlTest=fs.readFileSync(new URL('../../lib/contoPrenotazioneSql.test.ts',import.meta.url),'utf8');
 const schema=sqlTest.match(/await db.exec\(`([\s\S]*?)`\)/)[1];
 await db.exec(schema);
 await db.exec('alter table bookings add column cancelled_at timestamptz; alter table bookings add column cancelled_reason text;');
 await db.exec(fs.readFileSync(new URL('../../supabase/proposte/0049_conto_prenotazione.BOZZA.sql',import.meta.url),'utf8'));
 await db.query(`insert into bookings(id,guest_id,group_id,prenotazione_id,check_in,check_out,total_amount,status) values
 ($1,$5,$6,$8,'2026-09-10','2026-09-12',160,'confermata'),
 ($2,$5,$6,$8,'2026-09-12','2026-09-14',180,'confermata'),
 ($3,$5,$7,$8,'2026-09-10','2026-09-16',300,'confermata'),
 ($4,$5,null,$4,'2026-09-10','2026-09-14',500,'confermata')`,[id(1),id(2),id(3),id(4),id(5),id(6),id(7),id(8)]);
 await db.query("insert into payments(booking_id,amount,method,paid_on) values($1,50,'bonifico','2026-09-09')",[id(3)]);
 const ui={};const memory=new Map();let opened=id(3), booking=null, rows=[],group=[],acconti=[];const calls=[];let chiaveSaldo=null;
 class Q {
  constructor(table){this.table=table;this.filters=[];this.args=[];this.kind='select'}
  eq(col,v){this.args.push(v);this.filters.push(`"${col}"=$${this.args.length}`);return this}
  neq(col,v){this.args.push(v);this.filters.push(`"${col}"<>$${this.args.length}`);return this}
  in(col,vs){this.args.push(vs);this.filters.push(`"${col}"=any($${this.args.length})`);return this}
  order(){return this} select(){return this} single(){this.one=true;return this}
  update(values){this.kind='update';this.values=values;return this}
  insert(values){this.kind='insert';this.values=values;return this}
  async then(ok){try {
   if(this.table==='booking_whatsapp_log')return ok({data:[],error:null});
   assert.ok(['bookings','payments'].includes(this.table));
   let q=`select * from ${this.table}`;
   if(this.kind==='update') {const entries=Object.entries(this.values);const start=this.args.length;this.args.push(...entries.map(x=>x[1]));q=`update ${this.table} set ${entries.map(([k],i)=>`"${k}"=$${start+i+1}`).join(',')}`}
   if(this.filters.length)q+=' where '+this.filters.join(' and ');
   if(this.kind==='update')q+=' returning *';
   const r=await db.query(q,this.args);
   return ok({data:this.one?toRest(r.rows[0]):r.rows.map(toRest),error:null});
  }catch(e){return ok({data:null,error:e})}}
 }
 const supabase={from:t=>new Q(t),rpc:async(name,p)=>{
  calls.push({name,p});
  if(ui.rpcAssente)return {data:null,error:{code:'PGRST202',message:`Could not find function ${name}`}};
  try {const names={segna_pagato_prenotazione:['p_booking_id','p_chiave','p_metodo','p_paid_on'],registra_acconto_prenotazione:['p_booking_id','p_chiave','p_amount','p_metodo','p_paid_on'],salva_accordo_prenotazione:['p_booking_id','p_modo','p_caparra_centesimi','p_entro']};assert.ok(names[name]);
   const args=names[name].map(k=>p[k]);const r=await db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args);if(ui.rispostaPersa){ui.rispostaPersa=false;return {data:null,error:new Error('risposta persa dopo SQL')}};return {data:r.rows[0].r,error:null}
  }catch(e){return {data:null,error:e}}}};
 async function riapri(n=3){opened=id(n);rows=(await db.query('select * from bookings where prenotazione_id=$1',[id(8)])).rows.map(toRest);booking=rows.find(r=>r.id===opened);group=account.periodiCamera(booking,rows);acconti=(await db.query('select * from payments')).rows.map(toRest)}
 await riapri();
 function invoke(name,...args){
  const set=k=>value=>{ui[k]=typeof value==='function'?value(ui[k]):value};
  const scope={...account,...paid,righeStorico,otherBookings:ui.storico||[],leggiMemoria,scriviMemoria,leggiConEsito,MESSAGGIO_RILETTURA,scriviPoiAggiorna,oraCompleta,supabase,id:opened,booking,righePrenotazione:rows,groupBookings:group,accordoComune:account.accordoPrenotazione(rows),prenotazioneOk:true,accontiOk:true,contoPronto:true,acconti,savingAcconto:ui.saving||false,accontoForm:ui.form||{amount:'75',method:'bonifico',paid_on:'2026-09-10'},oggiARoma:()=> '2026-09-10',segmentiSoggiorno:()=>rows,localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},setSavingAcconto:set('saving'),setAccontoForm:set('form'),setAccontoError:set('errorePagamento'),setAcconti:v=>{acconti=v},
   setBooking:v=>{booking=v},setReservationBookings:v=>{rows=typeof v==='function'?v(rows):v},setGroupBookings:v=>{group=typeof v==='function'?v(group):v},setErrorePrenotazione:set('erroreLettura'),setTentativoCronologia:()=>{},
   segnandoPagato:ui.segnando||false,metodoPagato:'bonifico',setSegnandoPagato:set('segnando'),setErrorePagato:set('erroreSaldo'),setFinestraPagato:set('finestraSaldo'),setAccontiOk:set('accontiOk'),chiavePagatoStabile:()=>chiaveSaldo||(chiaveSaldo=crypto.randomUUID()),dimenticaChiavePagato:()=>{chiaveSaldo=null},
   salvandoAccordo:ui.salvandoAccordo||false,accordoModo:ui.modo||'caparra_libera',accordoImporto:ui.importo??150,accordoData:'2026-09-12',accordoOra:'18:00',setErroreAccordo:set('erroreAccordo'),setSalvandoAccordo:set('salvandoAccordo'),setAccordoAperto:set('accordoAperto'),
   annullando:ui.annullando||false,cancelReason:ui.motivo||'',setAnnullando:set('annullando'),setErroreAnnulla:set('erroreAnnulla'),setAvvisoScheda:set('avviso'),setShowCancel:set('showCancel'),setCancelDone:set('cancelDone'),window:{scrollTo:()=>{}},buildWhatsappMsg:()=> 'Messaggio sintetico',
   rileggiScheda:()=>invoke('rileggiScheda')};
  return new Function(...Object.keys(scope),'args',`${extracted[name]};return ${name}(...args);`)(...Object.values(scope),args);
 }
 return {db,ui,calls,invoke,riapri,get rows(){return rows},get acconti(){return acconti},close:()=>db.close()};
}
test('UI handler nuovo incasso passa alla RPC reale della prenotazione; riapertura in altra camera',async()=>{
 const p=await pagina();try {
  await p.invoke('aggiungiAcconto');assert.equal(p.ui.errorePagamento,null);
  assert.equal(p.calls[0].name,'registra_acconto_prenotazione');assert.equal(p.calls[0].p.p_booking_id,id(3));
  await p.riapri(1);assert.equal(account.contoPrenotazione(p.rows,p.acconti).residuoCent,51500);assert.equal(p.acconti.length,2);
  await p.invoke('rileggiScheda');assert.equal(p.rows.length,3);
 }finally{await p.close()}
})
test('salva accordo da altra camera due volte, riapertura: una sola caparra150; importo negativo rifiutato',async()=>{
 const p=await pagina();try {
  await p.invoke('salvaAccordo',640);assert.equal(p.ui.erroreAccordo,null);
  await p.riapri(1);await p.invoke('salvaAccordo',640);await p.riapri(3);
  assert.equal(p.rows.filter(r=>r.caparra_centesimi!=null).length,1);assert.equal(account.accordoPrenotazione(p.rows).caparra_centesimi,15000);
  p.ui.importo=-1;const n=p.calls.length;await p.invoke('salvaAccordo',640);assert.ok(p.ui.erroreAccordo);assert.equal(p.calls.length,n);
 }finally{await p.close()}
})
test('annulla dalla UI richiede motivo, tocca tre camere, conserva altra prenotazione e movimenti',async()=>{
 const p=await pagina();try {
  await p.invoke('cancelBooking');assert.ok(p.ui.erroreAnnulla);assert.ok(p.rows.every(r=>r.status==='confermata'));
  p.ui.motivo='Viaggio rinviato';await p.invoke('cancelBooking');
  // La fixture SQL aggiunge le colonne effettivamente usate per l’annullamento.
  assert.equal(p.ui.erroreAnnulla,null);await p.riapri(3);assert.ok(p.rows.every(r=>r.status==='annullata'&&r.cancelled_reason==='Viaggio rinviato'));
  assert.equal((await p.db.query('select status from bookings where id=$1',[id(4)])).rows[0].status,'confermata');assert.equal(p.acconti.length,1);
 }finally{await p.close()}
})

test('saldo dalla pagina di altra camera: 640 meno125, seconda pressione zero nuovi movimenti',async()=>{
 const p=await pagina();try {
  await p.invoke('aggiungiAcconto');await p.riapri(1);
  await p.invoke('segnaPagato');assert.equal(p.ui.erroreSaldo,null);await p.riapri(2);
  assert.equal(p.acconti.length,3);assert.equal(account.contoPrenotazione(p.rows,p.acconti).residuoCent,0);
  assert.ok(p.rows.every(r=>r.pagato));
  await p.invoke('segnaPagato');await p.riapri(3);assert.equal(p.acconti.length,3);assert.equal(p.ui.erroreSaldo,null);
 }finally{await p.close()}
})

test('RPC parent mancante: errore visibile, nessun inserimento semplice e nessun incasso nuovo',async()=>{
 const p=await pagina();try {
  p.ui.rpcAssente=true;await p.invoke('aggiungiAcconto');assert.ok(p.ui.errorePagamento);await p.riapri();assert.equal(p.acconti.length,1);
  await p.invoke('segnaPagato');assert.ok(p.ui.erroreSaldo);await p.riapri();assert.equal(p.acconti.length,1);assert.ok(p.rows.every(r=>!r.pagato));
 }finally{await p.close()}
})
test('risposta persa dopo SQL incasso: riprovando stessa richiesta, un solo nuovo movimento',async()=>{
 const p=await pagina();try {
  p.ui.rispostaPersa=true;await p.invoke('aggiungiAcconto');assert.ok(p.ui.errorePagamento);
  await p.invoke('aggiungiAcconto');assert.equal(p.ui.errorePagamento,null);await p.riapri(1);
  assert.equal(p.acconti.length,2);assert.equal(account.contoPrenotazione(p.rows,p.acconti).ricevutiCent,12500);
 }finally{await p.close()}
})

test('scheda: una camera in attesa impedisce il conteggio del soggiorno passato',async()=>{
 const p=await pagina();try {
  p.ui.storico=[{id:'x',prenotazione_id:'p2',check_in:'2026-08-01',check_out:'2026-08-03',status:'confermata',total_amount:100},{id:'y',prenotazione_id:'p2',check_in:'2026-08-01',check_out:'2026-08-04',status:'in_attesa',total_amount:100}];
  assert.equal(p.invoke('conclusiDelCliente').length,0);
  p.ui.storico[1].status='confermata';assert.equal(p.invoke('conclusiDelCliente').length,1);
 }finally{await p.close()}
})
test('il saldo riletto dal server riallinea anche un costo cambiato mentre la pagina era aperta',async()=>{
 const p=await pagina();try {
  await p.db.query('update bookings set total_amount=320 where id=$1',[id(3)]);
  await p.invoke('segnaPagato');assert.equal(p.ui.erroreSaldo,null);
  assert.equal(account.contoPrenotazione(p.rows,p.acconti).totaleCent,66000);
  assert.equal(account.contoPrenotazione(p.rows,p.acconti).residuoCent,0);
 }finally{await p.close()}
})
