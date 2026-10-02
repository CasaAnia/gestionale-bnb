// Pulizie, ritocchi del 02/10/2026 (docs/design/pulizie-timer-riferimento.html
// e pulizie-fondo-riferimento.html, checklist pulizie-timer-checklist.md).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { segnatiValidi, testoSegnati, testoOggiSpazi, minutiDalCampo, leggiSegnati, scriviSegnati, fotoTimer } from './minutiSegnati.ts'

const leggi = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const timer = (trascorsi: number, versione = 3, avviato_at: string | null = null) => ({ chiave: 'pulizia:x:soggiorno:2026-10-02', trascorsi, versione, avviato_at })

test('T1 · i minuti segnati: le parole della scheda', () => {
  assert.equal(testoSegnati(35), '✓ 35 minuti segnati')
  assert.equal(testoSegnati(1), '✓ 1 minuto segnato')
  assert.equal(testoOggiSpazi(12), 'oggi 12 minuti segnati')
  assert.equal(testoOggiSpazi(0), 'oggi niente segnato')
})

test('T1 · i minuti segnati valgono solo col timer di quando si sono segnati, e fermo', () => {
  const s = { minuti: 35, timer: fotoTimer(timer(1380)) }
  assert.deepEqual(segnatiValidi(s, timer(1380)), s)
  assert.equal(segnatiValidi(s, timer(1380, 4)), null, 'il timer è cambiato altrove')
  assert.equal(segnatiValidi(s, timer(1380, 3, '2026-10-02T08:00:00Z')), null, 'il timer corre di nuovo')
  // minuti a mano senza timer
  assert.deepEqual(segnatiValidi({ minuti: 10, timer: null }, undefined), { minuti: 10, timer: null })
  assert.equal(segnatiValidi({ minuti: 10, timer: null }, timer(60)), null, 'poi è partito un timer')
})

test('T1 · il campo dei minuti a mano: interi da 1 a 1440', () => {
  assert.equal(minutiDalCampo('35'), 35)
  assert.equal(minutiDalCampo(' 7 '), 7)
  for (const x of ['', '0', '-3', '2.5', 'abc', '1441']) assert.equal(minutiDalCampo(x), null, x)
})

test('T1 · i minuti segnati restano sul telefono (la PWA si ricarica tornando da WhatsApp)', () => {
  const m = new Map<string, string>()
  const mem = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) } }
  scriviSegnati(mem, 'pulizia:x', { minuti: 35, timer: { versione: 3, trascorsi: 1380 } })
  assert.deepEqual(leggiSegnati(mem, 'pulizia:x'), { minuti: 35, timer: { versione: 3, trascorsi: 1380 } })
  scriviSegnati(mem, 'pulizia:x', null)
  assert.equal(leggiSegnati(mem, 'pulizia:x'), null)
  m.set('pulizie-minuti-segnati:pulizia:y', '{"minuti":0,"timer":null}')
  assert.equal(leggiSegnati(mem, 'pulizia:y'), null, 'zero minuti non sono «segnati»')
})

test('T1 · sulla scheda della camera i comandi del timer, gli stessi del foglio', () => {
  const t = leggi('components/TimerPulizia.tsx')
  const grande = t.slice(t.indexOf('if (grande)'), t.indexOf('if (foglio)'))
  for (const parola of ['In corso', 'In pausa', 'Pausa', 'Avvia', 'Riprendi', 'Ferma e riporta i minuti', 'Azzera', 'Minuti a mano', 'Un altro timer è in corso']) assert.ok(grande.includes(parola), parola)
  // stessa logica: minuti riletti dal server, arrotondati per eccesso
  assert.ok(grande.includes('setAttesaRiporto(true)') && t.includes('minutiTimer(t.trascorsi)'))
  const c = leggi('components/ControlliPulizia.tsx')
  const pagina = c.slice(c.indexOf('if (pagina)'), c.indexOf('if (home)'))
  assert.ok(pagina.includes('testoSegnati(') && pagina.includes('correggi'), '«✓ 35 minuti segnati · correggi»')
  assert.ok(pagina.includes("registra('fatta', null, undefined, undefined, segnatiOra)"), '«Pulita» salva coi minuti, senza il foglio')
  assert.ok(pagina.includes('minutiSegnati={'), '«Pulita e recuperato» apre il foglio coi minuti già scritti')
  assert.ok(pagina.includes('Salva') && pagina.includes('Annulla') && pagina.includes('minuti</small>'))
  // il foglio tiene i suoi comandi
  assert.ok(leggi('components/SchedaPulizia.tsx').includes('TimerPulizia'))
})

