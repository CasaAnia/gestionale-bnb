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

// ── B · Fogli ───────────────────────────────────────────────────────────────
test('B1: la riga «Annulla · Salva» sta 24 px sotto il contenuto, in tutti i piedi dei fogli Maison', () => {
  const css = leggi('app/maison.css')
  for (const regola of [
    /\.mz-foot \{[^}]*margin-top: 24px; flex: none; \}/,
    /\.cal-fa-piede \{ flex: none; margin-top: 24px; \}/,
    /\.ric-piede \{[^}]*margin-top: 24px; flex: none; \}/,
    /\.cal-fog-ac \{[^}]*margin-top: 24px; flex: none; \}/,
    /\.cal-ten-ac \{[^}]*margin-top: 24px; flex: none; \}/,
  ]) assert.match(css, regola)
  // il foglio resta ad altezza fissa (la riga non si sposta scegliendo) e mai oltre il 92% dello schermo
  assert.match(leggi('components/maison/FoglioMaison.tsx'), /style=\{\{ height: `min\(\$\{altezza\}px, 92dvh\)` \}\}/)
  // il «Mancato arrivo» ha i tasti nella riga fissa (prima stavano in mezzo al contenuto)
  const mancato = leggi('components/scheda/FoglioMancatoArrivo.tsx')
  assert.match(mancato, /<PiedeFoglio azione=\{/)
  assert.doesNotMatch(mancato, /ed-pillola-contorno/)
})

test('B1: l’altezza nuova di ogni foglio, misurata a 390 px nel suo caso più lungo', async () => {
  const { ALTEZZE_FOGLI } = await import('./altezzeFogli.ts')
  assert.deepEqual({ ...ALTEZZE_FOGLI }, {
    date: 293, cambioCamera: 417, togliCamera: 226, sconto: 382, comePaga: 434, togliPagamento: 297, nota: 389, annulla: 343,
    mancatoArrivo: 500, prezzoSoggiorno: 655, cliente: 771, cambiaCliente: 720, provenienza: 323, chiDorme: 412, persona: 391, notte: 552,
  })
  assert.match(leggi('components/nuova/ConLei.tsx'), /<Foglio titolo=\{TITOLO_FOGLIETTO\} altezza=\{ALTEZZE_FOGLI\.persona\}/)
  const arrivo = leggi('components/scheda/FoglioArrivo.tsx')
  assert.match(arrivo, /export const ALTEZZA_FOGLIO_ARRIVO = 756/)
  assert.match(arrivo, /export const ALTEZZA_FOGLIO_ARRIVO_ARRIVI = 830/)
  assert.match(leggi('components/scheda/FoglioPagamento.tsx'), /export const ALTEZZA_FOGLIO_PAGAMENTO = 611/)
  assert.match(leggi('components/SchedaPulizia.tsx'), /export const ALTEZZA_FOGLIO_PULIZIA = 866/)
  const proposta = leggi('app/richieste/[id]/proposta/page.tsx')
  assert.match(proposta, /const ALTEZZA_INVIATA = 235/)
  assert.match(proposta, /const ALTEZZA_SOSTITUIRE = 174/)
  const calendario = leggi('app/calendario/page.tsx')
  assert.match(calendario, /const ALTEZZA_TENUTA = 366/)
  assert.match(calendario, /const ALTEZZA_CONFERMA_TENUTA = 239/)
})

