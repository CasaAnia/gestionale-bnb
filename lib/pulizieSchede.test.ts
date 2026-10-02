import { test } from 'node:test'
import assert from 'node:assert/strict'
import { etichettaScheda, orariScheda, rigaResta, pilloleLetti, testoFatta } from './pulizieSchede.ts'
import type { Pulizia, ProssimoArrivo } from './pulizie.ts'

const OGGI = '2026-10-01'
const b = (extra: Record<string, unknown> = {}) => ({ id: 'x', room_id: 'r', check_in: '2026-09-28', check_out: OGGI, status: 'confermata', guest_name: 'Elena Esposito', num_guests: 3, ...extra })
const pul = (tipo: Pulizia['tipo'], booking = b()): Pulizia => ({ roomId: 'r', tipo, booking, prevista: OGGI, due: OGGI, ritardo: 0, rinvii: [] })
const arr = (giorni: number, extra: Record<string, unknown> = {}): ProssimoArrivo => ({ booking: { id: 'y', room_id: 'r', check_in: '2026-10-03', check_out: '2026-10-05', guest_name: 'Giovanni Serra', ...extra }, giorni, cambioDa: null })

test('etichetta: priorità e tipo come nel riferimento', () => {
  assert.equal(etichettaScheda(pul('fine_soggiorno'), arr(0), 'urgente'), 'Urgente · cambio ospite')
  assert.equal(etichettaScheda(pul('soggiorno'), null, 'alta'), 'Priorità alta · 4 notti')
  assert.equal(etichettaScheda(pul('fine_soggiorno'), arr(2), 'nessuna_fretta'), 'Nessuna fretta · arriva il 3 ott')
  assert.equal(etichettaScheda(pul('fine_soggiorno'), null, 'nessuna_fretta'), 'Nessuna fretta · fine soggiorno')
  assert.equal(etichettaScheda(pul('cambio_camera'), null, 'flessibile'), 'Flessibile · cambio camera')
})

test('orari: parte · bagagli · arriva, ognuno solo se il dato c\'è; partenza senza ora = «da chiedere»', () => {
  const tutti = orariScheda(pul('fine_soggiorno', b({ check_out_time: '10:00:00' })), arr(0, { bagagli_alle: '11:00:00', check_in_time: '16:00' }), OGGI, true)
  assert.deepEqual(tutti, [{ chiave: 'parte', etichetta: 'Parte Esposito', ora: '10:00' }, { chiave: 'bagagli', etichetta: 'Bagagli Serra', ora: '11:00' }, { chiave: 'arriva', etichetta: 'Arriva Serra', ora: '16:00' }])
  assert.deepEqual(orariScheda(pul('fine_soggiorno'), null, OGGI, true), [{ chiave: 'parte', etichetta: 'Parte Esposito', ora: null }])
  // senza la 0064: niente partenza né bagagli, l'arrivo resta
  assert.deepEqual(orariScheda(pul('fine_soggiorno'), arr(0, { bagagli_alle: '11:00:00', check_in_time: '16:00' }), OGGI, false), [{ chiave: 'arriva', etichetta: 'Arriva Serra', ora: '16:00' }])
  // partito ieri: nessuna colonna di partenza
  assert.deepEqual(orariScheda(pul('fine_soggiorno', b({ check_out: '2026-09-30' })), null, OGGI, true), [])
  // cambio camera senza ora: nessun «da chiedere» (l'ospite non lascia Casa Ania)
  assert.deepEqual(orariScheda(pul('cambio_camera'), null, OGGI, true), [])
  assert.deepEqual(orariScheda(pul('soggiorno'), arr(0), OGGI, true), [])
})

test('chi resta, pillole e pulita', () => {
  assert.equal(rigaResta(b({ guest_name: 'Lucia Ferri', num_guests: 2 })), 'Lucia Ferri resta · 2 ospiti · cambio biancheria della 4ª notte')
  assert.deepEqual(pilloleLetti('Lena', b({ num_guests: 3, extra_bed: false }), OGGI), ['🛏 1 matrimoniale + 1 singolo', '6 federe', '3 completi asciugamani'])
  assert.deepEqual(pilloleLetti('Ambra', b({ num_guests: 2 }), OGGI), ['🛏 1 matrimoniale', '4 federe', '2 completi asciugamani'])
  assert.deepEqual(pilloleLetti('Ambra', b({ num_guests: 9 }), OGGI), ['letti da confermare'])
  assert.equal(testoFatta('9:02', 38), '✓ Pulita 9:02 · 38 min')
  assert.equal(testoFatta(null, null), '✓ Pulita')
})

test('la pagina usa le schede nuove e riusa i comandi di sempre (ControlliPulizia), non li riscrive', async () => {
  const { readFileSync } = await import('node:fs')
  const pagina = readFileSync(new URL('../app/pulizie/page.tsx', import.meta.url), 'utf8')
  const scheda = readFileSync(new URL('../components/pulizie/SchedaCameraOggi.tsx', import.meta.url), 'utf8')
  assert.ok(pagina.includes('<SchedaCameraOggi') && pagina.includes('<SpaziComuniOggi'))
  assert.ok(scheda.includes('<ControlliPulizia pagina'))
  assert.ok(!scheda.includes('inviaOperazionePulizia'), 'nessun salvataggio nuovo nella scheda')
})
