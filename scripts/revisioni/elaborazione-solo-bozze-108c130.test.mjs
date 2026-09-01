// Revisione indipendente del candidato 108c130. Solo archivi simulati:
// nessuna rete, nessun database. Gli assert descrivono il contratto E01-E09,
// non vanno invertiti per rendere verde un'implementazione non atomica.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  costruisciPacchettoBozze, elaboraDocumento,
} from '../../lib/spese/elaborazioneBozze.ts'

const CONTESTO = {
  gruppi: [
    { id: 'g-casa', ambito: 'personale' },
    { id: 'g-ania', ambito: 'personale' },
    { id: 'g-bnb', ambito: 'azienda' },
  ],
  sottoCanoniche: [],
}

const lettura = () => ({
  totale: 1,
  sorelle: [{
    ambito: 'personale', destinatario: 'g-casa', data: '2026-09-01',
    negozio: 'Negozio', voci: [{
      raw_name: 'VOCE', name: 'Voce', amount: 1, sottocategoria: 'Altro',
    }],
  }],
})

function archivio() {
  return {
    documento: { status: 'da_elaborare', doc_total: null, error_message: null },
    bozze: new Map(), righe: [], contatore: 0,
  }
}

function scrittorePer(a, varianti = {}) {
  return {
    async leggiDocumento() {
      if (varianti.leggiDocumento) return varianti.leggiDocumento()
      return { documento: { status: a.documento.status } }
    },
    async rimuoviBozzeDi() {
      if (varianti.rimuoviBozzeDi) return varianti.rimuoviBozzeDi()
      a.bozze.clear(); a.righe = []; return {}
    },
    async inserisciBozza(b) {
      if (varianti.inserisciBozza) return varianti.inserisciBozza(b)
      const id = `b-${++a.contatore}`; a.bozze.set(id, b); return { id }
    },
    async inserisciRiga(r) {
      if (varianti.inserisciRiga) return varianti.inserisciRiga(r)
      a.righe.push(r); return {}
    },
    async aggiornaDocumento(_id, campi) {
      if (varianti.aggiornaDocumento) return varianti.aggiornaDocumento(campi)
      Object.assign(a.documento, campi); return {}
    },
  }
}

test('108c130 E04: pulizia compensativa fallita non lascia bozze parziali dichiarando solo il primo errore', async () => {
  const a = archivio()
  let pulizie = 0
  const w = scrittorePer(a, {
    rimuoviBozzeDi: async () => {
      if (++pulizie === 2) return { errore: 'pulizia negata' }
      a.bozze.clear(); a.righe = []; return {}
    },
    inserisciRiga: async () => ({ errore: 'riga non inserita' }),
  })
  const esito = await elaboraDocumento(w, 'd1', { lettura: lettura() }, CONTESTO)
  assert.equal(esito.ok, false)
  assert.equal(a.bozze.size, 0,
    `l'esito promette niente parziali ma restano ${a.bozze.size} bozze; esito=${JSON.stringify(esito)}`)
  assert.equal(a.righe.length, 0)
  assert.match(esito.errore, /pulizia negata/,
    'il fallimento della compensazione deve essere dichiarato, non nascosto dal primo errore')
})

test('108c130 E03: due elaborazioni simultanee dello stesso documento non possono riuscire entrambe e duplicare le bozze', async () => {
  const a = archivio()
  let letture = 0, apri
  const barriera = new Promise(r => { apri = r })
  const w = scrittorePer(a, {
    leggiDocumento: async () => {
      // Entrambe acquisiscono lo stesso stato PRIMA di proseguire.
      const status = a.documento.status
      if (++letture === 2) apri()
      await barriera
      return { documento: { status } }
    },
  })
  const esiti = await Promise.all([
    elaboraDocumento(w, 'd1', { lettura: lettura() }, CONTESTO),
    elaboraDocumento(w, 'd1', { lettura: lettura() }, CONTESTO),
  ])
  assert.equal(esiti.filter(e => e.ok).length, 1,
    `due elaborazioni hanno dichiarato successo: ${JSON.stringify(esiti)}`)
  assert.equal(a.bozze.size, 1, 'il documento ha ricevuto bozze duplicate')
  assert.equal(a.righe.length, 1, 'il documento ha ricevuto righe duplicate')
})

test('108c130 E06: una nota presente non può essere ignorata senza dichiarare come è stata applicata o perché è dubbia', () => {
  const esito = costruisciPacchettoBozze(lettura(), {
    ...CONTESTO, documentId: 'd1', nota: 'Tutto per Casa Ania',
  })
  assert.equal(esito.ok, false,
    'contesto.nota non viene letto: il pacchetto è identico a quello senza nota e resta personale')
})

test('108c130 E02: un falso dubbio invisibile non può autorizzare una quadratura errata', () => {
  const l = lettura()
  l.totale = 2
  l.dubbioTotale = { campo: 'doc_total', confidence: 1, motivo: '' }
  const esito = costruisciPacchettoBozze(l, { ...CONTESTO, documentId: 'd1' })
  assert.equal(esito.ok, false,
    'confidence 1 e motivo vuoto non producono un dubbio visibile, ma oggi sbloccano il pacchetto')
})

test('108c130 E09: il runbook operativo non può dire di scartare automaticamente i duplicati', () => {
  const qui = dirname(fileURLToPath(import.meta.url))
  const runbook = readFileSync(resolve(qui, '..', '..', 'RUNBOOK-ELABORAZIONE-BOZZE.md'), 'utf8')
  assert.doesNotMatch(runbook, /doppioni\s+scartati/i,
    'contraddice E05 e il passo successivo dello stesso runbook: il duplicato va soltanto segnalato')
})

