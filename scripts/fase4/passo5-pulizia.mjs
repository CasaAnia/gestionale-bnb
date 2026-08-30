#!/usr/bin/env node
// ============================================================================
// Fase 4 · collaudo 0022 — PASSO 5: pulizia PRECISA dei soli artefatti
// sintetici creati dal collaudo, identificati così:
//  · documenti con upload_token NON nullo (il token nasce SOLO dalla RPC
//    della 0022: sul progetto di prova nessun altro dato lo possiede) e le
//    loro ricevute;
//  · oggetti storage nei prefissi-data del collaudo (2026-09-01/02/03),
//    estranei ai file finti della fixture 2B (verificato prima di toccare);
//  · utenti sintetici collaudo-0022-*/debug5-* @prova.locale e le loro
//    righe in app_members.
// Alla fine: confronto col bilancio PRE-collaudo (passo 1).
// ============================================================================
import { sql, rest, maschera, progetto } from '../fase2b/api.mjs'

console.log('Bersaglio:', maschera(progetto().ref))
const BASE = { family_documents: 98, family_receipts: 83, family_expenses: 232, app_members: 1, oggetti: 81 }

// 1) documenti e ricevute del collaudo (via upload_token)
const doc = await sql(`select count(*) as n from public.family_documents where upload_token is not null`)
const ric = await sql(`delete from public.family_receipts where document_id in
  (select id from public.family_documents where upload_token is not null) returning id`)
const docVia = await sql(`delete from public.family_documents where upload_token is not null returning id`)
console.log(`documenti del collaudo eliminati: ${docVia.length} (ricevute: ${ric.length}; attesi ${doc[0].n})`)

// 2) oggetti storage nei prefissi del collaudo (con controllo preventivo)
let oggettiVia = 0
for (const prefisso of ['2026-09-01', '2026-09-02', '2026-09-03']) {
  const lista = await rest('/storage/v1/object/list/scontrini', 'service', {
    method: 'POST', body: JSON.stringify({ prefix: prefisso, limit: 1000 }),
  })
  if (!lista.ok) { console.error('lista storage fallita per', prefisso); process.exit(1) }
  const nomi = (await lista.json()).map(o => `${prefisso}/${o.name}`)
  // SOLO percorsi nel formato del collaudo (<data>/<uuid>-p<n>.<ext>)
  const nostri = nomi.filter(n => /^\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}-p\d+\.[a-z0-9]+$/.test(n))
  if (nostri.length !== nomi.length) {
    console.error('STOP: nel prefisso', prefisso, 'ci sono oggetti fuori formato collaudo:', nomi.filter(n => !nostri.includes(n)))
    process.exit(1)
  }
  if (nostri.length) {
    const via = await rest('/storage/v1/object/scontrini', 'service', {
      method: 'DELETE', body: JSON.stringify({ prefixes: nostri }),
    })
    if (!via.ok) { console.error('cancellazione storage fallita:', via.status, await via.text()); process.exit(1) }
    oggettiVia += nostri.length
  }
}
console.log('oggetti storage del collaudo eliminati:', oggettiVia)

// 3) utenti sintetici e appartenenze
const utenti = await sql(`select id, email from auth.users where email like 'collaudo-0022-%@prova.locale' or email like 'debug5-%@prova.locale'`)
for (const u of utenti) {
  await sql(`delete from public.app_members where user_id='${u.id}'`)
  const via = await rest(`/auth/v1/admin/users/${u.id}`, 'service', { method: 'DELETE' })
  if (!via.ok) { console.error('utente non eliminato:', u.email); process.exit(1) }
}
console.log('utenti sintetici eliminati:', utenti.length)

// 4) bilancio finale contro la fotografia PRE-collaudo
const dopo = {}
for (const t of ['family_documents', 'family_receipts', 'family_expenses', 'app_members']) {
  dopo[t] = (await sql(`select count(*) as n from public.${t}`))[0].n
}
dopo.oggetti = (await sql(`select count(*) as n from storage.objects`))[0].n
console.log('bilancio finale:', JSON.stringify(dopo))
let ok = true
for (const k of Object.keys(BASE)) if (dopo[k] !== BASE[k]) { ok = false; console.error(`✗ ${k}: ${dopo[k]} ≠ base ${BASE[k]}`) }
// e nessun residuo con token
const residui = await sql(`select count(*) as n from public.family_documents where upload_token is not null`)
if (residui[0].n !== 0) { ok = false; console.error('✗ residui con upload_token:', residui[0].n) }
console.log(ok ? '✓ PULIZIA COMPLETA: il progetto di prova è tornato ESATTAMENTE allo stato pre-collaudo (0022 e 0021 restano applicate, come voluto)' : '✗ PULIZIA INCOMPLETA')
process.exit(ok ? 0 : 1)
