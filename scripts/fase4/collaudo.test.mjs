// ============================================================================
// Test LOCALI degli strumenti di collaudo (Fase 4) con servizi SIMULATI:
// coprono esattamente i casi riprodotti dalla revisione del commit 25040c7.
// Esecuzione: node --test scripts/fase4/  (fa parte dei "controlli degli
// script", separato dalla suite dell'applicazione).
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eseguiCaso, microsecondi, misuraCompleta, provaValida, riepilogo } from './concorrenza.mjs'
import { eseguiPulizia, validaPreliminari } from './pulizia.mjs'

// ---- 1. concorrenza: i rami in errore devono restare MISURATI --------------

test('concorrenza: ramo in errore SENZA misure → prova NON valida (il caso riprodotto)', () => {
  const buono = { pid: 11, prima: '2026-09-05T10:00:00.100Z', dopo: '2026-09-05T10:00:00.900Z', r: { document_id: 'd1' } }
  const erroreSenzaMisure = { errore: 'TOKEN_RIUSATO' }          // PRIMA: sovrapposti() diceva true
  assert.equal(misuraCompleta(erroreSenzaMisure), false)
  assert.equal(provaValida(buono, erroreSenzaMisure).valida, false)
  assert.ok(provaValida(buono, erroreSenzaMisure).motivo.includes('misure'))
})

test('concorrenza: stesso pid o finestre disgiunte → NON valida; misurata e sovrapposta → valida', () => {
  const a = { pid: 11, prima: '2026-09-05T10:00:00.100Z', dopo: '2026-09-05T10:00:00.900Z' }
  const stessoPid = { ...a }
  assert.equal(provaValida(a, stessoPid).valida, false)
  const disgiunto = { pid: 12, prima: '2026-09-05T10:00:01.000Z', dopo: '2026-09-05T10:00:01.500Z' }
  assert.equal(provaValida(a, disgiunto).valida, false)
  assert.ok(provaValida(a, disgiunto).motivo.includes('disgiunte'))
  // un ramo in ERRORE ATTESO ma CON le misure è giudicabile
  const erroreMisurato = { pid: 12, prima: '2026-09-05T10:00:00.200Z', dopo: '2026-09-05T10:00:00.800Z', errore: 'GIA_IN_ARCHIVIO' }
  assert.equal(provaValida(a, erroreMisurato).valida, true)
})

// ---- 2. pulizia: servizi simulati che conservano lo stato ------------------

function mondoFinto() {
  const stato = {
    documenti: [],   // { id, token }
    ricevute: [],    // { document_id, storage_path }
    oggetti: new Set(),
    utenti: [],      // { id, email }
    membri: new Set(),
  }
  const servizi = {
    async documentiDaToken(tokens) { return stato.documenti.filter(d => tokens.includes(d.token)) },
    async eliminaRicevuteDiDocumento(id) {
      const n = stato.ricevute.filter(r => r.document_id === id).length
      stato.ricevute = stato.ricevute.filter(r => r.document_id !== id)
      return n
    },
    async eliminaDocumento(id) {
      const n = stato.documenti.filter(d => d.id === id).length
      stato.documenti = stato.documenti.filter(d => d.id !== id)
      return n
    },
    async ricevutaCheUsaPercorso(p) { return stato.ricevute.some(r => r.storage_path === p) },
    async eliminaOggetto(p) { return stato.oggetti.delete(p) },
    async utentiDaIdentita(emails) { return stato.utenti.filter(u => emails.includes(u.email)) },
    async rimuoviAppartenenza(id) { stato.membri.delete(id) },
    async eliminaUtente(id) {
      const c = stato.utenti.length
      stato.utenti = stato.utenti.filter(u => u.id !== id)
      return stato.utenti.length < c
    },
    async residuiRegistro(dati) {
      const percorsi = [...(dati.percorsi ?? []), ...(dati.estranei ?? [])]
      return {
        documentiConToken: stato.documenti.filter(d => (dati.tokens ?? []).includes(d.token)).length,
        documentiConId: stato.documenti.filter(d => (dati.documenti ?? []).includes(d.id)).length,
        ricevuteSuiPercorsi: stato.ricevute.filter(r => percorsi.includes(r.storage_path)).length,
        oggettiSuiPercorsi: [...stato.oggetti].filter(o => percorsi.includes(o)).length,
        utenti: stato.utenti.filter(u => (dati.identita ?? []).includes(u.email)).length,
      }
    },
    async marcaPulito(r) { r.dati.pulito = true },
  }
  return { stato, servizi }
}
const registro = (dati) => ({ file: 'finto.json', dati: { pulito: false, tokens: [], documenti: [], percorsi: [], estranei: [], utenti: [], identita: [], ...dati } })

