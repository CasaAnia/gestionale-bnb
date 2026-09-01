#!/usr/bin/env node
// ============================================================================
// Collaudo 0023 · PASSO 4 — PULIZIA per identificativi ESATTI dal
// registro (mai per nome), fotografia finale CONFRONTATA con quella di
// base, registro marcato «pulito» SOLO a verifiche tutte positive.
// Idempotente: dopo un'interruzione si rilancia e riparte da dove era.
// ============================================================================
import { progetto, sql } from '../fase2b/api.mjs'
import { verificaNonProduzione } from '../fase2b/guardia.mjs'
import { creaContatore, eseguiPasso } from '../collaudo-contratto/strumenti.mjs'
import { fotografiaBase } from '../collaudo-contratto/ambiente.mjs'
import { apriUltimoRegistro } from '../collaudo-contratto/registro.mjs'
import { FUNZIONE_0023, pianoPulizia0023, validaFotografia0023, verificaAutorizzazione } from './strumenti0023.mjs'

await eseguiPasso('passo4-pulizia', async () => {
  verificaAutorizzazione()
  verificaNonProduzione(progetto().ref)
  const c = creaContatore('passo4-pulizia')
  const registro = apriUltimoRegistro()
  if (!registro) throw new Error('nessun registro: niente da pulire')
  if (registro.dati.pulito) { console.log('registro già pulito: nulla da fare'); return }
  c.esigi('fotografia di base presente e completa nel registro',
    validaFotografia0023(registro.dati.fotografiaBase),
    'senza base non si può verificare il ritorno allo stato iniziale')

  // piano per identificativi esatti; progresso annotato nel registro
  const piano = pianoPulizia0023({ docIds: registro.dati.docIds })
  const da = (registro.dati.puliziaArrivataA ?? -1) + 1
  for (let i = da; i < piano.length; i++) {
    await sql(piano[i])
    registro.segna('puliziaArrivataA', i)
  }
  c.attesa(`piano eseguito (${piano.length} istruzioni, ripreso da ${da})`, true)

  // la funzione NON deve più esistere; i documenti del collaudo nemmeno
  const residuoFn = await sql(`select count(*)::int as n from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='${FUNZIONE_0023}'`)
  c.esigi('funzione 0023 rimossa', residuoFn[0].n === 0)
  const ids = registro.dati.docIds.map(id => `'${id}'`).join(',') || `'00000000-0000-0000-0000-000000000000'`
  const residuoDoc = await sql(`select count(*)::int as n from public.family_documents where id in (${ids})`)
  c.esigi('nessun documento del collaudo residuo', residuoDoc[0].n === 0)

  // fotografia finale IDENTICA alla base (conteggi, impronte, permessi,
  // definizioni legacy, EXECUTE): il progetto torna com'era
  const finale = await fotografiaBase()
  c.esigi('fotografia finale IDENTICA alla base',
    JSON.stringify(finale) === JSON.stringify(registro.dati.fotografiaBase),
    'differenze da esaminare PRIMA di marcare pulito')

  registro.segna('pulito', true)
  c.chiudi()
  console.log('\nRegistro marcato pulito. Ricordare a fine collaudo: cancellare il file del token e REVOCARLO dal dashboard; nuovo reset della password del db di prova.')
})
