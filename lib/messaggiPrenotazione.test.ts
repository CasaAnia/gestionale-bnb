// ============================================================================
// I TESTI DEI MESSAGGI: uno solo, in due file finché la scheda vecchia non
// può essere toccata. Qui si controlla che la COPIA in lib/messaggiPrenotazione
// sia identica all'originale di app/prenotazioni/[id]/page.tsx, carattere per
// carattere. Se qualcuno cambia una parola da una parte sola, questo test lo
// dice subito. Poi si provano i messaggi veri, uno per tasto.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import buildWhatsappMsg, { MESSAGGI_SCHEDA, MESSAGGIO_ANNULLAMENTO } from './messaggiPrenotazione.ts'
import { messaggioRichiestaOrario } from './messaggiWhatsApp.ts'

const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

// Il testo di una funzione, dalla riga che la apre alla prima riga che
// contiene solo «}». «export» e «export default» davanti non contano: è il
// corpo che deve restare identico.
function funzione(sorgente: string, nome: string): string {
  const righe = sorgente.split('\n')
  const apre = (r: string) => r.replace(/^export (default )?/, '').startsWith(nome)
  const da = righe.findIndex(apre)
  assert.notEqual(da, -1, `non trovo «${nome}»`)
  let a = da + 1
  while (a < righe.length && righe[a] !== '}') a += 1
  return [righe[da].replace(/^export (default )?/, ''), ...righe.slice(da + 1, a + 1)].join('\n')
}

test('i testi dei messaggi sono identici nei due file', () => {
  const vecchia = leggi('app/prenotazioni/[id]/page.tsx')
  const nuova = leggi('lib/messaggiPrenotazione.ts')
  for (const nome of ['function buildWhatsappMsg', 'function bagnoDesc', 'function roomPageLink', 'function formatDateIT']) {
    assert.equal(
      funzione(nuova, nome),
      funzione(vecchia, nome),
      `«${nome}» è diverso fra la scheda vecchia e lib/messaggiPrenotazione: i testi devono restare uguali`,
    )
  }
})

// ── I messaggi veri ─────────────────────────────────────────────────────────
const LENA = { name: 'Lena', base_price: 80, double_price: 90, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_esterno' }
const prenotazione = (extra: Record<string, unknown> = {}) => ({
  id: 'b1', check_in: '2026-09-10', check_out: '2026-09-12', num_guests: 2,
  price_per_night: 80, extra_bed: false, extra_bed_dates: [], extra_bed_total: 0,
  total_amount: 160, status: 'confermata', rooms: LENA,
  guests: { full_name: 'Carmela Sabia', phone: '+39 333 000 0018' },
  guest_name: null, bonifico: false, ...extra,
})

test('i tasti della parte MESSAGGI, nell’ordine deciso', () => {
  assert.deepEqual(MESSAGGI_SCHEDA.map(m => m.label), [
    'Conferma', 'Modifica', 'Dati bonifico', 'Pagamento ricevuto',
    'Promemoria bonifico', 'Richiesta orario', 'Ringraziamento', 'Messaggio libero',
  ])
  assert.equal(MESSAGGIO_ANNULLAMENTO.label, 'Annullamento')
  assert.equal(MESSAGGIO_ANNULLAMENTO.tipo, 'annullamento')
  // l'annullamento sta a parte, non fra gli otto
  assert.equal(MESSAGGI_SCHEDA.some(m => m.tipo === 'annullamento'), false)
})

test('ogni tasto dà il suo messaggio, col nome della cliente', () => {
  const b = prenotazione()
  const conferma = buildWhatsappMsg(b, 'conferma')
  assert.match(conferma, /^CONFERMA DI PRENOTAZIONE – CASA ANIA/)
  assert.match(conferma, /Gentile Carmela Sabia,/)
  assert.match(conferma, /Notti: \*2\*/)
  assert.match(conferma, /Totale soggiorno: 160,00 €/)
  assert.match(buildWhatsappMsg(b, 'modifica'), /^MODIFICA PRENOTAZIONE – CASA ANIA/)
  assert.match(buildWhatsappMsg(b, 'annullamento'), /^ANNULLAMENTO PRENOTAZIONE – CASA ANIA/)
  assert.match(buildWhatsappMsg(b, 'dati_bonifico'), /IT32P0503401753000000159653/)
  assert.match(buildWhatsappMsg(b, 'promemoria_bonifico'), /non ho ancora ricevuto il bonifico/)
  assert.match(buildWhatsappMsg(b, 'pagamento_ricevuto'), /ho ricevuto il suo pagamento/)
  assert.match(buildWhatsappMsg(b, 'ringraziamento'), /lasciandoci una recensione su Google/)
  // «Richiesta orario» è lo stesso testo della Home, scritto in un posto solo
  assert.equal(buildWhatsappMsg(b, 'richiesta_orario'), messaggioRichiestaOrario('Carmela Sabia'))
  // «Messaggio libero» apre la chat senza testo
  assert.equal(buildWhatsappMsg(b, 'libero'), '')
})

test('col bonifico la conferma porta i dati del bonifico; col contante no', () => {
  assert.match(buildWhatsappMsg(prenotazione({ bonifico: true }), 'conferma'), /IBAN/)
  assert.match(buildWhatsappMsg(prenotazione(), 'conferma'), /Il pagamento avviene all'arrivo/)
})

test('con un acconto già ricevuto si chiede solo il residuo', () => {
  const testo = buildWhatsappMsg(prenotazione({ bonifico: true }), 'dati_bonifico', [], [{ amount: 60 }])
  assert.match(testo, /Già ricevuto: 60,00 €/)
  assert.match(testo, /Importo da bonificare:\n\*100,00 €\*/)
})

test('col cambio camera il messaggio elenca i periodi', () => {
  const uno = prenotazione({ id: 'b1', group_id: 'g', check_in: '2026-09-10', check_out: '2026-09-12', total_amount: 160 })
  const due = prenotazione({ id: 'b2', group_id: 'g', check_in: '2026-09-12', check_out: '2026-09-14', total_amount: 130, price_per_night: 65, rooms: { ...LENA, name: 'Amelia', base_price: 65 } })
  const testo = buildWhatsappMsg(uno, 'conferma', [uno, due])
  assert.match(testo, /Camere \(cambio camera durante il soggiorno\):/)
  assert.match(testo, /1\. \*Lena/)
  assert.match(testo, /2\. \*Amelia/)
  assert.match(testo, /Notti: \*4\*/)
})
