#!/usr/bin/env node
// ============================================================================
// Collaudo contratto — PASSO 4: CONCORRENZA MISURATA, non solo
// programmata. Riusa la validazione della 0022 (scripts/fase4/
// concorrenza.mjs): pid e finestre al MICROSECONDO attorno alle
// chiamate (misurate ANCHE sugli errori), sovrapposizione EFFETTIVA
// obbligatoria — altrimenti l'esito è NON_VALIDO e il passo fallisce;
// entrambi i rami attesi prima delle verifiche; riepilogo che pretende
// tutti i casi. Il caso Salva⇄Conferma accetta SOLO le coppie coerenti
// col vincitore (conferma vince → DOCUMENTO_NON_MODIFICABILE per il
// Salva; salva vince → SUPERATA per la conferma) e verifica i dati; i
// due ordini sono provati anche in modo FORZATO (sequenziale).
// ============================================================================
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { sql, progetto } from '../fase2b/api.mjs'
import { verificaNonProduzione } from '../fase2b/guardia.mjs'
import { comeMembro, fixtureDocumento, fotografiaDocumento, ownerId } from './ambiente.mjs'
import { creaContatore, eseguiPasso } from './strumenti.mjs'
import { apriUltimoRegistro } from './registro.mjs'
import { batchRamo, eseguiCaso, riepilogo } from '../fase4/concorrenza.mjs'

