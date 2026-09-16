// ============================================================================
// LE PAGINE NUOVE PRENDONO IL POSTO DELLE VECCHIE (16/09/2026). Nessun link
// del gestionale porta più a /prenotazioni/<id> né a /nuova: si arriva alla
// scheda nuova (/scheda/<id>) e all'inserimento nuovo (/nuova-prenotazione).
// Le due pagine vecchie restano raggiungibili a mano, con la riga in ottone
// in cima che manda a quella nuova. Qui si leggono i sorgenti.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parametriInserimento } from './nuovaPrenotazione.ts'

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const leggi = (p: string) => readFileSync(join(RADICE, p), 'utf8')

function sorgenti(cartella: string): string[] {
  const out: string[] = []
  const visita = (d: string) => {
    for (const nome of readdirSync(d)) {
      const p = join(d, nome)
      if (statSync(p).isDirectory()) visita(p)
      else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.ts$/.test(nome)) out.push(relative(RADICE, p))
    }
  }
  visita(join(RADICE, cartella))
  return out
}

// Le due pagine vecchie (che parlano di sé), la scheda nuova (che ha
// «Vedi tutto» verso la scheda completa, per scelta) e i testi dei messaggi
// (un commento) sono gli unici posti dove /prenotazioni/<id> può comparire.
// MobileTopBar nomina le sezioni per prefisso ('/nuova' copre anche /nuova-prenotazione): non è un link.
const AMMESSI = new Set(['app/prenotazioni/[id]/page.tsx', 'app/nuova/page.tsx', 'app/scheda/[id]/page.tsx', 'lib/messaggiPrenotazione.ts', 'app/prenotazioni/[id]/layout.tsx', 'app/nuova/layout.tsx', 'components/MobileTopBar.tsx'])