test('T1 · nessun tasto pieno nero nella pagina Pulizie', () => {
  const file = ['app/pulizie/page.tsx', 'components/ControlliPulizia.tsx', 'components/TimerPulizia.tsx', 'components/pulizie/SchedaCameraOggi.tsx', 'components/pulizie/SpaziComuniOggi.tsx']
  for (const f of file) assert.ok(!/pul-az p[ "']|ed-pillola["' ]/.test(f === 'components/ControlliPulizia.tsx' ? leggi(f).slice(leggi(f).indexOf('if (pagina)'), leggi(f).indexOf('if (home)')) : f === 'components/TimerPulizia.tsx' ? leggi(f).slice(leggi(f).indexOf('if (grande)'), leggi(f).indexOf('if (foglio)')) : leggi(f)), f)
  assert.ok(!leggi('app/pulizie.css').includes('.pul-card .pul-az.p'))
})

test('T2 · spazi comuni: i minuti si AGGIUNGONO a quelli di oggi (12 + 23 = 35)', async () => {
  const { aggiuntaSpazi } = await import('./spaziComuni.ts')
  assert.deepEqual(aggiuntaSpazi(12, 23), { totale: 35, errore: null })
  assert.deepEqual(aggiuntaSpazi(null, 7), { totale: 7, errore: null })
  assert.ok(aggiuntaSpazi(1430, 20).errore, 'oltre i 1440 minuti del giorno')
})

test('T2 · spazi comuni uguali alle camere: sezione, una scheda per voce, timer grande e comandi', () => {
  const s = leggi('components/pulizie/SpaziComuniOggi.tsx')
  assert.ok(s.includes('<p className="pul-sez">{TITOLO_SPAZI}</p>'), 'titolo maiuscoletto ottone col filo')
  assert.ok(s.includes('vociSpaziAttive(conAltro).map'), 'una scheda per voce')
  assert.ok(s.includes('<TimerPulizia grande chiave={chiave}') && s.includes('onAMano={apriAMano}'), 'gli stessi comandi di T1')
  assert.ok(s.includes("className={`pul-card pul-spazio${attiva ? ' cur' : ''}`}"), 'sfondo avorio come le camere')
  assert.ok(s.includes('testoOggiSpazi(minuti)') && s.includes('onMinuti(voce)'), '«oggi 35 minuti segnati» apre il foglio dei minuti')
  assert.ok(s.includes('salvaFuoriCamera(giorno, attivita, conto.totale, riga?.versione ?? null, trascorsi)'), 'aggiunge e consuma il timer nella stessa transazione')
  assert.ok(s.includes('area_comune'), 'il timer «Area comune» di prima si legge sotto il corridoio')
  // «Cosa · facoltativo» resta nel foglio, solo per «Altro»
  assert.ok(leggi('components/pulizie/FoglioSpaziComuni.tsx').includes("voce === 'altro' && conCosa && <label className=\"pul-fld\"><span>Cosa · facoltativo</span>"))
  assert.ok(/\.pul-spazio \.hd b \{ font-size: 27px; white-space: nowrap; \}/.test(leggi('app/pulizie.css')))
})

test('T3 · «Fuori dalle camere» tolta: i suoi tempi stanno negli spazi comuni, niente si perde', () => {
  const pagina = leggi('app/pulizie/page.tsx')
  assert.ok(!pagina.includes('TempiFuoriCamera') && !pagina.includes('Fuori dalle camere'))
  // il link della Home porta agli spazi comuni, e la pagina ci arriva anche coi vecchi link
  assert.ok(leggi('components/PulizieOggi.tsx').includes('href="/pulizie#spazi-comuni"'))
  assert.ok(pagina.includes("window.location.hash === '#spazi-comuni' || window.location.hash === '#fuori-camera'"))
  // «Vai a» e «Recupera minuti» di un timer degli spazi comuni (anche «Area comune») portano alla sua scheda
  assert.ok(pagina.includes("`spazi-${voceSpazi(p[2]) ?? 'corridoio'}`") && pagina.includes('Recupera minuti'))
  // i giorni passati si correggono dal Registro (riga degli spazi comuni → foglio dei minuti)
  assert.ok(pagina.includes('onApriSpazi={(giorno, voce, righe) => setFoglioSpazi({ giorno, voce, righe })}'))
})

test('T3 · fondo pagina: prossime pulizie e rinvii nella veste della pagina', async () => {
  const f = await import('./pulizieFondo.ts')
  assert.deepEqual([f.TIPO_PROSSIMA.fine_soggiorno, f.TIPO_PROSSIMA.soggiorno, f.TIPO_PROSSIMA.cambio_camera], ['fine soggiorno', 'biancheria 4 notti', 'cambio camera'])
  assert.equal(f.dataProssima('2026-10-03'), 'sab 3 ott')
  assert.equal(f.sottoProssima('fine_soggiorno', 'Giovanni Serra', false), 'parte Giovanni Serra · da fare')
  assert.equal(f.sottoProssima('soggiorno', 'Lucia Ferri', false), 'Lucia Ferri resta · da fare')
  assert.equal(f.daA('2026-10-01', '2026-10-02'), '1 → 2 ott')
  assert.equal(f.daA('2026-09-30', '2026-10-02'), '30 set → 2 ott')
  assert.deepEqual(f.rigaRinvio({ stato: 'rimandata', data_prevista: '2026-10-01', prossima_data: '2026-10-02' }), { tipo: 'rimandata', data: '1 → 2 ott', sotto: 'non conta fra le pulizie fatte' })
  assert.equal(f.rigaRinvio({ stato: 'saltata', data_prevista: '2026-10-01', prossima_data: '2026-10-05' }).tipo, 'cambio saltato')
  assert.equal(f.NOTA_FONDO, 'I tempi dei giorni passati si correggono dal Registro, toccando la riga degli spazi comuni.')
  const pagina = leggi('app/pulizie/page.tsx')
  assert.ok(pagina.includes('<p className="pul-sez">Prossime pulizie</p>') && pagina.includes('<p className="pul-sez">Rinvii e salti</p>'))
  assert.ok(pagina.includes('className="pul-anticipa"') && !pagina.includes('ed-pillola'), '«Anticipa» è un link sottolineato')
  const css = leggi('app/pulizie.css')
  assert.ok(css.includes('.pul-pross > b { font-family: var(--p-disp); font-size: 21px;') && css.includes('.pul-pross .d { font-family: var(--p-disp); font-size: 19px; font-weight: 600;') && css.includes('.pul-pross.mu { opacity: .65; }'))
})
