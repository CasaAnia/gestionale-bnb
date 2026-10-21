// T1/T2/T3 del ricontrollo Codex su 7136718 (21/10/2026 sera): il cliente
// estero NUOVO nato dalla conferma di una richiesta, i destinatari di
// chiamata e WhatsApp, e i passi verificati prima della conferma.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chiaveTelefono, stessoNumero, schedeConNumero, decisioneConferma, numeroPerContatto } from './clienteTelefono.ts'
import { numeroWhatsAppPrenotazione, whatsappRichiestaOrario, waHrefTesto } from './messaggiWhatsApp.ts'
import { telefonoDaSalvare } from './datiCliente.ts'
import { normalizzaTelefono } from './whatsapp.ts'
import { allineaConVerifica, creaSchedaConVerifica } from './confermaPassi.ts'

const LRE = '‪', PDF = '‬'
type G = { id: string; phone: string; full_name: string; created_at: number }

// La RPC conferma_richiesta com'è in produzione (0027/0031): cerca per cifre,
// la più vecchia; se non trova crea la scheda a SOLE CIFRE.
function rpc(telefono: string, nome: string, guests: G[]): string {
  const cifre = telefono.replace(/\D/g, '')
  const g = guests.filter(x => x.phone.replace(/\D/g, '') === cifre).sort((a, b) => a.created_at - b.created_at)[0]
  if (g) return g.id
  guests.push({ id: `rpc${guests.length}`, phone: cifre, full_name: nome, created_at: guests.length })
  return guests.at(-1)!.id
}
// La conferma come la fa adesso la finestra: decisione → (scheda nuova col «+») → RPC
function conferma(telefono: string, nome: string, guests: G[], scelta: string | null = null): { esito: string; id?: string } {
  const d = decisioneConferma(telefono, schedeConNumero(guests, telefono), scelta, guests)
  if (d.tipo === 'scegli' || d.tipo === 'bloccata') return { esito: d.tipo }
  let tel = telefono
  if (d.tipo === 'nuova') {
    guests.push({ id: `app${guests.length}`, phone: d.telefono, full_name: nome, created_at: guests.length })
    // come la finestra: cifre diverse → la richiesta prende la forma della scheda
    if (d.telefono.replace(/\D/g, '') !== telefono.replace(/\D/g, '')) tel = d.telefono
  }
  if (d.tipo === 'allinea') tel = d.telefono
  return { esito: d.tipo, id: rpc(tel, nome, guests) }
}

const NUOVI: [string, string, string[]][] = [
  ['+45 32 12 34 56', '+4532123456', ['0045 32123456', `${LRE}+45 3212 3456${PDF}`]],
  [`${LRE}+354 555 1234${PDF}`, '+3545551234', ['00354 555-1234', '+3545551234']],
  ['345 600 0001', '+393456000001', ['+39 345 600 0001', '0039 345-600-0001', '3456000001']],
]

