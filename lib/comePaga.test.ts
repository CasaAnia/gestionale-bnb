// «Come paga» (13/09/2026): i sei modi, un posto solo.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MODI_COME_PAGA, GRUPPI_COME_PAGA, NOME_COME_PAGA, FRASE_COME_PAGA, ACCORDO_SALVATO,
  comePagaSalvato, campiComePaga, comePagaInParole, chiedeImporto, chiedeScadenza, bonificoDelModo,
  type ComePaga,
} from './comePaga.ts'

test('i sei modi, nei due gruppi e nell’ordine deciso', () => {
  assert.deepEqual(GRUPPI_COME_PAGA.map(g => g.etichetta), ['Quando arriva', 'Prima di arrivare'])
  assert.deepEqual(GRUPPI_COME_PAGA[0].modi, ['contanti', 'bonifico', 'da_vedere'])
  assert.deepEqual(GRUPPI_COME_PAGA[1].modi, ['tutto', 'meta', 'caparra'])
  assert.deepEqual(MODI_COME_PAGA, ['contanti', 'bonifico', 'da_vedere', 'tutto', 'meta', 'caparra'])
})

test('i sei nomi', () => {
  assert.deepEqual(MODI_COME_PAGA.map(m => NOME_COME_PAGA[m]),
    ['Contanti', 'Bonifico', 'Da vedere', 'Tutto', 'Caparra del 50%', 'Caparra'])
})

test('le sei frasi per esteso', () => {
  assert.deepEqual(MODI_COME_PAGA.map(m => FRASE_COME_PAGA[m]), [
    'paga tutto in contanti quando arriva',
    'paga tutto con bonifico quando arriva',
    'paga tutto quando arriva, contanti o bonifico',
    'paga tutto in anticipo con bonifico',
    'caparra del 50%, il resto all’arrivo',
    'caparra, il resto all’arrivo',
  ])
})

test('a ogni modo corrisponde quello che il database salva già', () => {
  assert.deepEqual(MODI_COME_PAGA.map(m => ACCORDO_SALVATO[m]),
    ['contanti', 'bonifico_arrivo', null, 'bonifico_intero', 'caparra_meta', 'caparra_libera'])
  // e si rilegge uguale
  for (const m of MODI_COME_PAGA) {
    assert.equal(comePagaSalvato(ACCORDO_SALVATO[m], bonificoDelModo(m)), m, `${m} non si rilegge`)
  }
})

test('senza niente salvato: «Da vedere», oppure «Bonifico» se c’è la vecchia spunta', () => {
  assert.equal(comePagaSalvato(null, false), 'da_vedere')
  assert.equal(comePagaSalvato(undefined, null), 'da_vedere')
  assert.equal(comePagaSalvato('', false), 'da_vedere')
  assert.equal(comePagaSalvato(null, true), 'bonifico')
  // un valore che non conosciamo non inventa niente
  assert.equal(comePagaSalvato('chissà', false), 'da_vedere')
})

test('la vecchia spunta «bonifico» resta coerente', () => {
  assert.deepEqual(MODI_COME_PAGA.map(bonificoDelModo), [false, true, false, true, true, true])
})

test('l’importo si chiede solo per la caparra decisa da Ania', () => {
  assert.deepEqual(MODI_COME_PAGA.map(chiedeImporto), [false, false, false, false, false, true])
})

test('la scadenza compare solo con le due caparre', () => {
  assert.deepEqual(MODI_COME_PAGA.map(chiedeScadenza), [false, false, false, false, true, true])
})

test('la caparra del 50% è la metà del totale, fotografata adesso', () => {
  const campi = campiComePaga('meta', { totaleCent: 47000, entro: '2026-09-20T18:00:00' })
  assert.equal(campi.caparra_centesimi, 23500)
  assert.equal(campi.accordo_pagamento, 'caparra_meta')
  assert.equal(campi.caparra_entro, '2026-09-20T18:00:00')
  assert.equal(campi.bonifico, true)
  // dispari: si arrotonda al centesimo
  assert.equal(campiComePaga('meta', { totaleCent: 15001 }).caparra_centesimi, 7501)
})

test('la caparra libera prende l’importo scritto a mano', () => {
  const campi = campiComePaga('caparra', { totaleCent: 47000, importoCent: 10000, entro: '2026-09-20T18:00:00' })
  assert.equal(campi.caparra_centesimi, 10000)
  assert.equal(campi.accordo_pagamento, 'caparra_libera')
})

