// La richiesta a linguette (Richieste «Maison», novità 14d e 14e del 29/09/2026)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { LINGUETTE_RICHIESTA, linguettaDaHash, linguettaDiPartenza, mostraAlternativaAmelia, dividiNotaOpzioni } from './richiestaMaison.ts'

const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('quattro linguette, nell’ordine, e la scelta nell’indirizzo (#controllare, #camere, #pagamento, #messaggio)', () => {
  assert.deepEqual(LINGUETTE_RICHIESTA.map(l => l.label), ['Controllare', 'Camere', 'Pagamento', 'Messaggio'])
  assert.equal(linguettaDaHash('#camere', 'controllare'), 'camere')
  assert.equal(linguettaDaHash('#pagamento', 'controllare'), 'pagamento')
  assert.equal(linguettaDaHash('messaggio', 'controllare'), 'messaggio')
  // niente o un indirizzo storto: la linguetta di partenza
  assert.equal(linguettaDaHash('', 'controllare'), 'controllare')
  assert.equal(linguettaDaHash('#conto', 'messaggio'), 'messaggio')
  // all'apertura Controllare, Messaggio se la proposta è già inviata
  assert.equal(linguettaDiPartenza('in_attesa'), 'controllare')
  assert.equal(linguettaDiPartenza('proposta_inviata'), 'messaggio')
  assert.equal(linguettaDiPartenza(undefined), 'controllare')
})

test('dal telefono una parte alla volta, dal Mac la pagina unica a 620 px con la fascia che porta alla sezione', () => {
  const pagina = leggi('app/richieste/[id]/proposta/page.tsx')
  assert.match(pagina, /const vediParte = \(l: LinguettaRichiesta\) => paginaUnica \|\| linguetta === l/)
  for (const l of ['controllare', 'camere', 'pagamento', 'messaggio']) assert.match(pagina, new RegExp(`id="parte-${l}"`))
  assert.match(pagina, /<LinguetteRichiesta scelta=\{linguetta\} onScegli=\{sceltaLinguetta\} paginaUnica=\{paginaUnica\} \/>/)
  const css = leggi('app/maison.css')
  assert.match(css, /@media \(min-width: 768px\) \{ \.ric-pag \{ max-width: 620px; margin: 0 auto; \} \}/)
  assert.match(css, /\.sch-tabs\.quattro \{ grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/)
  // «Avanti» solo dal telefono; un solo tasto pieno per parte
  assert.match(pagina, /const avanti = \(l: LinguettaRichiesta, testo: string, pieno: boolean\) => \(paginaUnica \? null/)
  assert.match(pagina, /avanti\('camere', 'Avanti · Camere', false\)/)
  assert.match(pagina, /avanti\('pagamento', 'Avanti · Pagamento', true\)/)
  assert.match(pagina, /avanti\('messaggio', 'Avanti · Il messaggio', true\)/)
})

test('l’alternativa Ambra/Allegra sta sotto le camere e compare solo con Amelia scelta (novità 14e)', () => {
  assert.equal(mostraAlternativaAmelia({ amelia: true, ameliaScelta: true, completo: false, inviataBloccata: false }), true)
  assert.equal(mostraAlternativaAmelia({ amelia: true, ameliaScelta: false, completo: false, inviataBloccata: false }), false)
  assert.equal(mostraAlternativaAmelia({ amelia: false, ameliaScelta: true, completo: false, inviataBloccata: false }), false)
  assert.equal(mostraAlternativaAmelia({ amelia: true, ameliaScelta: true, completo: true, inviataBloccata: false }), false)
  assert.equal(mostraAlternativaAmelia({ amelia: true, ameliaScelta: true, completo: false, inviataBloccata: true }), false)
  const pagina = leggi('app/richieste/[id]/proposta/page.tsx')
  const camere = pagina.slice(pagina.indexOf('id="parte-camere"'), pagina.indexOf('id="parte-pagamento"'))
  assert.match(camere, /data-alternativa-amelia/)
  assert.match(camere, /Aggiungi l’alternativa Ambra\/Allegra/)
  // non più in «Come paga»
  const paga = pagina.slice(pagina.indexOf('id="parte-pagamento"'), pagina.indexOf('id="parte-messaggio"'))
  assert.equal(/alternativa Ambra/.test(paga), false)
})

test('la nota delle opzioni divisa in titolo e testo, come nel riferimento', () => {
  assert.deepEqual(dividiNotaOpzioni('Amelia è in opzione fino alle 18:00 per L. Greco. Libere per tutto il periodo: Ambra.'), ['Amelia è in opzione', ' fino alle 18:00 per L. Greco. Libere per tutto il periodo: Ambra.'])
  assert.deepEqual(dividiNotaOpzioni('Ambra era in opzione per Mario Rossi, scaduta alle 16:40. Puoi proporla.')[0], 'Ambra era in opzione')
  assert.deepEqual(dividiNotaOpzioni('Nessuna camera è proponibile: Amelia è in opzione fino alle 18:00 per X.')[0], 'Nessuna camera è proponibile: Amelia è in opzione')
  assert.deepEqual(dividiNotaOpzioni('altro'), ['', 'altro'])
})
