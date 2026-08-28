#!/usr/bin/env node
// Crea il progetto Supabase di PROVA (gratuito) per la Fase 2B, aspetta che
// sia attivo e salva ref + chiavi in ~/.gestionale-2b/progetto.json (600).
// Se la piattaforma chiedesse un piano a pagamento: STOP senza acquistare.
import { randomBytes } from 'node:crypto'
import { mgmt, salvaProgetto, progettoEsiste, progetto, NOME_PROGETTO, maschera } from './api.mjs'
import { refProduzione } from './guardia.mjs'

if (progettoEsiste()) {
  console.log('Progetto di prova già registrato:', maschera(progetto().ref))
  process.exit(0)
}

const orgs = await (await mgmt('/organizations')).json()
if (!Array.isArray(orgs) || orgs.length !== 1) {
  console.error('Attese esattamente 1 organizzazione, trovate:', orgs.length ?? '?'); process.exit(1)
}
const org = orgs[0]

const dbPass = randomBytes(24).toString('base64url')
console.log('Creo il progetto di prova (regione eu-central-1, piano free)…')
const r = await mgmt('/projects', {
  method: 'POST',
  body: JSON.stringify({
    name: NOME_PROGETTO,
    organization_id: org.id,
    region: 'eu-central-1',
    db_pass: dbPass,
    desired_instance_size: undefined,
  }),
})
if (!r.ok) {
  const msg = await r.text()
  if (/pay|plan|billing|quota|exceed|upgrade/i.test(msg)) {
    console.error('STOP: la creazione richiederebbe un piano a pagamento o supera la quota gratuita. Nessun acquisto effettuato.')
  }
  console.error('Creazione fallita:', r.status, msg.slice(0, 300).replace(refProduzione(), '***'))
  process.exit(1)
}
const proj = await r.json()
console.log('Creato:', maschera(proj.id), '| stato iniziale:', proj.status)

// attesa dell'attivazione
let stato = proj.status
for (let i = 0; i < 60 && stato !== 'ACTIVE_HEALTHY'; i++) {
  await new Promise(x => setTimeout(x, 10000))
  const s = await (await mgmt(`/projects/${proj.id}`)).json()
  stato = s.status
  if (i % 3 === 0) console.log('  stato:', stato)
}
if (stato !== 'ACTIVE_HEALTHY') { console.error('Il progetto non è diventato attivo in tempo:', stato); process.exit(1) }

// chiavi API del progetto di prova
const chiavi = await (await mgmt(`/projects/${proj.id}/api-keys?reveal=true`)).json()
const anon = chiavi.find(k => k.name === 'anon' || k.type === 'publishable' || k.name === 'sb_publishable')
const service = chiavi.find(k => k.name === 'service_role' || k.type === 'secret' || k.name === 'sb_secret')
if (!anon || !service) {
  console.error('Chiavi non trovate; tipi disponibili:', chiavi.map(k => k.name || k.type).join(', '))
  process.exit(1)
}
salvaProgetto({
  ref: proj.id,
  anon_key: anon.api_key,
  service_key: service.api_key,
  db_pass: dbPass,
  creato_il: new Date().toISOString(),
  nome: NOME_PROGETTO,
})
console.log('Progetto di prova pronto:', maschera(proj.id), '(chiavi salvate fuori dal repo, permessi 600)')
