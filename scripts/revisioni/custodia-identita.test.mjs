// ============================================================================
// Il tentativo incerto e il CAMBIO DI IDENTITÀ della prenotazione (21/09/2026)
//
// «Aggiungi camera» (anche da un altro telefono) scrive prenotazione_id su
// righe che prima erano singole o solo in gruppo. La custodia del tentativo
// vive sotto l'identità del soggiorno: se l'indirizzo cambia, il tentativo
// resta scritto ma diventa irraggiungibile — e la registrazione dopo
// nascerebbe con una chiave NUOVA, cioè un secondo pagamento se la prima
// scrittura era soltanto tardiva.
//
// Prove sulle funzioni VERE di lib/pagamentiDati, con Supabase finto e
// memoria finta. Nessuna rete, nessun dato vero.
//
// Esecuzione:
//   node --experimental-loader ./scripts/revisioni/loader-supabase-finto.mjs \
//     --test scripts/revisioni/custodia-identita.test.mjs
// ============================================================================
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

const memoria = new Map()
globalThis.localStorage = {
  get length() { return memoria.size },
  key: i => [...memoria.keys()][i] ?? null,
  getItem: k => memoria.get(k) ?? null,
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: k => memoria.delete(k),
}

let righe = [], movimenti = [], chiamate = [], rispostaRpc = null
globalThis.__fakeSupabase = {
  from(tabella) {
    const filtri = []
    const aggiornamenti = []
    const q = {
      select() { return q },
      eq(k, v) { filtri.push(r => r[k] === v); return q },
      is(k, v) { filtri.push(r => (r[k] ?? null) === v); return q },
      in(k, v) { filtri.push(r => v.includes(r[k])); return q },
      order() { return q },
      maybeSingle() { return q },
      update(valori) { aggiornamenti.push(valori); return q },
      then(ok, ko) {
        const dati = (tabella === 'bookings' ? righe : movimenti).filter(r => filtri.every(f => f(r)))
        for (const v of aggiornamenti) for (const r of dati) Object.assign(r, v)
        return Promise.resolve({ data: dati, error: null }).then(ok, ko)
      },
    }
    return q
  },
  async rpc(nome, argomenti) {
    chiamate.push({ nome, argomenti })
    return rispostaRpc ? rispostaRpc(nome, argomenti) : { data: null, error: { message: 'Simulated response lost' } }
  },
}

const mod = await import('../../lib/pagamentiDati.ts')
const CAMERA_A = 'riga-a', CAMERA_B = 'riga-b'
const base = { guest_id: 'ospite-finta', status: 'confermata', check_in: '2026-09-21', check_out: '2026-09-23', total_amount: 200 }
const tentativo = { chiave: 'chiave-originale', amount: 50, method: 'contanti', paid_on: '2026-09-21', creato: '2026-09-21T08:00:00Z', giaPresenti: 0, nota: 'nota originale' }
const custodisci = (identita, dati = tentativo) => memoria.set(`ca_acconto_pendente_${identita}`, JSON.stringify(dati))
const indirizzi = () => [...memoria.keys()].filter(k => k.startsWith('ca_acconto_pendente_'))

beforeEach(() => { memoria.clear(); righe = []; movimenti = []; chiamate = []; rispostaRpc = null })

// ── 1. il tentativo si recupera dopo il cambio di identità ─────────────────
for (const vecchia of ['singola', 'gruppo']) {
  test(`${vecchia} → prenotazione: il tentativo si ritrova, con la sua chiave e i suoi dati`, async () => {
    const b = { ...base, id: CAMERA_A, ...(vecchia === 'gruppo' ? { group_id: 'G' } : {}), prenotazione_id: 'P' }
    righe = [b]
    custodisci(vecchia === 'gruppo' ? 'G' : CAMERA_A)
    const r = await mod.verificaPagamento(b, righe)
    assert.equal(r.esito, 'non_trovato')
    assert.equal(r.tentativo.chiave, tentativo.chiave)
    assert.equal(r.tentativo.importo, 50)
    assert.equal(r.tentativo.metodo, 'contanti')
    assert.equal(r.tentativo.giorno, tentativo.paid_on)
    assert.equal(r.tentativo.nota, tentativo.nota)
    assert.equal(chiamate.length, 0, 'la verifica non deve chiamare il server per scrivere')
    // ora vive sotto l'identità di adesso, una sola custodia
    assert.deepEqual(indirizzi(), ['ca_acconto_pendente_P'])
  })
}

test('riapertura da un’ALTRA camera della prenotazione: il tentativo è lo stesso', async () => {
  const a = { ...base, id: CAMERA_A, prenotazione_id: 'P' }
  const b = { ...base, id: CAMERA_B, prenotazione_id: 'P' }
  righe = [a, b]
  custodisci(CAMERA_A)   // custodito quando la camera A era ancora sola
  const t = mod.tentativoIncerto(b, righe)
  assert.equal(t?.chiave, tentativo.chiave)
  assert.equal(t?.nota, tentativo.nota)
})

