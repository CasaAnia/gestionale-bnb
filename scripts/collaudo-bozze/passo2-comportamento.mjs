#!/usr/bin/env node
// ============================================================================
// Collaudo 0023 · PASSO 2 — COMPORTAMENTO del primitivo atomico via
// PostgREST con l'identità service_role (la stessa via dello strumento
// reale). Fixture con id nati qui e REGISTRATI prima degli INSERT.
// Prove: giro buono, idempotenza (stato non ammesso), marcatura errore,
// sostituzione integrale, richieste malformate, pacchetti vuoti,
// ROLLBACK totale su vincolo violato, permessi negati ad anon.
// ============================================================================
import { randomUUID } from 'node:crypto'
import { progetto, rest, sql } from '../fase2b/api.mjs'
import { verificaNonProduzione } from '../fase2b/guardia.mjs'
import { creaContatore, eseguiPasso } from '../collaudo-contratto/strumenti.mjs'
import { gruppoPersonale } from '../collaudo-contratto/ambiente.mjs'
import { apriUltimoRegistro } from '../collaudo-contratto/registro.mjs'
import { FUNZIONE_0023, corpoRpc0023, sqlFixture0023, verificaAutorizzazione } from './strumenti0023.mjs'

// pacchetto di prova COSTRUITO DAL COSTRUTTORE VERO (lib collaudata):
// due sorelle personali, tre righe, quadratura esatta
async function pacchettoVero(gruppoId) {
  const { costruisciPacchettoBozze } = await import('../../lib/spese/elaborazioneBozze.ts')
  const esito = costruisciPacchettoBozze({
    totale: 8,
    sorelle: [
      {
        ambito: 'personale', destinatario: gruppoId, data: '2026-08-30', negozio: 'Collaudo 0023',
        voci: [
          { raw_name: 'VOCE A', name: 'Voce A', amount: 3, sottocategoria: 'Altro' },
          { raw_name: 'VOCE B', name: 'Voce B', amount: 2, sottocategoria: 'Altro' },
        ],
      },
      {
        ambito: 'personale', destinatario: gruppoId, data: '2026-08-30', negozio: 'Collaudo 0023',
        voci: [{ raw_name: 'VOCE C', name: 'Voce C', amount: 3, sottocategoria: 'Altro' }],
      },
    ],
  }, { documentId: 'irrilevante', gruppi: [{ id: gruppoId, ambito: 'personale' }], sottoCanoniche: [] })
  if (!esito.ok) throw new Error(`fixture non valida per il costruttore: ${esito.errore}`)
  return esito.pacchetto
}

// fotografia del documento SENZA il giornale del contratto (che sulla
// base 0020–0022 pulita non esiste): documento, bozze e righe
const fotografiaDocumento0023 = async docId => {
  const [r] = await sql(`select jsonb_build_object(
    'doc', (select to_jsonb(d) from public.family_documents d where id='${docId}'),
    'bozze', (select coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]') from public.family_draft_expenses b where document_id='${docId}'),
    'righe', (select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]') from public.family_draft_items i
              where i.draft_id in (select id from public.family_draft_expenses where document_id='${docId}'))
  ) as foto`)
  return JSON.stringify(r.foto)
}

const chiamaRpc = async (identita, corpo) => {
  const r = await rest(`/rest/v1/rpc/${FUNZIONE_0023}`, identita, { method: 'POST', body: JSON.stringify(corpo) })
  const testo = await r.text()
  let dati = null
  try { dati = JSON.parse(testo) } catch { /* risposta non json */ }
  return { status: r.status, dati, testo }
}