test('8a67af1 E04: una lettura JSON malformata diventa documento_errore, non un TypeError che lascia il documento da elaborare', async () => {
  let richieste = 0
  let richiestaRicevuta
  const scrittore = {
    async leggiDocumento() { return { documento: { status: 'da_elaborare' } } },
    async sostituisciBozze(_id, richiesta) {
      richieste++
      richiestaRicevuta = richiesta
      return { ok: true, bozze: 0, righe: 0 }
    },
  }
  const malformata = lettura()
  malformata.sorelle[0].voci[0].name = 123
  let esito
  await assert.doesNotReject(async () => {
    esito = await elaboraDocumento(scrittore, 'd1', { lettura: malformata }, CONTESTO)
  }, 'il JSON arriva da un file non tipizzato: il costruttore non può lanciare su .trim()')
  assert.equal(esito.ok, false)
  assert.equal(esito.stato, 'documento_errore')
  assert.equal(richieste, 1, 'la marcatura atomica di errore deve partire una sola volta')
  assert.equal(typeof richiestaRicevuta?.errore, 'string')
})

test('8a67af1 E06: dichiarare a parole una nota non può contraddire ambito e gruppi del pacchetto', () => {
  const l = lettura()
  l.notaApplicata = {
    nota: 'Tutto per Casa Ania',
    come: 'tutto assegnato alla parte aziendale di Casa Ania',
  }
  const esito = costruisciPacchettoBozze(l, {
    ...CONTESTO, documentId: 'd1', nota: 'Tutto per Casa Ania',
  })
  assert.equal(esito.ok, false,
    'la dichiarazione dice Casa Ania ma il pacchetto resta personale: E06 richiede che la nota guidi davvero l\'esito')
})

test('8a67af1 R2: un campo dubbio inventato non è "pertinente"', () => {
  const ctx = { ...CONTESTO, documentId: 'd1' }
  const campoInventato = lettura()
  campoInventato.sorelle[0].dubbi = [{ campo: 'banana', confidence: 0.4, motivo: 'campo inesistente' }]
  assert.equal(costruisciPacchettoBozze(campoInventato, ctx).ok, false,
    '"campo pertinente" richiede una whitelist distinta per parte, voce e documento')
})

test('8a67af1 E02: tutti i numeri devono essere finiti prima della serializzazione JSON', () => {
  const ctx = { ...CONTESTO, documentId: 'd1' }
  const casi = [
    ['qty', l => { l.sorelle[0].voci[0].qty = Number.POSITIVE_INFINITY }],
    ['discount', l => { l.sorelle[0].voci[0].discount = Number.POSITIVE_INFINITY }],
    ['unit_price', l => { l.sorelle[0].voci[0].unit_price = Number.POSITIVE_INFINITY }],
    ['amount', l => { l.sorelle[0].voci[0].amount = Number.POSITIVE_INFINITY; l.dubbioTotale = { campo: 'doc_total', confidence: 0.4, motivo: 'quadratura dubbia' } }],
    ['arrotondamento_cent', l => { l.sorelle[0].arrotondamento_cent = Number.POSITIVE_INFINITY; l.dubbioTotale = { campo: 'doc_total', confidence: 0.4, motivo: 'quadratura dubbia' } }],
    ['totale', l => { l.totale = Number.POSITIVE_INFINITY; l.dubbioTotale = { campo: 'doc_total', confidence: 0.4, motivo: 'totale dubbio' } }],
  ]
  const accettati = []
  for (const [nome, altera] of casi) {
    const l = lettura()
    altera(l)
    if (costruisciPacchettoBozze(l, ctx).ok) accettati.push(nome)
  }
  assert.deepEqual(accettati, [],
    `JSON.stringify trasforma Infinity in null: valori accettati e quindi alterabili silenziosamente: ${accettati.join(', ')}`)
})

test('8a67af1 E02: una data col formato giusto ma inesistente viene rifiutata', () => {
  const ctx = { ...CONTESTO, documentId: 'd1' }
  const dataImpossibile = lettura()
  dataImpossibile.sorelle[0].data = '2026-99-99'
  assert.equal(costruisciPacchettoBozze(dataImpossibile, ctx).ok, false,
    'il formato YYYY-MM-DD non basta: la data deve esistere davvero')
})

test('8a67af1 fedeltà: il metodo personale assente resta non indicato', () => {
  const ctx = { ...CONTESTO, documentId: 'd1' }
  const senzaMetodo = costruisciPacchettoBozze(lettura(), ctx)
  assert.equal(senzaMetodo.ok, true)
  assert.equal(senzaMetodo.pacchetto.bozze[0].payment_method, null,
    'per Casa Mia il metodo è facoltativo: assente deve restare non indicato, non diventare Contanti')
})

test('8a67af1 perimetro: una proposta SQL non autorizzata non vive nella cartella delle migrazioni operative', () => {
  const qui = dirname(fileURLToPath(import.meta.url))
  const migrazione = resolve(qui, '..', '..', 'supabase', 'migrations', '0023_elaborazione_bozze_atomica.sql')
  assert.equal(existsSync(migrazione), false,
    'la scheda esclude migrazioni/RPC: finché è una proposta deve stare in proposte/*.BOZZA.sql, non nel percorso applicabile da db push')
})
