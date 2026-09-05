import { test } from 'node:test'
import assert from 'node:assert/strict'
import { daDoveArrivano, struttureDellAnno } from './provenienza.ts'

let n = 0
// La provenienza sta sul CLIENTE (guests.*); telefoni diversi per ogni cliente
const cliente = (nome: string, provenienza = 'non_so', struttura_nome: string | null = null) => ({ id: `c${++n}`, full_name: nome, phone: `+39 333 000 ${String(n).padStart(4, '0')}`, provenienza, struttura_nome })
const b = (id: string, check_in: string, check_out: string, total: number, g: ReturnType<typeof cliente>, extra: Record<string, unknown> = {}) =>
  ({ id, room_id: 'r', check_in, check_out, total_amount: total, status: 'confermata', guest_id: g.id, guests: g, ...extra })

test('da dove arrivano: una riga per fonte con clienti, soggiorni, ritorni e ricavi, ordinate per ricavi; provenienza dal cliente anche sulle prenotazioni vecchie', () => {
  n = 0
  const anna = cliente('Anna Rossi', 'altra_struttura', 'Nida'), marco = cliente('Marco Bianchi', 'google'), luca = cliente('Luca Verdi', 'altra_struttura', 'Umana'), paola = cliente('Paola Neri')
  const periodo = [
    b('a1', '2026-09-01', '2026-09-03', 200, anna),
    b('a2', '2026-09-20', '2026-09-22', 200, anna),                                    // Anna torna: 2° soggiorno del periodo → ritorno
    b('m1', '2026-09-05', '2026-09-07', 200, marco, { group_id: 'g' }),
    b('m2', '2026-09-07', '2026-09-09', 200, marco, { group_id: 'g' }),               // stesso soggiorno (cambio camera)
    b('l1', '2026-09-10', '2026-09-12', 300, luca, { provenienza: 'google' }),        // valore vecchio sulla prenotazione: vince il cliente (Umana)
    b('p1', '2026-09-15', '2026-09-17', 100, paola),
    b('x', '2026-09-29', '2026-10-03', 400, marco),                                   // 2 notti su 4 nel periodo = 200; ritorno di Marco
    b('att', '2026-09-25', '2026-09-27', 100, paola, { status: 'in_attesa' }),        // mai
  ]
  const storico = [...periodo, b('vecchia', '2026-07-01', '2026-07-05', 400, anna)]   // Anna era già stata a luglio
  const out = daDoveArrivano(periodo, storico, '2026-09-01', '2026-10-01')
  assert.deepEqual(out.righe.map(r => `${r.label}:${r.clienti}/${r.soggiorni}/${r.ritorni}/${r.ricaviCent}`), [
    'Google:1/2/1/60000',      // Marco: g (400) + x (200); il secondo è un ritorno
    'Nida:1/2/2/40000',        // Anna: entrambi ritorni (era stata a luglio)
    'Umana:1/1/0/30000',
    'Non so:1/1/0/10000',
    'Passaparola:0/0/0/0',
  ])
  assert.deepEqual([out.totale.clienti, out.totale.soggiorni, out.totale.ritorni, out.totale.ricaviCent], [4, 6, 3, 140000])
  assert.equal(out.colonnePresenti, true)
  // Strutture dell'anno
  assert.deepEqual(struttureDellAnno([...periodo, b('vecchia', '2026-07-01', '2026-07-05', 400, anna)], 2026).map(s => `${s.nome}:${s.soggiorni}/${s.ricaviCent}`), ['Nida:3/80000', 'Umana:1/30000'])
})

test('da dove arrivano: prima della 0037 vale il valore della 0036 sulla prenotazione; senza nulla tutto in Non so e colonnePresenti = false', () => {
  n = 0
  const senzaColonne = { id: 'z', full_name: 'Zoe', phone: '+39 333 000 9999' }
  const out = daDoveArrivano([b('a', '2026-09-01', '2026-09-03', 200, senzaColonne as never, { provenienza: 'passaparola' })], [], '2026-09-01', '2026-10-01')
  assert.equal(out.righe[0].label, 'Passaparola'); assert.equal(out.righe[0].soggiorni, 1)
  const nulla = daDoveArrivano([b('a', '2026-09-01', '2026-09-03', 200, senzaColonne as never)], [], '2026-09-01', '2026-10-01')
  assert.equal(nulla.colonnePresenti, false)
  assert.equal(nulla.righe.find(r => r.chiave === 'non_so')!.soggiorni, 1)
  assert.deepEqual(daDoveArrivano([], [], '2026-09-01', '2026-10-01').righe.map(r => r.soggiorni), [0, 0, 0])
})