test('camera aggiunta da un altro telefono: l’identità arriva dalle righe rilette', async () => {
  // il booking in mano all'app è ancora quello vecchio (senza prenotazione_id)
  const vecchio = { ...base, id: CAMERA_A }
  righe = [{ ...base, id: CAMERA_A, prenotazione_id: 'P' }, { ...base, id: CAMERA_B, prenotazione_id: 'P' }]
  custodisci(CAMERA_A)
  const t = mod.tentativoIncerto(vecchio, righe)
  assert.equal(t?.chiave, tentativo.chiave)
})

// ── 2. nessuna chiave nuova mentre un tentativo è incerto ──────────────────
test('registrare di nuovo lo stesso pagamento riusa la chiave originaria, mai una nuova', async () => {
  const b = { ...base, id: CAMERA_A, group_id: 'G', prenotazione_id: 'P' }
  righe = [b]
  custodisci('G')
  await mod.registraPagamento(b, righe, { importo: 50, metodo: 'contanti', giorno: tentativo.paid_on, nota: tentativo.nota }, { totaleAttesoCent: 20000, ricevutiAttesiCent: 0 })
  assert.ok(chiamate.length > 0, 'la scrittura deve partire')
  assert.ok(chiamate.every(c => c.argomenti.p_chiave === tentativo.chiave), 'mai una chiave nuova')
})

test('un pagamento DIVERSO con un tentativo in sospeso: non si scrive niente', async () => {
  const b = { ...base, id: CAMERA_A, group_id: 'G', prenotazione_id: 'P' }
  righe = [b]
  custodisci('G')
  const esito = await mod.registraPagamento(b, righe, { importo: 120, metodo: 'bonifico', giorno: '2026-09-22', nota: '' }, { totaleAttesoCent: 20000, ricevutiAttesiCent: 0 })
  assert.equal(esito.esito, 'errore')
  assert.equal(esito.messaggio, mod.MESSAGGIO_TENTATIVO_DA_VERIFICARE)
  assert.equal(chiamate.length, 0, 'nessuna scrittura, nessuna chiave nuova')
  assert.equal(esito.incerto?.chiave, tentativo.chiave)
})

// ── 3. custodie multiple: nessuna si perde, nessuna si scambia ─────────────
test('due tentativi sotto identità diverse: si spostano uno per volta, nessuno sparisce', async () => {
  const b = { ...base, id: CAMERA_A, prenotazione_id: 'P' }
  righe = [b, { ...base, id: CAMERA_B, prenotazione_id: 'P' }]
  custodisci(CAMERA_A, { ...tentativo, chiave: 'chiave-1', creato: '2026-09-21T08:00:00Z' })
  custodisci(CAMERA_B, { ...tentativo, chiave: 'chiave-2', amount: 70, creato: '2026-09-21T09:00:00Z' })
  const t = mod.tentativoIncerto(b, righe)
  assert.equal(t?.chiave, 'chiave-1', 'si prende il più vecchio')
  assert.equal(indirizzi().length, 2, 'l’altro resta custodito')
  assert.ok(indirizzi().includes(`ca_acconto_pendente_${CAMERA_B}`))
})

test('una custodia c’è già sotto l’identità nuova: non si sovrascrive', async () => {
  const b = { ...base, id: CAMERA_A, prenotazione_id: 'P' }
  righe = [b]
  custodisci('P', { ...tentativo, chiave: 'chiave-nuova' })
  custodisci(CAMERA_A, { ...tentativo, chiave: 'chiave-vecchia' })
  const t = mod.tentativoIncerto(b, righe)
  assert.equal(t?.chiave, 'chiave-nuova')
  assert.equal(JSON.parse(memoria.get(`ca_acconto_pendente_${CAMERA_A}`)).chiave, 'chiave-vecchia', 'la vecchia resta, non si butta')
})

test('due tentativi, uno già arrivato: si risolve quello e l’altro resta', async () => {
  const b = { ...base, id: CAMERA_A, prenotazione_id: 'P' }
  righe = [b, { ...base, id: CAMERA_B, prenotazione_id: 'P' }]
  custodisci(CAMERA_A, { ...tentativo, chiave: 'chiave-1', creato: '2026-09-21T08:00:00Z' })
  custodisci(CAMERA_B, { ...tentativo, chiave: 'chiave-2', amount: 70, nota: '', creato: '2026-09-21T09:00:00Z' })
  movimenti = [{ id: 'mov-2', booking_id: CAMERA_A, amount: 70, method: 'contanti', paid_on: tentativo.paid_on, chiave_operazione: 'chiave-2', note: null }]
  rispostaRpc = () => ({ data: null, error: { code: 'PGRST202', message: 'non trovata' } })
  const r = await mod.verificaPagamento(b, righe)
  assert.equal(r.esito, 'ritrovato')
  assert.equal(r.tentativo.chiave, 'chiave-2')
  assert.equal(r.certo, true)
  const rimaste = indirizzi().map(k => JSON.parse(memoria.get(k)).chiave)
  assert.deepEqual(rimaste, ['chiave-1'], 'il tentativo non ancora arrivato resta custodito')
})

