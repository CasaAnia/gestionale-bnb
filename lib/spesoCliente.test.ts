// Quanto ha speso il cliente sulla scheda del Calendario (Ania, 02/10/2026)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spesoPrimaCent, spesoConQuestaCent, formeCifra } from './spesoCliente.ts'
import { clienteFoglietto } from './calendarioFoglietto.ts'
import { euroScheda } from './schedaPrenotazione.ts'

const leggi = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const OGGI = '2026-10-02'
const camere = [{ id: 'ambra', name: 'Ambra' }, { id: 'lena', name: 'Lena' }]
const r = (id: string, extra: Record<string, unknown>) => ({ id, room_id: 'ambra', guest_id: 'rosa', guest_name: 'Rosa Bianchi', status: 'completata', check_in: '2026-08-01', check_out: '2026-08-04', total_amount: 300, ...extra })

test('lo stesso numero del foglietto: i soggiorni conclusi più il conto di questa', () => {
  const prima1 = r('p1', {}), prima2 = r('p2', { check_in: '2026-09-01', check_out: '2026-09-03', room_id: 'lena', total_amount: 200 })
  const annullata = r('p3', { check_in: '2026-09-10', check_out: '2026-09-12', status: 'annullata' })   // non conta
  const questa = [r('q1', { prenotazione_id: 'Q', status: 'confermata', check_in: '2026-10-05', check_out: '2026-10-08', total_amount: 480 }),
    r('q2', { prenotazione_id: 'Q', status: 'confermata', room_id: 'lena', check_in: '2026-10-08', check_out: '2026-10-10', total_amount: 400 })]
  const tutte = [prima1, prima2, annullata, ...questa]
  assert.equal(spesoPrimaCent(questa[0] as never, tutte as never, camere, OGGI), 50000)
  const cent = spesoConQuestaCent(questa[0] as never, questa as never, tutte as never, camere, OGGI)
  assert.equal(cent, 138000)
  // la riga «Cliente» del foglietto dice la stessa cifra
  const riga = clienteFoglietto(2, null, false, 50000, 88000)
  assert.equal(riga.find(p => p.tipo === 'mat')?.testo, formeCifra(cent!)[0])
  assert.equal(formeCifra(cent!)[0], '1.380 €')
  // un mancato arrivo della prenotazione conta, come nel foglietto
  const mancato = r('q3', { prenotazione_id: 'Q', status: 'annullata', mancato_arrivo_centesimi: 5000 })
  assert.equal(spesoConQuestaCent(questa[0] as never, [...questa, mancato] as never, tutte as never, camere, OGGI), 143000)
  // conto non leggibile: niente cifra
  assert.equal(spesoConQuestaCent(questa[0] as never, [{ ...questa[0], total_amount: null }] as never, tutte as never, camere, OGGI), null)
})

test('le forme della cifra, dalla più lunga: quella del foglietto → «1.381 €» → «1.381»', () => {
  assert.deepEqual(formeCifra(138050), [euroScheda(138050), '1.381 €', '1.381'])   // la prima è quella del foglietto
  assert.deepEqual(formeCifra(138000), ['1.380 €', '1.380'])
  assert.deepEqual(formeCifra(9000), ['90 €', '90'])
})