test('T1: cliente NUOVO dalla conferma — scheda col «+», riconosciuta dopo, nessun doppione dagli altri percorsi', () => {
  for (const [telefono, salvatoAtteso, altre] of NUOVI) {
    const guests: G[] = []
    const primo = conferma(telefono, 'Prova Nuova', guests)
    assert.equal(primo.esito, 'nuova', telefono)
    assert.equal(guests.length, 1, `${telefono}: una scheda sola`)
    assert.equal(guests[0].phone, salvatoAtteso, `${telefono}: salvata col «+»`)
    assert.equal(primo.id, guests[0].id, `${telefono}: la RPC usa la scheda creata dall'app`)
    // riapertura/rilettura: il paese resta
    assert.equal(chiaveTelefono(guests[0].phone), salvatoAtteso.slice(1))
    for (const altra of altre) {
      // ritrovata dagli altri percorsi (stesso numero in altre forme): il controllo doppioni la vede
      assert.equal(schedeConNumero(guests, altra).length, 1, `${altra} → ${guests[0].phone}`)
      assert.ok(stessoNumero(altra, guests[0].phone))
      // una seconda richiesta con lo stesso numero non crea un'altra scheda
      const secondo = conferma(altra, 'Prova Nuova', guests)
      assert.ok(secondo.esito === 'libera' || secondo.esito === 'allinea', `${altra}: ${secondo.esito}`)
      assert.equal(secondo.id, guests[0].id)
      assert.equal(guests.length, 1, `${altra}: nessun doppione`)
    }
  }
  // controprova: SENZA la scheda creata dall'app la RPC salverebbe a sole
  // cifre e il numero non si riconoscerebbe più (il difetto riprodotto da Codex)
  const vecchio: G[] = []
  rpc('+45 32 12 34 56', 'Freja', vecchio)
  assert.equal(vecchio[0].phone, '4532123456')
  assert.equal(chiaveTelefono(vecchio[0].phone), null)
  rpc('+354 555 1234', 'Jón', vecchio)
  assert.equal(chiaveTelefono(vecchio[1].phone), '393545551234')   // tornava «italiano»
})

test('T1: stesse cifre già in archivio come numero DIVERSO (vecchia scheda a sole cifre) → conferma ferma', () => {
  // una scheda vecchia «3545551234» (che si legge come cellulare italiano):
  // la RPC la prenderebbe per cifre per il cliente islandese
  const guests: G[] = [{ id: 'vecchia', phone: '3545551234', full_name: 'Vecchia', created_at: 0 }]
  assert.equal(conferma('+354 555 1234', 'Jón', guests).esito, 'bloccata')
  assert.equal(guests.length, 1)
  const d = decisioneConferma('+354 555 1234', [], null, guests)
  assert.match(d.tipo === 'bloccata' ? d.motivo : '', /come numero diverso/)
})

test('T2: chiamata e WhatsApp — gli esteri restano esteri, gli italiani come prima', () => {
  const casi: [string | null, string | null][] = [
    ['+4532123456', '4532123456'], ['+45 32 12 34 56', '4532123456'], [`${LRE}+45 3212 3456${PDF}`, '4532123456'], ['0045 32123456', '4532123456'],
    ['+3545551234', '3545551234'], ['+354 555 1234', '3545551234'],
    ['+447700900123', '447700900123'], ['+12125550100', '12125550100'],
    // italiani: come prima
    ['3331234567', '393331234567'], ['393331234567', '393331234567'], ['+393331234567', '393331234567'], ['+39 333 123 4567', '393331234567'],
    ['0039 333 123 4567', '393331234567'], [`${LRE}+39 333 123 4567${PDF}`, '393331234567'], ['02 1234567', '39021234567'],
    // vecchie forme non riconoscibili: regola di prima solo per le cifre nude
    ['12345', '3912345'], ['+12345', '12345'],
    [null, null], ['', null], ['   ', null],
  ]
  for (const [salvato, atteso] of casi) {
    assert.equal(numeroPerContatto(salvato), atteso, `contatto ${JSON.stringify(salvato)}`)
    assert.equal(numeroWhatsAppPrenotazione(salvato), atteso, `WhatsApp ${JSON.stringify(salvato)}`)
  }
  // i link preparati (nessuna chiamata, nessun invio)
  const wa = whatsappRichiestaOrario({ guest_name: 'Freja Nuova Prova', guests: { full_name: 'Freja Nuova Prova', phone: '+4532123456' } })
  assert.equal(wa?.numero, '4532123456')
  assert.match(wa?.href ?? '', /^https:\/\/wa\.me\/4532123456\?text=/)
  assert.equal(waHrefTesto(numeroPerContatto('+3545551234')!, ''), 'https://wa.me/3545551234')
  assert.equal(`tel:+${numeroWhatsAppPrenotazione('+4532123456')}`, 'tel:+4532123456')
  // la scheda nuova salvata dal modulo e la stessa per chiamare: coerenti
  for (const scritto of ['+45 32 12 34 56', '+354 555 1234', '333 123 4567']) {
    assert.equal(numeroPerContatto(telefonoDaSalvare(scritto)), chiaveTelefono(scritto))
    assert.equal(normalizzaTelefono(telefonoDaSalvare(scritto)).numero, chiaveTelefono(scritto))
  }
})

