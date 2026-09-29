// ============================================================================
// RITOCCHI «MAISON» DAL TELEFONO (incarico del 29/09/2026, checklist in
// docs/design/ritocchi-checklist.md): le guardie dei punti che non hanno un
// test loro altrove. Ogni test porta il codice della voce.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BUCHI_LIBERI_VISIBILI } from './calendarioMobile.ts'

const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

// ── A · Calendario e Arrivi ─────────────────────────────────────────────────
test('A1: 18 px fra il nastro e «Oggi · mesi», «Legenda» 14 px sotto «Oggi», «Oggi» tocca 44 × 44; solo dal telefono, solo Calendario e Arrivi', () => {
  const css = leggi('app/maison.css')
  const blocco = /@media \(max-width: 1023px\) \{\s*\.cal-rm\.cal-rm-staccata \{ margin-top: 18px; \}\s*\.cal-rm\.cal-rm-staccata \.og button::before \{ left: 50%; right: auto; width: max\(100%, 44px\); transform: translate\(-50%, -50%\); \}\s*\.cal-lg\.cal-lg-staccata \{ margin-top: 12px; \}\s*\}/
  assert.match(css, blocco)
  // l'area di tocco è già alta 44 px
  assert.match(css, /\.cal-rm \.og button::before \{[^}]*height: 44px;/)
  for (const file of ['app/calendario/page.tsx', 'app/arrivi/page.tsx']) {
    const src = leggi(file)
    assert.match(src, /<RigaMesi maison [\s\S]{0,400}?className=\{`shrink-0 cal-rm-staccata /, file)
    assert.match(src, /className="cal-lg cal-lg-staccata"/, file)
  }
  // le Richieste restano come sono
  assert.doesNotMatch(leggi('components/richieste/NastroRichieste.tsx'), /staccata/)
})

test('A3: prova reversibile, i buchi liberi tratteggiati non si disegnano; il tocco su un giorno libero apre lo stesso la nuova prenotazione', () => {
  assert.equal(BUCHI_LIBERI_VISIBILI, false)
  for (const file of ['app/calendario/page.tsx', 'app/arrivi/page.tsx']) {
    const src = leggi(file)
    assert.match(src, /\{BUCHI_LIBERI_VISIBILI && buchi\.map\(h => \{/, file)
    // la corsia prende il tocco sul giorno esatto (colonna toccata) e apre la nuova prenotazione
    assert.match(src, /<CorsiaNastro [^>]*\n?\s*onClick=\{e => \{[\s\S]{0,400}?const idx = Math\.floor\(x \/ CELL_W\)[\s\S]{0,200}?router\.push\(`\/nuova-prenotazione\?room_id=\$\{room\.id\}&check_in=\$\{dateStr\}`\)/, file)
  }
})