test('IL CASO RIPRODOTTO: registro con token+percorso ma senza documentId → il documento si RECUPERA dal token, niente allegati orfanati', async () => {
  const { stato, servizi } = mondoFinto()
  // registrazione riuscita, risposta persa PRIMA di annotare l'id
  stato.documenti.push({ id: 'doc-9', token: 'tok-perso' })
  stato.ricevute.push({ document_id: 'doc-9', storage_path: 'p/tok-perso-p1.jpg' })
  stato.oggetti.add('p/tok-perso-p1.jpg')
  const r = registro({ tokens: ['tok-perso'], percorsi: ['p/tok-perso-p1.jpg'] })
  const b = await eseguiPulizia([r], servizi)
  // PRIMA: il documento restava, il file veniva cancellato (ricevuta appesa)
  // e il registro veniva marcato pulito lo stesso
  assert.equal(b.documenti, 1)                    // recuperato via token ed eliminato
  assert.equal(b.ricevute, 1)
  assert.equal(stato.oggetti.size, 0)             // il file va via SOLO dopo la ricevuta
  assert.equal(r.dati.pulito, true)
  assert.equal(b.problemi.length, 0)
})

test('un file ANCORA USATO da una ricevuta (non recuperabile dal registro) NON si cancella e il registro resta aperto', async () => {
  const { stato, servizi } = mondoFinto()
  // una ricevuta ALTRUI usa il percorso registrato (stato anomalo): mai
  // cancellare l'allegato lasciandola appesa
  stato.ricevute.push({ document_id: 'doc-altrui', storage_path: 'p/conteso-p1.jpg' })
  stato.oggetti.add('p/conteso-p1.jpg')
  const r = registro({ percorsi: ['p/conteso-p1.jpg'] })
  const b = await eseguiPulizia([r], servizi)
  assert.ok(stato.oggetti.has('p/conteso-p1.jpg'))
  assert.equal(r.dati.pulito, false)              // PRIMA: pulito lo stesso
  assert.ok(b.problemi[0].problemi[0].includes('NON cancellato'))
})

test('utente creato ma risposta persa: recuperato dall\'IDENTITÀ esatta registrata prima della richiesta', async () => {
  const { stato, servizi } = mondoFinto()
  stato.utenti.push({ id: 'u-1', email: 'collaudo-x@prova.locale' })
  stato.membri.add('u-1')
  const r = registro({ identita: ['collaudo-x@prova.locale'] })   // utenti: [] (id mai saputo)
  const b = await eseguiPulizia([r], servizi)
  assert.equal(b.utenti, 1)
  assert.equal(stato.utenti.length, 0)
  assert.equal(r.dati.pulito, true)
})

test('errore di un servizio: il registro resta RECUPERABILE, mai marcato pulito', async () => {
  const { servizi } = mondoFinto()
  servizi.documentiDaToken = async () => { throw new Error('rete giù') }
  const r = registro({ tokens: ['tok-x'] })
  const b = await eseguiPulizia([r], servizi)
  assert.equal(r.dati.pulito, false)
  assert.equal(b.aperti, 1)
  assert.ok(b.problemi[0].problemi[0].includes('rete giù'))
})

