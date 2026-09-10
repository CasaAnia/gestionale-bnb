import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
const id=(n:number)=>`bbbbbbbb-0000-4000-8000-${String(n).padStart(12,'0')}`
let db:PGlite
before(async()=>{
 db=new PGlite()
 await db.exec(`create schema private;
 create function private.is_app_member() returns boolean language sql as $$ select coalesce(current_setting('test.membro',true),'si')='si' $$;
 create role authenticated; create role anon; create role service_role;
 alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
 create table bookings(id uuid primary key,guest_id uuid,group_id uuid,prenotazione_id uuid,check_in date,check_out date,total_amount numeric,status text,pagato boolean default false,bonifico boolean,accordo_pagamento text,caparra_centesimi bigint,caparra_entro timestamptz);
 create table payments(id uuid primary key default gen_random_uuid(),booking_id uuid references bookings(id),amount numeric,method text,paid_on date,created_at timestamptz default now());`)
 await db.exec(readFileSync(new URL('../supabase/proposte/0049_conto_prenotazione.BOZZA.sql',import.meta.url),'utf8'))
})
after(async()=>db?.close())
beforeEach(async()=>{
 await db.exec("set test.membro='si';delete from payments;delete from bookings;")
 await db.query(`insert into bookings(id,guest_id,group_id,prenotazione_id,check_in,check_out,total_amount,status) values
 ($1,$6,$7,$8,'2026-08-10','2026-08-12',160,'confermata'),
 ($2,$6,$7,$8,'2026-08-12','2026-08-14',180,'confermata'),
 ($3,$6,$9,$8,'2026-08-10','2026-08-16',300,'confermata'),
 ($4,$6,null,$4,'2026-08-10','2026-08-14',500,'confermata'),
 ($5,$6,null,$8,'2026-08-10','2026-08-12',80,'annullata')`,[id(1),id(2),id(3),id(4),id(5),id(6),id(7),id(8),id(9)])
})
const scalar=async(q:string,args:unknown[]=[]) =>(await db.query<{r:Record<string,unknown>}>(q,args)).rows[0].r
const saldo=(b:number,k:number)=>scalar("select segna_pagato_prenotazione($1,$2,'bonifico','2026-09-10') r",[id(b),id(k)])
const acconto=(b:number,k:number,n=50)=>scalar("select registra_acconto_prenotazione($1,$2,$3,'bonifico','2026-09-10') r",[id(b),id(k),n])
test('nuovo incasso su camera parallela, poi saldo da un cambio: 640 meno 50, una volta sola',async()=>{
 const p=await acconto(3,20);assert.equal(Number(p.importo),50)
 const s=await saldo(2,21);assert.equal(Number(s.importo),590);assert.equal(s.segmenti_aggiornati,3);assert.equal(s.contratto,'prenotazione_v1')
 const retry=await saldo(1,21);assert.equal(retry.movimento_id,s.movimento_id)
 const z=await saldo(3,22);assert.equal(z.movimento_id,null);assert.equal(Number(z.importo),0)
 const rows=(await db.query<{n:number,sum:string}>('select count(*)::int n,sum(amount) from payments')).rows[0];assert.equal(rows.n,2);assert.equal(Number(rows.sum),640)
 const other=(await db.query<{pagato:boolean}>('select pagato from bookings where id=$1',[id(4)])).rows[0];assert.equal(other.pagato,false)
})
test('caparra del 50% unica, si cambia dalla terza camera e si riapre senza raddoppi',async()=>{
 for(let n=0;n<2;n++) await scalar("select salva_accordo_prenotazione($1,'caparra_meta',1,'2026-09-12T16:00Z') r",[id(3)])
 const rows=(await db.query<{caparra_centesimi:string|null;accordo_pagamento:string}>('select caparra_centesimi,accordo_pagamento from bookings where prenotazione_id=$1',[id(8)])).rows
 assert.equal(rows.filter(r=>r.caparra_centesimi!=null).length,1)
 assert.equal(rows.reduce((s,r)=>s+Number(r.caparra_centesimi||0),0),32000)
 assert.ok(rows.every(r=>r.accordo_pagamento==='caparra_meta'))
 await scalar("select salva_accordo_prenotazione($1,'contanti',null,null) r",[id(2)])
 assert.equal((await db.query('select id from bookings where caparra_centesimi is not null')).rows.length,0)
})
test('credito della camera annullata compreso nel saldo, prezzo annullato escluso',async()=>{
 await db.query("insert into payments(booking_id,amount,method,paid_on) values($1,40,'contanti','2026-09-10')",[id(5)])
 assert.equal(Number((await saldo(1,30)).importo),600)
})
test('chiave acconto ritentata da altra camera della stessa prenotazione conserva id e camera del movimento',async()=>{
 const a=await acconto(1,31);const b=await acconto(3,31)
 assert.equal(a.movimento_id,b.movimento_id);assert.equal(b.booking_id,id(1))
 await assert.rejects(acconto(4,31),/CHIAVE_RIUSATA/)
 await assert.rejects(acconto(3,31,70),/CHIAVE_RIUSATA/)
})
test('nessun accesso a non membri; caparra e importi non validi rifiutati',async()=>{
 await assert.rejects(acconto(1,40,-10),/IMPORTO_NON_VALIDO/)
 await assert.rejects(scalar("select salva_accordo_prenotazione($1,'caparra_libera',-1,null) r",[id(1)]),/CAPARRA_NON_VALIDA/)
 await db.exec("set test.membro='no'")
 await assert.rejects(saldo(1,41),/Accesso non consentito/)
 await assert.rejects(acconto(1,42),/Accesso non consentito/)
 const grants=await db.query<{ok:boolean}>("select has_function_privilege('anon','segna_pagato_prenotazione(uuid,uuid,text,date)','execute') ok")
 assert.equal(grants.rows[0].ok,false)
})

