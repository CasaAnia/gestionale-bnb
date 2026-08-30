#!/usr/bin/env node
// ============================================================================
// Fase 4 · collaudo 0022 — PASSO 0: riaggancio del progetto di prova della
// 2B. NON crea progetti (se quello di prova non c'è: STOP), non tocca la
// produzione (guardia), non azzera nulla. Ricostruisce ~/.gestionale-2b/
// progetto.json con ref e chiavi API lette dalla Management API.
// ============================================================================
import { mgmt, salvaProgetto, NOME_PROGETTO, maschera } from '../fase2b/api.mjs'
import { verificaNonProduzione } from '../fase2b/guardia.mjs'

const r = await mgmt('/projects')
if (!r.ok) { console.error('Management API non raggiungibile:', r.status); process.exit(1) }
const progetti = await r.json()
const candidati = progetti.filter(p => p.name === NOME_PROGETTO)
if (candidati.length !== 1) {
  console.error(`STOP: atteso ESATTAMENTE il progetto di prova della 2B ("${NOME_PROGETTO}"), trovati: ${candidati.length}. Nessun progetto viene creato.`)
  process.exit(1)
}
const prova = candidati[0]
verificaNonProduzione(prova.id)
if (prova.status !== 'ACTIVE_HEALTHY') {
  console.error(`Il progetto di prova non è attivo (stato: ${prova.status}). Se è in pausa va ripristinato dal dashboard (gratuito); nessuna azione automatica.`)
  process.exit(1)
}

const chiavi = await (await mgmt(`/projects/${prova.id}/api-keys?reveal=true`)).json()
const anon = chiavi.find(k => k.name === 'anon' || k.type === 'publishable' || k.name === 'sb_publishable')
const service = chiavi.find(k => k.name === 'service_role' || k.type === 'secret' || k.name === 'sb_secret')
if (!anon?.api_key || !service?.api_key) {
  console.error('Chiavi API del progetto di prova non leggibili'); process.exit(1)
}
salvaProgetto({ ref: prova.id, anon_key: anon.api_key, service_key: service.api_key })
console.log(`Riagganciato il progetto di prova ${maschera(prova.id)} (ACTIVE_HEALTHY); chiavi salvate fuori dal repo (600). Nessuna scrittura sul progetto.`)