test('residui trovati alla verifica finale: registro APERTO anche se le cancellazioni non hanno dato errori', async () => {
  const { stato, servizi } = mondoFinto()
  // un documento col nostro token che la risoluzione non ha visto (comparso
  // tra risoluzione e verifica): i residui lo scoprono
  const residuiVeri = servizi.residuiRegistro
  servizi.documentiDaToken = async () => []
  stato.documenti.push({ id: 'doc-fantasma', token: 'tok-f' })
  const r = registro({ tokens: ['tok-f'] })
  const b = await eseguiPulizia([r], servizi)
  assert.equal(r.dati.pulito, false)
  assert.ok(b.problemi[0].problemi.some(p => p.includes('documentiConToken')))
  void residuiVeri
})

// ---- 3. fotografia: validazione OBBLIGATORIA prima delle cancellazioni ----

const CHIAVI = ['family_documents', 'storage.objects', 'auth.users']
const fotoBuona = Object.fromEntries(CHIAVI.map(k => [k, { n: 3, impronta: 'abc123' }]))

test('IL CASO RIPRODOTTO: fotografia {} → blocco, non un confronto verde a vuoto', () => {
  const v = validaPreliminari({ fotografia: {}, chiaviAttese: CHIAVI, registri: [] })
  assert.equal(v.ok, false)                       // PRIMA: {} passava e il confronto era verde
  assert.ok(v.controlli.some(c => !c.ok && c.nome.includes('completa')))
})

test('fotografia assente, voce senza impronta o registro rotto → blocco; tutto valido → passa', () => {
  assert.equal(validaPreliminari({ fotografia: null, chiaviAttese: CHIAVI, registri: [] }).ok, false)
  const zoppa = { ...fotoBuona, 'auth.users': { n: 3 } }        // impronta mancante
  assert.equal(validaPreliminari({ fotografia: zoppa, chiaviAttese: CHIAVI, registri: [] }).ok, false)
  const registroRotto = [{ file: 'x', dati: { pulito: false, tokens: 'NON-UN-ARRAY' } }]
  assert.equal(validaPreliminari({ fotografia: fotoBuona, chiaviAttese: CHIAVI, registri: registroRotto }).ok, false)
  const v = validaPreliminari({
    fotografia: fotoBuona, chiaviAttese: CHIAVI,
    registri: [{ file: 'x', dati: { pulito: false, tokens: [], documenti: [] } }],
  })
  assert.equal(v.ok, true)
  assert.ok(v.controlli.length >= 4)              // elenco OBBLIGATORIO delle verifiche
})


// ---- 4. orchestratore: catena ATTESA, mai verdi con verifiche in corso ----

const ritardo = (ms, v) => new Promise(r => setTimeout(() => r(v), ms))
const ramoOk = (pid, prima, dopo) => ({ pid, prima, dopo, r: { document_id: 'd1' } })
const FIN_A = ['2026-09-05T10:00:00.100000Z', '2026-09-05T10:00:00.900000Z']
const FIN_B = ['2026-09-05T10:00:00.200000Z', '2026-09-05T10:00:00.800000Z']

test('IL CASO RIPRODOTTO: rami ritardati + verifica fallita → il risultato ARRIVA e il riepilogo è rosso (niente 0/0/0 verdi)', async () => {
  let verificaFinita = false
  const e = await eseguiCaso(
    ritardo(20, ramoOk(11, ...FIN_A)),
    ritardo(30, ramoOk(12, ...FIN_B)),
    async () => { await ritardo(20); verificaFinita = true; return { ok: false, dettaglio: 'conteggio sbagliato' } },
  )
  assert.equal(verificaFinita, true)              // la verifica è stata ATTESA
  assert.equal(e.stato, 'fallito')                // PRIMA: il processo usciva 0 con 0/0/0
  const r = riepilogo([e], 3)
  assert.equal(r.ok, false)                       // e comunque 1 caso su 3 non basta
  assert.equal(riepilogo([], 3).ok, false)        // zero casi completati ≠ successo
})

