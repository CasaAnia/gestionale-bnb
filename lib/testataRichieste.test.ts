import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sottotitoloRichieste } from './testataRichieste.ts'

// ── LA TESTA DELLA PAGINA (Ania, dal telefono, 12/09/2026) ────────────────

test('la riga in cima dice quante aperte e quante nuove dal sito', () => {
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

// Il titolo sopra il conto non c'è più (Ania, dal telefono, 12/09/2026): la
// barra in alto dice già dove si è, e leggerlo due volte rubava una riga.
test('in cima c\u2019è solo il conto, in 13,5 stone: nessun titolo sopra', () => {
  const testata = readFileSync(new URL('../components/richieste/TestataRichieste.tsx', import.meta.url), 'utf8')
  assert.match(testata, /fontSize: 13\.5, color: 'var\(--color-stone\)'/)
  // niente più titolo: né il tag, né il carattere con cui era scritto
  assert.equal(/<h1/.test(testata), false, 'il titolo «Richieste» è ancora lì')
  assert.equal(/fontFamily|TITOLO_RICHIESTE/.test(testata), false, 'il titolo in Georgia è ancora lì')
  const lib = readFileSync(new URL('./testataRichieste.ts', import.meta.url), 'utf8')
  assert.equal(/TITOLO_RICHIESTE/.test(lib), false, 'il testo del titolo è rimasto nella libreria')

  // Il titolo lungo di ieri non c'è più, e non è più nascosto sul telefono
  const pagina = readFileSync(new URL('../app/richieste/page.tsx', import.meta.url), 'utf8')
  assert.equal(/Richieste di prenotazione/.test(pagina), false, 'il titolo lungo è ancora lì')
  assert.equal(/max-lg:invisible/.test(pagina), false, 'il titolo è ancora nascosto sul telefono')
  // la testa c'è in tutte e tre le vesti (Mac, telefono girato, telefono dritto)
  assert.equal(pagina.match(/<TestataRichieste /g)?.length, 3)
  // e il conto è la PRIMA cosa della pagina, prima del calendario e dei comandi
  assert.ok(pagina.indexOf('<TestataRichieste ') < pagina.indexOf('<CalendarioRichieste'), 'il conto non è la prima cosa della pagina')
})
