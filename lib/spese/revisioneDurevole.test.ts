// ============================================================================
// Test della CUSTODIA durevole della revisione — stessa disciplina di
// ripresaDurevole: lettura a TRE esiti (vuoto vero / valido / ERRORE mai
// scambiato per vuoto), niente sovrascritture su custodia illeggibile.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { depositoRevisioneInMemoria, depositoRevisioneLocale } from './revisioneDurevole.ts'
import type { TracciaRevisione } from './revisione.ts'

const traccia = (documentId: string, generazione = 1): TracciaRevisione => ({
  documentId, generazione, docTotaleCent: 500, docTotaleOriginaleCent: 500,
  originaliBozze: { b1: { store: 'Mercato' } }, originaliRighe: {},
  modificheBozze: { b1: { store: 'Iper' } }, modificheRighe: {},
  righeNuove: [],
})

function memoriaFinta(iniziale: Record<string, string> = {}) {
  const dati = { ...iniziale }
  return {
    dati,
    getItem: (k: string) => (k in dati ? dati[k] : null),
    setItem: (k: string, v: string) => { dati[k] = v },
  }
}

test('giro completo: salva, leggi per documento, rimuovi — documenti diversi non si toccano', () => {
  const mem = memoriaFinta()
  const dep = depositoRevisioneLocale('chiave-prova', () => mem)
  assert.deepEqual(dep.salva(traccia('d1')), {})
  assert.deepEqual(dep.salva(traccia('d2')), {})
  assert.equal(dep.leggi('d1').traccia?.documentId, 'd1')
  assert.equal(dep.leggi('d3').traccia, undefined)     // assente, senza errore
  assert.deepEqual(dep.rimuovi('d1'), {})
  assert.equal(dep.leggi('d1').traccia, undefined)
  assert.equal(dep.leggi('d2').traccia?.documentId, 'd2')
})

test('chiave assente = vuoto VERO, senza errore', () => {
  const dep = depositoRevisioneLocale('mai-scritta', () => memoriaFinta())
  const lettura = dep.leggi('d1')
  assert.equal(lettura.traccia, undefined)
  assert.equal(lettura.errore, undefined)
})

test('custodia CORROTTA o non valida: errore ESPLICITO, salva e rimuovi NON sovrascrivono', () => {
  const mem = memoriaFinta({ k: 'non-json{{{' })
  const dep = depositoRevisioneLocale('k', () => mem)
  assert.ok(dep.leggi('d1').errore?.includes('corrotti'))
  assert.ok(dep.salva(traccia('d1')).errore?.includes('non sovrascrivo'))
  assert.ok(dep.rimuovi('d1').errore?.includes('non tocco nulla'))
  assert.equal(mem.dati.k, 'non-json{{{')              // il contenuto resta com'era
  // struttura sbagliata (lista invece di archivio per documento)
  const mem2 = memoriaFinta({ k: '[1,2,3]' })
  const dep2 = depositoRevisioneLocale('k', () => mem2)
  assert.ok(dep2.leggi('d1').errore?.includes('non valida'))
})

test('STRUTTURA INTERNA invalida (JSON valido ma righeNuove:[null] o modifiche non-oggetto): errore, mai fatta passare, contenuto preservato', () => {
  const rotta = { ...traccia('d1'), righeNuove: [null] }
  const mem = memoriaFinta({ k: JSON.stringify({ d1: rotta }) })
  const dep = depositoRevisioneLocale('k', () => mem)
  assert.ok(dep.leggi('d1').errore?.includes('non valida'))            // MAI {traccia} né vuoto
  assert.ok(dep.salva(traccia('d1')).errore?.includes('non sovrascrivo'))
  assert.equal(mem.dati.k, JSON.stringify({ d1: rotta }))              // preservata per l'analisi
  // altre strutture interne rotte
  for (const guasta of [
    { ...traccia('d1'), righeNuove: [{ idLocale: 'x' }] },             // riga senza stato/campi
    { ...traccia('d1'), modificheBozze: 'niente' },
    { ...traccia('d1'), originaliRighe: { r1: 'niente' } },
    { ...traccia('d1'), generazione: 'due' },
  ]) {
    const m = memoriaFinta({ k: JSON.stringify({ d1: guasta }) })
    assert.ok(depositoRevisioneLocale('k', () => m).leggi('d1').errore, JSON.stringify(guasta).slice(0, 60))
  }
})

test('GENERAZIONI: una scrittura superata viene rifiutata (in ENTRAMBI i depositi), una pari o più nuova passa', () => {
  const mem = memoriaFinta()
  const dep = depositoRevisioneLocale('k', () => mem)
  assert.deepEqual(dep.salva(traccia('d1', 2)), {})
  const rifiuto = dep.salva(traccia('d1', 1))                          // la risposta vecchia
  assert.ok(rifiuto.errore?.includes('superata'))
  assert.equal(dep.leggi('d1').traccia?.generazione, 2)                // lo stato recente resta
  assert.deepEqual(dep.salva(traccia('d1', 2)), {})                    // stessa generazione: ok
  assert.deepEqual(dep.salva(traccia('d1', 3)), {})                    // più nuova: ok
  const memv = depositoRevisioneInMemoria()
  assert.deepEqual(memv.salva(traccia('d2', 2)), {})
  assert.ok(memv.salva(traccia('d2', 1)).errore?.includes('superata'))
  assert.equal(memv.leggi('d2').traccia?.generazione, 2)
})

test('memoria che ESPLODE (lettura o accesso negati): errore dichiarato, mai spacciato per vuoto', () => {
  const rotto = { getItem: () => { throw new Error('accesso negato') }, setItem: () => {} }
  const dep = depositoRevisioneLocale('k', () => rotto)
  assert.ok(dep.leggi('d1').errore?.includes('accesso negato'))
  assert.ok(dep.salva(traccia('d1')).errore)
  const inaccessibile = depositoRevisioneLocale('k', () => { throw new Error('niente localStorage') })
  assert.ok(inaccessibile.leggi('d1').errore?.includes('niente localStorage'))
  assert.ok(inaccessibile.salva(traccia('d1')).errore?.includes('niente localStorage'))
})
