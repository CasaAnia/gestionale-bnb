-- Aggiunge chi_e: relazione dell'ospite del nome aggiuntivo (mamma, papà, cognato, collega, ecc.)
alter table bookings add column if not exists chi_e text;
