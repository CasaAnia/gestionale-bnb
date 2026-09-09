import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const nuova = readFileSync(new URL('../app/nuova/page.tsx', import.meta.url), 'utf8')
const stileNuova = readFileSync(new URL('../app/nuova/nuova.module.css', import.meta.url), 'utf8')
const dettaglio = readFileSync(new URL('../app/prenotazioni/[id]/page.tsx', import.meta.url), 'utf8')

function occorrenze(testo: string, frammento: string) {
  return testo.split(frammento).length - 1
}

// Attesa aggiornata il 09/09/2026: la pagina è stata rifatta col disegno
// scelto da Ania e i campi non hanno più le classi Tailwind in linea, stanno
// in app/nuova/nuova.module.css. La protezione controllata è la stessa: su un
// iPhone stretto le due caselle data non devono uscire dallo schermo, cioè le
// colonne e i campi possono rimpicciolirsi (min-width: 0), il campo prende
// tutta la colonna e non ha la larghezza propria del controllo nativo.
test('nuova prenotazione protegge entrambe le caselle data dalla larghezza minima di iPhone', () => {
  assert.ok(occorrenze(nuova, 'type="date"') >= 2, 'servono le due caselle data')
  assert.ok(/\.due \{[^}]*min-width: 0/.test(stileNuova), 'la riga a due colonne deve poter rimpicciolire')
  assert.ok(/\.due > \* \{[^}]*min-width: 0/.test(stileNuova), 'le due colonne devono poter rimpicciolire')
  const campo = stileNuova.match(/\.campo \{[^}]*\}/)?.[0] ?? ''
  assert.ok(/min-width: 0/.test(campo) && /width: 100%/.test(campo), 'il campo riempie la colonna e può rimpicciolire')
  assert.ok(/appearance: none/.test(campo), 'niente larghezza propria del controllo nativo')
})

test('modifica e prolungamento mantengono la stessa protezione delle caselle data', () => {
  assert.ok(occorrenze(dettaglio, '<div className="min-w-0">') >= 4)
  assert.ok(occorrenze(dettaglio, 'w-full min-w-0 appearance-none') >= 4)
})
