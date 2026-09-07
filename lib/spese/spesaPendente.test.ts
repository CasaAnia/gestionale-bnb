// R1 della revisione del 07/09/2026: «Riprova» non deve raddoppiare una
// spesa. Servizio finto che conserva davvero le righe: risposta persa,
// riprova, doppio tocco, risposta tardiva, riapertura (nuova istanza con la
// custodia del browser conservata), rifiuto certo.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { eseguiInserimentoSpesa, leggiPendente, chiaveMemoriaSpesa, MESSAGGIO_INCERTO, MESSAGGIO_NON_SALVATA, _azzeraInCorso, type DepsInserimento, type SpesaPendente } from './spesaPendente.ts'

// --- servizio finto: le righe restano, la risposta può perdersi o arrivare tardi ---
function servizio() {
  const righe = new Map<string, Record<string, unknown>>()
  let perdiRisposta = false      // salva ma risponde con errore di rete
  let ritardo: (() => void) | null = null   // salva solo quando si sblocca (risposta tardiva)
  return {
    righe,
    perdi(v: boolean) { perdiRisposta = v },
    ritarda() { return new Promise<void>(ok => { ritardo = ok }) },
    sblocca() { ritardo?.(); ritardo = null },
    esiste: async (id: string) => ({ data: righe.has(id) ? [{ id }] : [], error: null }),
    inserisci: async (id: string, payload: Record<string, unknown>) => {
      if (ritardo) await new Promise<void>(ok => { const t = ritardo!; ritardo = () => { t(); ok() } })
      if (righe.has(id)) return { error: { code: '23505', message: 'duplicate key' } }
      righe.set(id, { id, ...payload })
      if (perdiRisposta) return { error: { message: 'Failed to fetch' } }
      return { error: null }
    },
  }
}

// --- browser finto: la custodia sopravvive alla «riapertura» ---
function browser() {
  const memoria = new Map<string, string>()
  return { memoria, deps(ambito: string, srv: ReturnType<typeof servizio>, ids = ['id-1', 'id-2', 'id-3']): DepsInserimento {
    let n = 0
    return {
      nuovoId: () => ids[n++],
      adesso: () => '2026-09-07T10:00:00Z',
      leggiPendente: () => leggiPendente(memoria.get(chiaveMemoriaSpesa(ambito)) ?? null, ambito),
      custodisci: (p: SpesaPendente) => { memoria.set(chiaveMemoriaSpesa(ambito), JSON.stringify(p)); return true },
      dimentica: () => { memoria.delete(chiaveMemoriaSpesa(ambito)) },
      esiste: srv.esiste,
      inserisci: srv.inserisci,
    }
  } }
}

const SPESA = { expense_date: '2026-09-07', amount: 12, group_id: 'g1', source: 'manuale' }
beforeEach(() => _azzeraInCorso())

test('risposta persa poi «Riprova»: una sola riga da 12 €, esito incerto detto chiaramente, custodia poi dimenticata', async () => {
  const srv = servizio(); const b = browser(); const deps = b.deps('azienda', srv)
  srv.perdi(true)
  const primo = await eseguiInserimentoSpesa('azienda', SPESA, deps)
  assert.equal(primo.esito, 'incerto')
  assert.equal((primo as { messaggio: string }).messaggio, MESSAGGIO_INCERTO)
  assert.equal(srv.righe.size, 1)
  assert.ok(b.memoria.has(chiaveMemoriaSpesa('azienda')), 'la custodia resta finché non si riconcilia')
  srv.perdi(false)
  const secondo = await eseguiInserimentoSpesa('azienda', null, deps)   // «Riprova»
  assert.deepEqual(secondo, { esito: 'salvata', id: 'id-1', giaPresente: true })
  assert.equal(srv.righe.size, 1)
  assert.equal([...srv.righe.values()].reduce((s, r) => s + Number(r.amount), 0), 12)
  assert.equal(b.memoria.size, 0)
})

test('riapertura: nuova istanza, memoria del browser conservata, riconcilia senza scrivere; la SECONDA riapertura non trova più nulla', async () => {
  const srv = servizio(); const b = browser()
  srv.perdi(true)
  await eseguiInserimentoSpesa('azienda', SPESA, b.deps('azienda', srv))
  srv.perdi(false)
  // riapertura: altro «controller», stessa memoria
  const deps2 = b.deps('azienda', srv, ['altro-id'])
  const pendente = deps2.leggiPendente()
  assert.equal(pendente?.id, 'id-1')
  const esito = await eseguiInserimentoSpesa('azienda', null, deps2)
  assert.deepEqual(esito, { esito: 'salvata', id: 'id-1', giaPresente: true })
  assert.equal(srv.righe.size, 1)
  // seconda riapertura: niente pendente, niente da fare
  const deps3 = b.deps('azienda', srv)
  assert.equal(deps3.leggiPendente(), null)
  assert.equal((await eseguiInserimentoSpesa('azienda', null, deps3)).esito, 'non_salvata')
  assert.equal(srv.righe.size, 1)
})

