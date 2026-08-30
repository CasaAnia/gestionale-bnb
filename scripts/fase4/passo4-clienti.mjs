#!/usr/bin/env node
// ============================================================================
// Fase 4 · collaudo 0022 — PASSO 4: il percorso COMPLETO con Storage e
// client REALI sul progetto di prova: gli adattatori effettivi
// (lib/spese/registrazioneClient.ts), il recupero durevole
// (lib/spese/ripresaDurevole.ts) e un utente sintetico membro. Alla fine si
// confrontano byte, impronte, documenti, ricevute, pendenti e orfani.
// ============================================================================
import { randomUUID, createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { sql, rest, maschera, progetto } from '../fase2b/api.mjs'
import { nuovoRegistro, tuttiIRegistri } from './registro.mjs'
import { creaClienteIdempotente } from '../../lib/spese/registrazioneClient.ts'
import { preparaRipresa, caricaConToken } from '../../lib/spese/registrazioneIdempotente.ts'
import { creaControllore, depositoLocale } from '../../lib/spese/ripresaDurevole.ts'

// registro INCREMENTALE: aggiornato a ogni artefatto creato
const registro = nuovoRegistro('clienti')
const p = progetto()
console.log('Bersaglio:', maschera(p.ref), '· registro:', registro.file)

let passati = 0, falliti = 0
const esito = (nome, ok, dettaglio = '') => {
  console.log(`${ok ? '✓' : '✗'} ${nome}${dettaglio ? ' — ' + dettaglio : ''}`)
  ok ? passati++ : falliti++
}
const sha = (s) => createHash('sha256').update(s).digest('hex')
const SALE = randomUUID().slice(0, 8)
const foto = (contenuto, nome = 'collaudo.jpg') =>
  ({ nomeFile: nome, tipo: 'image/jpeg', contenuto: new Blob([contenuto]), sha256: null })

// ---- utente SINTETICO membro (solo progetto di prova) ----------------------
const EMAIL = `collaudo-0022-${SALE}@prova.locale`
const PASSWORD = randomUUID() + randomUUID()   // mai stampata, mai salvata
// l'IDENTITÀ esatta si registra PRIMA della richiesta: se la creazione
// riesce ma la risposta si perde, la pulizia recupera l'account dall'email
registro.annota('identita', EMAIL)
const cr = await rest('/auth/v1/admin/users', 'service', {
  method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
})
if (!cr.ok) { console.error('utente sintetico non creato:', cr.status, await cr.text()); process.exit(1) }
const utente = await cr.json()
registro.annota('utenti', utente.id)
await sql(`insert into public.app_members (user_id, role) values ('${utente.id}', 'member')`)
console.log('utente sintetico membro creato (email locale di prova)')

// il client REALE (supabase-js) con sessione autenticata sul progetto di prova
const client = createClient(`https://${p.ref}.supabase.co`, p.anon_key, { auth: { persistSession: false } })
const accesso = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
if (accesso.error) { console.error('login sintetico fallito:', accesso.error.message); process.exit(1) }
const cliente = creaClienteIdempotente(client)

// memoria finta per il VERO depositoLocale (localStorage non esiste in node)
function memoriaFinta() {
  const dati = new Map()
  return { getItem: k => dati.get(k) ?? null, setItem: (k, v) => { dati.set(k, v) }, dati }
}
// il deposito usato nei flussi ANNOTA nel registro token e percorso al
// momento del salvataggio della ripresa — cioè PRIMA di ogni effetto
// remoto, non soltanto dopo il successo
function depositoAnnotato(memoria) {
  const base = depositoLocale(undefined, () => memoria)
  return {
    ...base,
    async salva(op) {
      registro.annota('tokens', op.token)
      registro.annota('percorsi', op.percorso)
      return base.salva(op)
    },
  }
}
const orologio = () => '2026-09-02T10:00:00.000Z'

// verifiche remote via service (fuori dal client sotto esame)
const doc = async (token) => (await sql(`select id, kind, upload_ambito, note from public.family_documents where upload_token='${token}'`))[0]
const ricevute = async (id) => await sql(`select storage_path, file_sha256, page_order from public.family_receipts where document_id='${id}' order by page_order`)
const scarica = async (percorso) => {
  // cache-buster: la CDN può servire per qualche istante un oggetto APPENA
  // cancellato; una query diversa forza il passaggio dall'origine
  const r = await rest(`/storage/v1/object/scontrini/${percorso}?cb=${Date.now()}`, 'service')
  return r.ok ? Buffer.from(await r.arrayBuffer()).toString() : null
}

// ---- 1. percorso felice con avvia (controller + deposito + storage veri) --
{
  const memoria = memoriaFinta()
  const c = creaControllore(cliente, depositoAnnotato(memoria), undefined, orologio)
  const contenuto = `foto-vera-${SALE}-1`
  const t = await c.avvia(foto(contenuto), 'personale', 'nota collaudo reale')
  const ok = t.ok
  esito('1 avvia: registrazione reale riuscita', ok, ok ? '' : t.errore)
  if (ok) {
    const d = (await sql(`select upload_token, note, kind from public.family_documents where id='${t.documentId}'`))[0]
    registro.annota('tokens', d.upload_token)
    registro.annota('documenti', t.documentId)
    const ric = await ricevute(t.documentId)
    registro.annota('percorsi', ric[0].storage_path)
    const byte = await scarica(ric[0].storage_path)
    esito('1b documento+ricevuta+file coerenti (byte e impronta VERI)',
      d.note === 'nota collaudo reale' && ric.length === 1
      && byte === contenuto && ric[0].file_sha256 === sha(contenuto),
      `sha db=${ric[0].file_sha256?.slice(0, 8)}… file=${sha(String(byte)).slice(0, 8)}…`)
    esito('1c deposito vuoto dopo la conclusione', (await c.pendenti()).riprese.length === 0)
  }
}

// ---- 2. risposta PERSA + controller RICREATO (recupero durevole reale) -----
{
  const memoria = memoriaFinta()
  const perdiRisposta = {
    ...cliente,
    async registraDocumento(...a) { await cliente.registraDocumento(...a); throw new Error('Failed to fetch (simulata DOPO la registrazione reale)') },
  }
  const c1 = creaControllore(perdiRisposta, depositoAnnotato(memoria), undefined, orologio)
  const contenuto = `foto-vera-${SALE}-2`
  const t1 = await c1.avvia(foto(contenuto), 'azienda', 'risposta persa')
  if (!t1.ok && t1.ripresa) { registro.annota('tokens', t1.ripresa.token); registro.annota('percorsi', t1.ripresa.percorso) }
  esito('2 risposta persa: esito riprovabile con traccia', !t1.ok && t1.riprovabile)
  // «pagina chiusa»: controller NUOVO su cliente REALE e stesso deposito
  const c2 = creaControllore(cliente, depositoAnnotato(memoria), undefined, orologio)
  const { riprese } = await c2.pendenti()
  esito('2b operazione pendente ritrovata dal deposito', riprese.length === 1 && riprese[0].nota === 'risposta persa')
  const t2 = await c2.riprendi(riprese[0])            // SENZA riselezionare il file
  const d = t2.ok && await doc(riprese[0].token)
  const ric = d ? await ricevute(d.id) : []
  if (d) registro.annota('documenti', d.id)
  esito('2c recupero reale: ripetuta, UN documento, UNA ricevuta, file collegato',
    t2.ok && t2.ripetuta && ric.length === 1 && ric[0].storage_path === riprese[0].percorso
    && (await scarica(riprese[0].percorso)) === contenuto)
  esito('2d deposito chiuso dopo il recupero', (await c2.pendenti()).riprese.length === 0)
}

// ---- 3. oggetto GIÀ PRESENTE con contenuto diverso (byte reali intatti) ----
let percorsoEstraneo = null
{
  const prep = await preparaRipresa(foto(`foto-vera-${SALE}-3`), orologio)
  if (!prep.ok) { esito('3 prepara', false, prep.errore) } else {
    // questo caricamento DIRETTO non passa dal depositoAnnotato: token e
    // percorso vanno registrati durevolmente PRIMA dell'upload, altrimenti
    // "oggetto creato, risposta persa" lascerebbe un file senza traccia
    registro.annota('tokens', prep.ripresa.token)
    registro.annota('estranei', prep.ripresa.percorso)
    percorsoEstraneo = prep.ripresa.percorso
    const estraneo = `BYTE-ESTRANEI-${SALE}`
    const su = await client.storage.from('scontrini').upload(prep.ripresa.percorso, new Blob([estraneo]), { contentType: 'text/plain', upsert: false })
    esito('3a oggetto estraneo piazzato al percorso (membro reale)', !su.error, su.error?.message ?? '')
    const t = await caricaConToken(cliente, foto(`foto-vera-${SALE}-3`), 'personale', null, prep.ripresa)
    const dentro = await scarica(prep.ripresa.percorso)
    esito('3b contenuto diverso: registrazione FERMATA, byte remoti INTATTI, nessun documento',
      !t.ok && !t.riprovabile && t.chiusura === 'da_verificare'
      && dentro === estraneo && !(await doc(prep.ripresa.token)),
      !t.ok ? t.errore.slice(0, 60) : '')
  }
}

// ---- 4. contenuto diverso nel RITENTATIVO (impronta fissata) ---------------
{
  const prep = await preparaRipresa(foto(`foto-vera-${SALE}-4`), orologio)
  if (!prep.ok) { esito('4 prepara', false, prep.errore) } else {
    registro.annota('tokens', prep.ripresa.token)
    registro.annota('percorsi', prep.ripresa.percorso)
    const t = await caricaConToken(cliente, foto(`ALTRO-CONTENUTO-${SALE}`), 'personale', null, prep.ripresa)
    esito('4 file riselezionato diverso: fermato PRIMA di ogni effetto',
      !t.ok && t.serveFile === true && (await scarica(prep.ripresa.percorso)) === null)
  }
}

// ---- 5. doppione con pulizia INIZIALMENTE indisponibile --------------------
{
  const memoria = memoriaFinta()
  const contenuto = `foto-vera-${SALE}-1`               // sha GIÀ registrato al punto 1
  let guasti = 1
  const puliziaGiu = {
    ...cliente,
    async ricevutaConSha() { return {} },               // niente scorciatoia: decide la RPC
    async ricevutaEsiste(percorso) {
      if (guasti-- > 0) return { errore: 'verifica giù (simulata)' }
      return cliente.ricevutaEsiste(percorso)
    },
  }
  const c1 = creaControllore(puliziaGiu, depositoAnnotato(memoria), undefined, orologio)
  const t1 = await c1.avvia(foto(contenuto), 'personale', null)
  if (!t1.ok && t1.ripresa) registro.annota('percorsi', t1.ripresa.percorso)
  esito('5 doppione reale con pulizia giù: pulizia_pendente, copia conservata',
    !t1.ok && t1.duplicato && t1.pulizia === 'incerta' && t1.chiusura === 'pulizia_pendente'
    && (await scarica(t1.ripresa?.percorso)) !== null)
  const { riprese } = await c1.pendenti()
  const t2 = riprese.length === 1 ? await c1.riprendi(riprese[0]) : null
  const copiaDopo = riprese.length === 1 ? await scarica(riprese[0].percorso) : '(niente riprese)'
  const pendentiDopo = (await c1.pendenti()).riprese.length
  esito('5b recupero: pulizia completata, copia RIMOSSA dal bucket vero',
    t2 && !t2.ok && t2.duplicato && t2.pulizia === 'rimossa' && t2.chiusura === 'conclusa'
    && copiaDopo === null && pendentiDopo === 0,
    JSON.stringify({ riprese: riprese.length,
      t2: t2 && { ok: t2.ok, dup: t2.duplicato, pulizia: t2.pulizia, chiusura: t2.chiusura, err: t2.errore?.slice(0, 90) },
      copiaDopo: copiaDopo === null ? null : String(copiaDopo).slice(0, 30), pendentiDopo }))
}

// ---- 6. bilancio finale: niente orfani tra gli artefatti del collaudo ------
{
  const ric = await sql(`select storage_path from public.family_receipts r join public.family_documents d on d.id=r.document_id where d.upload_token is not null`)
  const percorsiCollegati = new Set(ric.map(r => r.storage_path))
  const lista = await rest('/storage/v1/object/list/scontrini', 'service', {
    method: 'POST', body: JSON.stringify({ prefix: '2026-09-02', limit: 1000 }),
  })
  const oggetti = lista.ok ? (await lista.json()).map(o => '2026-09-02/' + o.name) : null
  const orfani = (oggetti?.filter(o => !percorsiCollegati.has(o)) ?? null)?.sort()
  // gli orfani ATTESI sono un ELENCO ESATTO: gli oggetti estranei
  // deliberatamente conservati (prova 3), registrati giro per giro e non
  // ancora ripuliti. Qualsiasi altro orfano è un file PERSO dal flusso.
  const attesi = [...new Set(tuttiIRegistri()
    .filter(r => !r.dati.pulito)
    .flatMap(r => r.dati.estranei ?? []))].sort()
  esito('6 orfani = ESATTAMENTE gli estranei registrati e non ancora ripuliti',
    orfani !== null && JSON.stringify(orfani) === JSON.stringify(attesi),
    orfani === null ? 'lista non disponibile' : `orfani=${JSON.stringify(orfani)} attesi=${JSON.stringify(attesi)}`)
}

console.log(`\nPASSO 4: ${passati} passati, ${falliti} falliti`)
process.exit(falliti ? 1 : 0)
