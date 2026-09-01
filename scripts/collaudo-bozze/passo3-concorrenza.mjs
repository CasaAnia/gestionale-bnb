#!/usr/bin/env node
// ============================================================================
// Collaudo 0023 · PASSO 3 — CONCORRENZA del primitivo atomico.
//  · caso DETERMINISTICO con sessioni pg dedicate: la sessione A tiene il
//    lock del documento (select … for update), la B chiama la RPC e resta
//    IN ATTESA (verificato su pg_stat_activity); A elabora e committa; B
//    si sblocca e DEVE essere rifiutata con lo stato già cambiato.
//  · caso PARALLELO di conferma via PostgREST: due chiamate simultanee,
//    ESATTAMENTE una riesce, una sola serie di bozze.
// Richiede la password del db di prova (passo0b del collaudo contratto).
// ============================================================================
import { randomUUID } from 'node:crypto'
import { progetto, rest, sql } from '../fase2b/api.mjs'
import { verificaNonProduzione } from '../fase2b/guardia.mjs'
import { creaContatore, eseguiPasso } from '../collaudo-contratto/strumenti.mjs'
import { connessionePg, gruppoPersonale } from '../collaudo-contratto/ambiente.mjs'
import { apriUltimoRegistro } from '../collaudo-contratto/registro.mjs'
import { FUNZIONE_0023, verificaAutorizzazione } from './strumenti0023.mjs'

const pausa = ms => new Promise(r => setTimeout(r, ms))
const corpoMinimo = (docId, gruppoId) => ({
  p_document_id: docId, p_errore: null,
  p_pacchetto: {
    doc_total: 3,
    bozze: [{
      document_id: docId, status: 'da_controllare', expense_date: '2026-08-30',
      group_id: gruppoId, arrotondamento_cent: 0, confidence: {},
      righe: [{ name: 'Voce concorrenza', qty: 1, discount: 0, amount: 3, confidence: {} }],
    }],
  },
})
const viaRest = async corpo => {
  const r = await rest(`/rest/v1/rpc/${FUNZIONE_0023}`, 'service', { method: 'POST', body: JSON.stringify(corpo) })
  const testo = await r.text()
  try { return JSON.parse(testo) } catch { return { trasporto: r.status, testo } }
}

await eseguiPasso('passo3-concorrenza', async () => {
  verificaAutorizzazione()
  verificaNonProduzione(progetto().ref)
  const c = creaContatore('passo3-concorrenza')
  const registro = apriUltimoRegistro()
  if (!registro || registro.dati.pulito || !registro.dati.bozza0023Applicata)
    throw new Error('nessun registro col passo 1 applicato: eseguire prima passo1-struttura')
  const p = progetto()
  if (!p.db_pass) throw new Error('db_pass assente: eseguire prima collaudo-contratto/passo0b-password.mjs')
  const gruppoId = await gruppoPersonale()

  // ---- caso DETERMINISTICO: attesa reale sul lock del documento ----------
  const docA = randomUUID()
  registro.documento(docA)
  await sql(`insert into public.family_documents (id, kind, status, upload_ambito)
    values ('${docA}', 'scontrino', 'da_elaborare', 'personale')`)
  const sessioneA = await connessionePg(p)
  try {
    await sessioneA.query('begin')
    await sessioneA.query(`select id from public.family_documents where id='${docA}' for update`)
    // B parte ORA e resta in attesa sul lock
    const bPromessa = viaRest(corpoMinimo(docA, gruppoId))
    let inAttesa = false
    for (let i = 0; i < 20 && !inAttesa; i++) {
      await pausa(300)
      const r = await sql(`select count(*)::int as n from pg_stat_activity
        where wait_event_type='Lock' and query ilike '%${FUNZIONE_0023}%'`)
      inAttesa = r[0].n > 0
    }
    c.esigi('la chiamata concorrente ATTENDE il lock (misurato su pg_stat_activity)', inAttesa)
    // A elabora DENTRO la propria transazione (lock già suo) e committa
    const [rigaA] = (await sessioneA.query(
      `select public.${FUNZIONE_0023}($1::uuid, $2::jsonb, null) as esito`,
      [docA, JSON.stringify(corpoMinimo(docA, gruppoId).p_pacchetto)],
    )).rows
    c.esigi('la sessione col lock elabora con successo', rigaA.esito?.ok === true, JSON.stringify(rigaA.esito))
    await sessioneA.query('commit')
    const esitoB = await bPromessa
    c.esigi('la perdente è rifiutata con lo stato GIÀ cambiato (mai bozze doppie)',
      esitoB.ok === false && esitoB.stato_attuale === 'in_revisione', JSON.stringify(esitoB))
    const conteggi = await sql(`select count(*)::int as n from public.family_draft_expenses where document_id='${docA}'`)
    c.esigi('una sola serie di bozze', conteggi[0].n === 1)
  } finally {
    await sessioneA.query('rollback').catch(() => {})
    await sessioneA.end().catch(() => {})
  }

  // ---- caso PARALLELO di conferma: esattamente una riesce ----------------
  const docB = randomUUID()
  registro.documento(docB)
  await sql(`insert into public.family_documents (id, kind, status, upload_ambito)
    values ('${docB}', 'scontrino', 'da_elaborare', 'personale')`)
  const [e1, e2] = await Promise.all([viaRest(corpoMinimo(docB, gruppoId)), viaRest(corpoMinimo(docB, gruppoId))])
  const riuscite = [e1, e2].filter(e => e.ok === true).length
  c.esigi('due chiamate simultanee: ESATTAMENTE una riesce', riuscite === 1, JSON.stringify([e1, e2]))
  const serie = await sql(`select count(*)::int as n from public.family_draft_expenses where document_id='${docB}'`)
  c.esigi('nessuna bozza doppia nel caso parallelo', serie[0].n === 1)

  c.chiudi()
})
