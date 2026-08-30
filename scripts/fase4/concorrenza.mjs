// ============================================================================
// CONCORRENZA (Fase 4 · collaudo 0022) — logica PURA e testabile della
// validità di una prova concorrente. Una prova è VALIDA solo se ENTRAMBI i
// rami hanno misure complete (pid, inizio, fine), i pid sono DIVERSI e le
// finestre temporali si INTERSECANO. Misure mancanti — anche su un ramo
// finito in errore atteso — rendono la prova NON VALIDA: mai conclusioni
// da esecuzioni sequenziali o non misurate.
// ============================================================================

export function misuraCompleta(ramo) {
  return !!(ramo && Number.isInteger(ramo.pid) && ramo.prima && ramo.dopo
    && new Date(ramo.prima).getTime() <= new Date(ramo.dopo).getTime())
}

// ritorna { valida: boolean, motivo?: string }
export function provaValida(a, b) {
  if (!misuraCompleta(a) || !misuraCompleta(b))
    return { valida: false, motivo: 'misure mancanti o incomplete (pid/inizio/fine) su almeno un ramo' }
  if (a.pid === b.pid)
    return { valida: false, motivo: `stesso backend (pid ${a.pid}): nessuna connessione indipendente` }
  const [aP, aD] = [new Date(a.prima).getTime(), new Date(a.dopo).getTime()]
  const [bP, bD] = [new Date(b.prima).getTime(), new Date(b.dopo).getTime()]
  if (!(aP <= bD && bP <= aD))
    return { valida: false, motivo: 'finestre temporali disgiunte: esecuzione di fatto sequenziale' }
  return { valida: true }
}

// Il batch SQL di un ramo: una funzione TEMPORANEA (pg_temp, sparisce con
// la connessione) misura pid e finestra ATTORNO alla chiamata e CATTURA
// l'eventuale errore atteso, così le misure arrivano anche quando la RPC
// rifiuta. Il blocco exception di plpgsql annulla i soli effetti della
// chiamata fallita (savepoint implicito): la transazione del batch resta
// sana e il commit finale non porta con sé nulla del ramo rifiutato.
export function batchRamo(claimsSql, chiamataRpcSql) {
  return `${claimsSql}
create function pg_temp.collaudo_ramo_0022()
returns table(pid int, prima timestamptz, dopo timestamptz, r jsonb, errore text)
language plpgsql as $f$
declare
  v_prima timestamptz;
  v_dopo timestamptz;
  v_r jsonb;
  v_err text;
begin
  perform pg_sleep(0.5);            -- allinea le partenze dei due rami
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
