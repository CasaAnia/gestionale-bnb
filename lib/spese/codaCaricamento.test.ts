// ============================================================================
// Test 3.2B.2 della coda di caricamento (la logica del CaricaFotoSheet) con
// richieste simulate SOSPESE: si aggiunge e si toglie DURANTE l'attesa e la
// coda resta coerente, perché il ciclo lavora per identificativi sullo stato
// vivo, mai su una copia iniziale.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applicaEsito, daInviare, nuoveVoci, rimovibile, salvaCoda, type VoceCoda } from './codaCaricamento.ts'
import type { EsitoCaricamento } from './scrittura.ts'

let n = 0
const genId = () => `v-${++n}`
const voce = (nome: string) => ({ file: nome as unknown as Blob, nome, tipo: 'image/jpeg' })

// uno stato vivo come quello React: leggi/scrivi sull'ULTIMA versione
function statoVivo(iniziali: VoceCoda[]) {
  let coda = iniziali
  return {
    leggi: () => coda,
    scrivi: (aggiorna: (c: VoceCoda[]) => VoceCoda[]) => { coda = aggiorna(coda) },
  }
}

// un invio che resta SOSPESO finché il test non lo sblocca
function inviiSospesi() {
  const pendenti: { nome: string; sblocca: (e: EsitoCaricamento) => void }[] = []
  const inviate: { nome: string; nota: string | null }[] = []
  const invia = (v: VoceCoda, nota: string | null) => {
    inviate.push({ nome: v.nome, nota })
    return new Promise<EsitoCaricamento>(res => pendenti.push({ nome: v.nome, sblocca: res }))
  }
  return { invia, inviate, pendenti }
}
const attimo = () => new Promise(r => setTimeout(r, 0))

test('un file TOLTO durante l\'attesa non viene caricato; uno AGGIUNTO resta e non sparisce', async () => {
  const s = statoVivo(nuoveVoci([voce('a.jpg'), voce('b.jpg')], genId))
  const { invia, inviate, pendenti } = inviiSospesi()
  const fine = salvaCoda(s.leggi, s.scrivi, invia, 'nota condivisa')
  await attimo()
  // a.jpg è in volo; nel frattempo l'utente TOGLIE b.jpg e AGGIUNGE c.jpg
  assert.equal(s.leggi().find(v => v.nome === 'a.jpg')!.stato, 'in_invio')
  assert.equal(rimovibile(s.leggi().find(v => v.nome === 'a.jpg')!), false)  // in volo: non si toglie
  s.scrivi(c => c.filter(v => v.nome !== 'b.jpg'))
  s.scrivi(c => [...c, ...nuoveVoci([voce('c.jpg')], genId)])
  pendenti[0].sblocca({ ok: true, documentId: 'doc-1' })
  await attimo(); pendenti[1]?.sblocca({ ok: true, documentId: 'doc-2' })
  const { salvate } = await fine
  // b.jpg NON è mai stata inviata; c.jpg è ancora lì, in attesa del prossimo Salva
  assert.deepEqual(inviate.map(i => i.nome), ['a.jpg'])
  assert.equal(salvate, 1)
  assert.deepEqual(s.leggi().map(v => [v.nome, v.stato]), [['a.jpg', 'salvata'], ['c.jpg', 'in_attesa']])
})

test('sospese e doppioni restano FUORI dai ritentativi; gli errori riprovabili rientrano', async () => {
  const s = statoVivo(nuoveVoci([voce('a.jpg'), voce('b.jpg'), voce('c.jpg')], genId))
  const esiti: Record<string, EsitoCaricamento> = {
    'a.jpg': { ok: false, errore: 'sospesa', riprovabile: false, sospeso: true, ripresa: { percorso: 'p-a' } },
    'b.jpg': { ok: false, errore: 'doppione', riprovabile: false, duplicato: true, ripresa: {} },
    'c.jpg': { ok: false, errore: 'rete', riprovabile: true, ripresa: { percorso: 'p-c', documentId: 'd-c' } },
  }
  let chiamate: string[] = []
  const invia = async (v: VoceCoda) => { chiamate.push(v.nome); return esiti[v.nome] }
  await salvaCoda(s.leggi, s.scrivi, invia, null)
  assert.deepEqual(chiamate, ['a.jpg', 'b.jpg', 'c.jpg'])
  assert.deepEqual(s.leggi().map(v => v.stato), ['sospesa', 'duplicato', 'errore'])
  // secondo Salva: SOLO c.jpg riparte, con la sua ripresa conservata
  chiamate = []
  const riprese: unknown[] = []
  await salvaCoda(s.leggi, s.scrivi, async v => { chiamate.push(v.nome); riprese.push(v.ripresa); return { ok: true } }, null)
  assert.deepEqual(chiamate, ['c.jpg'])
  assert.deepEqual(riprese, [{ percorso: 'p-c', documentId: 'd-c' }])
  assert.deepEqual(daInviare(s.leggi()), [])
})

test('la nota di una voce si FISSA al primo tentativo: cambiarla dopo non tocca i ritentativi', async () => {
  const s = statoVivo(nuoveVoci([voce('a.jpg')], genId))
  const note: (string | null)[] = []
  const invia = async (_v: VoceCoda, nota: string | null) => {
    note.push(nota)
    return note.length === 1
      ? { ok: false as const, errore: 'rete', riprovabile: true, ripresa: {} }
      : { ok: true as const }
  }
  await salvaCoda(s.leggi, s.scrivi, invia, 'prima nota')
  await salvaCoda(s.leggi, s.scrivi, invia, 'nota CAMBIATA')   // ritentativo con nota diversa a schermo
  assert.deepEqual(note, ['prima nota', 'prima nota'])          // coerenza documento/ricevuta
})

test('un invio che LANCIA non rompe il ciclo: la voce resta riprovabile con la sua ripresa', async () => {
  const s = statoVivo(nuoveVoci([voce('a.jpg'), voce('b.jpg')], genId))
  const invia = async (v: VoceCoda): Promise<EsitoCaricamento> => {
    if (v.nome === 'a.jpg') throw new Error('crollo inatteso')
    return { ok: true }
  }
  const { salvate } = await salvaCoda(s.leggi, s.scrivi, invia, null)
  assert.equal(salvate, 1)
  const a = s.leggi().find(v => v.nome === 'a.jpg')!
  assert.equal(a.stato, 'errore')
  assert.equal(a.riprovabile, true)
})

test('applicaEsito: il successo pulisce l\'errore; i tre fallimenti finiscono nello stato giusto', () => {
  const base = nuoveVoci([voce('a.jpg')], genId)[0]
  // e una voce SOSPESA (esito sconosciuto) non si può togliere: il
  // riferimento all'operazione non va perso in silenzio
  assert.equal(rimovibile({ ...base, stato: 'sospesa' }), false)
  assert.equal(rimovibile({ ...base, stato: 'duplicato' }), true)
  assert.equal(applicaEsito(base, { ok: true }).stato, 'salvata')
  assert.equal(applicaEsito(base, { ok: false, errore: 'x', riprovabile: true, ripresa: {} }).stato, 'errore')
  assert.equal(applicaEsito(base, { ok: false, errore: 'x', riprovabile: false, sospeso: true, ripresa: {} }).stato, 'sospesa')
  assert.equal(applicaEsito(base, { ok: false, errore: 'x', riprovabile: false, duplicato: true, ripresa: {} }).stato, 'duplicato')
})
