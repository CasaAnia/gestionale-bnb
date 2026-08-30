// ============================================================================
// Test LOCALI degli strumenti di collaudo (Fase 4) con servizi SIMULATI:
// coprono esattamente i casi riprodotti dalla revisione del commit 25040c7.
// Esecuzione: node --test scripts/fase4/  (fa parte dei "controlli degli
// script", separato dalla suite dell'applicazione).
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { provaValida, misuraCompleta } from './concorrenza.mjs'
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
