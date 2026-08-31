// ============================================================================
// Test dell'ADATTATORE EFFETTIVO della revisione (revisioneClient) con un
// servizio Supabase FINTO E RIGOROSO: tabelle giuste, payload validati
// colonna per colonna contro i permessi della 0021 (l'INSERT con una
// colonna estranea — idLocale, stato, id — qui esplode come sul database
// vero), RPC con nomi e argomenti esatti. Poi le SEQUENZE intere
// (Salva → Conferma) passando dall'adattatore vero.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { creaClienteRevisione, type SupabaseRevisione } from './revisioneClient.ts'
import { confermaRevisione, salvaModifiche } from './revisioneScrittura.ts'
import {
  aggiungiRiga, apriRevisione, modificaBozza, modificaTotale,
  CAMPI_BOZZA_REVISIONE, CAMPI_RIGA_NUOVA, CAMPI_RIGA_REVISIONE,
  type BozzaGrezza, type RigaGrezza,
} from './revisione.ts'
import { depositoRevisioneInMemoria } from './revisioneDurevole.ts'

const COLONNE: Record<string, Set<string>> = {
  'family_documents:update': new Set(['kind', 'doc_total', 'supplier', 'invoice_number', 'document_date', 'due_date', 'note']),
  'family_draft_expenses:update': new Set(CAMPI_BOZZA_REVISIONE),
  'family_draft_items:update': new Set(CAMPI_RIGA_REVISIONE),
  'family_draft_items:insert': new Set(CAMPI_RIGA_NUOVA),
}
const RPC = new Set(['conferma_documento', 'scarta_documento'])

// il Supabase finto: ogni chiamata è registrata e VALIDATA come farebbe
// il database (colonna sconosciuta → errore, mai silenzio)
function supabaseFinto(opzioni: { errori?: Record<string, string>; righeToccate?: number } = {}) {
  const chiamate: { azione: string; tabella?: string; payload?: unknown; rpc?: string; argomenti?: unknown }[] = []
  let contatore = 0
  const controlla = (tabella: string, verbo: 'update' | 'insert', campi: Record<string, unknown>) => {
    const consentite = COLONNE[`${tabella}:${verbo}`]
    if (!consentite) throw new Error(`tabella o verbo imprevisti: ${tabella}:${verbo}`)
    for (const k of Object.keys(campi))
      if (!consentite.has(k)) throw new Error(`colonna «${k}» inesistente o non concessa in ${verbo} su ${tabella}`)
    // VALORI e VINCOLI della 0020 sulle righe, non solo i nomi: un NULL
    // esplicito su qty/discount NON applica il default e viene rifiutato
    if (tabella === 'family_draft_items') {
      if ('qty' in campi && (campi.qty == null || typeof campi.qty !== 'number' || campi.qty <= 0))
        throw new Error('vincolo violato: qty NOT NULL > 0 (null esplicito non applica il default)')
      if ('discount' in campi && (campi.discount == null || typeof campi.discount !== 'number' || (campi.discount as number) < 0))
        throw new Error('vincolo violato: discount NOT NULL >= 0 (null esplicito non applica il default)')
      if ('amount' in campi && (campi.amount == null || typeof campi.amount !== 'number' || (campi.amount as number) < 0))
        throw new Error('vincolo violato: amount NOT NULL >= 0')
      if ('unit_price' in campi && campi.unit_price != null && (typeof campi.unit_price !== 'number' || (campi.unit_price as number) < 0))
        throw new Error('vincolo violato: unit_price NULL o >= 0')
      if ('name' in campi && (typeof campi.name !== 'string' || !campi.name))
        throw new Error('vincolo violato: name NOT NULL')
    }
  }
  const finto: SupabaseRevisione = {
    from(tabella) {
      return {
        update(campi) {
          controlla(tabella, 'update', campi)
          return {
            eq(colonna, valore) {
              assert.equal(colonna, 'id')
              return {
                async select(colonne) {
                  assert.equal(colonne, 'id')
                  chiamate.push({ azione: 'update', tabella, payload: { valore, campi } })
                  const errore = opzioni.errori?.[`update:${tabella}`]
                  if (errore) return { data: null, error: { message: errore } }
                  return { data: Array.from({ length: opzioni.righeToccate ?? 1 }, () => ({ id: valore })), error: null }
                },
              }
            },
          }
        },
        insert(campi) {
          controlla(tabella, 'insert', campi)
          return {
            select(colonne) {
              assert.equal(colonne, 'id')
              return {
                async single() {
                  chiamate.push({ azione: 'insert', tabella, payload: campi })
                  const errore = opzioni.errori?.[`insert:${tabella}`]
                  if (errore) return { data: null, error: { message: errore } }
                  return { data: { id: `srv-${++contatore}` }, error: null }
                },
              }
            },
          }
        },
      }
    },
    async rpc(nome, argomenti) {
      if (!RPC.has(nome)) throw new Error(`RPC imprevista: ${nome}`)
      chiamate.push({ azione: 'rpc', rpc: nome, argomenti })
      const errore = opzioni.errori?.[`rpc:${nome}`]
      if (errore) return { data: null, error: { message: errore } }
      return { data: nome === 'conferma_documento' ? ['spesa-1'] : null, error: null }
    },
  }
  return { finto, chiamate }
}

