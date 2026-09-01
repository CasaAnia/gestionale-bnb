#!/usr/bin/env node
// ============================================================================
// Collaudo 0023 · PASSO 1 — fotografia di base, applicazione della BOZZA
// sul SOLO progetto di prova, verifica della STRUTTURA (firma, security
// definer, search_path, privilegi EXECUTE). STOP alla prima verifica
// fallita. Richiede: autorizzazione esplicita (cancello), riaggancio già
// fatto (fase4/passo0), REGISTRO_DIR esportata.
// ============================================================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { progetto, sql } from '../fase2b/api.mjs'
import { verificaNonProduzione } from '../fase2b/guardia.mjs'
import { creaContatore, eseguiPasso } from '../collaudo-contratto/strumenti.mjs'
import { fotografiaBase, RADICE } from '../collaudo-contratto/ambiente.mjs'
import { nuovoRegistro } from '../collaudo-contratto/registro.mjs'
import {
  BOZZA_0023, FIRMA_0023, FUNZIONE_0023, problemiBozza, problemiStruttura,
  validaFotografia0023, verificaAutorizzazione,
} from './strumenti0023.mjs'

await eseguiPasso('passo1-struttura', async () => {
  verificaAutorizzazione()
  verificaNonProduzione(progetto().ref)
  const c = creaContatore('passo1-struttura')

  // la bozza nel repository deve rispettare ANCORA i vincoli R6
  const testoBozza = readFileSync(join(RADICE, BOZZA_0023), 'utf8')
  const staticamente = problemiBozza(testoBozza)
  c.esigi('bozza 0023 conforme in locale', staticamente.length === 0, staticamente.join('; '))

  // registro durevole + fotografia di base PRIMA di ogni effetto
  const registro = nuovoRegistro()
  const base = await fotografiaBase()
  c.esigi('fotografia di base completa', validaFotografia0023(base))
  registro.segna('fotografiaBase', base)

  // la funzione NON deve già esistere (base pulita, mai sovrascritture cieche)
  const gia = await sql(`select count(*)::int as n from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='${FUNZIONE_0023}'`)
  c.esigi('base pulita: funzione assente prima dell\'applicazione', gia[0].n === 0,
    'residuo di un giro precedente: eseguire prima passo4-pulizia')

  // applicazione della bozza (unica istruzione multi-statement)
  await sql(testoBozza)
  registro.segna('bozza0023Applicata', true)

  // struttura dal catalogo, giudicata dalla logica testata in locale
  const funzioni = await sql(`select p.proname as nome,
      oidvectortypes(p.proargtypes) as tipi, p.prosecdef as secdef,
      array_to_string(p.proconfig, ';') as config
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='${FUNZIONE_0023}'`)
  const esecuzioni = await sql(`select routine_name, grantee
    from information_schema.routine_privileges
    where privilege_type='EXECUTE' and routine_schema='public'
      and routine_name='${FUNZIONE_0023}'`)
  const problemi = problemiStruttura({ funzioni, esecuzioni })
  c.esigi('struttura conforme (firma ' + FIRMA_0023 + ', secdef, search_path, grants)',
    problemi.length === 0, problemi.join('; '))

  c.chiudi()
  console.log(`\nRegistro: ${registro.file}`)
})
