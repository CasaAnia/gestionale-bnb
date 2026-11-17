// Letture sempre complete (17/11/2026): una tabella oltre le 1.000 righe non si taglia in silenzio.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { leggiTutto, leggiTuttoPer } from './leggiTutto.ts'
import { ErroreLetturaIncompleta } from './statistiche/paginazione.ts'
import { readFileSync } from 'node:fs'

type Riga = { id: string; n: number }
/* eslint-disable @typescript-eslint/no-explicit-any */
// Un finto Supabase: risponde come PostgREST, al massimo 1.000 righe per richiesta, con range, order e in.
function finto(righe: Riga[], opzioni: { erroreAllaPagina?: number } = {}) {
  const chiamate: { range: [number, number]; ordine: string[]; filtroIn?: string[] }[] = []
  let pagina = 0
  return {
    chiamate,
    from() {
      const stato = { ordine: [] as string[], filtroIn: undefined as string[] | undefined }
      const q: any = {
        select() { return q },
        order(c: string, o?: { ascending?: boolean }) { stato.ordine.push(`${c}:${o?.ascending === false ? 'desc' : 'asc'}`); return q },
        in(_c: string, v: string[]) { stato.filtroIn = v; return q },
        eq() { return q },
        range(da: number, a: number) {
          pagina++
          chiamate.push({ range: [da, a], ordine: [...stato.ordine], filtroIn: stato.filtroIn })
          if (opzioni.erroreAllaPagina === pagina) return Promise.resolve({ data: null, error: new Error('rete') })
          const base = stato.filtroIn ? righe.filter(r => stato.filtroIn!.includes(r.id)) : righe
          return Promise.resolve({ data: base.slice(da, Math.min(a + 1, da + 1000)), error: null })
        },
      }
      return q
    },
  }
}
const tante = (n: number): Riga[] => Array.from({ length: n }, (_, i) => ({ id: `r${String(i).padStart(5, '0')}`, n: i }))

for (const [n, pagine] of [[0, 1], [999, 1], [1000, 2], [1001, 2], [2500, 3]] as const) {
  test(`${n} righe: tutte, in ${pagine} ${pagine === 1 ? 'pagina' : 'pagine'}, senza buchi né doppioni`, async () => {
    const db = finto(tante(n))
    const r = await leggiTutto<Riga>(db as never, 'bookings', '*')
    assert.equal(r.error, null)
    assert.equal(r.data!.length, n)
    assert.deepEqual(r.data!.map(x => x.n), Array.from({ length: n }, (_, i) => i))
    assert.equal(db.chiamate.length, pagine)
    // l'ordine è stabile: l'id chiude sempre
    assert.deepEqual(db.chiamate[0].ordine, ['id:asc'])
    assert.deepEqual(db.chiamate.map(c => c.range[0]), Array.from({ length: pagine }, (_, i) => i * 1000))
  })
}

test('errore alla seconda pagina: errore e nessuna riga, mai un elenco a metà', async () => {
  const r = await leggiTutto<Riga>(finto(tante(2500), { erroreAllaPagina: 2 }) as never, 'bookings')
  assert.ok(r.error)
  assert.equal(r.data, null)
  const primaPagina = await leggiTutto<Riga>(finto(tante(2500), { erroreAllaPagina: 1 }) as never, 'bookings')
  assert.ok(primaPagina.error); assert.equal(primaPagina.data, null)
})

test('ordine voluto prima dell\'id, e filtri applicati a ogni pagina', async () => {
  const db = finto(tante(1500))
  let filtri = 0
  await leggiTutto(db as never, 'family_expenses', '*', { ordine: [{ colonna: 'expense_date', ascendente: false }], filtri: q => { filtri++; return q.eq('x', 1) } })
  assert.deepEqual(db.chiamate[0].ordine, ['expense_date:desc', 'id:asc'])
  assert.equal(filtri, 2)
})

