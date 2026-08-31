#!/usr/bin/env node
// ============================================================================
// Collaudo contratto — PASSO 6: il CLIENT VERO (contrattoRpc +
// contrattoScrittura) contro le RPC reali via PostgREST, con l'identità
// del MEMBRO (jwt della 2B: scripts/fase2b/utenti-e-export.mjs). Niente
// pagine: gira in node con lo stesso codice che un giorno verrà cablato.
// Copre ciò che il server finto NON prova: trasporto reale, codici
// SQLSTATE veri, recupero per chiave sul giornale vero.
// ============================================================================
import { randomUUID, createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { rest, sql, progetto } from '../fase2b/api.mjs'
import { verificaNonProduzione } from '../fase2b/guardia.mjs'
import { contatore, fixtureDocumento, ownerId } from './ambiente.mjs'
import { creaClienteContrattoRpc } from '../../lib/spese/contrattoRpc.ts'
import { depositoOperazioniInMemoria, eseguiConferma, eseguiSalva, recuperaOperazione, reinviaOperazione } from '../../lib/spese/contrattoScrittura.ts'
import { apriRevisione, modificaBozza, aggiungiRiga } from '../../lib/spese/revisione.ts'

verificaNonProduzione(progetto().ref)
const v = contatore('PASSO 6 · client vero su RPC vere')
const UID = await ownerId()
const sha = async t => createHash('sha256').update(t, 'utf8').digest('hex')

// jwt del membro (creato dalla 2B, salvato fuori repo)
const jwt = readFileSync(join(homedir(), '.gestionale-2b', 'jwt-owner.txt'), 'utf8').trim()

// «supabase.rpc» minimale sopra PostgREST: la forma d'errore riporta il
// CODICE (SQLSTATE) che è l'unica prova di rifiuto accettata dal client
const supabase = {
  async rpc(nome, argomenti) {
    const r = await rest(`/rest/v1/rpc/${nome}`, { jwt }, { method: 'POST', body: JSON.stringify(argomenti) })
    const testo = await r.text()
    if (!r.ok) {
      let corpo = {}
      try { corpo = JSON.parse(testo) } catch { corpo = { message: testo } }
      return { data: null, error: { message: corpo.message ?? testo, code: corpo.code } }
    }
    try { return { data: JSON.parse(testo), error: null } } catch { return { data: testo, error: null } }
  },
}
const cliente = creaClienteContrattoRpc(supabase)
const statoDa = f => apriRevisione(f.docId, 5,
  [{ id: f.bozzaId, document_id: f.docId, status: 'da_controllare', expense_date: '2026-08-29', group_id: 'g', category_id: null, subcategory: null, canonical_category_id: null, canonical_subcategory_id: null, store: null, description: null, payment_method: 'contanti', room_id: null, expense_nature: null, arrotondamento_cent: 0, confidence: null }], [])

// ---- giro completo: salva → replay → recupero → conferma ------------------
{
  const f = await fixtureDocumento(UID)
  const deposito = depositoOperazioniInMemoria()
  let s = statoDa(f)
  s = modificaBozza(s, f.bozzaId, { store: 'Iper' })
  s = aggiungiRiga(s, { draft_id: f.bozzaId, name: 'Sacchetto', amount: 0.5 }, 'loc-1')
  const opKey = randomUUID()
  const esito = await eseguiSalva(cliente, deposito, s, 0, sha, opKey)
  v.attesa('eseguiSalva su RPC vera → ok con mappa', esito.ok && !('nulla' in esito) && !!esito.mappaNuove['loc-1'], JSON.stringify(esito))
  v.attesa('custodia chiusa a risposta convalidata', deposito.contenuto().length === 0)
  // reinvio manuale della STESSA richiesta → RIPETUTA, stessa mappa
  const dep2 = depositoOperazioniInMemoria()
  const replay = await eseguiSalva(cliente, dep2, s, 0, sha, opKey)
  v.attesa('replay dal client → ripetuta con la stessa mappa',
    replay.ok && !('nulla' in replay) && replay.ripetuta === true
    && JSON.stringify(replay.mappaNuove) === JSON.stringify(esito.ok && !('nulla' in esito) ? esito.mappaNuove : null), JSON.stringify(replay))
  // recupero per chiave sul giornale VERO con la corrispondenza piena
  const op = { opKey, kind: 'salva', documentId: f.docId, baseRev: 0, impronta: (dep2.contenuto()[0] ?? { impronta: '' }).impronta, clientRefs: ['loc-1'], richiesta: { kind: 'salva', modifiche: { kind: 'salva', document_id: f.docId, base_rev: 0, bozze: {}, righe: {}, nuove: [] } } }
  void op // la corrispondenza vera si prova col deposito serializzato:
  // (il caso completo di risposta persa non è forzabile sul trasporto
  // reale: coperto dal server finto; qui si prova il canale di lettura)
  const g = await cliente.esitoRevisione(opKey)
  v.attesa('esito_revisione vero: applicata con impronta', g.stato === 'applicata' && typeof g.manifesto_sha256 === 'string', JSON.stringify(g))
  // il totale non quadra più (5 + 0,50): la conferma versionata deve
  // arrivare col RAISE del server e il codice P0001 → rifiuto PROVATO
  const rifiuto = await eseguiConferma(cliente, depositoOperazioniInMemoria(), f.docId, 1, [], sha, randomUUID())
  v.attesa('quadratura del server → rifiuto DIMOSTRATO (P0001), custodia chiusa',
    !rifiuto.ok && 'errore' in rifiuto && !('incerto' in rifiuto) && /quadratura/i.test(rifiuto.errore), JSON.stringify(rifiuto))
}

// ---- SUPERATA reale e reinvio dal deposito --------------------------------
{
  const f = await fixtureDocumento(UID)
  const deposito = depositoOperazioniInMemoria()
  let s1 = statoDa(f); s1 = modificaBozza(s1, f.bozzaId, { store: 'B' })
  await eseguiSalva(cliente, deposito, s1, 0, sha, randomUUID())
  let s2 = statoDa(f); s2 = modificaBozza(s2, f.bozzaId, { store: 'A tardivo' })
  const tardivo = await eseguiSalva(cliente, deposito, s2, 0, sha, randomUUID())
  v.attesa('base_rev vecchio sul server vero → conflitto «superata»', !tardivo.ok && 'conflitto' in tardivo, JSON.stringify(tardivo))
  // reinvio dal deposito: richiesta mai partita (chiave nuova, custodia
  // scritta a mano) → assente → reinviaOperazione la manda dal deposito
  const opKey = randomUUID()
  let s3 = statoDa(f); s3 = modificaBozza(s3, f.bozzaId, { store: 'Dal deposito' })
  const { batchSalvaDa, manifestoSalva } = await import('../../lib/spese/contrattoRevisione.ts')
  const batch = batchSalvaDa(s3, 1)
  const op = { opKey, kind: 'salva', documentId: f.docId, baseRev: 1, impronta: await sha(manifestoSalva(batch)), clientRefs: [], richiesta: { kind: 'salva', modifiche: batch } }
  const dep = depositoOperazioniInMemoria([op])
  v.attesa('recupero → assente per la chiave mai inviata', (await recuperaOperazione(cliente, dep, op)).stato === 'assente')
  const reinvio = await reinviaOperazione(cliente, dep, opKey, sha)
  const [dopo] = await sql(`select store from public.family_draft_expenses where id='${f.bozzaId}'`)
  v.attesa('reinvio dal deposito applicato sul server vero', reinvio.ok && dopo.store === 'Dal deposito', JSON.stringify(reinvio))
}

await v.chiudi()
