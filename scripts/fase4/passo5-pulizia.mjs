#!/usr/bin/env node
// ============================================================================
// Fase 4 · collaudo 0022 — PASSO 5: pulizia guidata ESCLUSIVAMENTE dai
// registri incrementali (token, ID documento, percorsi, utenti annotati
// giro per giro, anche nei giri interrotti). NESSUNA cancellazione
// generica per "upload_token non nullo" o per prefisso-data.
// Alla fine: "stato invariato" dichiarato confrontando CONTEGGI E IMPRONTE
// md5 riga per riga con la fotografia automatica del passo 1 — mai numeri
// scritti a mano.
// ============================================================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sql, rest, maschera, progetto } from '../fase2b/api.mjs'
import { cartellaRegistri, IMPRONTA_INIZIALE, marcaPulito, tuttiIRegistri } from './registro.mjs'
import { improntaStato } from './impronta.mjs'

console.log('Bersaglio:', maschera(progetto().ref))
const daPulire = tuttiIRegistri().filter(r => !r.dati.pulito)
console.log('registri da ripulire:', daPulire.length)

const sicuro = (v) => /^[0-9a-zA-Z_/.-]+$/.test(String(v))   // id/percorsi: mai SQL arbitrario
let ricevuteVia = 0, documentiVia = 0, oggettiVia = 0, utentiVia = 0

for (const r of daPulire) {
  const { documenti = [], percorsi = [], estranei = [], utenti = [] } = r.dati
  // 1) ricevute e documenti, SOLO per gli id registrati
  for (const id of documenti.filter(sicuro)) {
    ricevuteVia += (await sql(`delete from public.family_receipts where document_id='${id}' returning id`)).length
    documentiVia += (await sql(`delete from public.family_documents where id='${id}' returning id`)).length
  }
  // 2) oggetti storage, SOLO i percorsi esatti registrati (già rimossi = ok)
  const daTogliere = [...new Set([...percorsi, ...estranei])].filter(sicuro)
  if (daTogliere.length) {
    const via = await rest('/storage/v1/object/scontrini', 'service', {
      method: 'DELETE', body: JSON.stringify({ prefixes: daTogliere }),
    })
    if (via.ok) oggettiVia += daTogliere.length
    else if (via.status !== 404) { console.error('cancellazione storage fallita:', via.status, await via.text()); process.exit(1) }
  }
  // 3) utenti sintetici registrati (appartenenza + account)
  for (const id of utenti.filter(sicuro)) {
    await sql(`delete from public.app_members where user_id='${id}'`)
    const via = await rest(`/auth/v1/admin/users/${id}`, 'service', { method: 'DELETE' })
    if (via.ok) utentiVia++
    else if (via.status !== 404) { console.error('utente non eliminato:', id); process.exit(1) }
  }
  marcaPulito(r)
  console.log(`registro ${r.file.split('/').pop()} ripulito (${documenti.length} documenti, ${daTogliere.length} percorsi, ${utenti.length} utenti)`)
}
console.log(`eliminati: ${documentiVia} documenti, ${ricevuteVia} ricevute, ~${oggettiVia} oggetti richiesti, ${utentiVia} utenti`)

// 4) STATO INVARIATO: conteggi E impronte contro la fotografia del passo 1
const iniziale = JSON.parse(readFileSync(join(cartellaRegistri(), IMPRONTA_INIZIALE), 'utf8'))
const finale = await improntaStato()
let ok = true
for (const t of Object.keys(iniziale)) {
  const uguale = finale[t] && finale[t].n === iniziale[t].n && finale[t].impronta === iniziale[t].impronta
  if (!uguale) {
    ok = false
    console.error(`✗ ${t}: iniziale n=${iniziale[t].n} impronta=${iniziale[t].impronta.slice(0, 8)}… · finale n=${finale[t]?.n} impronta=${finale[t]?.impronta.slice(0, 8)}…`)
  }
}
console.log(ok
  ? '✓ PULIZIA COMPLETA: conteggi e IMPRONTE riga per riga identici alla fotografia pre-collaudo'
  : '✗ STATO NON INVARIATO: differenze qui sopra (indagare prima di riprovare)')
process.exit(ok ? 0 : 1)
