// «Nota e colore» (17/09/2026): la logica pura del foglio
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { moduloDaPrenotazione, campiNota, idsDaScrivere, nienteDaCambiare, COLORI_CALENDARIO, ARRIVATA_DA } from './notaScheda.ts'

const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('i colori e le tre provenienze sono quelli della scheda attuale e del calendario', () => {
  const vecchia = leggi('app/prenotazioni/[id]/page.tsx')
  for (const c of COLORI_CALENDARIO) {
    if (c.valore) assert.match(vecchia, new RegExp(`value: '${c.valore}'`), `il colore ${c.nome} non è nella scheda attuale`)
  }
  assert.equal(COLORI_CALENDARIO[0].valore, '')       // «Auto»: la barra col colore di sempre
  assert.equal(COLORI_CALENDARIO.find(c => c.nome === 'Esclusiva')?.valore, '#f97316')
  assert.match(leggi('app/calendario/page.tsx'), /booking\.color === '#f97316'/)
  assert.deepEqual(ARRIVATA_DA.map(a => a.chiave), ['diretta', 'sito_web', 'whatsapp'])
  assert.match(vecchia, /\[\['diretta', 'Diretta'\], \['sito_web', '🌐 Sito'\], \['whatsapp', 'WhatsApp'\]\]/)
})

test('dalla riga al modulo e ritorno: nota vuota → null, colore vuoto → null (automatico), provenienza sconosciuta → diretta', () => {
  assert.deepEqual(moduloDaPrenotazione({ id: 'a', notes: ' Arriva tardi ', color: '#3b82f6', source: 'sito_web' }), { nota: 'Arriva tardi', colore: '#3b82f6', arrivataDa: 'sito_web' })
  assert.deepEqual(moduloDaPrenotazione({ id: 'a', notes: null, color: '#123456', source: 'booking' }), { nota: '', colore: '', arrivataDa: 'diretta' })
  assert.deepEqual(moduloDaPrenotazione(null), { nota: '', colore: '', arrivataDa: 'diretta' })
  assert.deepEqual(campiNota({ nota: '  ', colore: '', arrivataDa: 'diretta' }), { notes: null, color: null, source: 'diretta' })
  assert.deepEqual(campiNota({ nota: 'Cuscino in più', colore: '#ec4899', arrivataDa: 'whatsapp' }), { notes: 'Cuscino in più', color: '#ec4899', source: 'whatsapp' })
})

test('si scrive su tutte le camere attive; senza cambiamenti niente scrittura', () => {
  const righe = [{ id: 'a', status: 'confermata' }, { id: 'b', status: 'annullata' }, { id: 'c', status: 'confermata' }]
  assert.deepEqual(idsDaScrivere(righe), ['a', 'c'])
  const b = { id: 'a', notes: 'x', color: null, source: 'diretta' }
  assert.equal(nienteDaCambiare({ nota: 'x ', colore: '', arrivataDa: 'diretta' }, b), true)
  assert.equal(nienteDaCambiare({ nota: 'y', colore: '', arrivataDa: 'diretta' }, b), false)
  assert.equal(nienteDaCambiare({ nota: 'x', colore: '#1f2937', arrivataDa: 'diretta' }, b), false)
})
