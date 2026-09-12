import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TITOLO_RICHIESTE, sottotitoloRichieste } from './testataRichieste.ts'

// ── LA TESTA DELLA PAGINA (Ania, su bozza, 12/09/2026) ─────────────────────

test('la riga sotto il titolo dice quante aperte e quante nuove dal sito', () => {
  assert.equal(sottotitoloRichieste({ aperte: 4, nuoveDalSito: 2 }), '4 aperte · 2 nuove dal sito')
  // singolare giusto da tutte e due le parti
  assert.equal(sottotitoloRichieste({ aperte: 1, nuoveDalSito: 1 }), '1 aperta · 1 nuova dal sito')
  // senza nuove dal sito non si scrive «0 nuove»: si tace
  assert.equal(sottotitoloRichieste({ aperte: 3, nuoveDalSito: 0 }), '3 aperte')
  assert.equal(sottotitoloRichieste({ aperte: 3 }), '3 aperte')
  // pagina vuota
  assert.equal(sottotitoloRichieste({ aperte: 0, nuoveDalSito: 0 }), 'nessuna aperta')
  assert.equal(sottotitoloRichieste({ aperte: 0, nuoveDalSito: 2 }), 'nessuna aperta · 2 nuove dal sito')
  // numeri storti: mai un meno a schermo
  assert.equal(sottotitoloRichieste({ aperte: -1, nuoveDalSito: -5 }), 'nessuna aperta')
})

test('il titolo è «Richieste» in Georgia 26, il conto sotto in 12,5 stone', () => {
  assert.equal(TITOLO_RICHIESTE, 'Richieste')
  const testata = readFileSync(new URL('../components/richieste/TestataRichieste.tsx', import.meta.url), 'utf8')
  assert.match(testata, /fontFamily: GEORGIA, fontSize: 26/)
  assert.match(testata, /fontSize: 12\.5, color: 'var\(--color-stone\)'/)

  // Il titolo lungo di ieri non c'è più, e non è più nascosto sul telefono
  const pagina = readFileSync(new URL('../app/richieste/page.tsx', import.meta.url), 'utf8')
  assert.equal(/Richieste di prenotazione/.test(pagina), false, 'il titolo lungo è ancora lì')
  assert.equal(/max-lg:invisible/.test(pagina), false, 'il titolo è ancora nascosto sul telefono')
  // la testa c'è in tutte e tre le vesti (Mac, telefono girato, telefono dritto)
  assert.equal(pagina.match(/<TestataRichieste /g)?.length, 3)
})
