import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { messaggioRichiestaOrario, numeroWhatsAppPrenotazione, waHrefTesto, whatsappRichiestaOrario } from './messaggiWhatsApp.ts'

test('numero WhatsApp dalla scheda cliente: solo cifre, 39 se manca, null senza numero', () => {
  assert.equal(numeroWhatsAppPrenotazione('+39 333 123 4567'), '393331234567')
  assert.equal(numeroWhatsAppPrenotazione('333 123 4567'), '393331234567')
  assert.equal(numeroWhatsAppPrenotazione(''), null)
  assert.equal(numeroWhatsAppPrenotazione(null), null)
})

test('link wa.me: numero + testo codificato; senza testo solo la chat', () => {
  assert.equal(waHrefTesto('393331234567', 'Ciao, a che ora?'), 'https://wa.me/393331234567?text=Ciao%2C%20a%20che%20ora%3F')
  assert.equal(waHrefTesto('393331234567', ''), 'https://wa.me/393331234567')
})

test('«Richiesta orario» per una prenotazione: nome dell\'ospite, testo della scheda, stesso link; null senza telefono', () => {
  const b = { guest_name: 'Anna Rossi', guests: { full_name: 'Scheda Vecchia', phone: '+39 333 123 4567' } }
  const wa = whatsappRichiestaOrario(b)
  assert.ok(wa)
  assert.equal(wa.numero, '393331234567')
  assert.equal(wa.testo, messaggioRichiestaOrario('Anna Rossi'))
  assert.ok(wa.testo.startsWith('Gentile Anna Rossi,'))
  assert.ok(wa.testo.includes('dalle 15:00 alle 20:00'))
  assert.equal(wa.href, `https://wa.me/393331234567?text=${encodeURIComponent(wa.testo)}`)
  assert.equal(whatsappRichiestaOrario({ guests: { full_name: 'Senza Numero', phone: null } }), null)
  assert.equal(whatsappRichiestaOrario({ guests: null }), null)
})

test('il testo vive SOLO in lib/messaggiWhatsApp: la sezione Messaggi della scheda lo importa, non lo copia', () => {
  const scheda = readFileSync(new URL('../app/prenotazioni/[id]/page.tsx', import.meta.url), 'utf8')
  assert.ok(scheda.includes("if (type === 'richiesta_orario') {"), 'la scheda ha ancora il tipo richiesta_orario')
  assert.ok(scheda.includes('return messaggioRichiestaOrario(name)'), 'la scheda usa la funzione condivisa')
  assert.ok(!scheda.includes('il suo arrivo si avvicina'), 'nessuna copia del testo nella scheda')
  assert.ok(scheda.includes('waHrefTesto(waPhone'), 'stesso link wa.me condiviso')
})