test('ricostruzione usa il conto completo solo con identità parent esplicita',async()=>{
 await assert.rejects(scalar('select ricostruisci_incassi($1::jsonb) r',[JSON.stringify([{soggiorno:id(7),chiave:id(50)}])]),/PIANO_DA_AGGIORNARE/)
 const piano=[{soggiorno:id(8),chiave:id(51)},{soggiorno:id(8),chiave:id(52)}]
 const r=await scalar('select ricostruisci_incassi($1::jsonb) r',[JSON.stringify(piano)])
 assert.equal(r.scritti,1);assert.equal(r.nulla,1)
 assert.equal(Number((await db.query<{somma:string}>('select sum(amount) somma from payments')).rows[0].somma),640)
})
test('ricostruzione rifiuta l’intera prenotazione se una camera non è ancora confermata',async()=>{
 await db.query("update bookings set status='in_attesa' where id=$1",[id(3)])
 await assert.rejects(scalar('select ricostruisci_incassi($1::jsonb) r',[JSON.stringify([{soggiorno:id(8),chiave:id(53)}])]),/SOGGIORNO_NON_CONCLUSO/)
 assert.equal((await db.query('select id from payments')).rows.length,0)
})

test('una camera ancora in attesa impedisce di dichiarare saldato solo un pezzo della prenotazione',async()=>{
 await db.query("update bookings set status='in_attesa' where id=$1",[id(3)])
 await assert.rejects(saldo(1,60),/PRENOTAZIONE_NON_MODIFICABILE/)
 assert.equal((await db.query('select id from payments')).rows.length,0)
 assert.equal((await db.query('select id from bookings where pagato')).rows.length,0)
})

test('vecchie pagine fermate sulle camere parallele, ancora funzionanti sulle prenotazioni singole',async()=>{
 await assert.rejects(scalar("select segna_pagato($1,$2,'contanti','2026-09-10') r",[id(1),id(70)]),/PAGINA_DA_AGGIORNARE/)
 await assert.rejects(scalar("select registra_acconto($1,$2,50,'contanti','2026-09-10') r",[id(3),id(71)]),/PAGINA_DA_AGGIORNARE/)
 assert.equal((await db.query('select id from payments')).rows.length,0)
 const r=await scalar("select segna_pagato($1,$2,'contanti','2026-09-10') r",[id(4),id(72)])
 assert.equal(Number(r.importo),500)
})
