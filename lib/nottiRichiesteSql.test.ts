import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { proponiSoluzioni } from './richiesteProposta.ts'
import { validaRichiestaWeb } from './richiesteWeb.ts'

// SQL reale 0044 e RPC 0031, dentro un database locale isolato. La prova
// parte dal corpo web, rilegge la riga, propone e conferma: mai dati reali.
test('web → database → rilettura → proposta → conferma: 23,25,26 restano tre notti', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create schema auth; create role anon; create role authenticated;
      create function auth.uid() returns uuid language sql as 'select gen_random_uuid()';
      create table rooms(id uuid primary key,name text);
      create table guests(id uuid primary key default gen_random_uuid(),phone text,full_name text,created_at timestamptz default now());
      create table richieste(id uuid primary key default gen_random_uuid(),nome text,cognome text,arrivo date,partenza date,persone int,camera_id uuid,telefono text,note text,canale text,stato text,proposta_soluzione jsonb,proposta_alternative jsonb,persone_per_notte jsonb,prenotazione_id uuid,chiusa_at timestamptz,motivo_rifiuto text);
      create table bookings(id uuid primary key default gen_random_uuid(),room_id uuid,guest_id uuid,check_in date,check_out date,num_guests int,extra_bed boolean,extra_bed_dates jsonb,price_per_night numeric,extra_bed_total numeric,total_amount numeric,status text,source text,notes text,bonifico boolean,pagato boolean,group_id uuid,guest_name text);
    `)
    const sql = readFileSync(new URL('../supabase/proposte/0044_notti_richieste.BOZZA.sql',import.meta.url),'utf8').split('-- VERIFICA:')[0]
    await db.exec(sql)
    await db.exec(sql) // ripetibile
    const rpc = readFileSync(new URL('../supabase/migrations/0031_richieste_persone_per_notte.sql',import.meta.url),'utf8')
    await db.exec(rpc.slice(rpc.indexOf('create or replace function public.conferma_richiesta('),rpc.indexOf('notify pgrst')))
    const camera = {id:'aaaaaaaa-1111-4111-8111-111111111111',name:'Amelia',base_price:70,has_extra_bed:true,extra_bed_price:5,active:true}
    await db.query('insert into rooms values ($1,$2)',[camera.id,camera.name])
    const body = {nome:'Ospite',cognome:'Prova',telefono:'3330000000',arrivo:'2027-09-23',partenza:'2027-09-27',persone:1,camera:'Amelia',notti_richieste:['2027-09-23','2027-09-25','2027-09-26']}
    const esito = validaRichiestaWeb(body,'2027-09-01',[camera]); assert.ok(esito.ok)
    const d=esito.dati
    const inserita=await db.query<{id:string}>('insert into richieste(nome,cognome,telefono,arrivo,partenza,persone,camera_id,canale,stato,notti_richieste) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id',[d.nome,d.cognome,d.telefono,d.arrivo,d.partenza,d.persone,d.camera_id,'web','in_attesa',JSON.stringify(d.notti_richieste)])
    const id=inserita.rows[0].id
    const r=(await db.query<typeof d>('select * from richieste where id=$1',[id])).rows[0]
    assert.deepEqual(r.notti_richieste,body.notti_richieste)
    const sol=proponiSoluzioni(r,[camera],[])[0]
    await db.query('update richieste set proposta_soluzione=$1,stato=$2 where id=$3',[JSON.stringify(sol),'proposta_inviata',id])
    for(const maschera of [[],['2027-09-23','2027-09-23'],['2027-09-27'],['2027-09-26','2027-09-23'],['2027-09-99'],[5]]) {
      await assert.rejects(()=>db.query('update richieste set notti_richieste=$1 where id=$2',[JSON.stringify(maschera),id]))
    }
    const falsa={...sol,segmenti:[{...sol.segmenti[0],partenza:'2027-09-27'}]}
    await assert.rejects(()=>db.query('update richieste set proposta_soluzione=$1 where id=$2',[JSON.stringify(falsa),id]),/non richiesta/)
    await assert.rejects(()=>db.query('update richieste set proposta_alternative=$1 where id=$2',[JSON.stringify([falsa]),id]),/non richiesta/)
    await assert.rejects(()=>db.query('update richieste set proposta_soluzione=$1 where id=$2',[JSON.stringify({...sol,segmenti:[...sol.segmenti,...sol.segmenti]}),id]),/due volte/)
    await db.query('select public.conferma_richiesta($1)',[id])
    await db.query('select public.conferma_richiesta($1)',[id]) // reinvio senza doppioni
    const b=(await db.query<{check_in:string,check_out:string,total_amount:string}>('select check_in::text,check_out::text,total_amount::text from bookings order by check_in')).rows
    assert.deepEqual(b,[{check_in:'2027-09-23',check_out:'2027-09-24',total_amount:'70'},{check_in:'2027-09-25',check_out:'2027-09-27',total_amount:'140'}])
    assert.equal((await db.query('select * from richieste')).rows.length,1)
  } finally { await db.close() }
})
