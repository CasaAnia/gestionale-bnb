import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { nomeCompleto, nomeBreve, spezzaNome, salutoDaNominativo, salutoDaCampoNome, salutoOspite, NOME_DA_CONTROLLARE } from './guestName.ts'

// «Nome Cognome» ovunque, mai «Cognome Nome»
test('nomeCompleto: nome e cognome, nell\'ordine giusto e senza spazi doppi', () => {
  assert.equal(nomeCompleto({ nome: 'Anna', cognome: 'Rossi' }), 'Anna Rossi')
  assert.equal(nomeCompleto({ nome: ' Anna ', cognome: '  Rossi ' }), 'Anna Rossi')
  assert.equal(nomeCompleto({ nome: 'Maria Luisa', cognome: 'De  Santis' }), 'Maria Luisa De Santis')
})

test('nomeCompleto: solo nome, solo cognome, niente', () => {
  assert.equal(nomeCompleto({ nome: 'Anna', cognome: '' }), 'Anna')
  assert.equal(nomeCompleto({ nome: '', cognome: 'Rossi' }), 'Rossi')
  assert.equal(nomeCompleto({ nome: ' ', cognome: null }), '')
  assert.equal(nomeCompleto({}), '')
  assert.equal(nomeCompleto({ nome: null, cognome: undefined }), '')
})

test('nomeCompleto: scheda cliente col campo unico full_name (già «Nome Cognome»), ripulito', () => {
  assert.equal(nomeCompleto({ full_name: '  Mario   Rossi ' }), 'Mario Rossi')
  assert.equal(nomeCompleto({ full_name: null }), '')
  // nome e cognome separati vincono sul campo unico
  assert.equal(nomeCompleto({ nome: 'Anna', cognome: 'Rossi', full_name: 'Rossi Anna' }), 'Anna Rossi')
  assert.equal(nomeCompleto({ nome: '', cognome: '', full_name: 'Luca Bianchi' }), 'Luca Bianchi')
})

test('nomeBreve: «Nome C.» per le barre strette', () => {
  assert.equal(nomeBreve({ nome: 'Anna', cognome: 'Rossi' }), 'Anna R.')
  assert.equal(nomeBreve({ nome: ' Marek ', cognome: ' Kowalski' }), 'Marek K.')
  assert.equal(nomeBreve({ nome: 'Anna', cognome: '' }), 'Anna')
  assert.equal(nomeBreve({ nome: '', cognome: 'Rossi' }), 'Rossi')
  assert.equal(nomeBreve({ nome: '', cognome: '' }), '')
})

// ── IL SALUTO DEI MESSAGGI (Ania, 21/09/2026) ──────────────────────────────
// Regola unica: «Gentile [Nome],» — il solo nome, in TUTTI i messaggi.
// La vecchia eccezione del 12/09/2026 (nome e cognome nella conferma senza
// immagine) è superata: non deve tornare, e la guardia in fondo lo controlla.

test('il nome del saluto da un campo unico «Nome Cognome»', () => {
  assert.equal(salutoDaNominativo('Anna Rossi').nome, 'Anna')
  assert.equal(salutoDaNominativo('Anna Rossi').sicuro, true)
  // nome composto: non si taglia
  assert.equal(salutoDaNominativo('Maria Grazia Rossi').nome, 'Maria Grazia')
  assert.equal(salutoDaNominativo('Maria Grazia Anna Rossi').nome, 'Maria Grazia Anna')
  // cognome composto: la particella tira con sé tutto il resto
  assert.equal(salutoDaNominativo('Anna Maria De Luca').nome, 'Anna Maria')
  assert.equal(salutoDaNominativo('Anna De Luca').nome, 'Anna')
  assert.equal(salutoDaNominativo('Gianni La Rosa').nome, 'Gianni')
  assert.equal(salutoDaNominativo('Jan Van Der Berg').nome, 'Jan')
  for (const p of ['de', 'di', 'da', 'del', 'della', 'dello', 'dei', 'degli', 'la', 'lo', 'van', 'von']) {
    assert.equal(salutoDaNominativo(`Anna ${p} Qualcosa`).nome, 'Anna', `particella «${p}»`)
  }
  // le maiuscole restano quelle salvate
  assert.equal(salutoDaNominativo('ANNA MARIA DE LUCA').nome, 'ANNA MARIA')
  assert.equal(salutoDaNominativo('anna maria de luca').nome, 'anna maria')
})