test('orchestratore: verifica che LANCIA → fallito; misure mancanti → non_valido; tre passati → riepilogo verde', async () => {
  const scoppia = await eseguiCaso(
    ritardo(5, ramoOk(11, ...FIN_A)), ritardo(5, ramoOk(12, ...FIN_B)),
    async () => { throw new Error('select rotta') },
  )
  assert.equal(scoppia.stato, 'fallito')
  assert.ok(scoppia.dettaglio.includes('select rotta'))
  const senzaMisure = await eseguiCaso(
    ritardo(5, ramoOk(11, ...FIN_A)), ritardo(5, { errore: 'TOKEN_RIUSATO' }),
    async () => ({ ok: true }),
  )
  assert.equal(senzaMisure.stato, 'non_valido')
  const passato = await eseguiCaso(
    ritardo(5, ramoOk(11, ...FIN_A)), ritardo(5, ramoOk(12, ...FIN_B)),
    async () => ({ ok: true }),
  )
  assert.equal(riepilogo([passato, passato, passato], 3).ok, true)
})

// ---- 5. precisione temporale: microsecondi, sovrapposizione EFFETTIVA -----

test('IL CASO RIPRODOTTO: due finestre nello stesso millisecondo ma disgiunte al microsecondo → NON sovrapposte', () => {
  // .100100–.100200 contro .100800–.100900: getTime() le schiaccerebbe
  // tutte su .100 e sembravano sovrapposte
  const a = { pid: 11, prima: '2026-09-05T10:00:00.100100Z', dopo: '2026-09-05T10:00:00.100200Z' }
  const b = { pid: 12, prima: '2026-09-05T10:00:00.100800Z', dopo: '2026-09-05T10:00:00.100900Z' }
  assert.equal(microsecondi(a.prima) < microsecondi(b.prima), true)
  const v = provaValida(a, b)
  assert.equal(v.valida, false)                   // PRIMA: valida
  assert.ok(v.motivo.includes('disgiunte'))
  // il semplice CONTATTO fra estremi non è sovrapposizione effettiva
  const c = { pid: 12, prima: a.dopo, dopo: '2026-09-05T10:00:00.100500Z' }
  assert.equal(provaValida(a, c).valida, false)
  // sovrapposizione vera al microsecondo → valida
  const d = { pid: 12, prima: '2026-09-05T10:00:00.100150Z', dopo: '2026-09-05T10:00:00.100500Z' }
  assert.equal(provaValida(a, d).valida, true)
})

// ---- 6. estraneo interrotto FRA effetto remoto e risposta -----------------

test('IL CASO RIPRODOTTO: upload dell\'estraneo riuscito ma risposta persa → il registro (annotato PRIMA) fa rimuovere SOLO quell\'oggetto', async () => {
  const { stato, servizi } = mondoFinto()
  // il percorso è nel registro PRIMA dell'upload; l'interruzione arriva
  // dopo l'effetto remoto e prima della risposta (nessun documento)
  stato.oggetti.add('p/estraneo-p1.jpg')
  stato.oggetti.add('p/di-altri.jpg')             // roba NON nostra: intoccabile
  const r = registro({ tokens: ['tok-estraneo'], estranei: ['p/estraneo-p1.jpg'] })
  const b = await eseguiPulizia([r], servizi)
  assert.equal(stato.oggetti.has('p/estraneo-p1.jpg'), false)   // rimosso via registro
  assert.equal(stato.oggetti.has('p/di-altri.jpg'), true)       // il resto è intatto
  assert.equal(r.dati.pulito, true)
  assert.equal(b.problemi.length, 0)
})

