// Salvare «Come paga» (13/09/2026): il modo su tutte le camere, la caparra una
// volta sola. Rifatto il 15/09/2026: o è una transazione sola (proposta 0052),
// o si scrive nell'ordine che non può perdere la caparra.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { salvaComePaga, AVVISO_SENZA_0041, AVVISO_SENZA_0052, funzioneMancante } from './comePagaDati.ts'
import { campiComePaga } from './comePaga.ts'
import { MESSAGGIO_NON_SALVATO } from './scritturaSicura.ts'

/** Un finto database con due camere: la prima porta la caparra */
function finto(errori: { prima?: unknown; altre?: unknown; rpc?: unknown } = {}, opzioni: { conRpc?: boolean; altre?: number } = {}) {
  const scritte: { dove: string; campi: Record<string, unknown> }[] = []
  // com'è messo il database adesso: la prima riga ha già una caparra
  const righe: Record<string, { caparra_centesimi: number | null }> = {
    prima: { caparra_centesimi: 16000 }, altra: { caparra_centesimi: null },
  }
  let giroPrima = 0
  return {
    scritte,
    righe,
    scritture: {
      ...(opzioni.conRpc ? { rpc: (dati: Record<string, unknown>) => { scritte.push({ dove: 'rpc', campi: dati }); return Promise.resolve({ data: 2, error: errori.rpc ?? null }) } } : {}),
      scriviPrima: (campi: Record<string, unknown>) => {
        scritte.push({ dove: 'prima', campi })
        giroPrima += 1
        const errore = giroPrima === 1 ? (errori.prima ?? null) : null
        if (!errore && 'caparra_centesimi' in campi) righe.prima.caparra_centesimi = campi.caparra_centesimi as number | null
        return Promise.resolve({ error: errore })
      },
      scriviAltre: (campi: Record<string, unknown>) => {
        scritte.push({ dove: 'altre', campi })
        return Promise.resolve({ error: errori.altre ?? null })
      },
      quanteAltre: opzioni.altre ?? 1,
    },
  }
}

test('con la funzione della 0052 si scrive una volta sola, in transazione', async () => {
  const f = finto({}, { conRpc: true })
  const esito = await salvaComePaga(campiComePaga('meta', { totaleCent: 47000, entro: '2026-09-20T18:00:00' }), f.scritture)
  assert.deepEqual(esito, { esito: 'ok', messaggio: null })
  assert.deepEqual(f.scritte.map(s => s.dove), ['rpc'], 'con la funzione non servono due scritture')
  assert.equal(f.scritte[0].campi.p_caparra_centesimi, 23500)
})

test('se la funzione non c’è ancora si continua, dicendolo', async () => {
  const f = finto({ rpc: { code: 'PGRST202', message: 'Could not find the function public.salva_come_paga in the schema cache' } }, { conRpc: true })
  const esito = await salvaComePaga(campiComePaga('contanti', {}), f.scritture)
  assert.equal(esito.esito, 'ok')
  assert.equal(esito.messaggio, AVVISO_SENZA_0052)
  assert.deepEqual(f.scritte.map(s => s.dove), ['rpc', 'prima', 'altre'])
})

test('un errore vero della funzione non fa ripiegare sui due passaggi', async () => {
  const f = finto({ rpc: { code: '23514', message: 'check constraint' } }, { conRpc: true })
  const esito = await salvaComePaga(campiComePaga('contanti', {}), f.scritture)
  assert.equal(esito.esito, 'errore')
  assert.deepEqual(f.scritte.map(s => s.dove), ['rpc'])
})

test('SENZA transazione, se la seconda scrittura fallisce la caparra resta', async () => {
  // è il caso del rilievo: prima faceva 16000 → null e poi diceva «non salvato»
  const f = finto({ altre: { message: 'rete caduta' } })
  const esito = await salvaComePaga(campiComePaga('caparra', { importoCent: 20000, entro: '2026-10-02T18:00:00' }), f.scritture)
  assert.equal(esito.esito, 'errore')
  assert.match(esito.messaggio ?? '', /La caparra però è al sicuro/)
  assert.equal(f.righe.prima.caparra_centesimi, 20000, 'la caparra non è stata azzerata')
  assert.deepEqual(f.scritte.map(s => s.dove), ['prima', 'altre'], 'prima la riga della caparra, poi le altre')
})

