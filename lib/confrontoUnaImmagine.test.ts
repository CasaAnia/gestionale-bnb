// ============================================================================
// REGOLA FISSA n. 10 (REGOLE-FISSE.md, Ania, 21/09/2026 sera): quando c'è da
// scegliere, prima e dopo stanno nella STESSA immagine.
//
// «Rimettimi le foto una accanto all'altra in modo che le posso aprire tutte
// e due contemporaneamente per vedere le differenze.» Due file separati non
// si possono guardare insieme: si apre uno, si chiude, si apre l'altro, e la
// differenza non si vede.
//
// Questo file blocca la regola in tre modi: lo strumento esiste, compone una
// pagina SOLA con dentro tutte le schermate, e la regola resta scritta nei
// due documenti che si leggono prima di ogni incarico.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { paginaConfronto, misuraPng } from '../scripts/revisioni/confronto.mjs'

const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('lo strumento compone UNA pagina sola, con tutte le schermate dentro', () => {
  const pagina = paginaConfronto('Il riquadro o no?', [
    { etichetta: 'A · senza riquadro', larghezza: 390, altezza: 560, dati: 'data:image/png;base64,AAA' },
    { etichetta: 'B · col riquadro', larghezza: 390, altezza: 560, dati: 'data:image/png;base64,BBB' },
  ])
  // una pagina sola: un solo <body>, una sola fila
  assert.equal((pagina.match(/<body/g) ?? []).length, 1)
  assert.equal((pagina.match(/class="fila"/g) ?? []).length, 1)
  // e dentro ci sono tutte e due le schermate, affiancate
  assert.equal((pagina.match(/<img /g) ?? []).length, 2)
  assert.match(pagina, /base64,AAA/)
  assert.match(pagina, /base64,BBB/)
  assert.match(pagina, /display:flex/)
  // la domanda in cima e l'etichetta di ognuna
  assert.match(pagina, /Il riquadro o no\?/)
  assert.match(pagina, /A · senza riquadro/)
  assert.match(pagina, /B · col riquadro/)
  // i caratteri e i colori di casa, non un tema a parte
  assert.match(pagina, /--crema:#FBF9F4/)
  assert.match(pagina, /Georgia,'Times New Roman',serif/)
})

test('quando la differenza è piccola: riquadro rosso sulla zona e riga di spiegazione', () => {
  // Ania, 21/09/2026: «non vedo nessuna differenza». Due schermate intere
  // non bastano quando cambia una riga sola: si segna e si spiega.
  const pagina = paginaConfronto('La riga la tengo?', [
    { etichetta: 'C · con', larghezza: 390, altezza: 300, dati: 'x', segna: [20, 120, 340, 46], nota: 'Qui c’è la riga in più.' },
    { etichetta: 'D · senza', larghezza: 390, altezza: 300, dati: 'y', nota: 'Qui non c’è.' },
  ])
  assert.match(pagina, /class="segno"[^>]*left:20px;top:120px;width:340px;height:46px/)
  assert.match(pagina, /border:2px dashed #C00000/)
  assert.match(pagina, /Qui c’è la riga in più\./)
  assert.match(pagina, /Qui non c’è\./)
  // il segno sta SOPRA la schermata, non la ritocca
  assert.match(pagina, /\.telaio \{ position:relative/)
  assert.equal((pagina.match(/class="fila"/g) ?? []).length, 1)
})

test('funziona anche con tre schermate, sempre in una pagina sola', () => {
  const tre = [1, 2, 3].map(n => ({ etichetta: `n${n}`, larghezza: 390, altezza: 560, dati: `data:image/png;base64,${n}` }))
  const pagina = paginaConfronto('Quale?', tre)
  assert.equal((pagina.match(/<img /g) ?? []).length, 3)
  assert.equal((pagina.match(/class="fila"/g) ?? []).length, 1)
})

test('misuraPng legge le misure dall’intestazione, senza librerie', () => {
  const cartella = mkdtempSync(join(tmpdir(), 'png-'))
  const file = join(cartella, 'p.png')
  // un PNG minimo: firma + IHDR con 780×1120
  const b = Buffer.alloc(24)
  b.writeUInt32BE(0x89504e47, 0); b.writeUInt32BE(0x0d0a1a0a, 4)
  b.writeUInt32BE(13, 8); b.write('IHDR', 12)
  b.writeUInt32BE(780, 16); b.writeUInt32BE(1120, 20)
  writeFileSync(file, b)
  assert.deepEqual(misuraPng(file), { larghezza: 780, altezza: 1120 })
  writeFileSync(file, Buffer.from('non un png'))
  assert.throws(() => misuraPng(file), /non è un PNG/)
  rmSync(cartella, { recursive: true, force: true })
})

test('la regola è scritta dove si legge prima di ogni incarico', () => {
  const regole = leggi('REGOLE-FISSE.md')
  assert.match(regole, /## 10\. Quando c'è da decidere, prima e dopo nella STESSA immagine/)
  assert.match(regole, /mai in due file\s+separati/)
  assert.match(regole, /scripts\/revisioni\/confronto\.mjs/)
  const metodo = leggi('COLLABORAZIONE.md')
  assert.match(metodo, /regola fissa n\. 10/)
  assert.match(metodo, /UNA SOLA immagine/)
})
