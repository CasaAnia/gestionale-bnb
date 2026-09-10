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

// Attesa aggiornata il 10/09/2026: nella scheda le date del soggiorno (anche
// quelle di un cambio camera) sono passate al vestito nuovo, cioè alle classi
// di nuova.module.css già controllate qui sopra. La protezione è la stessa e
// il controllo ora è diretto: NESSUNA casella data della scheda può avere la
// larghezza propria del controllo nativo su un iPhone stretto.
test('modifica e prolungamento mantengono la stessa protezione delle caselle data', () => {
  const righe = dettaglio.split('\n')
  const inizi = righe.map((r, i) => [r, i] as const).filter(([r]) => r.includes('type="date"')).map(([, i]) => i)
  assert.ok(inizi.length >= 6, 'la scheda ha le caselle data della modifica, delle date e del soggiorno')
  for (const inizio of inizi) {
    // il tag della casella, dalla riga di apertura fino a dove si chiude
    let fine = inizio
    while (fine < righe.length && !righe[fine].includes('/>')) fine += 1
    const tag = righe.slice(inizio, fine + 1).join(' ')
    assert.ok(
      tag.includes('className={v.campo}') || tag.includes('min-w-0'),
      `casella data senza protezione della larghezza, riga ${inizio + 1}`,
    )
  }
})