test('doppio tocco: il secondo tentativo sullo stesso ID è ignorato mentre il primo è in corso', async () => {
  const srv = servizio(); const b = browser(); const deps = b.deps('azienda', srv)
  const blocco = srv.ritarda()
  const primo = eseguiInserimentoSpesa('azienda', SPESA, deps)
  await new Promise(r => setTimeout(r, 10))
  const secondo = await eseguiInserimentoSpesa('azienda', SPESA, deps)   // stesso payload → stesso pendente → in corso
  assert.deepEqual(secondo, { esito: 'in_corso' })
  srv.sblocca(); await blocco
  assert.deepEqual(await primo, { esito: 'salvata', id: 'id-1', giaPresente: false })
  assert.equal(srv.righe.size, 1)
})

test('risposta tardiva: il server salva dopo che il client ha già visto la rete cadere; la riprova rilegge e non duplica', async () => {
  const srv = servizio(); const b = browser(); const deps = b.deps('azienda', srv)
  // primo tentativo: il client crede alla rete caduta (esito incerto), il server salva comunque
  srv.perdi(true)
  await eseguiInserimentoSpesa('azienda', SPESA, deps)
  srv.perdi(false)
  // riprova: la rilettura trova la riga (arrivata «tardi») → nessun INSERT
  const r = await eseguiInserimentoSpesa('azienda', SPESA, deps)
  assert.equal(r.esito, 'salvata'); assert.equal((r as { giaPresente: boolean }).giaPresente, true)
  assert.equal(srv.righe.size, 1)
})

test('rilettura che non riesce = incerto (mai «Non salvato»); rifiuto certo del server = non salvata e custodia tolta', async () => {
  const srv = servizio(); const b = browser()
  const deps = b.deps('azienda', srv)
  const rotto = { ...deps, esiste: async () => ({ data: null, error: { message: 'Failed to fetch' } }) }
  const r = await eseguiInserimentoSpesa('azienda', SPESA, rotto)
  assert.equal(r.esito, 'incerto')
  assert.equal(srv.righe.size, 0)
  const rifiuta = { ...deps, inserisci: async () => ({ error: { code: '42501', message: 'permission denied' } }) }
  const r2 = await eseguiInserimentoSpesa('azienda', SPESA, rifiuta)
  assert.equal(r2.esito, 'non_salvata'); assert.equal((r2 as { messaggio: string }).messaggio, MESSAGGIO_NON_SALVATA)
  assert.equal(b.memoria.size, 0)
  // un 5xx o un errore senza codice SQL NON è un rifiuto certo: il server può aver salvato → incerto, custodia conservata
  const gateway = { ...deps, inserisci: async () => ({ error: { message: 'Bad Gateway', code: undefined } }) }
  const r3 = await eseguiInserimentoSpesa('azienda', { ...SPESA, amount: 9 }, gateway)
  assert.equal(r3.esito, 'incerto')
  assert.equal(b.memoria.size, 1)
})

test('payload diverso dal pendente custodito = tentativo nuovo con ID nuovo (il vecchio incerto resta da riconciliare a parte)', async () => {
  const srv = servizio(); const b = browser(); const deps = b.deps('azienda', srv)
  srv.perdi(true)
  await eseguiInserimentoSpesa('azienda', SPESA, deps)
  srv.perdi(false)
  const r = await eseguiInserimentoSpesa('azienda', { ...SPESA, amount: 30 }, deps)
  assert.deepEqual(r, { esito: 'salvata', id: 'id-2', giaPresente: false })
  assert.equal(srv.righe.size, 2)
})

test('leggiPendente: testo rotto, ambito diverso o campi mancanti → null', () => {
  assert.equal(leggiPendente('{', 'azienda'), null)
  assert.equal(leggiPendente(JSON.stringify({ id: 'x', payload: {}, ambito: 'personale' }), 'azienda'), null)
  assert.equal(leggiPendente(JSON.stringify({ payload: {} , ambito: 'azienda' }), 'azienda'), null)
  assert.deepEqual(leggiPendente(JSON.stringify({ id: 'x', payload: { amount: 1 }, ambito: 'azienda', creato: 'c' }), 'azienda'), { id: 'x', payload: { amount: 1 }, creato: 'c', ambito: 'azienda' })
})