test('la scheda del nastro: cifra attaccata al nome (6 px, mai in fondo: Ania 02/10/2026), Cormorant 13 peso 600, nome che non si stringe; nel Calendario sì, nelle Richieste no', () => {
  const scheda = leggi('components/calendario/SchedaPrenotazione.tsx')
  assert.match(scheda, /<b className="con-speso"><span data-nome>/)
  assert.match(scheda, /<CifraSpeso cent=\{speso\} \/>/)
  const css = leggi('app/maison.css')
  assert.match(css, /\.cal-scheda-in \.tx > b\.con-speso > \[data-nome\] \{ flex: none; white-space: nowrap; \}/)
  assert.match(css, /\.cal-scheda-in \.tx > b\.con-speso > \.spe \{ flex: none; margin-left: 0; padding-left: 6px; font-family: var\(--m-disp\); font-size: 13px; font-weight: 600; color: #8C3B2E; \}/)
  assert.match(leggi('app/calendario/page.tsx'), /speso=\{spesoPerBooking\[booking\.id\]\}/)
  assert.doesNotMatch(leggi('components/richieste/NastroRichieste.tsx'), /speso=/)
  // il foglietto usa la stessa funzione
  assert.match(leggi('components/calendario/FogliettoPrenotazione.tsx'), /spesoPrimaCent: spesoPrimaCent\(prenotazione, tutte, camere, oggi\)/)
})

// ── 17/11/2026: la cifra rossa non corrispondeva al totale speso ─────────────
// Caso vero, anonimizzato («Roberto»): lo stesso cliente aveva DUE schede con lo
// stesso telefono (una scritta con il +39, una senza). Sei soggiorni stavano
// sulla prima, uno sulla seconda. La cifra rossa filtrava per scheda e diceva
// 1.840 € su sei e 158 € sul settimo: il totale vero è 1.998 €.
import { soggiorniDelCliente, stessoCliente, schedeStessoTelefono } from './spesoCliente.ts'
import { leggiSchedeGemelle } from './spesoClienteDati.ts'

const OGGI2 = '2026-11-17'
const camere2 = [{ id: 'ambra', name: 'Ambra' }, { id: 'lena', name: 'Lena' }]
const sc = (id: string, extra: Record<string, unknown> = {}) => ({ id, room_id: 'ambra', guest_id: 'g1', guest_name: 'Roberto Verdi', status: 'confermata', check_in: '2026-04-13', check_out: '2026-04-17', total_amount: 320, guests: { phone: '+39 335 123 4567', full_name: 'Roberto Verdi' }, ...extra })
const scheda2 = { guest_id: 'g2', guests: { phone: '3351234567', full_name: 'Roberto Verdi' } }
const sei = [
  sc('a1', { total_amount: 320 }), sc('a2', { check_in: '2026-04-20', check_out: '2026-04-24', total_amount: 320 }),
  sc('a3', { check_in: '2026-04-26', check_out: '2026-04-30', total_amount: 300 }), sc('a4', { check_in: '2026-05-04', check_out: '2026-05-08', total_amount: 300 }),
  sc('a5', { check_in: '2026-05-10', check_out: '2026-05-15', total_amount: 375 }), sc('a6', { check_in: '2026-07-05', check_out: '2026-07-08', total_amount: 225 }),
]
const settimo = sc('b1', { guest_id: 'g2', check_in: '2026-06-22', check_out: '2026-06-24', total_amount: 158, guests: scheda2.guests })
const tutte2 = [...sei, settimo]

test('causa 2 — due schede con lo stesso telefono: la cifra rossa è il totale vero, su tutti e sette i soggiorni', () => {
  // dalla settima (scheda 2): prima = i sei della scheda 1, questa = 158 → 1.998
  assert.equal(spesoConQuestaCent(settimo as never, [settimo] as never, tutte2 as never, camere2, OGGI2), 199800)
  // dall'ultima della scheda 1: gli altri cinque + il settimo + questa → 1.998
  const ultima = sei[5]
  assert.equal(spesoConQuestaCent(ultima as never, [ultima] as never, tutte2 as never, camere2, OGGI2), 199800)
  assert.equal(spesoPrimaCent(settimo as never, tutte2 as never, camere2, OGGI2), 184000)
  assert.equal(soggiorniDelCliente(settimo as never, tutte2 as never, camere2, OGGI2).length, 6)
  assert.equal(soggiorniDelCliente(ultima as never, tutte2 as never, camere2, OGGI2).length, 6)
})

test('causa 2 — si unisce per telefono (cifre), MAI per il solo nome: due «Antonio» con telefoni diversi restano due clienti', () => {
  const antonio1 = sc('c1', { guest_id: 'g3', guest_name: 'Antonio', guests: { phone: '339 111 2706', full_name: 'Antonio' }, total_amount: 70 })
  const antonio2 = sc('c2', { guest_id: 'g4', guest_name: 'Antonio', guests: { phone: '339 222 2866', full_name: 'Antonio' }, check_in: '2026-10-15', check_out: '2026-10-16', total_amount: 80 })
  assert.equal(stessoCliente(antonio1 as never, antonio2 as never), false)
  assert.equal(spesoConQuestaCent(antonio2 as never, [antonio2] as never, [antonio1, antonio2] as never, camere2, OGGI2), 8000)
  // nessun telefono da nessuna parte: nessuna unione, solo la scheda
  const senza1 = sc('d1', { guest_id: 'g5', guests: { phone: null, full_name: 'X' } }), senza2 = sc('d2', { guest_id: 'g6', guests: { phone: '', full_name: 'X' } })
  assert.equal(stessoCliente(senza1 as never, senza2 as never), false)
  // stessa scheda: sempre lo stesso cliente
  assert.equal(stessoCliente(sei[0] as never, sei[1] as never), true)
  // stesso telefono in due forme: lo stesso cliente
  assert.equal(stessoCliente(sei[0] as never, settimo as never), true)
})

test('causa 2 — le schede con lo stesso telefono si trovano a cifre, e la scheda stessa non conta', () => {
  const guests = [{ id: 'g1', phone: '+39 335 123 4567' }, { id: 'g2', phone: '335-1234567' }, { id: 'g3', phone: '339 111 2706' }, { id: 'g4', phone: null }]
  assert.deepEqual(schedeStessoTelefono('g1', '3351234567', guests), ['g2'])
  assert.deepEqual(schedeStessoTelefono('g3', '339 111 2706', guests), [])
  assert.deepEqual(schedeStessoTelefono('g4', null, guests), [])
})

// la lettura delle schede gemelle (la scheda prenotazione): completa, o niente cifra
type Risposta = { data: unknown[] | null; error: unknown }
function finto(guests: unknown[], bookings: unknown[], errore: { tabella?: string } = {}) {
  return {
    from(tabella: string) {
      let filtro: string[] | null = null
      const q = {
        select() { return q }, order() { return q }, in(_c: string, ids: string[]) { filtro = ids; return q },
        range(da: number, a: number): PromiseLike<Risposta> {
          if (errore.tabella === tabella) return Promise.resolve({ data: null, error: new Error('rete') })
          const base = tabella === 'guests' ? guests : (bookings as { guest_id: string }[]).filter(b => !filtro || filtro.includes(b.guest_id))
          return Promise.resolve({ data: base.slice(da, a + 1), error: null })
        },
      }
      return q
    },
  }
}
test('causa 2 — la lettura delle schede gemelle è completa (oltre 1.000 righe) e dice l\'errore, mai una lista a metà', async () => {
  const molti = Array.from({ length: 1205 }, (_, i) => ({ id: i === 1204 ? 'g2' : `x${i}`, phone: i === 1204 ? '335 123 4567' : `0${i}` }))
  const righe = [settimo, { ...settimo, id: 'b2' }]
  const ok = await leggiSchedeGemelle(finto(molti, righe) as never, 'g1', '+39 335 123 4567')
  assert.equal(ok.errore, null)
  assert.deepEqual(ok.righe.map(x => (x as { id: string }).id), ['b1', 'b2'])
  const senzaTel = await leggiSchedeGemelle(finto(molti, righe) as never, 'g1', null)
  assert.deepEqual(senzaTel, { righe: [], errore: null })
  const male = await leggiSchedeGemelle(finto(molti, righe, { tabella: 'bookings' }) as never, 'g1', '335 123 4567')
  assert.ok(male.errore); assert.deepEqual(male.righe, [])
  const male2 = await leggiSchedeGemelle(finto(molti, righe, { tabella: 'guests' }) as never, 'g1', '335 123 4567')
  assert.ok(male2.errore); assert.deepEqual(male2.righe, [])
})

test('UNA sola funzione: cifra rossa, foglietto, riquadro e testata della scheda prendono i soggiorni dal totale unico, nessuno li ricalcola da sé', () => {
  const calendario = leggi('app/calendario/page.tsx'), foglietto = leggi('components/calendario/FogliettoPrenotazione.tsx'), scheda = leggi('app/scheda/[id]/page.tsx')
  for (const [nome, src] of [['calendario', calendario], ['foglietto', foglietto], ['scheda', scheda]] as const) {
    assert.doesNotMatch(src, /elencoSoggiorniPersona\(/, `${nome}: i soggiorni del cliente vengono solo da soggiorniDelCliente (lib/spesoCliente)`)
    assert.match(src, /soggiorniDelCliente\(|spesoConQuestaCent\(/, nome)
  }
  assert.match(scheda, /spesoPrimaCent\(/)
  assert.match(scheda, /leggiSchedeGemelle\(/)
  assert.match(foglietto, /spesoPrimaCent\(prenotazione, tutte, camere, oggi\)/)
})
