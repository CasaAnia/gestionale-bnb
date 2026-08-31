#!/usr/bin/env node
// ============================================================================
// Collaudo contratto — PASSO 5: TRANSIZIONE A/B (solo progetto di
// prova). La prova della chiamata sospesa identifica Y per PID e ne
// verifica l'ATTESA EFFETTIVA su app_members (pg_locks), mai una pausa
// come prova; la condizione di quiescenza è quella VERA della fase B
// (attendiQuiescenza: età delle transazioni + orizzonte xmin, poll con
// timeout e STOP) e viene provata anche con transazioni INSERT/UPDATE
// pregresse; la fase B è UNA SOLA transazione (barriera, revoche,
// ripuntamento involucri) costruita da costruisciFaseB — unica fonte.
// Le sessioni pg si rilasciano nei finally anche sugli errori.
// ============================================================================
import { randomUUID } from 'node:crypto'
import { sql, progetto } from '../fase2b/api.mjs'
import { verificaNonProduzione } from '../fase2b/guardia.mjs'
import { LEGACY, bozzaSql, comeMembro, connessionePg, fixtureDocumento, ownerId } from './ambiente.mjs'
import { attendiQuiescenza, attesaSuTabella, costruisciFaseB, creaContatore, eseguiPasso, provaNegativaFaseA } from './strumenti.mjs'
import { apriUltimoRegistro } from './registro.mjs'