test('upload dell\'estraneo MAI avvenuto (interrotto prima dell\'effetto): pulizia senza errori, nulla da rimuovere', async () => {
  const { stato, servizi } = mondoFinto()
  const r = registro({ tokens: ['tok-mai'], estranei: ['p/mai-caricato-p1.jpg'] })
  const b = await eseguiPulizia([r], servizi)
  assert.equal(b.oggetti, 0)
  assert.equal(b.documenti, 0)
  assert.equal(r.dati.pulito, true)               // niente residui: chiuso
  assert.equal(stato.oggetti.size, 0)
})
// ---- 7. verificatore dell'audit: mai più verdi non verificati -------------
import { matricePolicy, verificaPolicy, verificaRpc, verificaTabelleRls, TABELLE_ATTESE, RPC_ATTESE } from './verificaAudit.mjs'

// osservazioni CONFORMI, rese come le renderebbe pg_policies
const RESA = {
  [`(select private.is_app_member())`.replace(/\s/g, '')]: '( SELECT private.is_app_member() AS is_app_member)',
  [`(select private.is_app_owner())`.replace(/\s/g, '')]: '( SELECT private.is_app_owner() AS is_app_owner)',
}
const resa = (c) => c === '' ? ''
  : RESA[c] ?? `((bucket_id = 'scontrini'::text) AND ( SELECT private.is_app_member() AS is_app_member))`
const policyConformi = () => matricePolicy().map(a => ({
  schemaname: a.schema, tablename: a.tabella, policyname: a.nome,
  roles: '{authenticated}', cmd: a.cmd, permissive: 'PERMISSIVE',
  qual: resa(a.qual), with_check: resa(a.check),
}))

test('FALSO VERDE riprodotto: 4 policy storage col nome giusto ma ruolo anon e condizione true → ROSSO', () => {
  const oss = policyConformi().map(p =>
    p.schemaname === 'storage' ? { ...p, roles: '{anon}', qual: 'true', with_check: p.with_check ? 'true' : '' } : p)
  const v = verificaPolicy(oss)
  assert.equal(v.ok, false)                        // PRIMA: contava 4 nomi e passava
  assert.ok(v.differenze.some(d => d.includes('scontrini_membri_select')))
})

test('FALSO VERDE riprodotto: policy di app_members del tutto ASSENTI → ROSSO', () => {
  const oss = policyConformi().filter(p => p.tablename !== 'app_members')
  const v = verificaPolicy(oss)
  assert.equal(v.ok, false)                        // PRIMA: app_members non era validata
  assert.ok(v.differenze.some(d => d.includes('ASSENTE: public.app_members.app_members_lettura_membri')))
  assert.ok(v.differenze.some(d => d.includes('app_members_gestione_owner')))
})

test('FALSO VERDE riprodotto: family con "is_app_member() OR true" → ROSSO (uguaglianza, non sottostringa)', () => {
  const oss = policyConformi().map(p =>
    p.policyname === 'family_expenses_solo_membri'
      ? { ...p, qual: '(( SELECT private.is_app_member() AS is_app_member) OR true)' } : p)
  const v = verificaPolicy(oss)
  assert.equal(v.ok, false)                        // PRIMA: la sottostringa bastava
  assert.ok(v.differenze.some(d => d.includes('family_expenses') && d.includes('USING')))
})

test('policy AGGIUNTIVA: mai dichiarata innocua, è una differenza da analizzare', () => {
  const oss = [...policyConformi(), {
    schemaname: 'storage', tablename: 'objects', policyname: 'apertura_totale',
    roles: '{anon}', cmd: 'ALL', permissive: 'PERMISSIVE', qual: 'true', with_check: 'true',
  }]
  const v = verificaPolicy(oss)
  assert.equal(v.ok, false)
  assert.ok(v.differenze.some(d => d.includes('AGGIUNTIVA da analizzare') && d.includes('apertura_totale')))
})

test('FALSO VERDE riprodotto: storage.objects assente ma COMPENSATA da una tabella family in più → ROSSO', () => {
  const oss = TABELLE_ATTESE.filter(t => t !== 'storage.objects')
    .map(t => ({ schema: t.split('.')[0], tabella: t.split('.')[1], rls: true }))
  oss.push({ schema: 'public', tabella: 'family_inventata', rls: true })   // stesso CONTEGGIO
  const v = verificaTabelleRls(oss)
  assert.equal(v.ok, false)                        // PRIMA: 18 = 18 e passava
  assert.ok(v.differenze.some(d => d.includes('ASSENTE: storage.objects')))
  assert.ok(v.differenze.some(d => d.includes('family_inventata')))
})

