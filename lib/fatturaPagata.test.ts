// «Segna pagata» sulle bollette (Ania, 30/09/2026): la RPC giusta per lo
// stato, solo contanti o bonifico, la commissione come spesa a parte una
// volta sola, errori sempre visibili (mai un «pagata» finto).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  segnaFatturaPagata, idCommissione, commissioneCent, importoIniziale, notaCommissione, METODI_FATTURA,
  ERRORE_IMPORTO_MINORE, ERRORE_IMPORTO_FATTURA, COMMISSIONE_NON_SALVATA, type ClienteFattura, type FatturaDaPagare,
} from './fatturaPagata.ts'
import { MESSAGGIO_NON_SALVATO } from './scritturaSicura.ts'

const BOLLETTA: FatturaDaPagare = { documentoId: 'doc1', stato: 'in_revisione', importoCent: 12500, nome: 'Bolletta gas A2A · Via Mincio', numero: '524515483327', gruppoId: 'casa' }

function finto(opzioni: { erroreRpc?: boolean; erroreSpesa?: boolean; giaRegistrata?: boolean } = {}) {
  const chiamate: { rpc: [string, Record<string, unknown>][]; spese: Record<string, unknown>[] } = { rpc: [], spese: [] }
  const client: ClienteFattura = {
    async rpc(nome, argomenti) { chiamate.rpc.push([nome, argomenti]); return { data: ['e1'], error: opzioni.erroreRpc ? { message: 'Stato non valido' } : null } },
    async categoriaCommissione() { return { id: 'servizi', error: null } },
    async commissioneGiaRegistrata() { return { esiste: !!opzioni.giaRegistrata, error: null } },
    async inserisciSpesa(riga) { chiamate.spese.push(riga); return { error: opzioni.erroreSpesa ? { message: 'rete' } : null } },
  }
  return { client, chiamate }
}

test('solo contanti e bonifico', () => {
  assert.deepEqual(METODI_FATTURA.map(m => m.chiave), ['contanti', 'bonifico'])
})

test('importo: precompilato con la bolletta, commissione = quanto pagato in più', () => {
  assert.equal(importoIniziale(11900), '119,00')
  assert.equal(importoIniziale(33088), '330,88')
  assert.equal(commissioneCent('125,00', 12500), 0)
  assert.equal(commissioneCent('127,95', 12500), 295)
  assert.equal(commissioneCent('120', 12500), null)
  assert.equal(commissioneCent('abc', 12500), null)
})

test('in revisione → conferma_fattura_pagata con data e metodo; niente commissione se l\'importo è quello', async () => {
  const { client, chiamate } = finto()
  const esito = await segnaFatturaPagata(client, BOLLETTA, { giorno: '2026-09-30', metodo: 'contanti', importo: '125,00' })
  assert.deepEqual(esito, { ok: true, commissioneCent: 0 })
  assert.deepEqual(chiamate.rpc, [['conferma_fattura_pagata', { p_document_id: 'doc1', p_data_pagamento: '2026-09-30', p_payment_method: 'contanti', p_correzioni: [] }]])
  assert.equal(chiamate.spese.length, 0)
})

test('approvata da pagare → paga_fattura', async () => {
  const { client, chiamate } = finto()
  await segnaFatturaPagata(client, { ...BOLLETTA, stato: 'approvata_da_pagare' }, { giorno: '2026-09-22', metodo: 'bonifico', importo: '125' })
  assert.equal(chiamate.rpc[0][0], 'paga_fattura')
})

test('il caso di Ania: 127,95 € da Mooney → bolletta 125,00 € + spesa a parte «Commissione pagamento» di 2,95 € nello stesso gruppo', async () => {
  const { client, chiamate } = finto()
  const esito = await segnaFatturaPagata(client, BOLLETTA, { giorno: '2026-09-30', metodo: 'contanti', importo: '127,95' })
  assert.deepEqual(esito, { ok: true, commissioneCent: 295 })
  assert.equal(chiamate.spese.length, 1)
  assert.deepEqual(chiamate.spese[0], {
    id: await idCommissione('doc1'),
    expense_date: '2026-09-30', amount: 2.95, group_id: 'casa', category_id: 'servizi', subcategory: 'Commissioni', store: null,
    description: 'Commissione pagamento', notes: notaCommissione(BOLLETTA), payment_method: 'contanti', paid_at: '2026-09-30',
    expense_nature: 'ordinaria', source: 'manuale',
  })
})

test('la commissione non si registra due volte (ripetendo il salvataggio)', async () => {
  const { client, chiamate } = finto({ giaRegistrata: true })
  const esito = await segnaFatturaPagata(client, BOLLETTA, { giorno: '2026-09-30', metodo: 'contanti', importo: '127,95' })
  assert.equal(esito.ok, true)
  assert.equal(chiamate.spese.length, 0)
})