await eseguiPasso('PASSO 5 · transizione A/B', async () => {
  verificaNonProduzione(progetto().ref)
  const v = creaContatore('PASSO 5 · transizione A/B')
  const registro = apriUltimoRegistro()
  if (!registro || registro.dati.pulito) throw new Error('nessun registro aperto: eseguire prima il passo 1')
  const fixture = opz => fixtureDocumento(registro, opz)
  const UID = await ownerId()
  const p = progetto()
  if (!p.db_pass) throw new Error('db_pass mancante in progetto.json: eseguire passo0b-password.mjs')

  const sessioni = []
  const sessione = async () => {
    const cli = await connessionePg(p)
    sessioni.push(cli); return cli
  }
  const definizioni = async schema => Object.fromEntries((await sql(`
    select p.proname as nome, pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='${schema}' and p.proname in (${LEGACY.map(x => `'${x}'`).join(',')})`)).map(r => [r.nome, r.def]))
  const firmeDi = async schema => Object.fromEntries((await sql(`
    select p.proname as n, pg_get_function_identity_arguments(p.oid) as f
    from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
    where ns.nspname='${schema}' and p.proname in (${LEGACY.map(x => `'${x}'`).join(',')})`)).map(r => [r.n, r.f]))
  const smontaFaseA = async () => {
    await sql(`do $$ declare r record; begin
      for r in select nome, definizione from private.transizione_backup loop execute r.definizione; end loop; end $$;`)
    await sql(`do $$ declare r record; begin
      for r in select p.proname as nome, pg_get_function_identity_arguments(p.oid) as f
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='private' and p.proname in (${LEGACY.map(x => `'${x}'`).join(',')})
      loop execute format('drop function private.%I(%s)', r.nome, r.f); end loop; end $$;
      drop table private.transizione_backup;`)
  }

  try {
    const originali = await definizioni('public')
    v.esigi('cinque funzioni legacy presenti in public', Object.keys(originali).length === 5)

    // ---- 5.0 GUARDIA della fase A provata sul database vero ---------------
    // La bozza porta il SUO begin;…commit;: incollarla dopo un BEGIN non
    // annida nulla e quel commit concluderebbe anche la sonda — se la
    // guardia accettasse per errore, il rosso arriverebbe a residui già
    // persistiti. provaNegativaFaseA toglie begin/commit dalla bozza e
    // chiude SEMPRE con rollback: la transazione la controlla il
    // collaudo, e anche un'accettazione inattesa non lascia nulla.
    const residuiGuardia = async () => (await sql(`select
      (select count(*)::int from pg_proc p join pg_namespace n2 on n2.oid=p.pronamespace
         where n2.nspname='public' and p.proname='scarta_documento') as sovraccarichi,
      (select count(*)::int from information_schema.tables where table_schema='private' and table_name='transizione_backup') as backup,
      (select count(*)::int from pg_proc p join pg_namespace n2 on n2.oid=p.pronamespace
         where n2.nspname='private' and p.proname in (${LEGACY.map(x => `'${x}'`).join(',')})) as private_`))[0]
    // (a) un SOVRACCARICO in più → FASE_A_STOP
    {
      let stop = ''
      try {
        await sql(provaNegativaFaseA({
          bozza: bozzaSql('transizione-fase-A.BOZZA.sql'),
          sonda: `create function public.scarta_documento(p_solo uuid) returns void
            language sql as 'select null::void';`,
        }))
      } catch (e) { stop = String(e.message) }
      const resti = await residuiGuardia()
      v.esigi('sonda e bozza SENZA residui (rollback del collaudo, anche ad accettazione inattesa)',
        resti.sovraccarichi === 1 && resti.backup === 0 && resti.private_ === 0, JSON.stringify(resti))
      v.esigi('overload presente → FASE_A_STOP (ESATTAMENTE una)', stop.includes('ESATTAMENTE una'), stop.slice(0, 120))
    }
    // (b) TIPI diversi da quelli attesi → FASE_A_STOP
    {
      let stop = ''
      try {
        await sql(provaNegativaFaseA({
          bozza: bozzaSql('transizione-fase-A.BOZZA.sql'),
          sonda: `drop function public.scarta_documento(uuid, text);
          create function public.scarta_documento(p_document_id uuid, p_motivi jsonb) returns void
            language sql as 'select null::void';`,
        }))
      } catch (e) { stop = String(e.message) }
      const resti = await residuiGuardia()
      const dopoGuardia = await definizioni('public')
      v.esigi('nessun residuo e originale INTATTO byte per byte (rollback garantito)',
        resti.sovraccarichi === 1 && resti.backup === 0 && resti.private_ === 0
        && dopoGuardia.scarta_documento === originali.scarta_documento, JSON.stringify(resti))
      v.esigi('tipi inattesi → FASE_A_STOP (confronto dal catalogo, non sul testo nominato)', stop.includes('tipi inattesi'), stop.slice(0, 120))
    }
    // (c) il caso CONFORME sono le funzioni REALI della 0020, con gli
    // argomenti NOMINATI (p_document_id uuid, …): è la 5.1 qui sotto —
    // se la guardia respingesse i nomi, la fase A non passerebbe mai

    // ---- 5.1 fase A + ROLLBACK provato (sotto-giro isolato) ---------------
    registro.segna('transizioneApplicata')
    await sql(bozzaSql('transizione-fase-A.BOZZA.sql'))
    {
      const private_ = await definizioni('private')
      v.esigi('copie in private per tutti e cinque i nomi', Object.keys(private_).length === 5)
      v.esigi('spostamento VERBATIM (solo l\'intestazione cambia)',
        LEGACY.every(n => private_[n] && private_[n].replace(`FUNCTION private.${n}`, `FUNCTION public.${n}`) === originali[n]))
      const firme = await firmeDi('public')
      for (const n of LEGACY) {
        const argomenti = firme[n].split(',').filter(Boolean).map(() => 'null').join(',')
        let esito = ''
        try { await sql(`begin; ${comeMembro(UID)} select public.${n}(${argomenti}); rollback;`) }
        catch (e) { esito = String(e.message) }
        // CANCELLO: un respingente mancante o una private eseguibile non
        // devono lasciar proseguire verso lo smontaggio e la fase B
        v.esigi(`respingente ${n} → PERCORSO_DISMESSO`, esito.includes('PERCORSO_DISMESSO'), esito.slice(0, 80))
        const [pr] = await sql(`select has_function_privilege('authenticated',
          (select p.oid from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
           where ns.nspname='private' and p.proname='${n}'), 'execute') as e`)
        v.esigi(`private.${n} negata ad authenticated`, pr.e === false)
      }
      await smontaFaseA()
      const ripristinate = await definizioni('public')
      v.esigi('ROLLBACK dal runbook: i cinque corpi originali tornano identici',
        LEGACY.every(n => ripristinate[n] === originali[n]))
    }

    // ---- 5.2 quiescenza: INSERT/UPDATE pregressi e chiamata sospesa -------
    // (a) transazioni pregresse con SCRITTURE sulle bozze
    {
      const T = await sessione()
      await T.query(`begin; insert into public.family_draft_expenses (document_id, status, expense_date, group_id, arrotondamento_cent)
        select id, 'da_controllare', '2026-08-29', (select id from public.family_groups order by name limit 1), 0
        from public.family_documents limit 1;`)
      const [{ t: taglio }] = await sql(`select now()::text as t`)
      const [{ x: xid }] = await sql(`select pg_current_xact_id()::text::bigint as x`)
      const q1 = await attendiQuiescenza(sql, { taglio, xidTaglio: xid, tentativi: 3, pausaMs: 300 })
      v.esigi('INSERT pregresso ancora aperto → quiescenza in TIMEOUT (STOP)', q1.esito === 'timeout' && q1.pregresse.length >= 1, JSON.stringify(q1.pregresse))
      await T.query('rollback;')
      const q2 = await attendiQuiescenza(sql, { taglio, xidTaglio: xid, tentativi: 10, pausaMs: 300 })
      v.esigi('chiusa la transazione → quiescenza soddisfatta', q2.esito === 'ok', JSON.stringify(q2))
    }
    // (b) la chiamata LEGACY sospesa dentro is_app_member, identificata per PID
    {
      const f = await fixture()
      const X = await sessione(), Y = await sessione()
      const pidY = (await Y.query('select pg_backend_pid() as pid')).rows[0].pid
      await X.query('begin; lock table public.app_members in access exclusive mode;')
      const chiamataY = Y.query(`begin; ${comeMembro(UID)} select public.conferma_documento('${f.docId}'::uuid,'[]'::jsonb) as r; commit;`)
        .then(() => 'conclusa').catch(e => `errore: ${e.message}`)
      // PROVA vera: Y (per PID) è in attesa di lock proprio su app_members,
      // con la query della conferma — non una pausa temporale
      const attesa = await attesaSuTabella(sql, { pid: pidY, tabella: 'app_members', funzione: 'conferma_documento' })
      v.esigi('Y è DAVVERO sospesa su app_members dentro la conferma (pid verificato)', attesa.trovato, attesa.dettaglio ?? '')
      // fase A mentre Y è sospesa
      registro.segna('transizioneApplicata')
      await sql(bozzaSql('transizione-fase-A.BOZZA.sql'))
      const [{ t: tA }] = await sql(`select now()::text as t`)
      const [{ x: xidA }] = await sql(`select pg_current_xact_id()::text::bigint as x`)
      // la CONDIZIONE della fase B deve CONTARE proprio Y
      const q1 = await attendiQuiescenza(sql, { taglio: tA, xidTaglio: xidA, tentativi: 3, pausaMs: 300 })
      v.esigi('condizione fase B in TIMEOUT con Y fra le pregresse (per PID)',
        q1.esito === 'timeout' && q1.pregresse.some(r => Number(r.pid) === Number(pidY)), JSON.stringify(q1.pregresse))
      // una chiamata legacy invocata ADESSO → respingente immediato
      let respinta = ''
      try { await sql(`begin; ${comeMembro(UID)} select public.scarta_documento('${f.docId}'::uuid,'x'); rollback;`) }
      catch (e) { respinta = String(e.message) }
      v.esigi('invocazione post-fase-A → PERCORSO_DISMESSO immediato', respinta.includes('PERCORSO_DISMESSO'), respinta.slice(0, 80))
      // X rilascia: Y conclude col corpo VECCHIO, poi la condizione passa
      await X.query('rollback;')
      const esitoY = await chiamataY
      v.esigi('la chiamata pregressa CONCLUDE col corpo vecchio dopo il rilascio', esitoY === 'conclusa', esitoY)
      const q2 = await attendiQuiescenza(sql, { taglio: tA, xidTaglio: xidA, tentativi: 10, pausaMs: 300 })
      v.esigi('a chiamate concluse la condizione è soddisfatta', q2.esito === 'ok', JSON.stringify(q2))
    }

    // ---- 5.3 fase B: UNA SOLA transazione ---------------------------------
    {
      const firme = await firmeDi('public')
      const faseB = costruisciFaseB({ bozzaContratto: bozzaSql('contratto-revisione.BOZZA.sql'), firme, legacy: LEGACY })
      await sql(faseB)
      // verifiche post-commit
      let negato = ''
      try { await sql(`begin; ${comeMembro(UID)} update public.family_draft_items set name='x' where false; rollback;`) }
      catch (e) { negato = String(e.message) }
      v.esigi('scritture dirette respinte per authenticated', /permission|denied|negat/i.test(negato), negato.slice(0, 80))
      const f = await fixture()
      const r = await sql(`begin; ${comeMembro(UID)}
        select public.conferma_revisione('${randomUUID()}'::uuid,'${f.docId}'::uuid,0,'[]'::jsonb) as r; commit;`)
      const esito = r.find(x => x?.r)?.r
      v.attesa('conferma_revisione verde via copia private (APPLICATA con spese)',
        esito?.esito === 'APPLICATA' && esito?.spese?.length > 0, JSON.stringify(esito))
      // doppia porta: execute revocato oltre ai respingenti (OID
      // verificato: mai il testo della firma dentro has_function_privilege)
      for (const n of LEGACY) {
        const [pr] = await sql(`select has_function_privilege('authenticated',
          (select p.oid from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
           where ns.nspname='public' and p.proname='${n}'), 'execute') as e`)
        v.attesa(`doppia porta, execute negato: ${n}`, pr.e === false)
      }
    }

    v.chiudi()
  } finally {
    for (const cli of sessioni) {
      await cli.query('rollback;').catch(() => {})
      await cli.end().catch(() => {})
    }
  }
})