test('accenti, apostrofi e trattini non si toccano', () => {
  assert.equal(salutoDaNominativo('Niccolò D’Angelo').nome, 'Niccolò')
  assert.equal(salutoDaNominativo('Anna-Maria Rossi').nome, 'Anna-Maria')
  assert.equal(salutoDaNominativo('José Muñoz').nome, 'José')
  assert.equal(salutoDaNominativo('Anna D’Angelo Rossi').nome, 'Anna D’Angelo')
})

test('spazi doppi e caratteri invisibili spariscono dal saluto', () => {
  assert.equal(salutoDaNominativo('  Anna   Rossi ').nome, 'Anna')
  assert.equal(salutoDaNominativo('️Anna Rossi').nome, 'Anna')
  assert.equal(salutoDaNominativo('​Anna‍ Maria  Rossi').nome, 'Anna Maria')
  assert.equal(`Gentile ${salutoDaNominativo('  Maria   Grazia  Rossi ').nome},`, 'Gentile Maria Grazia,')
})

test('una parola sola: si saluta con quella, ma il nome resta da controllare', () => {
  // «Anna» è quasi sempre il nome, «Monda» quasi sempre il cognome: da qui
  // non si distinguono, quindi si saluta e si chiede di controllare
  for (const solo of ['Anna', 'Monda', 'Rossi']) {
    const s = salutoDaNominativo(solo)
    assert.equal(s.nome, solo)
    assert.equal(s.sicuro, false)
    assert.equal(s.daCompletare, false)
  }
})

test('niente «Gentile undefined», «Gentile null», «Gentile ,», «Gentile 342…»', () => {
  for (const vuoto of ['', '   ', null, undefined]) {
    const s = salutoDaNominativo(vuoto)
    assert.equal(s.nome, NOME_DA_CONTROLLARE)
    assert.equal(s.daCompletare, true)
  }
  // nomeOspite ripiega sul telefono o su «Ospite»: nessuno dei due è un nome
  for (const finto of ['3427004354', '+39 342 700 4354', '342 700 4354', 'Ospite']) {
    assert.equal(salutoDaNominativo(finto).daCompletare, true, finto)
  }
  // e in nessun caso il saluto resta vuoto
  for (const x of ['', null, undefined, '342 700 4354', 'Ospite', 'Anna Rossi', 'De Luca Anna']) {
    assert.notEqual(salutoDaNominativo(x).nome.trim(), '')
    assert.equal(`Gentile ${salutoDaNominativo(x).nome},`.includes('Gentile ,'), false)
    assert.equal(`Gentile ${salutoDaNominativo(x).nome},`.includes('undefined'), false)
  }
})

test('cognome davanti: non si spaccia il cognome per nome', () => {
  // la particella in testa dice che l'ordine è rovesciato
  for (const rovesciato of ['De Luca Anna', 'La Rosa Maria', 'Di Pietro Marco', 'De Luca']) {
    const s = salutoDaNominativo(rovesciato)
    assert.equal(s.daCompletare, true, rovesciato)
    assert.equal(s.nome, NOME_DA_CONTROLLARE)
    assert.equal(s.nome.includes('Luca'), false)
  }
})