test('errori visibili: RPC fallita = «Non salvato», niente commissione; commissione fallita = pagata ma avviso', async () => {
  const a = finto({ erroreRpc: true })
  const e1 = await segnaFatturaPagata(a.client, BOLLETTA, { giorno: '2026-09-30', metodo: 'contanti', importo: '127,95' })
  assert.deepEqual(e1, { ok: false, errore: MESSAGGIO_NON_SALVATO, pagata: false })
  assert.equal(a.chiamate.spese.length, 0)
  const b = finto({ erroreSpesa: true })
  const e2 = await segnaFatturaPagata(b.client, BOLLETTA, { giorno: '2026-09-30', metodo: 'contanti', importo: '127,95' })
  assert.deepEqual(e2, { ok: false, errore: COMMISSIONE_NON_SALVATA, pagata: true })
})

test('importo sbagliato o minore della bolletta: niente chiamate', async () => {
  const { client, chiamate } = finto()
  assert.deepEqual(await segnaFatturaPagata(client, BOLLETTA, { giorno: '2026-09-30', metodo: 'contanti', importo: '100' }), { ok: false, errore: ERRORE_IMPORTO_MINORE, pagata: false })
  assert.deepEqual(await segnaFatturaPagata(client, BOLLETTA, { giorno: '2026-09-30', metodo: 'contanti', importo: '' }), { ok: false, errore: ERRORE_IMPORTO_FATTURA, pagata: false })
  assert.equal(chiamate.rpc.length, 0)
})

test('la Home: «Segna pagata» apre il foglio, «Apri PDF» c\'è, la data scaduta in mattone', () => {
  const home = readFileSync(new URL('../components/DaControllare.tsx', import.meta.url), 'utf8')
  assert.match(home, /data-segna-pagata/)
  assert.match(home, /Apri PDF/)
  assert.match(home, /var\(--m-mat\)/)
  const foglio = readFileSync(new URL('../components/FoglioSegnaPagata.tsx', import.meta.url), 'utf8')
  assert.match(foglio, /FoglioMaison/)
  assert.match(foglio, /ALTEZZA_FOGLIO_SEGNA_PAGATA/)
  assert.match(foglio, /AvvisoAzione/)
})

// Audit Codex R2 (30/09/2026): due salvataggi contemporanei (due telefoni)
// passano entrambi il controllo «c'è già?» prima che l'altro scriva. Il
// database finto qui sotto ha la chiave primaria come quello vero: la seconda
// riga con lo stesso id viene rifiutata (23505) e vale come «già registrata».
test('due salvataggi contemporanei: una commissione sola, ed entrambi «salvato»', async () => {
  const tabella = new Map<string, Record<string, unknown>>()
  let inAttesa: (() => void)[] = []
  const client: ClienteFattura = {
    async rpc() { return { data: ['e1'], error: null } },
    async categoriaCommissione() { return { id: 'servizi', error: null } },
    async commissioneGiaRegistrata(nota) {
      const esiste = [...tabella.values()].some(r => r.notes === nota)
      await new Promise<void>(ok => { inAttesa.push(ok); if (inAttesa.length === 2) { inAttesa.forEach(f => f()); inAttesa = [] } })
      return { esiste, error: null }
    },
    async inserisciSpesa(riga) {
      const id = String(riga.id)
      if (tabella.has(id)) return { error: { message: 'duplicate key value violates unique constraint "family_expenses_pkey"', code: '23505' } }
      tabella.set(id, riga)
      return { error: null }
    },
  }
  const scelta = { giorno: '2026-09-30', metodo: 'contanti' as const, importo: '127,95' }
  const [a, b] = await Promise.all([segnaFatturaPagata(client, BOLLETTA, scelta), segnaFatturaPagata(client, BOLLETTA, scelta)])
  assert.deepEqual(a, { ok: true, commissioneCent: 295 })
  assert.deepEqual(b, { ok: true, commissioneCent: 295 })
  assert.equal(tabella.size, 1, 'una riga sola: 2,95 €, non 5,90 €')
})

test('idCommissione: stesso documento → stesso uuid valido; documenti diversi → uuid diversi', async () => {
  const a = await idCommissione('doc1'), b = await idCommissione('doc1'), c = await idCommissione('doc2')
  assert.equal(a, b)
  assert.notEqual(a, c)
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})

test('un altro errore di scrittura resta «commissione non salvata»', async () => {
  const { client } = finto({ erroreSpesa: true })
  const esito = await segnaFatturaPagata(client, BOLLETTA, { giorno: '2026-09-30', metodo: 'contanti', importo: '127,95' })
  assert.deepEqual(esito, { ok: false, errore: COMMISSIONE_NON_SALVATA, pagata: true })
})