test('senza caparra i due campi restano vuoti, come vuole il vincolo del database', () => {
  for (const modo of ['contanti', 'bonifico', 'da_vedere', 'tutto'] as ComePaga[]) {
    const campi = campiComePaga(modo, { totaleCent: 47000, importoCent: 10000, entro: '2026-09-20T18:00:00' })
    assert.equal(campi.caparra_centesimi, null, `${modo} ha scritto una caparra`)
    assert.equal(campi.caparra_entro, null, `${modo} ha scritto una scadenza`)
  }
  // «Da vedere» non scrive niente nella colonna, come fa oggi chi non specifica
  assert.equal(campiComePaga('da_vedere', {}).accordo_pagamento, null)
  assert.equal(campiComePaga('da_vedere', {}).bonifico, false)
})

test('quello che si legge partendo dai campi salvati', () => {
  assert.deepEqual(comePagaInParole('caparra_meta', true), { nome: 'Caparra del 50%', frase: 'caparra del 50%, il resto all’arrivo' })
  assert.deepEqual(comePagaInParole(null, false), { nome: 'Da vedere', frase: 'paga tutto quando arriva, contanti o bonifico' })
  assert.deepEqual(comePagaInParole('contanti', false), { nome: 'Contanti', frase: 'paga tutto in contanti quando arriva' })
})

test('i nomi vecchi non esistono più', () => {
  const tutto = [...Object.values(NOME_COME_PAGA), ...Object.values(FRASE_COME_PAGA)].join(' | ')
  for (const vecchio of ['Pagamento completo', 'intero in anticipo', 'tutto anticipato', 'Accordo']) {
    assert.equal(tutto.includes(vecchio), false, `«${vecchio}» è ancora qui`)
  }
})

// ── IL COMPONENTE, letto dai sorgenti ──────────────────────────────────────
import { readFileSync } from 'node:fs'
const componente = readFileSync(new URL('../components/ComePaga.tsx', import.meta.url), 'utf8')

test('le due etichette dei gruppi: 9,5 px maiuscole spaziate 1,4 stone', () => {
  assert.match(componente, /fontSize: 9\.5,\s*letterSpacing: '1\.4px',\s*textTransform: 'uppercase' as const,\s*color: 'var\(--color-stone\)'/)
  assert.match(componente, /\{gruppo\.etichetta\}/)
})

test('le pastiglie: 30 px, 12,5 semibold, contorno #C9BFA8 e green-mid quando scelte', () => {
  assert.match(componente, /export const ALTEZZA_PASTIGLIA = 30/)
  assert.match(componente, /export const BORDO_SPENTA = '#C9BFA8'/)
  assert.match(componente, /height: ALTEZZA_PASTIGLIA, borderRadius: 999, padding: '0 12px', fontSize: 12\.5, fontWeight: 600/)
  assert.match(componente, /background: acceso \? 'var\(--color-green-mid\)' : 'transparent'/)
  assert.match(componente, /color: acceso \? 'var\(--color-cream\)' : 'var\(--color-green-dark\)'/)
  // si toccano su 44 px senza crescere
  assert.match(componente, /className="py-\[7px\] -my-\[7px\]"/)
})

test('una sola scelta accesa alla volta, fra tutte e sei', () => {
  // l'acceso è il confronto con l'unico valore `modo`: non c'è nessun elenco di scelte
  assert.match(componente, /const acceso = modo === m/)
  assert.match(componente, /aria-pressed=\{acceso\}/)
  assert.equal(/scelte|selezionati|\[\]\.includes/.test(componente), false)
})

test('la frase per esteso, l’importo del 50%, il campo della caparra e la scadenza', () => {
  assert.match(componente, /data-frase-come-paga[\s\S]{0,120}\{FRASE_COME_PAGA\[modo\]\}/)
  assert.match(componente, /modo === 'meta' && meta !== null/)
  assert.match(componente, /\{chiedeImporto\(modo\) && \(/)
  assert.match(componente, /\{chiedeScadenza\(modo\) && \(/)
  assert.match(componente, />Entro il</)
  assert.match(componente, />alle</)
})

test('il componente non parla col database e non si riscrive i nomi', () => {
  assert.equal(/supabase/i.test(componente), false)
  assert.match(componente, /from '@\/lib\/comePaga'/)
  for (const nome of ['Contanti', 'Bonifico', 'Da vedere', 'Caparra del 50%']) {
    assert.equal(componente.includes(`>${nome}<`), false, `«${nome}» è scritto a mano nel componente`)
  }
})
