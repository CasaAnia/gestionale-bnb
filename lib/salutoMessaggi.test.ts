// ============================================================================
// «Gentile [Nome],» — LA PROVA DI TUTTI I MESSAGGI (Ania, 21/09/2026)
//
// Regola unica: ogni messaggio all'ospite comincia col SOLO nome. Qui non si
// prova la funzione da sola (quella sta in lib/guestName.test.ts): si fanno
// uscire i TESTI VERI da tutti i generatori, uno per uno, con dati finti, e si
// guarda la prima riga. Se domani qualcuno rimette il cognome in un solo
// messaggio, la suite lo dice.
//
// Generatori coperti:
//  · i nove messaggi della scheda (lib/messaggiPrenotazione.buildWhatsappMsg),
//    che sono gli stessi della scheda vecchia (test di confronto sorgenti);
//  · «Richiesta orario» dalla Home (lib/messaggiWhatsApp);
//  · il ringraziamento della notifica di partenza;
//  · il testo WhatsApp della conferma CON immagine (components/ConfermaWhatsApp);
//  · l'apertura delle proposte alle richieste (lib/richiesteTesti).
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import buildWhatsappMsg, { MESSAGGI_SCHEDA, MESSAGGIO_ANNULLAMENTO } from './messaggiPrenotazione.ts'
import { whatsappRichiestaOrario } from './messaggiWhatsApp.ts'
import { apertura } from './richiesteTesti.ts'
import { salutoOspite, NOME_DA_CONTROLLARE } from './guestName.ts'
import { avvisoSaluto } from './avvisoSaluto.ts'