await eseguiPasso('passo2-comportamento', async () => {
  verificaAutorizzazione()
  verificaNonProduzione(progetto().ref)
  const c = creaContatore('passo2-comportamento')
  const registro = apriUltimoRegistro()
  if (!registro || registro.dati.pulito || !registro.dati.bozza0023Applicata)
    throw new Error('nessun registro col passo 1 applicato: eseguire prima passo1-struttura')

  const gruppoId = await gruppoPersonale()
  const pacchetto = await pacchettoVero(gruppoId)
  const corpoBuono = docId => corpoRpc0023(docId, { statiAmmessi: ['da_elaborare', 'errore'], pacchetto })
  const statoDoc = async id =>
    (await sql(`select status, doc_total::float as doc_total, error_message,
      (select count(*)::int from public.family_draft_expenses where document_id='${id}') as bozze,
      (select count(*)::int from public.family_draft_items i join public.family_draft_expenses b on b.id=i.draft_id
        where b.document_id='${id}') as righe
      from public.family_documents where id='${id}'`))[0]

  // PERMESSI: anon non può nemmeno vedere il primitivo
  const daAnon = await chiamaRpc('anon', corpoBuono(randomUUID()))
  c.esigi('anon respinto (mai il browser)', daAnon.status >= 400, `status ${daAnon.status}`)

  // GIRO BUONO su documento da_elaborare
  const doc1 = randomUUID()
  registro.documento(doc1)
  for (const stmt of sqlFixture0023({ docId: doc1, stato: 'da_elaborare', gruppoId })) await sql(stmt)
  const buono = await chiamaRpc('service', corpoBuono(doc1))
  c.esigi('giro buono: ok con conteggi', buono.dati?.ok === true && buono.dati.bozze === 2 && buono.dati.righe === 3, buono.testo)
  const dopo1 = await statoDoc(doc1)
  c.attesa('documento in_revisione con doc_total e archivio pieno',
    dopo1.status === 'in_revisione' && dopo1.doc_total === 8 && dopo1.error_message === null
    && dopo1.bozze === 2 && dopo1.righe === 3, JSON.stringify(dopo1))

  // IDEMPOTENZA: la ripetizione su in_revisione è respinta SENZA effetti
  const fotoPrima = await fotografiaDocumento0023(doc1)
  const ripetuta = await chiamaRpc('service', corpoBuono(doc1))
  c.esigi('ripetizione respinta con stato_attuale', ripetuta.dati?.ok === false && ripetuta.dati.stato_attuale === 'in_revisione', ripetuta.testo)
  c.esigi('archivio INVARIATO dopo il rifiuto', await fotografiaDocumento0023(doc1) === fotoPrima)
  const marcaturaNegata = await chiamaRpc('service', corpoRpc0023(doc1, { statiAmmessi: [], errore: 'tentativo' }))
  c.attesa('anche la marcatura d\'errore è respinta su in_revisione', marcaturaNegata.dati?.ok === false, marcaturaNegata.testo)

  // MARCATURA ERRORE + SOSTITUZIONE da stato errore (bozze pregresse via)
  const doc2 = randomUUID(); const bozzaVecchia = randomUUID()
  registro.documento(doc2)
  for (const stmt of sqlFixture0023({ docId: doc2, stato: 'errore', gruppoId, bozzaId: bozzaVecchia, rigaId: randomUUID() })) await sql(stmt)
  const marcata = await chiamaRpc('service', corpoRpc0023(doc2, { statiAmmessi: [], errore: 'lettura da rifare (collaudo)' }))
  const dopoMarca = await statoDoc(doc2)
  c.esigi('marcatura errore: pulizia totale + motivo', marcata.dati?.ok === true && dopoMarca.status === 'errore'
    && dopoMarca.error_message === 'lettura da rifare (collaudo)' && dopoMarca.bozze === 0, JSON.stringify(dopoMarca))
  const rielaborata = await chiamaRpc('service', corpoBuono(doc2))
  const dopoRielab = await statoDoc(doc2)
  const vecchiaSparita = await sql(`select count(*)::int as n from public.family_draft_expenses where id='${bozzaVecchia}'`)
  c.esigi('rielaborazione da errore: SOSTITUISCE (mai accumuli)', rielaborata.dati?.ok === true
    && dopoRielab.bozze === 2 && dopoRielab.righe === 3 && dopoRielab.status === 'in_revisione' && vecchiaSparita[0].n === 0,
  JSON.stringify(dopoRielab))

  // RICHIESTE MALFORMATE e PACCHETTI VUOTI: respinte senza effetti
  const doc3 = randomUUID()
  registro.documento(doc3)
  for (const stmt of sqlFixture0023({ docId: doc3, stato: 'da_elaborare', gruppoId })) await sql(stmt)
  const nessuno = await chiamaRpc('service', { p_document_id: doc3, p_pacchetto: null, p_errore: null })
  const entrambi = await chiamaRpc('service', { p_document_id: doc3, p_pacchetto: { doc_total: 1, bozze: [] }, p_errore: 'x' })
  c.esigi('malformata (né pacchetto né errore / entrambi) respinta',
    nessuno.dati?.ok === false && /malformata/.test(nessuno.dati?.errore ?? '')
    && entrambi.dati?.ok === false, `${nessuno.testo} · ${entrambi.testo}`)
  const vuoto = await chiamaRpc('service', { p_document_id: doc3, p_pacchetto: { doc_total: 1, bozze: [] }, p_errore: null })
  const senzaRighe = await chiamaRpc('service', {
    p_document_id: doc3, p_errore: null,
    p_pacchetto: { doc_total: 1, bozze: [{ document_id: doc3, expense_date: '2026-08-30', group_id: gruppoId, righe: [] }] },
  })
  const dopoVuoti = await statoDoc(doc3)
  c.esigi('pacchetto senza bozze / bozza senza righe: mai in_revisione',
    vuoto.dati?.ok === false && senzaRighe.dati?.ok === false && dopoVuoti.status === 'da_elaborare' && dopoVuoti.bozze === 0,
    `${vuoto.testo} · ${senzaRighe.testo}`)

  // ROLLBACK TOTALE: una riga viola un CHECK della 0020 (qty=0) su un
  // documento in errore CON bozza pregressa → l'intera chiamata è
  // annullata: la bozza pregressa DEVE essere ancora lì, byte per byte
  const doc4 = randomUUID()
  registro.documento(doc4)
  for (const stmt of sqlFixture0023({ docId: doc4, stato: 'errore', gruppoId, bozzaId: randomUUID(), rigaId: randomUUID() })) await sql(stmt)
  const fotoRollback = await fotografiaDocumento0023(doc4)
  const corpoRotto = corpoBuono(doc4)
  corpoRotto.p_pacchetto = JSON.parse(JSON.stringify(corpoRotto.p_pacchetto))
  corpoRotto.p_pacchetto.bozze[0].righe[0].qty = 0
  const rotto = await chiamaRpc('service', corpoRotto)
  c.esigi('vincolo violato → errore dal trasporto', rotto.status >= 400, rotto.testo.slice(0, 160))
  c.esigi('ROLLBACK totale: archivio IDENTICO byte per byte (delete compreso)',
    await fotografiaDocumento0023(doc4) === fotoRollback)

  // DOCUMENTO INESISTENTE
  const fantasma = await chiamaRpc('service', corpoBuono(randomUUID()))
  c.esigi('documento inesistente dichiarato', fantasma.dati?.ok === false && /inesistente/.test(fantasma.dati?.errore ?? ''), fantasma.testo)

  c.chiudi()
})