test('FALSO VERDE riprodotto: scarta_documento assente, COMPENSATA da un secondo overload di conferma_documento → ROSSO', () => {
  const base = Object.entries(RPC_ATTESE).map(([nome, firma]) =>
    ({ proname: nome, firma, autenticato: true, anonimo: false, service: false }))
  const oss = base.filter(o => o.proname !== 'scarta_documento')
  oss.push({ proname: 'conferma_documento', firma: 'uuid', autenticato: true, anonimo: false, service: false })
  const v = verificaRpc(oss)                       // sempre 5 righe: il conteggio non vede nulla
  assert.equal(v.ok, false)
  assert.ok(v.differenze.some(d => d.includes('ASSENTE: scarta_documento')))
  assert.ok(v.differenze.some(d => d.includes('OVERLOAD')))
})

test('caso CONFORME completo (rendering realistico di pg_policies): tutto verde', () => {
  assert.equal(verificaPolicy(policyConformi()).ok, true)
  assert.equal(verificaTabelleRls(TABELLE_ATTESE.map(t =>
    ({ schema: t.split('.')[0], tabella: t.split('.')[1], rls: true }))).ok, true)
  assert.equal(verificaRpc(Object.entries(RPC_ATTESE).map(([nome, firma]) =>
    ({ proname: nome, firma, autenticato: true, anonimo: false, service: false }))).ok, true)
})

// ---- 8. terza revisione dell'audit: firme nominate, colonne effettive, letterali ----
import {
  COLONNE_CONSENTITE, COLONNE_RISERVATE_MINIME, canon, normalizzaFirma,
  verificaColonneEffettive, verificaEffettiviTabella,
} from './verificaAudit.mjs'

// il formato REALE di pg_get_function_identity_arguments (nomi degli
// argomenti CONSERVATI, dalla 0020) — non copiato da RPC_ATTESE
const FIRME_NOMINATE = {
  conferma_documento: 'p_document_id uuid, p_correzioni jsonb',
  approva_fattura_da_pagare: 'p_document_id uuid, p_correzioni jsonb',
  paga_fattura: 'p_document_id uuid, p_data_pagamento date, p_payment_method text, p_correzioni jsonb',
  conferma_fattura_pagata: 'p_document_id uuid, p_data_pagamento date, p_payment_method text, p_correzioni jsonb',
  scarta_documento: 'p_document_id uuid, p_motivo text',
}

test('FALSO ALLARME riprodotto: firme NOMINATE della 0020 (formato vero della query) → ora CONFORMI', () => {
  assert.equal(normalizzaFirma('p_document_id uuid, p_correzioni jsonb'), 'uuid, jsonb')
  const oss = Object.entries(FIRME_NOMINATE).map(([nome, firma]) =>
    ({ proname: nome, firma, autenticato: true, anonimo: false, service: false }))
  const v = verificaRpc(oss)                       // PRIMA: tutte e 5 "diverse"
  assert.equal(v.ok, true)
  // e un TIPO sbagliato dentro la firma nominata resta un rosso
  const rotte = oss.map(o => o.proname === 'scarta_documento'
    ? { ...o, firma: 'p_document_id uuid, p_motivo jsonb' } : o)
  const v2 = verificaRpc(rotte)
  assert.equal(v2.ok, false)
  assert.ok(v2.differenze.some(d => d.includes('scarta_documento') && d.includes('firma')))
})

