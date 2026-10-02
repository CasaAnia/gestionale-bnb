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
test('A1: 18 px fra il nastro e «Oggi · mesi», «Legenda» 28 px sotto «Oggi» (dal 30/09/2026, anche nelle Richieste), «Oggi» tocca 44 × 44; solo dal telefono', () => {
  const css = leggi('app/maison.css')
  const blocco = /@media \(max-width: 1023px\) \{\s*\.cal-rm\.cal-rm-staccata \{ margin-top: 18px; \}\s*\.cal-rm\.cal-rm-staccata \.og button::before \{ left: 50%; right: auto; width: max\(100%, 44px\); transform: translate\(-50%, -50%\); \}\s*\/\*[^*]*\*\/\s*\.cal-lg, \.cal-lg\.cal-lg-staccata \{ margin-top: 26px; \}\s*\}/
  assert.match(css, blocco)
  // l'area di tocco è già alta 44 px
  assert.match(css, /\.cal-rm \.og button::before \{[^}]*height: 44px;/)
  for (const file of ['app/calendario/page.tsx', 'app/arrivi/page.tsx']) {
    const src = leggi(file)
    assert.match(src, /<RigaMesi maison [\s\S]{0,400}?className=\{`shrink-0 cal-rm-staccata /, file)
    assert.match(src, /className="cal-lg cal-lg-staccata"/, file)
  }
  // le Richieste: niente «staccata» sulla riga dei mesi, ma «Legenda» a 28 px come le altre (regola su .cal-lg)
  assert.doesNotMatch(leggi('components/richieste/NastroRichieste.tsx'), /staccata/)
  assert.match(leggi('components/richieste/NastroRichieste.tsx'), /className="cal-lg"/)
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
  assert.match(arrivo, /export const ALTEZZA_FOGLIO_ARRIVO = 713/)
  assert.match(arrivo, /export const ALTEZZA_FOGLIO_ARRIVO_ARRIVI = 729/)
  assert.match(leggi('components/scheda/FoglioPagamento.tsx'), /export const ALTEZZA_FOGLIO_PAGAMENTO = 611/)
  // Dal 01/10/2026 (P7): i fogli delle Pulizie alti uguali, fino a 790 px per i comandi del timer, tasti a 96 px dal fondo
  assert.match(leggi('components/SchedaPulizia.tsx'), /export const ALTEZZA_FOGLIO_PULIZIA = ALTEZZA_FOGLI_PULIZIE/)
  assert.match(leggi('components/pulizie/FoglioPulizie.tsx'), /export const ALTEZZA_FOGLI_PULIZIE = 790/)
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

// ── C4 · la freccia torna da dove si è venuti ───────────────────────────────
test('C4: la freccia «‹» dice e riporta alla pagina di provenienza, per ogni pagina; senza, «‹ Prenotazioni»', async () => {
  const { hrefScheda, provenienzaScheda, conDaDellaScheda } = await import('./provenienzaScheda.ts')
  const p = (q: string) => new URLSearchParams(q)
  const casi: [string, string, string][] = [
    ['da=home', 'Oggi', '/'],
    ['da=calendario', 'Calendario', '/calendario'],
    ['da=arrivi', 'Arrivi', '/arrivi'],
    ['da=richieste', 'Richieste', '/richieste'],
    ['da=richiesta&avviso=x', 'Richieste', '/richieste'],
    ['da=cliente&cliente=g1', 'Cliente', '/clienti/g1'],
    ['da=prenotazioni', 'Prenotazioni', '/prenotazioni'],
    ['', 'Prenotazioni', '/prenotazioni'],
    ['da=boh', 'Prenotazioni', '/prenotazioni'],
    ['azione=pagato&da=home', 'Oggi', '/'],
  ]
  for (const [q, etichetta, riserva] of casi) {
    const r = provenienzaScheda(p(q))
    assert.deepEqual([r.etichetta, r.riserva], [etichetta, riserva], q)
  }
  assert.equal(hrefScheda('b1', 'calendario'), '/scheda/b1?da=calendario')
  assert.equal(hrefScheda('b1', 'cliente', { cliente: 'g1' }), '/scheda/b1?da=cliente&cliente=g1')
  assert.equal(hrefScheda('b1', 'home', { query: 'azione=pagato' }), '/scheda/b1?azione=pagato&da=home')
  // passando a un'altra camera (dopo un salvataggio) la provenienza resta
  assert.equal(conDaDellaScheda('b2', p('da=arrivi')), '/scheda/b2?da=arrivi')
  assert.equal(conDaDellaScheda('b2', p('da=cliente&cliente=g1&salvata=1')), '/scheda/b2?da=cliente&cliente=g1')
  assert.equal(conDaDellaScheda('b2', p('')), '/scheda/b2')
  const scheda = leggi('app/scheda/[id]/page.tsx')
  assert.match(scheda, />‹ \{daDove\.etichetta\}<\/button>/)
  assert.equal((scheda.match(/router\.replace\(conDaDellaScheda\(/g) || []).length, 2)
  assert.doesNotMatch(scheda, /router\.replace\(`\/scheda\//)
  // le linguette cambiano l'indirizzo tenendo i parametri (il `da` resta dopo i salvataggi)
  assert.match(leggi('components/scheda/LinguetteScheda.tsx'), /const url = `\$\{window\.location\.pathname\}\$\{window\.location\.search\}#\$\{l\}`/)
  // ogni link che apre la scheda dice da dove
  const link: [string, RegExp][] = [
    ['components/ArriviOggi.tsx', /hrefScheda\(b\.id, 'home'\)/], ['components/maison/SoldiHome.tsx', /hrefScheda\(p\.bookingId, 'home'\)/],
    ['components/RichiesteHome.tsx', /hrefScheda\(r\.id, 'home'\)/], ['lib/daControllare.ts', /hrefScheda\(d\.prenotazioneId, 'home'\)/],
    ['app/calendario/page.tsx', /hrefScheda\(booking\.id, 'calendario'\)/], ['app/arrivi/page.tsx', /hrefScheda\(popup\.id, 'arrivi'\)/],
    ['app/richieste/page.tsx', /hrefScheda\(r\.prenotazione_id, 'richieste'\)/], ['components/richieste/NastroRichieste.tsx', /hrefScheda\(aperta\.id, 'richieste'\)/],
    ['app/prenotazioni/page.tsx', /hrefScheda\(b\.id, 'prenotazioni'\)/], ['app/clienti/[id]/page.tsx', /hrefScheda\(r\.prenotazioneId, 'cliente', \{ cliente: String\(id\) \}\)/],
  ]
  for (const [file, re] of link) assert.match(leggi(file), re, file)
})

// ── D2 · elenco clienti ─────────────────────────────────────────────────────
test('D2: le righe dell’elenco clienti — icone, nome, telefono per esteso coi cerchi, «da Nida · 4 soggiorni · 640 €»', async () => {
  const { rigaElenco, iconeCliente, filtraElenco, conclusiPerCliente } = await import('./clientiElenco.ts')
  const testo = (p: { testo: string }[]) => p.map(x => x.testo).join('')
  const maria = { id: 'm', full_name: 'Maria Rossi', phone: '393427004354', rating: 'ottimo', vuole_ricevuta: true, provenienza: 'altra_struttura', struttura_nome: 'Nida' }
  assert.equal(testo(rigaElenco(maria, { n: 4, ricaviCent: 64000 })), 'da Nida · 4 soggiorni · 640 €')
  assert.deepEqual(rigaElenco(maria, { n: 4, ricaviCent: 64000 }).find(p => p.mat)?.testo, '640 €', 'lo speso in mattone')
  assert.equal(testo(rigaElenco({ id: 'l', provenienza: 'passaparola' }, { n: 0, ricaviCent: 0 })), 'da passaparola · prima volta')
  assert.equal(testo(rigaElenco({ id: 'p', provenienza: 'google', motivo_problematico: 'non ha pagato' }, { n: 2, ricaviCent: 31000 })), 'da Google · 2 soggiorni · 310 € · motivo interno')
  assert.equal(testo(rigaElenco({ id: 'x' }, { n: 1, ricaviCent: 18000 })), 'provenienza non nota · 1 soggiorno · 180 €')
  assert.deepEqual(iconeCliente(maria), { ricevuta: true, stella: true, problema: false })
  assert.deepEqual(iconeCliente({ id: 'p', rating: 'problematico' }), { ricevuta: false, stella: false, problema: true })
  // la ricerca di sempre: nome o telefono
  const tutti = [maria, { id: 'g', full_name: 'Giovanni Serra', phone: '393351182204' }]
  assert.deepEqual(filtraElenco(tutti, 'mar').map(g => g.id), ['m'])
  assert.deepEqual(filtraElenco(tutti, '335118').map(g => g.id), ['g'])
  // i soggiorni conclusi per cliente (un cambio camera = un soggiorno)
  const c = conclusiPerCliente([
    { id: 'a', guest_id: 'm', prenotazione_id: 'P', check_in: '2026-04-29', check_out: '2026-05-02', status: 'completata', total_amount: 200 },
    { id: 'b', guest_id: 'm', prenotazione_id: 'P', check_in: '2026-05-02', check_out: '2026-05-04', status: 'completata', total_amount: 200 },
    { id: 'c', guest_id: 'm', check_in: '2026-12-01', check_out: '2026-12-03', status: 'confermata', total_amount: 160 },
  ], '2026-09-29')
  assert.deepEqual(c.get('m'), { n: 1, ricaviCent: 40000 })
  const pagina = leggi('app/clienti/page.tsx')
  assert.match(pagina, /<CampoRicerca maison value=\{search\} onChange=\{setSearch\} \/>/)
  assert.match(pagina, /Clienti · \{filtered\.length\}/)
  assert.match(pagina, /`\/clienti\/nuovo\?ricerca=\$\{encodeURIComponent\(search\.trim\(\)\)\}`/)
  assert.match(pagina, /\{nuovo\('\+ Nuovo cliente'\)\}/)
  assert.match(pagina, /supabase\.from\('guests'\)\.select\('\*'\)\.order\('created_at', \{ ascending: false \}\)/)
  assert.match(pagina, /Nessun cliente trovato/)
  assert.match(pagina, /onClick=\{\(\) => router\.push\(`\/clienti\/\$\{g\.id\}`\)\}/)
  assert.match(pagina, /<IconeContatto telefono=\{g\.phone \?\? null\}/)
  const css = leggi('app/maison.css')
  assert.match(css, /\.cli-riga \.cn2 \{ font-family: var\(--m-disp\); font-size: 19px;/)
  assert.match(css, /\.cli-riga \.tel2 \.num \{ font-family: var\(--m-disp\); font-size: 16px;/)
  assert.match(css, /\.cli-riga \.tel2 \.sch-ic a \{ width: 26px; height: 26px; \}/)
  assert.match(css, /\.cli-riga \.cd \{[^}]*font-size: 12\.5px;/)
  // dal Mac: scrittina con ricerca e «+ Nuovo cliente», elenco a 620 px, misure vere
  assert.match(pagina, /<TestaMac titolo="Clienti"/)
  assert.match(css, /@media \(min-width: 1024px\) \{ \.cli-elenco \{ max-width: 620px; margin: 0 auto; \} \}/)
  assert.match(leggi('components/MainContainer.tsx'), /const NO_ZOOM = \[[^\]]*'\/clienti'\]/)
})

// ── D3 · scheda cliente, D4 · nuovo cliente ─────────────────────────────────
test('D3: la testata della scheda cliente (riga coi soli pezzi presenti, speso in mattone) e le righe dei soggiorni', async () => {
  const { rigaTestaCliente, rigaSoggiornoCliente, importoSoggiorno } = await import('./schedaCliente.ts')
  const t = (p: { testo: string }[]) => p.map(x => x.testo).join('')
  const maria = { provenienza: 'altra_struttura', struttura_nome: 'Nida', rating: 'ottimo', vuole_ricevuta: true, pagamento_abituale: 'contanti' }
  assert.equal(t(rigaTestaCliente(maria, { n: 4, ricaviCent: 64000 })), 'da Nida · 4 soggiorni · 640 € · ricevuta · ottimo · paga in contanti')
  assert.equal(rigaTestaCliente(maria, { n: 4, ricaviCent: 64000 }).find(p => p.mat)?.testo, '640 €')
  assert.equal(t(rigaTestaCliente({ provenienza: 'non_so', pagamento_abituale: 'bonifico' }, { n: 0, ricaviCent: 0 })), 'paga con bonifico')
  assert.equal(t(rigaTestaCliente({}, { n: 0, ricaviCent: 0 })), '')
  const r = { check_in: '2026-04-03', check_out: '2026-04-06', status: 'completata', extra_bed: true }
  assert.equal(rigaSoggiornoCliente(r, { check_in_time: '17:00', shuttle: 'si' }, true), '3 apr → 6 apr 2026 · arrivo 17:00 · 🚌 · 🛏 letto in più')
  assert.equal(rigaSoggiornoCliente({ ...r, extra_bed: false }, { check_in_time: null, shuttle: 'no' }, true), '3 apr → 6 apr 2026 · orario non registrato · no navetta')
  assert.equal(rigaSoggiornoCliente({ ...r, status: 'annullata', extra_bed: false }, { check_in_time: '17:00' }, true), '3 apr → 6 apr 2026')
  assert.equal(importoSoggiorno({ status: 'completata', totaleCent: 24000 }), '240 €')
  assert.equal(importoSoggiorno({ status: 'annullata', totaleCent: 0 }), '—')
  const pagina = leggi('app/clienti/[id]/page.tsx')
  assert.match(pagina, />‹ Clienti<\/button>/)
  assert.match(pagina, /<IconeContatto telefono=\{guest\.phone \?\? null\}/)
  assert.match(pagina, /data-email-cliente/)
  assert.match(pagina, /<strong>Motivo interno:<\/strong> \{motivo\}/)
  // «Modifica dati» apre il foglio «Dati della cliente» (anche ?edit=1); «Nuova prenotazione» col cliente scelto
  assert.match(pagina, /useState\(searchParams\.get\('edit'\) === '1'\)/)
  assert.match(pagina, /onClick=\{\(\) => setFoglioDati\(true\)\}>Modifica dati</)
  assert.match(pagina, /href=\{`\/nuova-prenotazione\?guest_id=\$\{guest\.id\}`\}/)
  // i tre numeri come prima, gli ultimi arrivi, i documenti, i soggiorni, elimina
  assert.match(pagina, /const storico = storicoCliente\(bookings\)/)
  for (const t of ['>Soggiorni<', '>Totale speso<', '>Annullate<', 'Ultimi arrivi', 'Nessuna prenotazione', 'Cliente non trovato', 'Sei sicuro? Questa azione non si può annullare. Le prenotazioni associate rimarranno nel sistema.', "'Sì, elimina'"]) assert.ok(pagina.includes(t), t)
  assert.match(pagina, /<DocumentiCliente guestId=\{String\(id\)\} \/>/)
  assert.match(pagina, /<FoglioMaison titolo="Elimina cliente"/)
  const doc = leggi('components/DocumentiCliente.tsx')
  assert.match(doc, /<FoglioMaison titolo="Eliminare questo documento\?"/)
  assert.match(doc, /\{etichettaLeggibile\(daCancellare\)\} · non si può recuperare\./)
  assert.match(doc, /ETICHETTE\.filter\(e => e\.chiave !== 'documento'\)/)
  assert.match(doc, /\{caricando \? 'Carico…' : 'Aggiungi documento'\}/)
  assert.match(doc, /<VisoreDocumento /)
  assert.match(doc, /Nessun documento allegato\./)
  const css = leggi('app/maison.css')
  assert.match(css, /\.cli-doc-griglia \{ display: grid; grid-template-columns: 1fr 1fr;/)
  assert.match(css, /aspect-ratio: 4 \/ 3;/)
})

test('D4: nuovo cliente nella veste del modulo Maison, stesso salvataggio, poi la scheda del cliente', () => {
  const p = leggi('app/clienti/nuovo/page.tsx')
  assert.match(p, /placeholder="\+39 333 1234567"/)
  assert.match(p, /rawP\.startsWith\('39'\) \? rawP : `39\$\{rawP\}`/)
  assert.match(p, /Email · può restare vuota/)
  assert.match(p, /'Inserisci almeno nome o numero di telefono\.'/)
  assert.match(p, /\{saving \? 'Salvataggio\.\.\.' : 'Salva cliente'\}/)
  assert.match(p, /router\.push\(`\/clienti\/\$\{data\.id\}`\)/)
  assert.match(p, /moduloDaRicerca\(ricerca\)/)
})

test('proposta nelle Richieste (Ania, 30/09/2026): contanti → «All’arrivo» già acceso; bonifico o niente → nulla', async () => {
  const { condizioneDaAbituale, pagamentoAbitualeDi } = await import('./pagamentoAbituale.ts')
  assert.equal(condizioneDaAbituale(pagamentoAbitualeDi({ pagamento_abituale: 'contanti' })), 'arrivo')
  assert.equal(condizioneDaAbituale(pagamentoAbitualeDi({ pagamento_abituale: 'bonifico' })), null)
  assert.equal(condizioneDaAbituale(pagamentoAbitualeDi({ pagamento_abituale: null })), null)
  assert.equal(condizioneDaAbituale(pagamentoAbitualeDi({})), null, 'senza la 0062 la colonna non c’è: come prima')
  assert.equal(condizioneDaAbituale(pagamentoAbitualeDi(null)), null, 'cliente nuova')
  const proposta = leggi('app/richieste/[id]/proposta/page.tsx')
  // il cliente è quello riconosciuto di sempre (telefono, poi nome e cognome)
  assert.match(proposta, /const condizioneIniziale = condizioneDaAbituale\(pagamentoAbitualeDi\(guest as/)
  // una volta sola all'apertura, mai su una proposta già inviata, e senza scavalcare una scelta già fatta
  assert.match(proposta, /if \(loading \|\| !richiesta \|\| inviata \|\| preselezioneFatta\.current\) return/)
  assert.match(proposta, /if \(condizioneIniziale\) setCondizioneTipo\(t => t \?\? condizioneIniziale\)/)
  // ripartendo da capo (altra soluzione, «No» a «L'hai inviata?») si torna alla stessa partenza
  assert.match(proposta, /setCondizioneTipo\(condizioneIniziale\); setCaparraTesto\(''\)/)
  assert.doesNotMatch(proposta, /setCondizioneTipo\(null\)/)
})
