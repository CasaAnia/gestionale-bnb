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

test('A4: nei foglietti (Calendario e Richieste) il numero per esteso sotto il nome coi cerchi a destra; niente cerchi accanto al nome', () => {
  const pezzi = leggi('components/calendario/PezziFoglietto.tsx')
  assert.match(pezzi, /const numero = telefonoPerEsteso\(telefono\)/)
  assert.match(pezzi, /<div className="tel" data-telefono-foglietto=\{dati\}>\s*<span className="num">\{numero\}<\/span>\s*<IconeContatto /)
  const css = leggi('app/maison.css')
  assert.match(css, /\.cal-fog-testa \.tel \{ display: flex; align-items: center; justify-content: space-between;/)
  assert.match(css, /\.cal-fog-testa \.tel \.num \{ font-family: var\(--m-disp\); font-size: 16px;/)
  for (const file of ['components/calendario/FogliettoPrenotazione.tsx', 'components/richieste/FogliettoRichiesta.tsx']) {
    const src = leggi(file)
    assert.match(src, /<div className="hd2">\s*<div className="ti"[^>]*>\{icone && <span className="ic">\{icone\} <\/span>\}\{nome\}<\/div>\s*<\/div>\s*<TelefonoFoglietto /, file)
    assert.doesNotMatch(src, /<IconeContatto /, `${file}: i cerchi stanno nella riga del numero`)
  }
})

test('A4: in fondo ai foglietti i due tasti affiancati (metà larghezza, 12 px, 44 px, 28 px sotto l’ultima riga): azione piena, «Chiudi» a filo', async () => {
  const css = leggi('app/maison.css')
  assert.match(css, /\.fog-tasti-blocco \{ margin-top: 28px; \}/)
  assert.match(css, /\.fog-tasti \{ display: flex; justify-content: center; gap: 12px; \}/)
  assert.match(css, /\.fog-tasti button \{ flex: 0 0 calc\(50% - 6px\);[^}]*height: 44px;[^}]*border: 1px solid var\(--m-ink\);/)
  assert.match(css, /\.fog-tasti \.pieno \{ background: var\(--m-ink\); color: #F6F2EA; \}/)
  assert.match(css, /\.fog-tasti \.filo \{ background: transparent; color: var\(--m-ink\); \}/)
  const cal = leggi('components/calendario/FogliettoPrenotazione.tsx')
  // i tasti stanno dentro, subito sotto le righe (non incollati al bordo in fondo: niente `piede`)
  assert.match(cal, /<\/div>\s*<TastiFoglietto azione=\{APRI_LA_SCHEDA\} onAzione=\{onApri\} datiAzione=\{\{ 'data-apri-scheda': '' \}\} onChiudi=\{onChiudi\} testoChiudi=\{CHIUDI\} \/>\s*<\/FoglioMaison>/)
  assert.doesNotMatch(cal, /piede=\{/)
  const ric = leggi('components/richieste/FogliettoRichiesta.tsx')
  // «Modifica · Rifiuta» sottolineati sopra, l'azione piena e «Chiudi» a filo
  assert.match(ric, /const piena = tutte\.find\(a => a\.azione === 'proposta' \|\| a\.azione === 'conferma'\)/)
  assert.match(ric, /sopra=\{altre\.length > 0 \?/)
  assert.doesNotMatch(ric, /piede=\{/)
  const { ALTEZZA_FOGLIETTO } = await import('./calendarioFoglietto.ts')
  const { ALTEZZA_FOGLIETTO_RICHIESTA } = await import('./richiesteFoglietto.ts')
  assert.equal(ALTEZZA_FOGLIETTO, 500)
  assert.equal(ALTEZZA_FOGLIETTO_RICHIESTA, 440)
})