test('FALSO VERDE riprodotto: i letterali NON si normalizzano — SCONTRINI e "s c o n t r i n i" ≠ scontrini', () => {
  assert.notEqual(canon("bucket_id = 'SCONTRINI'"), canon("bucket_id = 'scontrini'"))
  assert.notEqual(canon("bucket_id = 's c o n t r i n i'"), canon("bucket_id = 'scontrini'"))
  const maiuscola = policyConformi().map(p => p.policyname === 'scontrini_membri_select'
    ? { ...p, qual: p.qual.replace("'scontrini'", "'SCONTRINI'") } : p)
  assert.equal(verificaPolicy(maiuscola).ok, false)          // PRIMA: verde
  const spaziata = policyConformi().map(p => p.policyname === 'scontrini_membri_select'
    ? { ...p, qual: p.qual.replace("'scontrini'", "'s c o n t r i n i'") } : p)
  assert.equal(verificaPolicy(spaziata).ok, false)           // PRIMA: verde
  // il rendering CONFORME resta verde (regressione)
  assert.equal(verificaPolicy(policyConformi()).ok, true)
})

test('modalità permissive ASSENTE o sconosciuta → INCOMPLETO, non conforme', () => {
  const senza = policyConformi().map(p => p.policyname === 'family_expenses_solo_membri'
    ? { ...p, permissive: undefined } : p)
  const v = verificaPolicy(senza)                            // PRIMA: passava come PERMISSIVE
  assert.equal(v.ok, false)
  assert.ok(v.differenze.some(d => d.includes('family_expenses') && d.includes('INCOMPLETO')))
})

test('FALSO VERDE riprodotto: 30 casi con effettivo=null NON sono «tutti negati»', () => {
  const casi = ['family_documents'].flatMap(t => ['INSERT'].flatMap(p =>
    ['authenticated', 'anon'].map(ruolo => ({ tabella: t, privilegio: p, ruolo }))))
  const nulli = casi.map(c => ({ ...c, effettivo: null }))
  const v = verificaEffettiviTabella(nulli, casi)            // PRIMA: "tutti negati"
  assert.equal(v.ok, false)
  assert.ok(v.differenze.every(d => d.includes('INCOMPLETO')))
  // caso mancante = incompleto; tutti false espliciti = verde; un true = rosso
  assert.equal(verificaEffettiviTabella([], casi).ok, false)
  assert.equal(verificaEffettiviTabella(casi.map(c => ({ ...c, effettivo: false })), casi).ok, true)
  const unoAperto = casi.map((c, i) => ({ ...c, effettivo: i === 0 }))
  assert.ok(verificaEffettiviTabella(unoAperto, casi).differenze.some(d => d.includes('può')))
})

// INVENTARIO completo di colonna (con colonne extra vere come created_at e
// id) e osservazioni CONFORMI: la matrice nasce dall'inventario, distinto
// dai risultati dei privilegi
function inventarioColonne() {
  const inv = []
  const tabelle = [...new Set(Object.keys(COLONNE_CONSENTITE).map(k => k.split('/')[0]))]
  for (const t of tabelle) {
    const colonne = [...new Set([
      'id', 'created_at',
      ...(COLONNE_CONSENTITE[`${t}/INSERT`] ?? []), ...(COLONNE_CONSENTITE[`${t}/UPDATE`] ?? []),
      ...(COLONNE_RISERVATE_MINIME[t] ?? []),
    ])]
    for (const colonna of colonne) inv.push({ tabella: t, colonna })
  }
  return inv
}
function colonneConformi(inv = inventarioColonne()) {
  const righe = []
  for (const i of inv)
    for (const ruolo of ['authenticated', 'anon'])
      for (const privilegio of ['INSERT', 'UPDATE'])
        righe.push({
          tabella: i.tabella, colonna: i.colonna, ruolo, privilegio,
          effettivo: ruolo === 'authenticated' && (COLONNE_CONSENTITE[`${i.tabella}/${privilegio}`] ?? []).includes(i.colonna),
        })
  return righe
}