test('campo nome già separato: non si taglia niente', () => {
  assert.deepEqual(salutoDaCampoNome('Maria Grazia'), { nome: 'Maria Grazia', sicuro: true, daCompletare: false })
  assert.equal(salutoDaCampoNome('Anna Maria').nome, 'Anna Maria')
  assert.equal(salutoDaCampoNome('  Anna  ').nome, 'Anna')
  assert.equal(salutoDaCampoNome('️Anna').nome, 'Anna')
  assert.equal(salutoDaCampoNome('').daCompletare, true)
  assert.equal(salutoDaCampoNome(null).daCompletare, true)
  assert.equal(salutoDaCampoNome('3427004354').daCompletare, true)
})

// ── Il saluto di UNA prenotazione ───────────────────────────────────────────
test('vale il nominativo della prenotazione, non quello della scheda cliente', () => {
  // persone diverse sullo stesso telefono: si saluta chi ha prenotato
  assert.equal(salutoOspite({ guest_name: 'Anna Rossi', guests: { full_name: 'Mario Bianchi' } }).nome, 'Anna')
  assert.equal(salutoOspite({ guest_name: 'Maria Grazia Conti', guests: { full_name: 'Mario Bianchi' } }).nome, 'Maria Grazia')
  // prenotazioni vecchie senza guest_name: vale la scheda, come da sempre
  assert.equal(salutoOspite({ guests: { full_name: 'Carmela Sabia' } }).nome, 'Carmela')
  assert.equal(salutoOspite({ guest_name: null, guests: { full_name: 'Anna Maria De Luca' } }).nome, 'Anna Maria')
  // il nome di chi dorme in camera con lei non entra mai nel saluto
  const conAltri = { guest_name: 'Luca Tassone', extra_phone_1_name: 'Massimo Tassone', guests: { full_name: 'Luca Tassone' } }
  assert.equal(salutoOspite(conAltri).nome, 'Luca')
})

test('la scheda cliente aiuta solo quando è la STESSA persona', () => {
  // solo il cognome sulla prenotazione, nome e cognome sulla scheda
  assert.equal(salutoOspite({ guest_name: 'Monda', guests: { full_name: 'Simona Monda' } }).nome, 'Simona')
  // nominativo storico al contrario, raddrizzato dalla scheda
  assert.equal(salutoOspite({ guest_name: 'Rossi Anna', guests: { full_name: 'Anna Rossi' } }).nome, 'Anna')
  assert.equal(salutoOspite({ guest_name: 'De Luca Anna', guests: { full_name: 'Anna De Luca' } }).nome, 'Anna')
  // ma se la scheda parla di un'altra persona non si usa: resta il dubbio
  assert.equal(salutoOspite({ guest_name: 'Monda', guests: { full_name: 'Mario Bianchi' } }).nome, 'Monda')
  assert.equal(salutoOspite({ guest_name: 'Monda', guests: { full_name: 'Mario Bianchi' } }).sicuro, false)
  assert.equal(salutoOspite({ guest_name: 'De Luca Anna', guests: { full_name: 'Mario Bianchi' } }).daCompletare, true)
})

test('senza nessun nome il saluto è da completare, mai il numero di telefono', () => {
  assert.equal(salutoOspite({ guests: { phone: '+39 342 700 4354' } }).daCompletare, true)
  assert.equal(salutoOspite({}).daCompletare, true)
  assert.equal(salutoOspite(null).daCompletare, true)
  assert.equal(salutoOspite({ guests: { phone: '3427004354' } }).nome.includes('342'), false)
})

