// Blocco «alternativa Amelia» (pezzo 6) riscritto nello stile del pezzo 11.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generaProposta, CHIUSURA } from './richiesteTesti.ts'
import { proponiSoluzioni, segmento, alternativaAmelia, type Soluzione } from './richiesteProposta.ts'

const AMELIA = { id: 'amelia', name: 'Amelia', base_price: 70, has_extra_bed: true, extra_bed_price: 5, bathroom_type: 'privato_interno', active: true }
const ALLEGRA = { id: 'allegra', name: 'Allegra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_interno', active: true }
const AMBRA = { id: 'ambra', name: 'Ambra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_interno', active: true }
const LENA = { id: 'lena', name: 'Lena', base_price: 80, double_price: 90, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_esterno', active: true }
const CAMERE = [AMELIA, ALLEGRA, AMBRA, LENA]
const sol = (caso: Soluzione['caso'], segmenti: Soluzione['segmenti']): Soluzione => ({
  caso, segmenti, nottiTotali: segmenti.reduce((s, x) => s + x.notti, 0), nottiCoperte: segmenti.reduce((s, x) => s + x.notti, 0), nottiMancanti: [],
  prezzoTotale: segmenti.reduce((s, x) => s + x.totale, 0),
})
const ARRIVO = { tipo: 'arrivo' } as const
const apertura = (nome: string) => `Gentile ${nome},\ngrazie per aver pensato a Casa Ania per il suo soggiorno.`
const LINK = (slug: string) => `Qui può vedere le foto e i dettagli della camera: casaaniarozzano.it/camere/${slug}`
const CODA = (cosa: string) => `Il pagamento avviene all'arrivo, alla consegna delle chiavi, per l'intero soggiorno: in contanti oppure con bonifico istantaneo.\n\nSe desidera ${cosa}, la prego di farmelo sapere entro 3 ore da questo messaggio. Trascorso questo tempo, dovrò verificare nuovamente la disponibilità.\n\n${CHIUSURA}`
const R = { nome: 'Anna', cognome: 'Rossi', arrivo: '2026-09-13', partenza: '2026-09-15', persone: 1, camera_id: null }

test('blocco Amelia (pezzo 6) nello stile del pezzo 11, fra il link e la condizione', () => {
  const rich = { ...R, arrivo: '2026-09-13', partenza: '2026-09-16', persone: 1 }
  const s = sol('completa', [segmento(AMELIA, '2026-09-13', '2026-09-16', 1)])   // 210 €
  const amelia = alternativaAmelia(rich, s, CAMERE, [])
  assert.ok(amelia); assert.equal(amelia.camera.name, 'Allegra')
  assert.equal(generaProposta({ richiesta: rich, soluzione: s, condizione: ARRIVO, amelia }), `${apertura('Anna')}

Ho verificato le date che mi ha indicato. Dal 13 al 16 settembre è disponibile soltanto Amelia, una camera singola con il bagno in camera.

Il prezzo per le 3 notti è di 210 €, a 70 € a notte.

${LINK('singola')}

Visto che si tratta di un soggiorno di 3 notti, le segnalo anche un'alternativa. Amelia è la nostra camera più piccola e per una permanenza più lunga potrebbe risultare meno comoda. Con 10 € in più a notte posso proporle Allegra, una camera matrimoniale con il balconcino e il bagno in camera. Il prezzo per le 3 notti sarebbe di 240 €.

${CODA('confermare la camera')}`)
  // con più camere elencate il blocco non compare (le alternative sono già lì)
  const due = proponiSoluzioni(rich, [AMELIA, AMBRA], [])
  assert.doesNotMatch(generaProposta({ richiesta: rich, soluzione: due[0], condizione: null, alternative: due, amelia }), /camera più piccola/)
})
