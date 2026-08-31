// Test del legame RPC del contratto: nomi e argomenti esatti, errori
// resi come { errore, codice } (la prova di rifiuto passa SOLO dal
// codice), esito_revisione che LANCIA sugli errori (→ «illeggibile»).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { creaClienteContrattoRpc, type SupabaseContratto } from './contrattoRpc.ts'
import { validaRisposta, type OperazioneContratto } from './contrattoRevisione.ts'

function finto(risposte: Record<string, { data?: unknown; error?: { message: string; code?: string } }>) {
  const chiamate: { nome: string; argomenti: Record<string, unknown> }[] = []
  const supabase: SupabaseContratto = {
    async rpc(nome, argomenti) {
      chiamate.push({ nome, argomenti })
      const r = risposte[nome] ?? {}
      return { data: r.data ?? null, error: r.error ?? null }
    },
  }
  return { cliente: creaClienteContrattoRpc(supabase), chiamate }
}

const op = (kind: 'salva' | 'conferma' | 'scarto'): OperazioneContratto => ({
  opKey: 'k', kind, documentId: 'd1', baseRev: 0, impronta: 'x', clientRefs: [],
  richiesta: kind === 'salva'
    ? { kind, modifiche: { kind: 'salva', document_id: 'd1', base_rev: 0, bozze: {}, righe: {}, nuove: [] } }
    : kind === 'conferma' ? { kind, correzioni: [] } : { kind, motivo: 'm' },
})

test('RPC del contratto: nomi e argomenti esatti; l\'errore porta il codice SQLSTATE e SOLO quello prova il rifiuto', async () => {
  const { cliente, chiamate } = finto({
    salva_revisione: { error: { message: 'Quadratura non esatta', code: 'P0001' } },
    conferma_revisione: { error: { message: 'Bad Gateway' } },
  })
  const rifiuto = await cliente.salvaRevisione({ op_key: 'k', document_id: 'd1', base_rev: 0, modifiche: { kind: 'salva', document_id: 'd1', base_rev: 0, bozze: {}, righe: {}, nuove: [] } })
  assert.deepEqual(chiamate[0], { nome: 'salva_revisione', argomenti: { p_op_key: 'k', p_document_id: 'd1', p_base_rev: 0, p_modifiche: chiamate[0].argomenti.p_modifiche } })
  assert.equal(validaRisposta(op('salva'), rifiuto).tipo, 'rifiuto')            // col codice: rifiuto provato
  const senzaCodice = await cliente.confermaRevisione({ op_key: 'k', document_id: 'd1', base_rev: 0, correzioni: [] })
  assert.equal(validaRisposta(op('conferma'), senzaCodice).tipo, 'incerta')     // senza codice: pendenza
})

test('esito_revisione: gli errori LANCIANO (il recupero li classifica «illeggibile»), i dati passano com\'è', async () => {
  const { cliente } = finto({ esito_revisione: { error: { message: 'timeout', code: '57014' } } })
  await assert.rejects(() => cliente.esitoRevisione('k'), /timeout \[57014\]/)
  const { cliente: ok } = finto({ esito_revisione: { data: { stato: 'assente' } } })
  assert.deepEqual(await ok.esitoRevisione('k'), { stato: 'assente' })
})