// ── Tutti i generatori passano di qui ──────────────────────────────────────
test('ogni messaggio all’ospite saluta col SOLO nome, da salutoOspite', () => {
  const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

  // 1. Arrivo («Richiesta orario»), sia dalla scheda sia dalla Home: il nome
  //    arriva già pronto, così non si taglia due volte «Maria Grazia»
  const arrivo = leggi('lib/messaggiWhatsApp.ts')
  assert.match(arrivo, /export function messaggioRichiestaOrario\(nomeSaluto: string\)/)
  assert.match(arrivo, /Gentile \$\{nomeSaluto\},/)
  assert.match(arrivo, /messaggioRichiestaOrario\(salutoOspite\(b\)\.nome\)/)

  // 2. Conferma CON immagine: saluto col solo nome; il nominativo intero resta
  //    all'immagine e alla causale del bonifico
  const conferma = leggi('components/ConfermaWhatsApp.tsx')
  assert.match(conferma, /const saluto = salutoOspite\(booking\)/)
  assert.match(conferma, /Gentile \$\{nomeSaluto\},/)
  assert.match(conferma, /causaleBonifico\(segmenti, nome\)/)

  // 3. Ringraziamento mandato dalla notifica di partenza
  const ringrazia = leggi('app/api/push/ringraziamento/route.ts')
  assert.match(ringrazia, /buildRingraziamentoMsg\(salutoOspite\(b\)\.nome\)/)
  assert.match(ringrazia, /Gentile \$\{nomeSaluto\},/)

  // 4. Proposte alle richieste: la richiesta ha nome e cognome separati e il
  //    campo nome non si taglia
  const proposte = leggi('lib/richiesteTesti.ts')
  assert.match(proposte, /Gentile \$\{salutoDaCampoNome\(nome\)\.nome\},/)
  assert.equal(/apertura\(nomeCompleto/.test(proposte), false)
  const pagina = leggi('app/richieste/[id]/proposta/page.tsx')
  assert.equal(/generaProposta\([^)]*nomeCompleto/.test(pagina), false)

  // 5. I nove messaggi della scheda, nei DUE file che li tengono identici
  for (const f of ['lib/messaggiPrenotazione.ts', 'app/prenotazioni/[id]/page.tsx']) {
    const src = leggi(f)
    assert.match(src, /const nome = salutoOspite\(b\)\.nome/, f)
    assert.equal(/Gentile \$\{name\},/.test(src), false, `${f}: un saluto usa ancora il nominativo intero`)
    assert.equal((src.match(/Gentile \$\{nome\},/g) || []).length, 7, `${f}: i sette saluti`)
    // il nominativo intero resta dov'è identificazione, non saluto
    assert.match(src, /causaleBonifico\(segmenti, name\)/, f)
  }

  // 6. La vecchia eccezione non deve tornare da nessuna parte: le due
  //    funzioni che la reggevano non esistono più e nessuno le chiama.
  //    (Nel commento di lib/guestName restano NOMINATE come storico superato.)
  assert.equal(/export function (soloNomeMessaggio|nomeECognomeMessaggio)/.test(leggi('lib/guestName.ts')), false)
  for (const f of ['lib/guestName.ts', 'lib/messaggiWhatsApp.ts', 'lib/messaggiPrenotazione.ts', 'lib/richiesteTesti.ts',
    'app/prenotazioni/[id]/page.tsx', 'components/ConfermaWhatsApp.tsx', 'app/api/push/ringraziamento/route.ts']) {
    assert.equal(/(nomeECognomeMessaggio|soloNomeMessaggio)\(/.test(leggi(f)), false, `${f}: torna la regola vecchia`)
  }
})

// ── spezzaNome (16/09/2026): il nominativo salvato nei due campi del foglio ──
test('spezzaNome: l’ultima parola è il cognome, la particella tira con sé tutto il resto', () => {
  assert.deepEqual(spezzaNome('Carmela Sabia'), { nome: 'Carmela', cognome: 'Sabia' })
  assert.deepEqual(spezzaNome('Maria Grazia Rossi'), { nome: 'Maria Grazia', cognome: 'Rossi' })
  assert.deepEqual(spezzaNome('Anna Maria De Luca'), { nome: 'Anna Maria', cognome: 'De Luca' })
  assert.deepEqual(spezzaNome('Nida'), { nome: 'Nida', cognome: '' })
  assert.deepEqual(spezzaNome('De Luca'), { nome: 'De', cognome: 'Luca' })
  assert.deepEqual(spezzaNome('  Anna   Rossi '), { nome: 'Anna', cognome: 'Rossi' })
  assert.deepEqual(spezzaNome(null), { nome: '', cognome: '' })
})