test('B2: «Dati della cliente» alto 771 (il caso più lungo) e aperto dalla scheda e dalla scheda cliente', () => {
  const scheda = leggi('app/scheda/[id]/page.tsx')
  assert.match(scheda, /<FoglioCliente cliente=\{/)
  // la conferma B la mostra il foglio: la scheda poi chiude e basta (niente doppia conferma)
  assert.match(scheda, /\/\/ la conferma B l'ha già mostrata il foglio \(ritocchi B2\): qui si chiude e basta\n\s*setFoglioCliente\(false\)/)
})

// ── D1 · pagamento_abituale ────────────────────────────────────────────────
test('D1: «paga di solito con» si salva alla PRIMA prenotazione e poi non si aggiorna da solo', async () => {
  const { daSalvareAllaPrima, pagamentoDaComePaga, pagamentoAbitualeDi } = await import('./pagamentoAbituale.ts')
  // cliente senza valore: il modo scelto in «Come paga» si salva su di lei
  assert.equal(daSalvareAllaPrima({ pagamento_abituale: null }, 'contanti'), 'contanti')
  assert.equal(daSalvareAllaPrima({ pagamento_abituale: null }, 'bonifico'), 'bonifico')
  assert.equal(daSalvareAllaPrima({}, 'meta'), 'bonifico', 'caparra = bonifico; anche la cliente appena creata (senza la colonna letta)')
  // «Da vedere» non dice il mezzo: niente
  assert.equal(daSalvareAllaPrima({ pagamento_abituale: null }, 'da_vedere'), null)
  // con un valore già salvato: MAI aggiornato da solo
  assert.equal(daSalvareAllaPrima({ pagamento_abituale: 'contanti' }, 'bonifico'), null)
  assert.equal(daSalvareAllaPrima({ pagamento_abituale: 'bonifico' }, 'contanti'), null)
  assert.deepEqual(['contanti', 'bonifico', 'da_vedere', 'tutto', 'meta', 'caparra'].map(m => pagamentoDaComePaga(m as never)), ['contanti', 'bonifico', null, 'bonifico', 'bonifico', 'bonifico'])
  assert.equal(pagamentoAbitualeDi({ pagamento_abituale: 'assegno' }), null)
  const nuova = leggi('app/nuova-prenotazione/page.tsx')
  // si scrive solo dopo il salvataggio riuscito, e non aggiungendo una camera (il come paga non si tocca)
  assert.match(nuova, /const abituale = aggiungoA \? null : daSalvareAllaPrima\(cliente as \{ pagamento_abituale\?: string \| null \}, comePaga\)\n\s*if \(abituale && cliente\.id\) void salvaPagamentoAbitualeAllaPrima\(String\(cliente\.id\), abituale\)/)
  // la scrittura: solo se ancora vuoto, anche nella query
  assert.match(leggi('lib/pagamentoAbitualeDati.ts'), /\.update\(\{ \[COLONNA_PAGAMENTO_ABITUALE\]: valore \}\)\.eq\('id', guestId\)\.is\(COLONNA_PAGAMENTO_ABITUALE, null\)/)
  // si cambia solo dal foglio «Dati della cliente»
  const { campiDaModulo, moduloDaCliente } = await import('./datiCliente.ts')
  const c = { full_name: 'Maria Rossi', phone: '393427004354', pagamento_abituale: 'contanti' }
  const m = campiDaModulo({ ...moduloDaCliente(c), pagamento: 'bonifico' }, c, { colonnaRicevuta: true, conProvenienza: false, colonnaPagamento: true })
  assert.ok(m.ok && m.campi.pagamento_abituale === 'bonifico')
  const uguale = campiDaModulo(moduloDaCliente(c), c, { colonnaRicevuta: true, conProvenienza: false, colonnaPagamento: true })
  assert.ok(uguale.ok && !('pagamento_abituale' in uguale.campi), 'non cambiato: non si scrive')
  const senzaColonna = campiDaModulo({ ...moduloDaCliente(c), pagamento: 'bonifico' }, c, { colonnaRicevuta: true, conProvenienza: false })
  assert.ok(senzaColonna.ok && !('pagamento_abituale' in senzaColonna.campi), 'senza la 0062 non si scrive')
  // la proposta della colonna
  const sql = leggi('supabase/proposte/0062_pagamento_abituale.BOZZA.sql')
  assert.match(sql, /alter table public\.guests\s+add column if not exists pagamento_abituale text/)
  assert.match(sql, /check \(pagamento_abituale is null or pagamento_abituale in \('contanti', 'bonifico'\)\)/)
})

test('D1: la pastiglia già accesa è quella della cliente (Nuova prenotazione, Come paga della scheda, Aggiungi pagamento)', async () => {
  const { comePagaIniziale, comePagaSchedaConAbituale, metodoIniziale, testoPagamentoAbituale } = await import('./pagamentoAbituale.ts')
  assert.equal(comePagaIniziale('contanti', 'da_vedere'), 'contanti')
  assert.equal(comePagaIniziale(null, 'da_vedere'), 'da_vedere', 'senza valore: come prima')
  // nella scheda: se la prenotazione non dice niente la sua, altrimenti resta quello scelto per la prenotazione
  assert.equal(comePagaSchedaConAbituale('da_vedere', 'bonifico'), 'bonifico')
  assert.equal(comePagaSchedaConAbituale('meta', 'contanti'), 'meta')
  assert.equal(metodoIniziale('bonifico', 'contanti'), 'bonifico')
  assert.equal(metodoIniziale(null, 'contanti'), 'contanti')
  assert.equal(testoPagamentoAbituale('contanti'), 'paga in contanti')
  assert.equal(testoPagamentoAbituale('bonifico'), 'paga con bonifico')
  assert.equal(testoPagamentoAbituale(null), null)
  assert.match(leggi('app/nuova-prenotazione/page.tsx'), /if \(abituale\) setComePaga\(prima => comePagaIniziale\(abituale, prima\)\)/)
  const scheda = leggi('app/scheda/[id]/page.tsx')
  assert.match(scheda, /<FoglioPagamento [^\n]*abituale=\{pagamentoAbitualeDi\(guest/)
  assert.match(scheda, /modo=\{comePagaSchedaConAbituale\(comePagaSalvato\(/)
  assert.match(leggi('components/maison/PagamentoDaHome.tsx'), /abituale: pagamentoAbitualeDi\(scheda\.guests/)
})