test('senza caparra e con una camera sola basta una scrittura', async () => {
  const f = finto({}, { altre: 0 })
  const esito = await salvaComePaga(campiComePaga('contanti', {}), f.scritture)
  assert.deepEqual(esito, { esito: 'ok', messaggio: null })
  assert.deepEqual(f.scritte.map(s => s.dove), ['prima'])
  assert.deepEqual(f.scritte[0].campi, { accordo_pagamento: 'contanti', bonifico: false, caparra_centesimi: null, caparra_entro: null })
})

test('con la caparra: il modo su tutte, l’importo solo sulla prima', async () => {
  const f = finto()
  await salvaComePaga(campiComePaga('meta', { totaleCent: 47000, entro: '2026-09-20T18:00:00' }), f.scritture)
  assert.deepEqual(f.scritte.map(s => s.dove), ['prima', 'altre'])
  assert.equal(f.scritte[0].campi.caparra_centesimi, 23500)
  assert.equal(f.scritte[1].campi.caparra_centesimi, null, 'sulle altre camere la caparra non si copia')
  assert.equal(f.scritte[1].campi.accordo_pagamento, 'caparra_meta')
})

test('«Da vedere» svuota la colonna e spegne la spunta', async () => {
  const f = finto()
  await salvaComePaga(campiComePaga('da_vedere', {}), f.scritture)
  assert.deepEqual(f.scritte[0].campi, { accordo_pagamento: null, bonifico: false, caparra_centesimi: null, caparra_entro: null })
})

test('senza la proposta 0041 si salva la spunta e lo si dice', async () => {
  const f = finto({ prima: { code: '42703', message: 'column "accordo_pagamento" does not exist' } })
  const esito = await salvaComePaga(campiComePaga('tutto', {}), f.scritture)
  assert.deepEqual(esito, { esito: 'senza_accordo', messaggio: AVVISO_SENZA_0041 })
  assert.deepEqual(f.scritte.map(s => s.campi).slice(1), [{ bonifico: true }, { bonifico: true }])
})

test('un errore vero non si scambia per una colonna mancante', async () => {
  const f = finto({ prima: { code: '23514', message: 'new row violates check constraint' } })
  const esito = await salvaComePaga(campiComePaga('contanti', {}), f.scritture)
  assert.equal(esito.esito, 'errore')
  assert.match(esito.messaggio ?? '', new RegExp(MESSAGGIO_NON_SALVATO))
  assert.equal(f.scritte.length, 1, 'ha riprovato dopo un errore che non è una colonna mancante')
})

test('riconosce la funzione che non c’è dai suoi codici', () => {
  assert.equal(funzioneMancante({ code: 'PGRST202' }), true)
  assert.equal(funzioneMancante({ code: '42883' }), true)
  assert.equal(funzioneMancante({ message: 'function public.salva_come_paga does not exist' }), true)
  assert.equal(funzioneMancante({ code: '23514', message: 'check' }), false)
  assert.equal(funzioneMancante(null), false)
})

test('la proposta 0052 esiste, controlla le righe toccate ed è una transazione', () => {
  const sql = readFileSync(new URL('../supabase/proposte/0052_come_paga_atomico.BOZZA.sql', import.meta.url), 'utf8')
  assert.match(sql, /create or replace function public\.salva_come_paga/)
  assert.match(sql, /get diagnostics toccate = row_count/)
  assert.match(sql, /raise exception 'aggiornate % righe su %/)
  assert.match(sql, /security invoker/)      // i permessi restano quelli di chi chiama
  assert.match(sql, /grant execute[\s\S]{0,120}to authenticated/)
  // e la pagina la chiama
  const foglio = readFileSync(new URL('../components/scheda/FoglioComePaga.tsx', import.meta.url), 'utf8')
  assert.match(foglio, /supabase\.rpc\('salva_come_paga'/)
  assert.match(foglio, /p_righe: idRighe, p_prima: idPrima/)
})
