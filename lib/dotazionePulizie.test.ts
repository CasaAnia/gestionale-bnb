import { test } from 'node:test'
import assert from 'node:assert/strict'
import { proponiAssetto, dotazioneDaAssetto, pezziVuoti, daLavare, totalePezzi, fotografaPulizia, salvaNelRegistro, riepilogoDotazione, type RegistrazionePulizia } from './dotazionePulizie.ts'
const evento = (): RegistrazionePulizia => {
 const assetto = proponiAssetto('Lena', 2, true)!
 return { id: 'pulizia-1', camera: 'Lena', data: '2026-09-25', tipo: 'fine_soggiorno', assetto, dotazione: dotazioneDaAssetto(assetto), recuperi: pezziVuoti(), minuti: null }
}
test('matrimoniale uso singolo: lenzuola matrimoniali, un completo asciugamani; scelta esplicita delle federe', () => {
 assert.equal(proponiAssetto('Ambra', 1, false), null)
 for (const federe of [2, 4] as const) {
  const d = dotazioneDaAssetto(proponiAssetto('Ambra', 1, false, federe)!)
  assert.equal(d.sotto_matrimoniale, 1); assert.equal(d.sotto_singolo, 0); assert.equal(d.federe, federe)
  assert.deepEqual([d.telo_doccia, d.asciugamano_viso, d.asciugamano_mani], [1, 1, 1])
 }
})
test('singola uso doppia: due letti singoli, quattro federe e sei asciugamani', () => {
 const d = dotazioneDaAssetto(proponiAssetto('Amelia', 2, true)!)
 assert.equal(d.sotto_singolo, 2); assert.equal(d.sotto_matrimoniale, 0); assert.equal(d.federe, 4); assert.equal(d.telo_doccia, 2)
})
test('due ospiti con letto extra: matrimoniale più singolo e due completi asciugamani in tutte le matrimoniali', () => {
 for (const camera of ['Lena', 'Ambra', 'Allegra']) {
  const d = dotazioneDaAssetto(proponiAssetto(camera, 2, true)!)
  assert.equal(d.sotto_matrimoniale, 1); assert.equal(d.sotto_singolo, 1); assert.equal(d.federe, 6); assert.equal(d.telo_doccia, 2)
 }
})
test('Lena tripla e quadrupla: un matrimoniale più uno o due singoli; quattro e otto federe non confusi', () => {
 const tripla = dotazioneDaAssetto(proponiAssetto('Lena', 3, true)!)
 const quadrupla = dotazioneDaAssetto(proponiAssetto('Lena', 4, true)!)
 assert.equal(tripla.sotto_singolo, 1); assert.equal(tripla.federe, 6); assert.equal(tripla.telo_doccia, 3)
 assert.equal(quadrupla.sotto_singolo, 2); assert.equal(quadrupla.federe, 8); assert.equal(quadrupla.telo_doccia, 4)
 assert.equal(quadrupla.tappeto_bagno, 1); assert.equal(quadrupla.scendidoccia, 1)
 assert.equal(proponiAssetto('Amelia', 3, true), null); assert.equal(proponiAssetto('Ambra', 4, true), null)
})
test('recuperi parziali: sottrae i singoli pezzi, non interi completi', () => {
 const d = evento().dotazione!; const rec = { ...pezziVuoti(), federe: 2, sotto_singolo: 1, asciugamano_mani: 1 }
 const l = daLavare(d, rec)
 assert.equal(l.federe, 4); assert.equal(l.sotto_singolo, 0); assert.equal(l.sopra_singolo, 1)
 assert.equal(totalePezzi(l), totalePezzi(d) - 4)
 assert.throws(() => daLavare(d, { ...rec, sotto_singolo: 2 }), /supera/)
})
test('salva due volte, riapre e modifica: una pulizia; lo storico non cambia con la proposta nuova', () => {
 const richiesta = evento(); let reg = salvaNelRegistro([], richiesta)
 richiesta.assetto!.singoli = 0; richiesta.dotazione!.federe = 4
 assert.equal(reg[0].assetto!.singoli, 1); assert.equal(reg[0].dotazione!.federe, 6)
 reg = JSON.parse(JSON.stringify(reg)); const modifica = { ...reg[0], recuperi: { ...pezziVuoti(), federe: 2 } }
 reg = salvaNelRegistro(reg, modifica); reg = salvaNelRegistro(reg, modifica)
 assert.equal(reg.length, 1); assert.equal(reg[0].recuperi!.federe, 2)
 const r = riepilogoDotazione(JSON.parse(JSON.stringify(reg)), '2026-09-01', '2026-10-01')
 assert.equal(r.interventi, 1); assert.equal(r.matrimoniali, 1); assert.equal(r.singoli, 1)
})
test('durata e dotazione mancanti restano sconosciute; non diventano zero ore o percentuale completa', () => {
 const vecchio: RegistrazionePulizia = { ...evento(), id: 'vecchia', assetto: null, dotazione: null, recuperi: null }
 const r = riepilogoDotazione([{ ...evento(), minuti: 40 }, vecchio], '2026-09-01', '2026-10-01')
 assert.equal(r.interventi, 2); assert.equal(r.camereDistinte, 1); assert.equal(r.minuti, 40); assert.equal(r.conDurata, 1)
 assert.equal(r.minutiMedi, 40); assert.equal(r.conLavaggio, 1); assert.equal(r.percentualeRecupero, null)
})
test('mese della pulizia invariato quando si correggono i recuperi nel mese dopo', () => {
 const reg = salvaNelRegistro([evento()], { ...evento(), recuperi: { ...pezziVuoti(), federe: 1 } })
 assert.equal(riepilogoDotazione(reg, '2026-09-01', '2026-10-01').recuperi.federe, 1)
 assert.equal(riepilogoDotazione(reg, '2026-10-01', '2026-11-01').interventi, 0)
})
test('rifiuta durate, date e quantità impossibili e doppie letture', () => {
 assert.throws(() => fotografaPulizia({ ...evento(), minuti: -1 }))
 assert.throws(() => fotografaPulizia({ ...evento(), data: '2026-02-30' }))
 assert.throws(() => riepilogoDotazione([evento(), evento()], '2026-09-01', '2026-10-01'), /duplicata/)
 assert.throws(() => daLavare(evento().dotazione!, { ...pezziVuoti(), federe: NaN }))
})
