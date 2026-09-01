// Revisione indipendente del candidato 108c130. Solo archivi simulati:
// nessuna rete, nessun database. Gli assert descrivono il contratto E01-E09,
// non vanno invertiti per rendere verde un'implementazione non atomica.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