const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const LENA = { name: 'Lena', base_price: 80, double_price: 90, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_esterno' }
/** una prenotazione finta, col nominativo che serve al caso */
const prenotazione = (guest_name: string | null, full_name: string | null = null, extra: Record<string, unknown> = {}) => ({
  id: 'b1', check_in: '2026-09-10', check_out: '2026-09-12', num_guests: 2,
  price_per_night: 80, extra_bed: false, extra_bed_dates: [], extra_bed_total: 0,
  total_amount: 160, status: 'confermata', rooms: LENA,
  guests: { full_name, phone: '+39 333 000 0018' },
  guest_name, bonifico: false, ...extra,
})

/** tutti i testi che partono da una prenotazione, tranne il «Messaggio libero» (vuoto) */
const TIPI = [...MESSAGGI_SCHEDA, MESSAGGIO_ANNULLAMENTO].map(m => m.tipo).filter(t => t !== 'libero')

/** la prima riga che comincia con «Gentile» dentro un testo */
function rigaDelSaluto(testo: string): string {
  const riga = testo.split('\n').find(r => r.startsWith('Gentile '))
  assert.ok(riga, 'nessun saluto «Gentile …» nel messaggio')
  return riga
}

// Il testo WhatsApp della conferma CON immagine sta dentro un componente
// React (.tsx): qui si rifà la sua prima riga con la STESSA funzione, e una
// guardia sul sorgente controlla che il componente usi proprio quella.
const salutoConfermaImmagine = (b: Parameters<typeof salutoOspite>[0]) => `Gentile ${salutoOspite(b).nome},`
// Stessa cosa per il ringraziamento della notifica di partenza.
const salutoRingraziamentoPush = salutoConfermaImmagine

// ── I casi chiesti da Ania, uno per riga ───────────────────────────────────
const CASI: { titolo: string; guest_name: string | null; full_name?: string | null; atteso: string }[] = [
  { titolo: '1. nome e cognome semplici', guest_name: 'Anna Rossi', atteso: 'Gentile Anna,' },
  { titolo: '2. nome composto', guest_name: 'Maria Grazia Rossi', atteso: 'Gentile Maria Grazia,' },
  { titolo: '3. cognome composto', guest_name: 'Anna Maria De Luca', atteso: 'Gentile Anna Maria,' },
  { titolo: '5. accenti, apostrofi, trattini', guest_name: 'Niccolò D’Angelo', atteso: 'Gentile Niccolò,' },
  { titolo: '5b. nome col trattino', guest_name: 'Anna-Maria Bianchi', atteso: 'Gentile Anna-Maria,' },
  { titolo: '6. spazi doppi e caratteri invisibili', guest_name: '️Anna   Rossi ', atteso: 'Gentile Anna,' },
  { titolo: '7a. nessun nome', guest_name: null, full_name: null, atteso: `Gentile ${NOME_DA_CONTROLLARE},` },
  { titolo: '7b. solo il cognome, e la scheda non aiuta', guest_name: 'Monda', full_name: 'Monda', atteso: 'Gentile Monda,' },
  { titolo: '7c. solo il cognome, ma la scheda ha il nome', guest_name: 'Monda', full_name: 'Simona Monda', atteso: 'Gentile Simona,' },
  { titolo: '8a. cognome–nome, raddrizzato dalla scheda', guest_name: 'Rossi Anna', full_name: 'Anna Rossi', atteso: 'Gentile Anna,' },
  { titolo: '8b. cognome con particella davanti, senza aiuto', guest_name: 'De Luca Anna', full_name: null, atteso: `Gentile ${NOME_DA_CONTROLLARE},` },
  { titolo: '9. prenotazione diversa dalla scheda del telefono', guest_name: 'Maria Grazia Conti', full_name: 'Mario Bianchi', atteso: 'Gentile Maria Grazia,' },
  { titolo: '9b. prenotazione vecchia senza nominativo suo', guest_name: null, full_name: 'Carmela Sabia', atteso: 'Gentile Carmela,' },
]

test('LA STESSA PRENOTAZIONE, TUTTI I PERCORSI: ogni messaggio comincia con «Gentile [Nome],»', () => {
  for (const caso of CASI) {
    const b = prenotazione(caso.guest_name, caso.full_name ?? null)

    // a) i nove messaggi della scheda (e della scheda vecchia: stesso testo)
    for (const tipo of TIPI) {
      assert.equal(rigaDelSaluto(buildWhatsappMsg(b, tipo as never)), caso.atteso, `${caso.titolo} · messaggio «${tipo}»`)
    }
    // b) «Richiesta orario» aperto dalla Home «Da controllare»
    assert.equal(rigaDelSaluto(whatsappRichiestaOrario(b)!.testo), caso.atteso, `${caso.titolo} · richiesta orario dalla Home`)
    // c) il testo WhatsApp che accompagna la conferma con immagine
    assert.equal(salutoConfermaImmagine(b), caso.atteso, `${caso.titolo} · testo della conferma con immagine`)
    // d) il ringraziamento della notifica di partenza
    assert.equal(salutoRingraziamentoPush(b), caso.atteso, `${caso.titolo} · ringraziamento dalla notifica`)
    // e) mai il cognome, mai «undefined», mai il telefono
    for (const brutto of ['undefined', 'null', 'Gentile ,', 'signora', '333']) {
      assert.equal(caso.atteso.includes(brutto), false, `${caso.titolo}: «${brutto}» nel saluto`)
    }
  }
})

test('il cognome resta dov’è identificazione: causale del bonifico e nome del file', () => {
  const b = prenotazione('Anna Rossi', 'Anna Rossi', { bonifico: true })
  const testo = buildWhatsappMsg(b, 'dati_bonifico')
  assert.match(testo, /^Gentile Anna,/)
  // la causale porta il COGNOME: serve a riconoscere il bonifico in banca
  assert.match(testo, /Lena · 10–12 set · Rossi/)
  // e l'immagine resta intestata al nominativo intero (nome del file compreso)
  const conferma = leggi('components/ConfermaWhatsApp.tsx')
  assert.match(conferma, /causaleBonifico\(segmenti, nome\)/)
  assert.match(conferma, /nome=\{nome\}/)
  assert.match(conferma, /const cognome = nome\.trim\(\)\.split\(' '\)\.slice\(-1\)\[0\]/)
})

test('importi, date, camere e condizioni non cambiano col saluto nuovo', () => {
  const dopo = buildWhatsappMsg(prenotazione('Anna Rossi', 'Anna Rossi'), 'conferma')
  assert.match(dopo, /Check-in: \*giovedì 10 settembre 2026\* \(dalle 15:00 alle 20:00\)/)
  assert.match(dopo, /Check-out: \*sabato 12 settembre 2026\* \(entro le 10:00\)/)
  assert.match(dopo, /Notti: \*2\*/)
  assert.match(dopo, /Camera: Lena – Tripla/)
  assert.match(dopo, /\*Totale soggiorno: 160,00 €\*/)
  assert.match(dopo, /Cancellazione gratuita fino a 7 giorni prima dell'arrivo\./)
})

// ── Le proposte alle richieste: campo nome già separato ────────────────────
test('proposte alle richieste: il campo nome non si taglia', () => {
  assert.match(apertura('Anna'), /^Gentile Anna,/)
  assert.match(apertura('Maria Grazia'), /^Gentile Maria Grazia,/)      // MAI «Gentile Maria,»
  assert.match(apertura('Anna Maria'), /^Gentile Anna Maria,/)
  assert.match(apertura('  Niccolò  '), /^Gentile Niccolò,/)
  assert.match(apertura('️Anna'), /^Gentile Anna,/)
  assert.match(apertura(''), new RegExp(`^Gentile \\${NOME_DA_CONTROLLARE.slice(0, 1)}`))
})

// ── Quando il nome non si ricava, il messaggio non sembra pronto ───────────
test('«controlla il nome»: le parole e il blocco dei tasti', () => {
  const sicuro = salutoOspite(prenotazione('Anna Rossi', 'Anna Rossi'))
  assert.equal(avvisoSaluto(sicuro), null)

  const unaParola = salutoOspite(prenotazione('Monda', 'Monda'))
  const avvisoUna = avvisoSaluto(unaParola)!
  assert.equal(avvisoUna.blocca, false)
  assert.match(avvisoUna.testo, /Controlla il nome/)
  assert.match(avvisoUna.testo, /Gentile Monda,/)

  const senzaNome = salutoOspite(prenotazione(null, null))
  const avvisoNiente = avvisoSaluto(senzaNome)!
  assert.equal(avvisoNiente.blocca, true)
  assert.match(avvisoNiente.testo, /Manca il nome della cliente/)
  // parole di tutti i giorni: niente nomi di campi, di file o di funzioni
  for (const a of [avvisoUna.testo, avvisoNiente.testo]) {
    assert.equal(/guest_name|full_name|\.ts|lib\/|salutoOspite/.test(a), false, a)
  }
})

test('i tre punti che mandano messaggi spengono i tasti quando manca il nome', () => {
  // 1. la finestra della conferma con immagine
  const conferma = leggi('components/ConfermaWhatsApp.tsx')
  assert.match(conferma, /const nomeBloccato = avvisoSaluto\(saluto\)\?\.blocca === true/)
  assert.match(conferma, /<AvvisoSaluto saluto=\{saluto\}/)
  assert.match(conferma, /if \(!numeroChat \|\| nomeBloccato\) return/)
  assert.equal((conferma.match(/disabled=\{nomeBloccato\}/g) || []).length, 3, 'i due tasti WhatsApp e la copia del testo')

  // 2. la parte «Messaggi» della scheda nuova
  const messaggi = leggi('components/scheda/MessaggiScheda.tsx')
  assert.match(messaggi, /const bloccato = avvisoSaluto\(saluto\)\?\.blocca === true/)
  assert.match(messaggi, /<AvvisoSaluto saluto=\{saluto\}/)
  assert.match(messaggi, /bloccato \? 'pointer-events-none opacity-40' : ''/)
  const scheda = leggi('app/scheda/[id]/page.tsx')
  assert.match(scheda, /saluto=\{salutoOspite\(perIMessaggi\(\)\)\}/)

  // 3. la scheda vecchia, ancora raggiungibile da /nuova e dall'elenco
  const vecchia = leggi('app/prenotazioni/[id]/page.tsx')
  assert.match(vecchia, /const nomeBloccato = avvisoSaluto\(salutoMessaggi\)\?\.blocca === true/)
  assert.match(vecchia, /<AvvisoSaluto saluto=\{salutoMessaggi\}/)
  assert.match(vecchia, /if \(nomeBloccato\) return/)
})
