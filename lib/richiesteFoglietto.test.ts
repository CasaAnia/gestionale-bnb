// Il foglietto di una richiesta (Richieste «Maison», novità 14b e 14c del
// 29/09/2026): le righe, il telefono per esteso, le azioni per stato.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  testaFogliettoRichiesta, righeFogliettoRichiesta, azioniFogliettoRichiesta, personeFoglietto, cameraFoglietto, statoFoglietto, clienteFoglietto,
  ALTEZZA_FOGLIETTO_RICHIESTA,
} from './richiesteFoglietto.ts'
import { camereLibere } from './richiesteNastro.ts'
import { telefonoPerEsteso } from './whatsapp.ts'
import type { Richiesta } from './richieste.ts'

const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const adesso = new Date('2026-09-29T12:00:00')
const ric = (extra: Partial<Richiesta> = {}): Richiesta => ({
  id: 'a', created_at: new Date('2026-09-29T08:41:00').toISOString(), nome: 'Anna', cognome: 'Rinaldi', arrivo: '2026-09-30', partenza: '2026-10-03', persone: 2,
  camera_id: null, canale: 'web', telefono: '+393478126690', note: 'Se possibile la camera con il balcone, grazie', stato: 'in_attesa',
  proposta_inviata_at: null, chiusa_at: null, prenotazione_id: null, ...extra,
})

test('il telefono per esteso: «+39 347 812 6690», gli esteri col loro prefisso, senza numero niente', () => {
  assert.equal(telefonoPerEsteso('+39 347 812 6690'), '+39 347 812 6690')
  assert.equal(telefonoPerEsteso('3478126690'), '+39 347 812 6690')
  assert.equal(telefonoPerEsteso('+44 7700 900123'), '+447700900123')
  assert.equal(telefonoPerEsteso(null), '')
})

test('le righe del foglietto, nell’ordine, come nel riferimento', () => {
  assert.equal(testaFogliettoRichiesta(ric(), adesso), 'richiesta · dal sito · oggi 08:41')
  const righe = righeFogliettoRichiesta(ric(), { libere: ['Ambra', 'Allegra', 'Lena'], volte: 3, inArchivio: true, spesoCent: 64000 }, adesso)
  // la riga TELEFONO non c'è più: il numero sta sotto il nome (ritocchi del 29/09/2026, A4)
  assert.deepEqual(righe.map(r => r.etichetta), ['Date', 'Persone', 'Camera', 'Stato', 'Nota', 'Cliente'])
  assert.deepEqual(righe.map(r => r.valore), [
    '30 set → 3 ott · 3 notti',
    '2',
    'qualsiasi · libere: Ambra, Allegra, Lena',
    'in attesa · arrivata oggi',
    '«Se possibile la camera con il balcone, grazie»',
    'già ospite 3 volte · 640 € spesi',
  ])
  assert.equal(righe[4].tipo, 'mat')
  // senza nota la riga resta, vuota (il foglio ha l'altezza fissa)
  assert.equal(righeFogliettoRichiesta(ric({ note: null }), { libere: [], volte: 0, inArchivio: false, spesoCent: 0 }, adesso)[4].valore, '')
  assert.equal(ALTEZZA_FOGLIETTO_RICHIESTA, 440)
})

test('persone, camera, stato e cliente nelle loro varianti', () => {
  assert.equal(personeFoglietto(ric({ persone: 3, persone_per_notte: [3, 2, 2] })), '3 → 2 persone')
  assert.equal(cameraFoglietto({ camera_id: 'x', rooms: { name: 'Ambra' } }, []), 'Ambra')
  assert.equal(cameraFoglietto({ camera_id: null, rooms: null }, []), 'qualsiasi · nessuna libera per tutte le notti')
  // proposta inviata alle 10:00, scade alle 13:00 (all'arrivo, 3 ore)
  const inviata = ric({ stato: 'proposta_inviata', proposta_inviata_at: new Date('2026-09-29T10:45:00').toISOString() })
  assert.equal(statoFoglietto(inviata, adesso), 'proposta inviata · scade tra 1 h 45 min')
  // ferma: in attesa da più di 24 ore
  assert.equal(statoFoglietto(ric({ created_at: new Date('2026-09-26T09:00:00').toISOString() }), adesso), 'in attesa · ferma da 3 giorni')
  assert.equal(clienteFoglietto(0, false, 0), '')
  assert.equal(clienteFoglietto(0, true, 0), 'già in archivio')
})

test('le azioni per stato: «Invia proposta» o «Conferma», poi «Modifica» e «Rifiuta»; su una chiusa niente', () => {
  assert.deepEqual(azioniFogliettoRichiesta({ stato: 'in_attesa' }).map(a => a.testo), ['Invia proposta', 'Modifica', 'Rifiuta'])
  assert.deepEqual(azioniFogliettoRichiesta({ stato: 'proposta_inviata' }).map(a => a.azione), ['conferma', 'modifica', 'rifiuta'])
  assert.deepEqual(azioniFogliettoRichiesta({ stato: 'chiusa' }), [])
})

test('le camere libere per «qualsiasi»: niente prenotazioni confermate e niente tenute di altre proposte', () => {
  const camere = [{ id: 'amelia', name: 'Amelia' }, { id: 'ambra', name: 'Ambra' }, { id: 'lena', name: 'Lena' }]
  const libere = camereLibere({ ...ric() }, camere, [{ room_id: 'amelia', check_in: '2026-10-02', check_out: '2026-10-04', status: 'confermata' }], [{ richiestaId: 'b', cameraId: 'lena', notti: ['2026-09-30'], scaduta: false }])
  assert.deepEqual(libere.map(c => c.name), ['Ambra'])
})

test('il foglietto sostituisce il vecchio pannello: FoglioMaison 440 px (380 prima dei ritocchi), cerchi di chiamata e WhatsApp, Rifiuta in mattone', () => {
  const foglio = leggi('components/richieste/FogliettoRichiesta.tsx')
  assert.match(foglio, /<FoglioMaison /)
  assert.match(foglio, /altezza=\{ALTEZZA_FOGLIETTO_RICHIESTA\}/)
  // i cerchi stanno nella riga del numero, sotto il nome (ritocchi A4)
  assert.match(foglio, /<TelefonoFoglietto telefono=\{r\.telefono\} /)
  assert.match(foglio, /a\.azione === 'rifiuta' \? 'mz-lnk q mat'/)
  const pagina = leggi('app/richieste/page.tsx')
  assert.match(pagina, /<FogliettoRichiesta /)
  assert.equal(/PannelloRichieste/.test(pagina), false, 'il vecchio pannello è ancora nella pagina')
})
