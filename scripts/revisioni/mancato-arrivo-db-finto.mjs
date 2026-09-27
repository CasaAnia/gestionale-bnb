import {readFile} from 'node:fs/promises'
// Completa solo il database sintetico: nessuna connessione remota.
export async function preparaMancatoArrivo(db,bookings,payments=[]) {
 await db.exec(`reset role;
 alter table bookings add column total_amount numeric, add column prenotazione_id uuid, add column group_id uuid, add column guest_id uuid,
 add column cancelled_at timestamptz, add column cancelled_reason text, add column pagato boolean default false;
 create table payments(id uuid primary key default gen_random_uuid(), booking_id uuid references bookings(id), amount numeric, method text, paid_on date,
 chiave_operazione uuid unique,soggiorno text,origine text,note text);
 create function public.soggiorno_di(p_booking_id uuid) returns text language sql stable as $$ select coalesce(prenotazione_id::text,group_id::text,id::text) from public.bookings where id=p_booking_id $$;
 create function public.blocca_soggiorno(p_soggiorno text) returns void language plpgsql as $$ begin
 perform pg_advisory_xact_lock(hashtext(p_soggiorno)); perform id from public.bookings where coalesce(prenotazione_id::text,group_id::text,id::text)=p_soggiorno order by id for update; end $$;`)
 for(const b of bookings) await db.query('update bookings set total_amount=$2,prenotazione_id=$3,group_id=$4,guest_id=$5,pagato=$6 where id=$1',[b.id,b.total_amount??100,b.prenotazione_id??null,b.group_id??null,b.guest_id??null,b.pagato??false])
 for(const p of payments) if(bookings.some(b=>b.id===p.booking_id)) await db.query('insert into payments(id,booking_id,amount,method,paid_on) values($1,$2,$3,$4,$5)',[p.id,p.booking_id,p.amount,p.method,p.paid_on])
 await db.exec(await readFile(new URL('../../supabase/proposte/0060_mancato_arrivo.BOZZA.sql',import.meta.url),'utf8'))
 await db.exec('grant select on payments to authenticated; set role authenticated;')
}
