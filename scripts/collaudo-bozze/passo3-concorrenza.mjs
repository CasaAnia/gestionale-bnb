#!/usr/bin/env node
// ============================================================================
// Collaudo 0023 · PASSO 3 — CONCORRENZA del primitivo atomico.
//  · caso DETERMINISTICO: la sessione A è UNA richiesta SQL (un batch =
//    una connessione = una transazione) che prende il lock del documento,
//    segnala di averlo con un advisory lock osservabile, dorme, elabora e
//    committa; la chiamata B via PostgREST parte SOLO quando l'advisory è
//    visibile, resta IN ATTESA (misurato su pg_stat_activity) e al commit
//    di A DEVE essere rifiutata con lo stato già cambiato.
//  · caso PARALLELO di conferma: due chiamate simultanee via PostgREST,
//    ESATTAMENTE una riesce, una sola serie di bozze.
// Nessuna password del db necessaria: tutto passa dalle vie già usate.
// ============================================================================
import { randomUUID } from 'node:crypto'
import { progetto, rest, sql } from '../fase2b/api.mjs'
import { verificaNonProduzione } from '../fase2b/guardia.mjs'
import { creaContatore, eseguiPasso } from '../collaudo-contratto/strumenti.mjs'
import { gruppoPersonale } from '../collaudo-contratto/ambiente.mjs'
import { apriUltimoRegistro } from '../collaudo-contratto/registro.mjs'
import { FUNZIONE_0023, verificaAutorizzazione } from './strumenti0023.mjs'

const ADVISORY = 423023 // marcatore osservabile del lock di A (0023)
const pausa = ms => new Promise(r => setTimeout(r, ms))
const pacchettoMinimo = gruppoId => ({
  doc_total: 3,
  bozze: [{
    status: 'da_controllare', expense_date: '2026-08-30',
    group_id: gruppoId, arrotondamento_cent: 0, confidence: {},
    righe: [{ name: 'Voce concorrenza', qty: 1, discount: 0, amount: 3, confidence: {} }],
  }],
})
const viaRest = async (docId, gruppoId) => {
  const corpo = { p_document_id: docId, p_pacchetto: pacchettoMinimo(gruppoId), p_errore: null }
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
  const gruppoId = await gruppoPersonale()

  // ---- caso DETERMINISTICO: attesa reale sul lock del documento ----------
  const docA = randomUUID()
  registro.documento(docA)
  await sql(`insert into public.family_documents (id, kind, status, upload_ambito)
    values ('${docA}', 'scontrino', 'da_elaborare', 'personale')`)
  // A: UN batch (una connessione, una transazione): lock del documento,
  // advisory osservabile, pausa perché B possa arrivare e mettersi in
  // coda, poi l'elaborazione col lock GIÀ suo e il commit
  const pacchettoJson = JSON.stringify(pacchettoMinimo(gruppoId)).replaceAll("'", "''")
  const batchA = sql(`begin;
    select id from public.family_documents where id='${docA}' for update;
    select pg_advisory_xact_lock(${ADVISORY});
    select pg_sleep(8);
    select public.${FUNZIONE_0023}('${docA}'::uuid, '${pacchettoJson}'::jsonb, null) as esito;
    commit;`)
  batchA.catch(() => {}) // l'esito vero si giudica sotto; niente unhandled
  // B parte SOLO quando l'advisory di A è visibile (quindi il lock di
  // riga è certamente preso: l'advisory viene DOPO nel batch)
  let lockVisto = false
  for (let i = 0; i < 30 && !lockVisto; i++) {
    await pausa(300)
    const r = await sql(`select count(*)::int as n from pg_locks
      where locktype='advisory' and granted and objid=${ADVISORY}`)
    lockVisto = r[0].n > 0
  }
  c.esigi('la sessione A tiene il lock (advisory osservato)', lockVisto)
  const bPromessa = viaRest(docA, gruppoId)
  let inAttesa = false
  for (let i = 0; i < 20 && !inAttesa; i++) {
    await pausa(300)
    const r = await sql(`select count(*)::int as n from pg_stat_activity
      where wait_event_type='Lock' and query ilike '%${FUNZIONE_0023}%'`)
    inAttesa = r[0].n > 0
  }
  c.esigi('la chiamata concorrente ATTENDE il lock (misurato su pg_stat_activity)', inAttesa)
  await batchA
  const esitoB = await bPromessa
  const [statoA] = await sql(`select status,
    (select count(*)::int from public.family_draft_expenses where document_id='${docA}') as bozze
    from public.family_documents where id='${docA}'`)
  c.esigi('la sessione col lock ha elaborato (in_revisione, una serie di bozze)',
    statoA.status === 'in_revisione' && statoA.bozze === 1, JSON.stringify(statoA))
  c.esigi('la perdente è rifiutata con lo stato GIÀ cambiato (mai bozze doppie)',
    esitoB.ok === false && esitoB.stato_attuale === 'in_revisione', JSON.stringify(esitoB))

  // ---- caso PARALLELO di conferma: esattamente una riesce ----------------
  const docB = randomUUID()
  registro.documento(docB)
  await sql(`insert into public.family_documents (id, kind, status, upload_ambito)
    values ('${docB}', 'scontrino', 'da_elaborare', 'personale')`)
  const [e1, e2] = await Promise.all([viaRest(docB, gruppoId), viaRest(docB, gruppoId)])
  const riuscite = [e1, e2].filter(e => e.ok === true).length
  c.esigi('due chiamate simultanee: ESATTAMENTE una riesce', riuscite === 1, JSON.stringify([e1, e2]))
  const serie = await sql(`select count(*)::int as n from public.family_draft_expenses where document_id='${docB}'`)
  c.esigi('nessuna bozza doppia nel caso parallelo', serie[0].n === 1)

  c.chiudi()
})