test('colonne EFFETTIVE: caso completo conforme verde; UPDATE(status) riaperto via PUBLIC/ereditarietà → ROSSO', () => {
  const inv = inventarioColonne()
  assert.equal(verificaColonneEffettive(inv, colonneConformi(inv)).ok, true)
  const riaperto = colonneConformi(inv).map(r =>
    r.tabella === 'family_documents' && r.colonna === 'status' && r.ruolo === 'authenticated' && r.privilegio === 'UPDATE'
      ? { ...r, effettivo: true } : r)
  const v = verificaColonneEffettive(inv, riaperto)
  assert.equal(v.ok, false)
  assert.ok(v.differenze.some(d => d.includes('status') && d.includes('RIAPERTO')))
})

test('FALSI VERDI riprodotti: la completezza viene dalla MATRICE dell\'inventario, non dalle righe ricevute', () => {
  const inv = inventarioColonne()
  // 1) TUTTE le righe anon eliminate → i casi anon risultano ASSENTI
  const senzaAnon = colonneConformi(inv).filter(r => r.ruolo !== 'anon')
  const v1 = verificaColonneEffettive(inv, senzaAnon)          // PRIMA: verde
  assert.equal(v1.ok, false)
  assert.ok(v1.differenze.some(d => d.includes('assente') && d.includes('anon')))
  // 2) via il caso family_draft_expenses/document_id/authenticated/UPDATE
  //    (document_id è consentita SOLO in insert: il suo caso UPDATE prima
  //    non era preteso da nessuno)
  const senzaCaso = colonneConformi(inv).filter(r =>
    !(r.tabella === 'family_draft_expenses' && r.colonna === 'document_id' && r.ruolo === 'authenticated' && r.privilegio === 'UPDATE'))
  const v2 = verificaColonneEffettive(inv, senzaCaso)          // PRIMA: verde
  assert.equal(v2.ok, false)
  assert.ok(v2.differenze.some(d => d.includes('family_draft_expenses/document_id/authenticated/UPDATE')))
  // 3) una riservata FUORI dalla lista minima (created_at) con
  //    effettivo=null per authenticated → INCOMPLETO
  const conNull = colonneConformi(inv).map(r =>
    r.tabella === 'family_documents' && r.colonna === 'created_at' && r.ruolo === 'authenticated' && r.privilegio === 'UPDATE'
      ? { ...r, effettivo: null } : r)
  const v3 = verificaColonneEffettive(inv, conNull)            // PRIMA: verde
  assert.equal(v3.ok, false)
  assert.ok(v3.differenze.some(d => d.includes('created_at') && d.includes('INCOMPLETO')))
  // 4) duplicati e righe fuori inventario: mai conformi
  const doppia = [...colonneConformi(inv), colonneConformi(inv)[0]]
  assert.ok(verificaColonneEffettive(inv, doppia).differenze.some(d => d.includes('DUPLICATO')))
  const estranea = [...colonneConformi(inv), { tabella: 'family_documents', colonna: 'colonna_inventata', ruolo: 'anon', privilegio: 'UPDATE', effettivo: false }]
  assert.ok(verificaColonneEffettive(inv, estranea).differenze.some(d => d.includes('INATTESA')))
  // 5) inventario monco (senza una consentita) → incompleto
  const invMonco = inv.filter(i => !(i.tabella === 'family_documents' && i.colonna === 'note'))
  assert.ok(verificaColonneEffettive(invMonco, colonneConformi(invMonco)).differenze.some(d => d.includes('inventario senza family_documents.note')))
})

test('IDENTITÀ dei ruoli: {AUTHENTICATED} ≠ {authenticated} — confronto esatto, niente canon', () => {
  const maiuscolo = policyConformi().map(p => p.policyname === 'family_expenses_solo_membri'
    ? { ...p, roles: '{AUTHENTICATED}' } : p)
  const v = verificaPolicy(maiuscolo)                          // PRIMA: verde via canon
  assert.equal(v.ok, false)
  assert.ok(v.differenze.some(d => d.includes('family_expenses') && d.includes('ruoli')))
  assert.equal(verificaPolicy(policyConformi()).ok, true)      // il conforme resta verde
})
