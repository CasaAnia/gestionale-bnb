import { test } from 'node:test'
import assert from 'node:assert/strict'
import { imbutoRichieste, mediana } from './imbuto.ts'

const r = (id: string, stato: string, canale: string, extra: Partial<{ origine: string; motivo_rifiuto: string; proposta_inviata_at: string; created_at: string; proposta_soluzione: { manuale?: boolean; segmenti?: { prezzo_manuale?: boolean }[] } }> = {}) =>
  ({ id, stato, canale, created_at: '2026-09-01T10:00:00Z', arrivo: '2026-09-17', partenza: '2026-09-21', ...extra })

test('mediana', () => {
  assert.equal(mediana([]), null); assert.equal(mediana([7]), 7); assert.equal(mediana([1, 9]), 5); assert.equal(mediana([1, 2, 100]), 2)
})

test('imbuto: conteggi per stato, canale e origine; motivi; mediana di risposta; quote manuali', () => {
  const lista = [
    r('1', 'in_attesa', 'web', { origine: 'google' }),
    r('2', 'proposta_inviata', 'web', { origine: 'google', proposta_inviata_at: '2026-09-01T10:30:00Z', proposta_soluzione: { manuale: false, segmenti: [{}] } }),
    r('3', 'confermata', 'telefono', { proposta_inviata_at: '2026-09-01T12:00:00Z', proposta_soluzione: { manuale: true, segmenti: [{ prezzo_manuale: true }] } }),
    r('4', 'rifiutata', 'whatsapp', { motivo_rifiuto: 'Prezzo', proposta_inviata_at: '2026-09-02T10:00:00Z', proposta_soluzione: { segmenti: [{}] } }),
    r('5', 'rifiutata', 'web', { motivo_rifiuto: 'date assegnate a altro cliente' }),   // rifiutata senza proposta
    r('6', 'rifiutata', 'telefono'),                                                    // senza motivo
    r('7', 'confermata', 'web', { origine: '', proposta_inviata_at: '2026-09-01T10:10:00Z', proposta_soluzione: { manuale: true, segmenti: [{}] } }),
  ]
  const i = imbutoRichieste(lista)
  assert.deepEqual(i.totale, { richieste: 7, proposteInviate: 4, confermate: 2, rifiutate: 3, inAttesa: 1 })
  assert.deepEqual(i.perCanale.web, { richieste: 4, proposteInviate: 2, confermate: 1, rifiutate: 1, inAttesa: 1 })
  assert.deepEqual(i.perCanale.telefono, { richieste: 2, proposteInviate: 1, confermate: 1, rifiutate: 1, inAttesa: 0 })
  assert.deepEqual(Object.keys(i.perOrigine).sort(), ['diretto', 'google'])
  assert.deepEqual(i.perOrigine.google, { richieste: 2, proposteInviate: 1, confermate: 0, rifiutate: 0, inAttesa: 1 })
  assert.deepEqual(i.motiviRifiuto, { Prezzo: 1, 'date assegnate a altro cliente': 1, 'non indicato': 1 })
  assert.equal(i.tempoRispostaMedianoMinuti, 75)   // 30, 120, 1440, 10 → mediana (30+120)/2
  assert.equal(i.proposteConSoluzione, 4); assert.equal(i.composizioniManuali, 2); assert.equal(i.prezziManuali, 1)
  assert.equal(i.quotaManualiPerMille, 500); assert.equal(i.quotaPrezziManualiPerMille, 250)
  // una richiesta in attesa non è mai una conferma
  assert.equal(imbutoRichieste([r('9', 'in_attesa', 'web')]).totale.confermate, 0)
  // mese senza dati
  const vuoto = imbutoRichieste([])
  assert.deepEqual(vuoto.totale, { richieste: 0, proposteInviate: 0, confermate: 0, rifiutate: 0, inAttesa: 0 })
  assert.equal(vuoto.tempoRispostaMedianoMinuti, null); assert.equal(vuoto.quotaManualiPerMille, 0)
})