const bozza = (x: Partial<BozzaGrezza> & { id: string }): BozzaGrezza => ({
  document_id: 'doc-1', status: 'da_controllare', expense_date: '2026-08-29',
  group_id: 'g-casa', category_id: null, subcategory: null,
  canonical_category_id: null, canonical_subcategory_id: null,
  store: 'Mercato', description: null, payment_method: 'contanti',
  room_id: null, expense_nature: null, arrotondamento_cent: 0, confidence: null, ...x,
})
const riga = (x: Partial<RigaGrezza> & { id: string; draft_id: string; amount: number }): RigaGrezza => ({
  raw_name: null, name: 'Voce', qty: 1, unit_price: null, discount: 0,
  group_id: null, category_id: null, subcategory: null,
  canonical_category_id: null, canonical_subcategory_id: null,
  necessity: null, planning: null, excluded: false, user_added: false, confidence: null, ...x,
})

test('INSERT della riga nuova: SOLO colonne concesse dalla 0021 e VALORI validi per la 0020 (qty=1 e discount=0, mai NULL vietati)', async () => {
  const { finto, chiamate } = supabaseFinto()
  const cliente = creaClienteRevisione(finto)
  // arriva l'oggetto dello STATO, con idLocale e stato: l'adattatore lo pulisce
  const esito = await cliente.aggiungiRiga({
    draft_id: 'b1', name: 'Sacchetto', amount: 0.5,
    ...( { idLocale: 'loc-1', stato: 'nuova' } as object ),
  })
  assert.equal(esito.id, 'srv-1')
  const payload = chiamate[0].payload as Record<string, unknown>
  assert.deepEqual(Object.keys(payload).sort(), [...CAMPI_RIGA_NUOVA].sort())
  assert.ok(!('idLocale' in payload) && !('stato' in payload) && !('id' in payload))
  // i NOT NULL viaggiano coi default della 0020, mai come null
  assert.equal(payload.qty, 1)
  assert.equal(payload.discount, 0)
  assert.equal(payload.unit_price, null)
  // la precisione a 3 decimali di qty/unit_price passa intera
  await cliente.aggiungiRiga({ draft_id: 'b1', name: 'Ciliegie', amount: 3.75, qty: 0.472, unit_price: 7.945 })
  const secondo = chiamate[1].payload as Record<string, unknown>
  assert.equal(secondo.qty, 0.472)
  assert.equal(secondo.unit_price, 7.945)
})

test('risposta dell\'INSERT senza id: INCERTO (non un rifiuto ordinario) — il chiamante non deve poterla reinviare', async () => {
  const { finto } = supabaseFinto()
  const strano: SupabaseRevisione = {
    ...finto,
    from(tabella) {
      const vero = finto.from(tabella)
      return {
        ...vero,
        insert: () => ({ select: () => ({ async single() { return { data: {}, error: null } } }) }),
      }
    },
  }
  const cliente = creaClienteRevisione(strano)
  const esito = await cliente.aggiungiRiga({ draft_id: 'b1', name: 'Sacchetto', amount: 0.5 })
  assert.equal(esito.id, undefined)
  assert.equal(esito.incerto, true)
  assert.ok(esito.errore?.includes('id'))
})

test('sequenza intera con l\'adattatore vero: Salva ripetuto poi Conferma — UN insert, UNA RPC, correzioni nella RPC', async () => {
  const { finto, chiamate } = supabaseFinto()
  const cliente = creaClienteRevisione(finto)
  const deposito = depositoRevisioneInMemoria()
  let s = apriRevisione('doc-1', 5,
    [bozza({ id: 'b1' })], [riga({ id: 'r1', draft_id: 'b1', amount: 5 })])
  s = modificaBozza(s, 'b1', { store: 'Iper' })
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Sacchetto', amount: 0.5 }, 'loc-1')
  s = modificaTotale(s, 550)
  const primo = await salvaModifiche(cliente, deposito, s)
  assert.equal(primo.ok, true)
  const secondo = await salvaModifiche(cliente, deposito, primo.stato)
  assert.equal(secondo.ok, true)
  const conferma = await confermaRevisione(cliente, deposito, secondo.stato)
  assert.equal(conferma.ok, true)
  assert.equal(chiamate.filter(c => c.azione === 'insert').length, 1)   // MAI due
  const rpc = chiamate.filter(c => c.azione === 'rpc')
  assert.equal(rpc.length, 1)
  assert.equal(rpc[0].rpc, 'conferma_documento')
  const argomenti = rpc[0].argomenti as { p_document_id: string; p_correzioni: Record<string, unknown>[] }
  assert.equal(argomenti.p_document_id, 'doc-1')
  assert.ok(argomenti.p_correzioni.some(c => c.field === 'store' && c.proposed === 'Mercato' && c.corrected === 'Iper'))
  assert.ok(argomenti.p_correzioni.some(c => c.field === 'doc_total'))
  // a conferma riuscita la custodia si svuota
  assert.equal(deposito.leggi('doc-1').traccia, undefined)
})

test('errori del database restituiti fedeli; zero righe toccate non è un successo; lo scarto passa dalla sua RPC', async () => {
  const { finto } = supabaseFinto({ errori: { 'update:family_draft_expenses': 'permission denied' } })
  const cliente = creaClienteRevisione(finto)
  assert.deepEqual(await cliente.aggiornaBozza('b1', { store: 'Iper' }), { errore: 'permission denied' })
  const { finto: vuoto } = supabaseFinto({ righeToccate: 0 })
  const zero = creaClienteRevisione(vuoto)
  assert.deepEqual(await zero.aggiornaRiga('r1', { amount: 2 }), { righe: 0 })
  const { finto: ok, chiamate } = supabaseFinto()
  const scarto = creaClienteRevisione(ok)
  assert.deepEqual(await scarto.scartaDocumento('doc-1', 'foto doppia'), {})
  assert.deepEqual(chiamate[0], { azione: 'rpc', rpc: 'scarta_documento', argomenti: { p_document_id: 'doc-1', p_motivo: 'foto doppia' } })
})
