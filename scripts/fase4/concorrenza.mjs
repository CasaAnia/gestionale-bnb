// ============================================================================
// CONCORRENZA (Fase 4 · collaudo 0022) — logica PURA e testabile.
// · misure al MICROSECONDO: i timestamp di PostgreSQL hanno 6 cifre di
//   frazione, Date.getTime() le tronca ai millisecondi e due finestre
//   distinte dentro lo stesso millisecondo sembrerebbero sovrapposte;
// · sovrapposizione EFFETTIVA (disuguaglianze strette): il semplice
//   contatto fra estremi non è concorrenza;
// · l'ORCHESTRATORE attende i rami E la verifica (niente fire-and-forget:
//   un processo non può uscire verde con verifiche ancora in corso) e un
//   riepilogo che pretende TUTTI i casi completati.
// ============================================================================

// epoch in MICROSECONDI, frazione a 6 cifre preservata
export function microsecondi(ts) {
  const testo = String(ts)
  const base = new Date(testo).getTime()          // ms (frazione TRONCATA a 3 cifre)
  if (!Number.isFinite(base)) return NaN
  const m = testo.match(/\.(\d+)/)
  const frazione = m ? m[1] : ''
  const oltreMs = frazione.length > 3 ? Number(frazione.slice(3, 6).padEnd(3, '0')) : 0
  return base * 1000 + oltreMs
}

export function misuraCompleta(ramo) {
  if (!ramo || !Number.isInteger(ramo.pid) || !ramo.prima || !ramo.dopo) return false
  const p = microsecondi(ramo.prima), d = microsecondi(ramo.dopo)
  return Number.isFinite(p) && Number.isFinite(d) && p <= d
}

// ritorna { valida: boolean, motivo?: string }
export function provaValida(a, b) {
  if (!misuraCompleta(a) || !misuraCompleta(b))
    return { valida: false, motivo: 'misure mancanti o incomplete (pid/inizio/fine) su almeno un ramo' }
  if (a.pid === b.pid)
    return { valida: false, motivo: `stesso backend (pid ${a.pid}): nessuna connessione indipendente` }
  const [aP, aD] = [microsecondi(a.prima), microsecondi(a.dopo)]
  const [bP, bD] = [microsecondi(b.prima), microsecondi(b.dopo)]
  // sovrapposizione EFFETTIVA: strettamente dentro, non il contatto fra estremi
  if (!(aP < bD && bP < aD))
    return { valida: false, motivo: 'finestre temporali disgiunte (al microsecondo): esecuzione di fatto sequenziale' }
  return { valida: true }
}

// ---- ORCHESTRATORE di un caso concorrente ---------------------------------
// Attende ENTRAMBI i rami, giudica la validità della prova, poi ATTENDE la
// verifica. Ogni errore diventa un esito esplicito: mai promesse perse.
// Ritorna { stato: 'passato' | 'fallito' | 'non_valido', dettaglio }.
export async function eseguiCaso(promA, promB, verifica) {
  let a, b
  try { [a, b] = await Promise.all([promA, promB]) } catch (e) {
    return { stato: 'fallito', dettaglio: `lancio dei rami: ${String(e?.message ?? e)}` }
  }
  if (a?.trasporto || b?.trasporto)
    return { stato: 'non_valido', dettaglio: `errore di trasporto: ${a?.trasporto ?? b?.trasporto}` }
  const v = provaValida(a, b)
  if (!v.valida) return { stato: 'non_valido', dettaglio: v.motivo }
  try {
    const r = await verifica(a, b)                 // ATTESA sempre
    return r?.ok
      ? { stato: 'passato', dettaglio: r.dettaglio ?? '' }
      : { stato: 'fallito', dettaglio: r?.dettaglio ?? 'verifica negativa' }
  } catch (e) {
    return { stato: 'fallito', dettaglio: `verifica: ${String(e?.message ?? e)}` }
  }
}

// il riepilogo pretende che TUTTI i casi attesi siano COMPLETATI e passati:
// "0 passati, 0 falliti" con casi ancora in volo NON è un successo
export function riepilogo(esiti, casiAttesi) {
  const conta = (s) => esiti.filter(e => e?.stato === s).length
  return {
    passati: conta('passato'),
    falliti: conta('fallito'),
    nonValidi: conta('non_valido'),
    completati: esiti.filter(e => e && e.stato).length,
    ok: esiti.length === casiAttesi
      && esiti.every(e => e?.stato === 'passato'),
  }
}

// Il batch SQL di un ramo: una funzione TEMPORANEA misura pid e finestra
// ATTORNO alla chiamata e CATTURA l'errore atteso, così le misure arrivano
// anche quando la RPC rifiuta (il blocco exception annulla i soli effetti
// della chiamata: savepoint implicito di plpgsql). CREATE OR REPLACE:
// una connessione del pool può sopravvivere alla singola richiesta e la
// funzione pg_temp può già esistere su quel backend.
export function batchRamo(claimsSql, chiamataRpcSql) {
  return `${claimsSql}
create or replace function pg_temp.collaudo_ramo_0022()
returns table(pid int, prima timestamptz, dopo timestamptz, r jsonb, errore text)
language plpgsql as $f$
declare
  v_prima timestamptz;
  v_dopo timestamptz;
  v_r jsonb;
  v_err text;
  v_sveglia timestamptz;
begin
  -- allineamento a un istante ASSOLUTO comune (il prossimo confine di 2
  -- secondi dell'orologio del server): il ritardo di arrivo fra le due
  -- richieste HTTP non separa più le finestre. Una pausa relativa non
  -- basta: con chiamate da ~5 ms e jitter di rete da ~80 ms le finestre
  -- risultavano sempre disgiunte (giustamente NON VALIDE).
  v_sveglia := date_trunc('second', clock_timestamp()) + interval '2 seconds';
  perform pg_sleep(greatest(0, extract(epoch from (v_sveglia - clock_timestamp()))::double precision));
  v_prima := clock_timestamp();
  begin
    v_r := ${chiamataRpcSql};
  exception when others then
    v_err := sqlerrm;               -- errore ATTESO: misurato comunque
  end;
  v_dopo := clock_timestamp();
  return query select pg_backend_pid(), v_prima, v_dopo, v_r, v_err;
end $f$;
set local role authenticated;
select * from pg_temp.collaudo_ramo_0022()`
}