test('un elenco lungo di valori si legge a blocchi da 100, ogni blocco a pagine, righe uniche', async () => {
  const righe = tante(1500)
  const db = finto(righe)
  const r = await leggiTuttoPer<Riga>(db as never, 'family_expense_items', '*', 'expense_id', righe.map(x => x.id))
  assert.equal(r.error, null)
  assert.equal(r.data!.length, 1500)
  assert.equal(db.chiamate.length, 15)                       // 15 blocchi da 100, una pagina ciascuno
  assert.ok(db.chiamate.every(c => c.filtroIn!.length <= 100))
  const male = await leggiTuttoPer<Riga>(finto(righe, { erroreAllaPagina: 7 }) as never, 'family_expense_items', '*', 'expense_id', righe.map(x => x.id))
  assert.ok(male.error); assert.equal(male.data, null)
  assert.deepEqual(await leggiTuttoPer<Riga>(finto(righe) as never, 'x', '*', 'expense_id', []), { data: [], error: null })
})

test('tetto di pagine con l\'ultima ancora piena: errore esplicito, non un elenco che sembra intero', async () => {
  // 5.000 righe a pagine da 100 = 50 pagine piene: il tetto è raggiunto e potrebbero essercene altre
  const r = await leggiTutto<Riga>(finto(tante(5000)) as never, 'bookings', '*', { limite: 100 })
  assert.equal(r.data, null)
  assert.ok(r.error?.cause instanceof ErroreLetturaIncompleta)
  assert.match(r.error!.message, /Lettura incompleta/)
})

test('le letture di tabelle intere usano leggiTutto: nessuna tabella che cresce è letta con un select secco', () => {
  const leggi = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  const punti: [string, RegExp][] = [
    ['app/calendario/page.tsx', /leggiTutto<CalendarBooking>\(supabase, 'bookings'[\s\S]{0,200}leggiTutto<PaymentRow>\(supabase, 'payments'/],
    ['app/arrivi/page.tsx', /leggiTutto<Riga>\(supabase, 'bookings'/],
    ['app/clienti/page.tsx', /leggiTutto<ClienteElenco>\(supabase, 'guests'[\s\S]{0,400}leggiTutto<SoggiornoStorico>\(supabase, 'bookings'/],
    ['app/prenotazioni/page.tsx', /leggiTutto<Record<string, unknown>>\(supabase, 'bookings'/],
    ['app/richieste/page.tsx', /leggiTutto<Record<string, unknown>>\(supabase, 'bookings'[\s\S]{0,300}'payments'[\s\S]{0,400}'guests'/],
    ['app/richieste/[id]/proposta/page.tsx', /leggiTutto<Record<string, unknown>>\(supabase, 'bookings'[\s\S]{0,600}'guests'/],
    ['lib/richiesteDati.ts', /leggiTutto\(supabase, 'richieste'/],
    ['lib/puliziePush.ts', /leggiTutto<Riga>\(supabase, 'bookings'[\s\S]{0,200}leggiTutto<Decisione>\(supabase, 'cleanings'/],
    ['app/api/push/ringraziamento/route.ts', /leggiTutto<Riga>\(supabase, 'bookings'/],
    ['lib/spese/dati.ts', /leggiTutto<Fx>\(supabase, 'family_expenses'[\s\S]{0,2000}leggiTuttoPer<[^>]*>\(supabase, 'family_expense_items'/],
  ]
  for (const [f, re] of punti) assert.match(leggi(f), re, f)
  // e quei punti non hanno più il select secco sulla stessa tabella
  const secchi: [string, RegExp][] = [
    ['app/calendario/page.tsx', /supabase\.from\('(bookings|payments)'\)\.select/],
    ['app/arrivi/page.tsx', /supabase\.from\('bookings'\)/],
    ['app/clienti/page.tsx', /supabase\.from\('(guests|bookings)'\)/],
    ['app/prenotazioni/page.tsx', /\.from\('bookings'\)\s*\.select/],
    ['app/richieste/page.tsx', /supabase\.from\('(bookings|payments|guests)'\)/],
    ['app/richieste/[id]/proposta/page.tsx', /supabase\.from\('(bookings|guests)'\)/],
    ['lib/puliziePush.ts', /supabase\.from\('(bookings|cleanings)'\)/],
    ['lib/spese/dati.ts', /from\('family_expenses'\)\.select\('\*'\)\.order|from\('family_expense_items'\)\.select/],
  ]
  for (const [f, re] of secchi) assert.doesNotMatch(leggi(f), re, `${f}: select secco su una tabella che cresce`)
})