// ── 4. risposta tardiva (la scrittura arriva dopo) ─────────────────────────
test('risposta tardiva col cambio di identità: prima non trovato, poi ritrovato per chiave, un movimento solo', async () => {
  const b = { ...base, id: CAMERA_A, group_id: 'G', prenotazione_id: 'P' }
  righe = [b]
  custodisci('G')   // tentativo nato quando la prenotazione era solo in gruppo
  const prima = await mod.verificaPagamento(b, righe)
  assert.equal(prima.esito, 'non_trovato')
  assert.equal(prima.riprovabile, true)
  assert.equal(movimenti.length, 0)
  // adesso la scrittura di prima arriva sul server, con la chiave originaria
  movimenti = [{ id: 'mov-1', booking_id: CAMERA_A, amount: 50, method: 'contanti', paid_on: tentativo.paid_on, chiave_operazione: tentativo.chiave, note: null }]
  rispostaRpc = () => ({ data: null, error: { code: 'PGRST202', message: 'non trovata' } })
  const dopo = await mod.verificaPagamento(b, righe)
  assert.equal(dopo.esito, 'ritrovato')
  assert.equal(dopo.certo, true)
  assert.equal(dopo.tentativo.chiave, tentativo.chiave)
  assert.equal(movimenti.length, 1, 'nessun secondo movimento')
  assert.equal(movimenti[0].note, tentativo.nota, 'la nota del tentativo finisce sul suo movimento')
  assert.deepEqual(indirizzi(), [], 'custodia chiusa')
})

test('la riprova dopo il cambio di identità manda la STESSA chiave e non raddoppia', async () => {
  const b = { ...base, id: CAMERA_A, group_id: 'G', prenotazione_id: 'P' }
  righe = [b]
  custodisci('G')
  // il server risponde «già presente»: la scrittura di prima era arrivata
  rispostaRpc = (nome, a) => nome.startsWith('registra_acconto')
    ? { data: { movimento_id: 'mov-1', importo: a.p_amount, soggiorno: 'P', contratto: 'prenotazione_v1', booking_id: CAMERA_A, gia_presente: true }, error: null }
    : { data: null, error: { code: 'PGRST202', message: 'non trovata' } }
  const esito = await mod.registraPagamento(b, righe, { importo: 50, metodo: 'contanti', giorno: tentativo.paid_on, nota: tentativo.nota }, { totaleAttesoCent: 20000, ricevutiAttesiCent: 0 })
  assert.equal(esito.esito, 'ok')
  assert.equal(esito.giaRegistrato, true)
  const scritture = chiamate.filter(c => c.nome.startsWith('registra_acconto'))
  assert.ok(scritture.length > 0 && scritture.every(c => c.argomenti.p_chiave === tentativo.chiave))
  assert.deepEqual(indirizzi(), [], 'custodia chiusa dopo il buon esito')
})

// ── 5. controlli positivi: senza cambio di identità niente cambia ──────────
test('identità invariata: non trovato conserva la chiave e non scrive', async () => {
  const b = { ...base, id: CAMERA_A, prenotazione_id: 'P' }
  righe = [b]
  custodisci('P')
  const r = await mod.verificaPagamento(b, righe)
  assert.equal(r.esito, 'non_trovato')
  assert.equal(mod.tentativoIncerto(b, righe)?.chiave, tentativo.chiave)
  assert.equal(chiamate.length, 0)
})

test('nessuna custodia: nessun tentativo, e le identità possibili partono da quella di adesso', async () => {
  const b = { ...base, id: CAMERA_A, group_id: 'G', prenotazione_id: 'P' }
  righe = [b]
  assert.equal(await mod.verificaPagamento(b, righe).then(r => r.esito), 'nessun_tentativo')
  assert.deepEqual(mod.identitaPossibili(b, righe), ['P', 'G', CAMERA_A])
})

test('custodia illeggibile: si lascia dov’è e non travolge le altre', async () => {
  const b = { ...base, id: CAMERA_A, prenotazione_id: 'P' }
  righe = [b]
  memoria.set(`ca_acconto_pendente_${CAMERA_A}`, '{rotto')
  assert.equal(mod.tentativoIncerto(b, righe), null)
  assert.equal(memoria.has(`ca_acconto_pendente_${CAMERA_A}`), true)
})