test('nessun link del gestionale apre più la scheda vecchia /prenotazioni/<id>', () => {
  const trovati: string[] = []
  for (const p of [...sorgenti('app'), ...sorgenti('components'), ...sorgenti('lib')]) {
    if (AMMESSI.has(p)) continue
    const s = leggi(p)
    s.split('\n').forEach((r, i) => {
      if (r.trimStart().startsWith('//')) return
      if (/\/prenotazioni\/\$\{|['"`]\/prenotazioni\/[^'"`\s]/.test(r)) trovati.push(`${p}:${i + 1}`)
    })
  }
  assert.deepEqual(trovati, [], `aprono ancora la scheda vecchia:\n${trovati.join('\n')}`)
})

test('nessun link del gestionale apre più l’inserimento vecchio /nuova', () => {
  const trovati: string[] = []
  for (const p of [...sorgenti('app'), ...sorgenti('components'), ...sorgenti('lib')]) {
    if (AMMESSI.has(p)) continue
    const s = leggi(p)
    s.split('\n').forEach((r, i) => {
      if (r.trimStart().startsWith('//')) return
      if (/['"`]\/nuova(\?|['"`])/.test(r)) trovati.push(`${p}:${i + 1}`)
    })
  }
  assert.deepEqual(trovati, [], `aprono ancora l’inserimento vecchio:\n${trovati.join('\n')}`)
})

test('i punti di partenza, uno per uno, portano alla scheda nuova', () => {
  assert.match(leggi('app/page.tsx'), /href=\{`\/scheda\/\$\{g\.id\}`\}/)                                  // Home, «Da incassare»
  assert.match(leggi('lib/daControllare.ts'), /case 'prenotazione': return `\/scheda\/\$\{d\.prenotazioneId\}`/)   // Home, «Da controllare»
  assert.match(leggi('lib/daControllare.ts'), /case 'saldo': return `\/scheda\/\$\{d\.prenotazioneId\}\?azione=pagato`/)
  assert.equal((leggi('app/calendario/page.tsx').match(/router\.push\(`\/scheda\/\$\{(b|booking)\.id\}`\)/g) || []).length, 5)   // Calendario
  assert.match(leggi('app/arrivi/page.tsx'), /router\.push\(`\/scheda\/\$\{popup\.id\}`\)/)                 // Arrivi
  assert.match(leggi('app/prenotazioni/page.tsx'), /router\.push\(`\/scheda\/\$\{b\.id\}`\)/)               // elenco Prenotazioni
  assert.match(leggi('app/richieste/page.tsx'), /router\.push\(`\/scheda\/\$\{id\}\?da=richiesta/)          // richiesta confermata
  assert.match(leggi('app/richieste/page.tsx'), /href=\{`\/scheda\/\$\{r\.prenotazione_id\}`\}/)             // «scheda» nella riga della richiesta
  assert.match(leggi('app/richieste/[id]/proposta/page.tsx'), /router\.push\(`\/scheda\/\$\{x\}\?da=richiesta/)
  assert.match(leggi('app/clienti/[id]/page.tsx'), /href=\{`\/scheda\/\$\{r\.prenotazioneId\}\?da=cliente&cliente=\$\{id\}`\}/)   // scheda del Cliente
  assert.match(leggi('components/ParteCliente.tsx'), /href=\{`\/scheda\/\$\{s\.prenotazioneId\}`\}/)         // soggiorni nella proposta
  assert.match(leggi('components/WebRequestAlert.tsx'), /router\.push\(`\/scheda\/\$\{primo\.id\}`\)/)      // avviso richiesta dal sito
})

test('i punti che creano una prenotazione nuova portano all’inserimento nuovo', () => {
  assert.match(leggi('app/calendario/page.tsx'), /router\.push\(`\/nuova-prenotazione\?room_id=\$\{room\.id\}&check_in=\$\{dateStr\}`\)/)
  assert.match(leggi('app/prenotazioni/page.tsx'), /<Link href="\/nuova-prenotazione"/)
  assert.match(leggi('components/BottomNav.tsx'), /\{ href: '\/nuova-prenotazione', label: 'Nuova', Icon: Plus \}/)
  assert.match(leggi('lib/opzioneLibera.ts'), /return `\/nuova-prenotazione\?\$\{p\.toString\(\)\}`/)
  // la barra in alto sa nominare tutte e due le pagine nuove
  const barra = leggi('components/MobileTopBar.tsx')
  assert.match(barra, /\['\/scheda', 'Prenotazione'\]/)
  assert.match(barra, /\['\/nuova', 'Nuova prenotazione'\]/)   // il prefisso copre anche /nuova-prenotazione
})

test('la scheda nuova capisce da dove si arriva: ?da=richiesta, ?da=cliente, ?avviso', () => {
  const scheda = leggi('app/scheda/[id]/page.tsx')
  assert.match(scheda, /const daRichiesta = parametri\.get\('da'\) === 'richiesta'/)
  assert.match(scheda, /\{daRichiesta \? PRENOTAZIONE_DA_RICHIESTA : PRENOTAZIONE_SALVATA\}/)
  assert.match(scheda, /const daCliente = parametri\.get\('da'\) === 'cliente' \? parametri\.get\('cliente'\) : null/)
  assert.match(scheda, /const hrefIndietro = daCliente \? `\/clienti\/\$\{daCliente\}` : '\/prenotazioni'/)
  assert.match(scheda, /useState<string \| null>\(parametri\.get\('avviso'\)\)/)
})

test('l’inserimento nuovo legge camera, date e cliente dall’indirizzo', () => {
  assert.deepEqual(parametriInserimento('?room_id=lena&check_in=2026-10-05'), { guestId: null, roomId: 'lena', checkIn: '2026-10-05', checkOut: null })
  assert.deepEqual(parametriInserimento('check_in=2026-10-05&check_out=2026-10-08'), { guestId: null, roomId: null, checkIn: '2026-10-05', checkOut: '2026-10-08' })
  // la partenza prima dell'arrivo o una data storta non si prendono
  assert.deepEqual(parametriInserimento('?check_in=2026-10-05&check_out=2026-10-01'), { guestId: null, roomId: null, checkIn: '2026-10-05', checkOut: null })
  assert.deepEqual(parametriInserimento('?check_in=ieri&guest_id=g1&returnTo=/calendario'), { guestId: 'g1', roomId: null, checkIn: null, checkOut: null })
  assert.deepEqual(parametriInserimento(''), { guestId: null, roomId: null, checkIn: null, checkOut: null })
  const pagina = leggi('app/nuova-prenotazione/page.tsx')
  assert.match(pagina, /const p = parametriInserimento\(window\.location\.search\)/)
  assert.match(pagina, /applicaParametri\(lette\)/)
  assert.match(pagina, /from\('guests'\)\.select\('\*'\)\.eq\('id', p\.guestId\)/)
})

test('le pagine vecchie restano, con in cima la riga in ottone verso quella nuova', () => {
  // i due file delle pagine non si toccano: la riga sta nei layout
  assert.match(leggi('app/prenotazioni/[id]/layout.tsx'), /<AvvisoPaginaVecchia href=\{`\/scheda\/\$\{id\}`\}/)
  assert.match(leggi('app/nuova/layout.tsx'), /<AvvisoPaginaVecchia href="\/nuova-prenotazione"/)
  const avviso = leggi('components/AvvisoPaginaVecchia.tsx')
  assert.match(avviso, /export const TESTO_PAGINA_VECCHIA = 'Questa è la pagina vecchia\. Quella nuova si apre da'/)
  assert.match(avviso, /color: '#A9884E'/)
  // le pagine vecchie esistono ancora
  assert.ok(leggi('app/prenotazioni/[id]/page.tsx').length > 0)
  assert.ok(leggi('app/nuova/page.tsx').length > 0)
})
