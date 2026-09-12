import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { nomeCompleto, nomeBreve, nomeOspite, nomeECognomeMessaggio, soloNomeMessaggio } from './guestName.ts'

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

// ── COME SI CHIAMA LA CLIENTE NEI MESSAGGI (Ania, 12/09/2026) ──────────────
// Conferma senza immagine: nome e cognome, in quest'ordine. Tutti gli altri
// messaggi: solo il nome.

test('conferma senza immagine: nome e cognome, prima il nome', () => {
  assert.equal(nomeECognomeMessaggio('Anna Rossi'), 'Anna Rossi')
  // le maiuscole restano quelle salvate sulla cliente
  assert.equal(nomeECognomeMessaggio('Anna De Luca'), 'Anna De Luca')
  assert.equal(nomeECognomeMessaggio('anna rossi'), 'anna rossi')
  // il nominativo della prenotazione vince su quello della scheda
  assert.equal(nomeECognomeMessaggio(nomeOspite({ guest_name: 'Anna Rossi', guests: { full_name: 'Mario Bianchi' } })), 'Anna Rossi')
})

test('conferma senza immagine senza cognome: solo il nome, senza spazi doppi', () => {
  assert.equal(nomeECognomeMessaggio('Anna'), 'Anna')
  assert.equal(nomeECognomeMessaggio('  Anna  '), 'Anna')
  // spazi doppi in mezzo e caratteri invisibili non lasciano buchi nel saluto
  assert.equal(nomeECognomeMessaggio('Anna  Rossi'), 'Anna Rossi')
  assert.equal(nomeECognomeMessaggio('️Anna'), 'Anna')
  assert.equal(nomeECognomeMessaggio(''), '')
  assert.equal(nomeECognomeMessaggio(null), '')
  // niente virgole vuote: «Gentile Anna,» resta pulito
  assert.equal(`Gentile ${nomeECognomeMessaggio('Anna')},`, 'Gentile Anna,')
})

test('tutti gli altri messaggi: solo il nome', () => {
  assert.equal(soloNomeMessaggio('Anna Rossi'), 'Anna')
  assert.equal(soloNomeMessaggio('Anna De Luca'), 'Anna')
  // senza cognome non cambia nulla
  assert.equal(soloNomeMessaggio('Anna'), 'Anna')
  assert.equal(soloNomeMessaggio('  Anna  Rossi '), 'Anna')
  assert.equal(soloNomeMessaggio('️Anna Rossi'), 'Anna')
  assert.equal(soloNomeMessaggio(''), '')
  assert.equal(soloNomeMessaggio(null), '')
  assert.equal(soloNomeMessaggio(undefined), '')
  // le maiuscole restano quelle salvate
  assert.equal(soloNomeMessaggio('ANNA ROSSI'), 'ANNA')
})

test('i messaggi di tutti i giorni salutano col solo nome', () => {
  const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

  // 1. Arrivo («Richiesta orario»), sia dalla scheda sia dalla Home: il taglio
  //    sta dentro al testo, così i due tasti mandano le stesse parole
  const arrivo = leggi('lib/messaggiWhatsApp.ts')
  assert.match(arrivo, /const nome = soloNomeMessaggio\(name\)/)
  assert.match(arrivo, /Gentile \$\{nome\},/)

  // 2. Conferma CON immagine: saluto col solo nome; il nominativo intero resta
  //    all'immagine e alla causale del bonifico
  const conferma = leggi('components/ConfermaWhatsApp.tsx')
  assert.match(conferma, /const nomeSaluto = soloNomeMessaggio\(nome\)/)
  assert.match(conferma, /Gentile \$\{nomeSaluto\},/)
  assert.match(conferma, /causaleBonifico\(segmenti, nome\)/)

  // 3. Ringraziamento mandato dalla notifica di partenza
  const ringrazia = leggi('app/api/push/ringraziamento/route.ts')
  assert.match(ringrazia, /const nome = soloNomeMessaggio\(name\)/)
  assert.match(ringrazia, /Gentile \$\{nome\},/)

  // 4. Proposte alle richieste: la richiesta ha nome e cognome separati e il
  //    testo prende da sempre il solo nome. Che resti così.
  const proposte = leggi('lib/richiesteTesti.ts')
  assert.match(proposte, /export function apertura\(nome: string\)/)
  assert.equal(/apertura\(nomeCompleto/.test(proposte), false)
  const pagina = leggi('app/richieste/[id]/proposta/page.tsx')
  assert.equal(/generaProposta\([^)]*nomeCompleto/.test(pagina), false)
})

// Il nome non è per forza una parola sola (Ania, 12/09/2026)
test('nome di due parole: il cognome è solo l’ultima', () => {
  assert.equal(soloNomeMessaggio('Maria Grazia Rossi'), 'Maria Grazia')
  assert.equal(soloNomeMessaggio('Anna Maria Bianchi'), 'Anna Maria')
  // tre nomi e un cognome: resta tutto il nome
  assert.equal(soloNomeMessaggio('Maria Grazia Anna Rossi'), 'Maria Grazia Anna')
  // e il caso normale non cambia
  assert.equal(soloNomeMessaggio('Anna Rossi'), 'Anna')
})

test('con una particella, da lì in poi è tutto cognome', () => {
  assert.equal(soloNomeMessaggio('Anna Maria De Luca'), 'Anna Maria')
  assert.equal(soloNomeMessaggio('Anna De Luca'), 'Anna')
  assert.equal(soloNomeMessaggio('Marco Di Pietro'), 'Marco')
  assert.equal(soloNomeMessaggio('Gianni La Rosa'), 'Gianni')
  assert.equal(soloNomeMessaggio('Maria Grazia Della Valle'), 'Maria Grazia')
  assert.equal(soloNomeMessaggio('Jan Van Der Berg'), 'Jan')
  assert.equal(soloNomeMessaggio('Klaus Von Neumann'), 'Klaus')
  // la particella si riconosce anche tutta maiuscola o tutta minuscola
  assert.equal(soloNomeMessaggio('ANNA MARIA DE LUCA'), 'ANNA MARIA')
  assert.equal(soloNomeMessaggio('anna maria de luca'), 'anna maria')
  // tutte le particelle della lista
  for (const p of ['de', 'di', 'da', 'del', 'della', 'dello', 'dei', 'degli', 'la', 'lo', 'van', 'von']) {
    assert.equal(soloNomeMessaggio(`Anna ${p} Qualcosa`), 'Anna', `particella «${p}»`)
  }
})

test('quando non resta niente si saluta con quello che c’è, mai «Gentile ,»', () => {
  // una parola sola: è il nome
  assert.equal(soloNomeMessaggio('Anna'), 'Anna')
  // solo il cognome con la sua particella: meglio quello che niente
  assert.equal(soloNomeMessaggio('De Luca'), 'De Luca')
  assert.equal(soloNomeMessaggio('Rossi'), 'Rossi')
  assert.equal(soloNomeMessaggio(''), '')
  assert.equal(soloNomeMessaggio(null), '')
  // spazi doppi e caratteri invisibili non cambiano il conto delle parole
  assert.equal(soloNomeMessaggio('  Maria   Grazia  Rossi '), 'Maria Grazia')
  assert.equal(soloNomeMessaggio('️Anna Maria De Luca'), 'Anna Maria')
})