test('T2: nessun «39» incollato a mano nei punti che preparano chiamate e WhatsApp', () => {
  const leggi = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  for (const f of ['lib/messaggiWhatsApp.ts', 'app/prenotazioni/[id]/page.tsx', 'app/api/push/ringraziamento/route.ts'])
    assert.doesNotMatch(leggi(f), /startsWith\('39'\) \? raw : `39\$\{raw\}`/, f)
  assert.match(leggi('components/maison/SoldiHome.tsx'), /openWhatsApp\(numeroPerContatto\(v\.telefono\)!/)
  assert.match(leggi('components/scheda/TestataMaison.tsx'), /numeroWhatsAppPrenotazione\(telefono\)/)
})

// ── T3: i passi verificati ───────────────────────────────────────────────
const T = '3330000201'
test('T3: allineamento — riuscito solo se il valore salvato è proprio quello', async () => {
  // risposta con il telefono giusto
  assert.equal((await allineaConVerifica({ telefono: T, scrivi: async () => ({ error: null, telefono: T }), rileggi: async () => { throw new Error('non serve') } })).esito, 'ok')
  // risposta persa DOPO la scrittura: la rilettura mostra il valore → si prosegue
  assert.equal((await allineaConVerifica({ telefono: T, scrivi: async () => { throw new TypeError('Failed to fetch') }, rileggi: async () => ({ error: null, telefono: T, stato: 'proposta_inviata' }) })).esito, 'ok')
  // risposta persa e scrittura NON avvenuta: errore, non si prosegue
  assert.equal((await allineaConVerifica({ telefono: T, scrivi: async () => { throw new TypeError('Failed to fetch') }, rileggi: async () => ({ error: null, telefono: '+39 333 000 0201', stato: 'proposta_inviata' }) })).esito, 'errore')
  // risposta con un valore diverso da quello chiesto: si rilegge, e se è diverso è errore
  assert.equal((await allineaConVerifica({ telefono: T, scrivi: async () => ({ error: null, telefono: 'altro' }), rileggi: async () => ({ error: null, telefono: 'altro', stato: 'proposta_inviata' }) })).esito, 'errore')
  // nemmeno la rilettura riesce: incerto, ci si ferma
  assert.equal((await allineaConVerifica({ telefono: T, scrivi: async () => { throw new Error('rete') }, rileggi: async () => { throw new Error('rete') } })).esito, 'incerto')
  assert.equal((await allineaConVerifica({ telefono: T, scrivi: async () => ({ error: 'x', telefono: null }), rileggi: async () => ({ error: 'timeout', telefono: null, stato: null }) })).esito, 'incerto')
  // la richiesta nel frattempo non è più in «proposta inviata»
  assert.equal((await allineaConVerifica({ telefono: T, scrivi: async () => ({ error: 'Nessuna riga', telefono: null }), rileggi: async () => ({ error: null, telefono: T, stato: 'confermata' }) })).esito, 'errore')
})

test('T3: scheda nuova — risposta persa, errore, già esistente', async () => {
  const s = { id: 's1' }
  assert.deepEqual(await creaSchedaConVerifica({ crea: async () => ({ cliente: s, errore: null }), cerca: async () => { throw new Error('non serve') } }), { esito: 'ok', valore: s })
  // risposta persa ma scheda creata: la ricerca la trova
  assert.deepEqual(await creaSchedaConVerifica({ crea: async () => { throw new TypeError('Failed to fetch') }, cerca: async () => ({ schede: [s], errore: null }) }), { esito: 'ok', valore: s })
  // non creata
  assert.equal((await creaSchedaConVerifica({ crea: async () => ({ cliente: null, errore: 'rifiutata' }), cerca: async () => ({ schede: [], errore: null }) })).esito, 'errore')
  // non si sa
  assert.equal((await creaSchedaConVerifica({ crea: async () => { throw new Error('rete') }, cerca: async () => ({ schede: [], errore: 'rete' }) })).esito, 'incerto')
  assert.equal((await creaSchedaConVerifica({ crea: async () => { throw new Error('rete') }, cerca: async () => ({ schede: [s, { id: 's2' }], errore: null }) })).esito, 'incerto')
  // nel frattempo il numero è comparso su una scheda: niente doppione
  assert.equal((await creaSchedaConVerifica({ crea: async () => ({ cliente: null, errore: 'già', schede: [s] }), cerca: async () => ({ schede: [s], errore: null }) })).esito, 'errore')
})

test('T3: errore della conferma dopo l\'allineamento → nuova prova idempotente, nessun doppione', () => {
  // Gea: due schede, scelta «Gea Uno» in altra forma → allinea; la RPC fallisce;
  // alla riapertura il telefono è già allineato → «libera» sulla stessa scheda
  const guests: G[] = [{ id: 'uno', phone: '3330000202', full_name: 'Gea Uno', created_at: 0 }, { id: 'due', phone: '+39 333-000-0202', full_name: 'Gea Due', created_at: 1 }]
  const d1 = decisioneConferma('+39 333 000 0202', schedeConNumero(guests, '+39 333 000 0202'), 'uno', guests)
  assert.deepEqual(d1.tipo === 'allinea' && [d1.scheda.id, d1.telefono], ['uno', '3330000202'])
  // (RPC fallita: nessuna scrittura) — nuova prova col telefono già allineato
  const d2 = decisioneConferma('3330000202', schedeConNumero(guests, '3330000202'), 'uno', guests)
  assert.equal(d2.tipo, 'libera')
  assert.equal(rpc('3330000202', 'Gea', guests), 'uno')
  assert.equal(guests.length, 2)
  // cliente nuovo: la RPC fallisce dopo la creazione della scheda → la nuova
  // prova trova la scheda già creata («libera»), non ne crea un'altra
  const g2: G[] = []
  const n = decisioneConferma('+45 32 12 34 56', [], null, g2)
  assert.equal(n.tipo, 'nuova')
  g2.push({ id: 'app0', phone: n.tipo === 'nuova' ? n.telefono : '', full_name: 'Freja', created_at: 0 })
  const dopo = decisioneConferma('+45 32 12 34 56', schedeConNumero(g2, '+45 32 12 34 56'), null, g2)
  assert.deepEqual(dopo.tipo === 'libera' && dopo.scheda?.id, 'app0')
  assert.equal(rpc('+45 32 12 34 56', 'Freja', g2), 'app0')
  assert.equal(g2.length, 1)
})

test('T3: la finestra rilegge l\'archivio prima di scrivere e dopo ogni errore', () => {
  const s = readFileSync(new URL('../components/richieste/FinestraConferma.tsx', import.meta.url), 'utf8')
  assert.match(s, /const ora = await leggiArchivio\(telefonoRichiesta\)[\s\S]*?firma\(adesso\) !== firma\(decisione\)/)
  assert.match(s, /allineaConVerifica\(\{[\s\S]*?rileggi: \(\) => rileggiTelefonoRichiesta\(richiesta\.id\)/)
  assert.match(s, /creaSchedaConVerifica<ClienteBreve>\(/)
  // cliente nuovo con cifre diverse da quelle della scheda: si allinea anche lì
  assert.match(s, /decisione\.tipo === 'nuova' && decisione\.telefono\.replace\(\/\\D\/g, ''\) !== telefonoRichiesta\.replace/)
  assert.match(s, /if \(r\.error \|\| !r\.prenotazioneId\) \{ await dopoErrore\(/)
})
