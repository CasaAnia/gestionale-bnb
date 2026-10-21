// R4 di Codex (21/10/2026): una risposta della ricerca vecchia arriva DOPO
// che si è scritto il testo nuovo ma PRIMA che parta la sua ricerca (i 250 ms
// di attesa): non deve comparire. Prova temporizzata con l'orologio finto.
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { creaRicercaRitardata } from './ricercaRitardata.ts'

function banco() {
  const promesse: Record<string, (v: string[]) => void> = {}
  const partite: string[] = []
  const mostrati: (string | null)[] = []
  const r = creaRicercaRitardata<string[]>({
    cerca: testo => { partite.push(testo); return new Promise(ok => { promesse[testo] = ok }) },
    mostra: e => mostrati.push(e ? `${e.testo}:${e.risultato.join(',')}` : null),
  })
  return { r, promesse, partite, mostrati }
}
const giro = () => new Promise(ok => setImmediate(ok))

test('risposta di A fra la digitazione di B e la partenza della ricerca B: scartata, elenco vuoto', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const { r, promesse, partite, mostrati } = banco()
    r.scrivi('Anna')
    mock.timers.tick(250)                       // parte la ricerca A
    assert.deepEqual(partite, ['Anna'])
    mock.timers.tick(50)
    r.scrivi('Tina')                            // B scritto a 300 ms: A ancora in volo
    assert.equal(mostrati.at(-1), null)         // elenco svuotato SUBITO
    mock.timers.tick(100)                       // 400 ms: B non è ancora partita
    promesse['Anna'](['Anna Rossi'])            // arriva la risposta di A
    await giro()
    assert.ok(!mostrati.includes('Anna:Anna Rossi'), 'la risposta vecchia non deve comparire')
    assert.equal(mostrati.at(-1), null)
    mock.timers.tick(150)                       // 550 ms: parte B
    assert.deepEqual(partite, ['Anna', 'Tina'])
    promesse['Tina'](['Tina Senzaprefisso'])
    await giro()
    assert.equal(mostrati.at(-1), 'Tina:Tina Senzaprefisso')
  } finally { mock.timers.reset() }
})

test('le risposte fuori ordine: vince sempre l\'ultimo testo, anche se torna prima', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const { r, promesse, mostrati } = banco()
    r.scrivi('An'); mock.timers.tick(250)
    r.scrivi('Ann'); mock.timers.tick(250)
    promesse['Ann'](['Anna'])
    await giro()
    promesse['An'](['Andrea', 'Anna'])           // la vecchia torna dopo
    await giro()
    assert.equal(mostrati.at(-1), 'Ann:Anna')
  } finally { mock.timers.reset() }
})

test('testo corto o vuoto: niente ricerca e niente risultati vecchi; ferma() chiude tutto', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const { r, promesse, partite, mostrati } = banco()
    r.scrivi('Anna'); mock.timers.tick(250)
    r.scrivi('A')
    mock.timers.tick(1000)
    promesse['Anna'](['Anna Rossi']); await giro()
    assert.deepEqual(partite, ['Anna'])
    assert.equal(mostrati.at(-1), null)
    r.scrivi('Tina'); r.ferma(); mock.timers.tick(1000)
    assert.deepEqual(partite, ['Anna'])
  } finally { mock.timers.reset() }
})

test('le pagine usano la ricerca ritardata comune (Nuova prenotazione e foglio Cambia cliente)', () => {
  for (const f of ['app/nuova-prenotazione/page.tsx', 'components/scheda/FoglioCambiaCliente.tsx']) {
    const s = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    assert.match(s, /creaRicercaRitardata\(/, f)
    assert.doesNotMatch(s, /giroRicerca/, f)
  }
  // la finestra vecchia mostra solo i risultati del testo attuale
  assert.match(readFileSync(new URL('../components/CambiaCliente.tsx', import.meta.url), 'utf8'), /const risultati = risultatiPer === testo \? risultatiTutti : \[\]/)
})