await eseguiPasso('PASSO 4 · concorrenza misurata', async () => {
  verificaNonProduzione(progetto().ref)
  const v = creaContatore('PASSO 4 · concorrenza misurata')
  const registro = apriUltimoRegistro()
  if (!registro || registro.dati.pulito) throw new Error('nessun registro aperto: eseguire prima il passo 1')
  const fixture = opz => fixtureDocumento(registro, opz)
  const UID = await ownerId()
  const p = progetto()
  if (!p.db_pass) throw new Error('db_pass mancante in progetto.json: eseguire passo0b-password.mjs')

  const sessioni = []
  const sessione = async () => {
    const cli = new pg.Client({ host: `db.${p.ref}.supabase.co`, port: 5432, user: 'postgres', database: 'postgres', password: p.db_pass, ssl: { rejectUnauthorized: false } })
    await cli.connect(); sessioni.push(cli); return cli
  }
  try {
    const A = await sessione(), B = await sessione()
    // un RAMO: batch della 0022 (allineamento a istante assoluto,
    // misure pid/prima/dopo anche quando la chiamata erra)
    const ramo = async (cli, espressioneRpc) => {
      try {
        const r = await cli.query(`begin; ${batchRamo(comeMembro(UID), espressioneRpc)} commit;`)
        const righe = (Array.isArray(r) ? r : [r]).flatMap(x => x.rows ?? [])
        const m = righe.find(x => x?.pid)
        return m ?? { trasporto: 'nessuna misura restituita' }
      } catch (e) { return { trasporto: String(e.message) } }
    }
    const salvaExpr = (op, doc, rev, modifiche) =>
      `public.salva_revisione('${op}'::uuid,'${doc}'::uuid,${rev},'${JSON.stringify(modifiche).replaceAll("'", "''")}'::jsonb)`
    const confermaExpr = (op, doc, rev) =>
      `public.conferma_revisione('${op}'::uuid,'${doc}'::uuid,${rev},'[]'::jsonb)`
    const esiti = []

    // ---- caso 1: batch IDENTICI, stessa chiave, stesso documento ----------
    {
      const f = await fixture()
      const op = randomUUID()
      const b = { bozze: { [f.bozzaId]: { store: 'Concorrente' } }, righe: {}, nuove: [{ client_ref: 'c1', draft_id: f.bozzaId, name: 'Voce parallela', qty: 1, unit_price: null, discount: 0, amount: 1, group_id: null, category_id: null, subcategory: null, canonical_category_id: null, canonical_subcategory_id: null, necessity: null, planning: null }] }
      esiti.push(await eseguiCaso(
        ramo(A, salvaExpr(op, f.docId, 0, b)),
        ramo(B, salvaExpr(op, f.docId, 0, b)),
        async (a, bb) => {
          const coppia = [a.r?.esito, bb.r?.esito].sort().join('+')
          const [conta] = await sql(`select count(*)::int as n from public.family_draft_items where draft_id='${f.bozzaId}' and name='Voce parallela'`)
          const stessaMappa = JSON.stringify(a.r?.righe_nuove) === JSON.stringify(bb.r?.righe_nuove)
          return { ok: coppia === 'APPLICATA+RIPETUTA' && conta.n === 1 && stessaMappa, dettaglio: `${coppia} · voci=${conta.n}` }
        }))
    }

    // ---- caso 2: stessa chiave su DOCUMENTI diversi ------------------------
    {
      const f = await fixture(), g = await fixture()
      const op = randomUUID()
      const fotoF = await fotografiaDocumento(f.docId), fotoG = await fotografiaDocumento(g.docId)
      esiti.push(await eseguiCaso(
        ramo(A, salvaExpr(op, f.docId, 0, { bozze: { [f.bozzaId]: { store: 'F' } }, righe: {}, nuove: [] })),
        ramo(B, salvaExpr(op, g.docId, 0, { bozze: { [g.bozzaId]: { store: 'G' } }, righe: {}, nuove: [] })),
        async (a, bb) => {
          const coppia = [a.r?.esito, bb.r?.esito].sort().join('+')
          if (coppia !== 'APPLICATA+CHIAVE_RIUSATA') return { ok: false, dettaglio: coppia }
          const perdenteF = a.r?.esito !== 'APPLICATA'
          const fotoPerdente = await fotografiaDocumento(perdenteF ? f.docId : g.docId)
          const intatto = fotoPerdente === (perdenteF ? fotoF : fotoG)
          const [reg] = await sql(`select count(*)::int as n from public.family_revision_ops where op_key='${op}'`)
          return { ok: intatto && reg.n === 1, dettaglio: `perdente intatto=${intatto} · registrazioni=${reg.n}` }
        }))
    }

    // ---- caso 3: Salva ⇄ Conferma sullo stesso documento -------------------
    {
      const f = await fixture()
      esiti.push(await eseguiCaso(
        ramo(A, salvaExpr(randomUUID(), f.docId, 0, { doc_total: 5, bozze: { [f.bozzaId]: { store: 'S' } }, righe: {}, nuove: [] })),
        ramo(B, confermaExpr(randomUUID(), f.docId, 0)),
        async (a, bb) => {
          const [doc] = await sql(`select status, revisione_rev from public.family_documents where id='${f.docId}'`)
          const [bz] = await sql(`select store from public.family_draft_expenses where id='${f.bozzaId}'`)
          // vince il SALVA → conferma SUPERATA, doc ancora aperto col negozio nuovo
          const vinceSalva = a.r?.esito === 'APPLICATA' && bb.r?.esito === 'SUPERATA'
            && doc.status === 'in_revisione' && doc.revisione_rev === 1 && bz.store === 'S'
          // vince la CONFERMA → il Salva trova il documento CHIUSO:
          // DOCUMENTO_NON_MODIFICABILE (non SUPERATA), negozio intatto
          const vinceConferma = bb.r?.esito === 'APPLICATA' && a.r?.esito === 'DOCUMENTO_NON_MODIFICABILE'
            && doc.status === 'confermato' && bz.store !== 'S'
          return { ok: vinceSalva || vinceConferma, dettaglio: `${a.r?.esito}+${bb.r?.esito} · doc=${doc.status}` }
        }))
    }

    const r = riepilogo(esiti, 3)
    v.esigi('tutti i casi concorrenti COMPLETATI e PASSATI (misure valide, mai sequenziali)', r.ok,
      JSON.stringify({ ...r, dettagli: esiti.map(e => `${e.stato}: ${e.dettaglio}`) }))

    // ---- i DUE ORDINI, forzati in sequenza (esiti esatti) ------------------
    {
      const f = await fixture()
      const c1 = await sql(`begin; ${comeMembro(UID)} select ${confermaExpr(randomUUID(), f.docId, 0)} as r; commit;`)
      const s1 = await sql(`begin; ${comeMembro(UID)} select ${salvaExpr(randomUUID(), f.docId, 0, { bozze: { [f.bozzaId]: { store: 'tardi' } }, righe: {}, nuove: [] })} as r; commit;`)
      v.attesa('ordine forzato conferma→salva: DOCUMENTO_NON_MODIFICABILE',
        c1.find(x => x?.r)?.r?.esito === 'APPLICATA' && s1.find(x => x?.r)?.r?.esito === 'DOCUMENTO_NON_MODIFICABILE',
        JSON.stringify({ c: c1.find(x => x?.r)?.r?.esito, s: s1.find(x => x?.r)?.r?.esito }))
      const g = await fixture()
      const s2 = await sql(`begin; ${comeMembro(UID)} select ${salvaExpr(randomUUID(), g.docId, 0, { bozze: { [g.bozzaId]: { store: 'prima' } }, righe: {}, nuove: [] })} as r; commit;`)
      const c2 = await sql(`begin; ${comeMembro(UID)} select ${confermaExpr(randomUUID(), g.docId, 0)} as r; commit;`)
      v.attesa('ordine forzato salva→conferma: SUPERATA',
        s2.find(x => x?.r)?.r?.esito === 'APPLICATA' && c2.find(x => x?.r)?.r?.esito === 'SUPERATA',
        JSON.stringify({ s: s2.find(x => x?.r)?.r?.esito, c: c2.find(x => x?.r)?.r?.esito }))
    }

    v.chiudi()
  } finally {
    // rilascio delle sessioni GARANTITO anche sugli errori
    for (const cli of sessioni) await cli.end().catch(() => {})
  }
})
