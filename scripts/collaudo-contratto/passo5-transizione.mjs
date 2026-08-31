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
import pg from 'pg'
import { sql, progetto } from '../fase2b/api.mjs'
import { verificaNonProduzione } from '../fase2b/guardia.mjs'
import { LEGACY, bozzaSql, comeMembro, fixtureDocumento, ownerId } from './ambiente.mjs'
import { attendiQuiescenza, attesaSuTabella, costruisciFaseB, creaContatore, eseguiPasso } from './strumenti.mjs'
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
    const cli = new pg.Client({ host: `db.${p.ref}.supabase.co`, port: 5432, user: 'postgres', database: 'postgres', password: p.db_pass, ssl: { rejectUnauthorized: false } })
    await cli.connect(); sessioni.push(cli); return cli
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
    // ---- 5.1 fase A + ROLLBACK provato (sotto-giro isolato) ---------------
    const originali = await definizioni('public')
    v.esigi('cinque funzioni legacy presenti in public', Object.keys(originali).length === 5)
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
        v.attesa(`respingente ${n} → PERCORSO_DISMESSO`, esito.includes('PERCORSO_DISMESSO'), esito.slice(0, 80))
        const [pr] = await sql(`select has_function_privilege('authenticated','private.${n}(${firme[n]})','execute') as e`)
        v.attesa(`private.${n} negata ad authenticated`, pr.e === false)
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
      v.attesa('invocazione post-fase-A → PERCORSO_DISMESSO immediato', respinta.includes('PERCORSO_DISMESSO'))
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
      v.attesa('scritture dirette respinte per authenticated', /permission|denied|negat/i.test(negato), negato.slice(0, 80))
      const f = await fixture()
      const r = await sql(`begin; ${comeMembro(UID)}
        select public.conferma_revisione('${randomUUID()}'::uuid,'${f.docId}'::uuid,0,'[]'::jsonb) as r; commit;`)
      const esito = r.find(x => x?.r)?.r
      v.attesa('conferma_revisione verde via copia private (APPLICATA con spese)',
        esito?.esito === 'APPLICATA' && esito?.spese?.length > 0, JSON.stringify(esito))
      const [porta] = await sql(`select has_function_privilege('authenticated','public.conferma_documento(${firme.conferma_documento})','execute') as e`)
      v.attesa('doppia porta: execute legacy revocato oltre al respingente', porta.e === false)
      for (const n of LEGACY) {
        const [pr] = await sql(`select has_function_privilege('authenticated','public.${n}(${firme[n]})','execute') as e`)
        v.attesa(`execute negato: ${n}`, pr.e === false)
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
