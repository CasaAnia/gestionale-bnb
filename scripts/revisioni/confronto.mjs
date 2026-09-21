#!/usr/bin/env node
// ============================================================================
// PRIMA E DOPO IN UNA SOLA IMMAGINE (Ania, 21/09/2026 sera).
//
// «Quando devo decidere qualcosa, sempre prima e dopo nella stessa
// immagine.» Due file separati non si possono guardare insieme: si apre
// uno, si chiude, si apre l'altro, e la differenza non si vede.
//
// Prende due (o tre) schermate già fatte e le mette affiancate, con sopra
// la domanda e sotto l'etichetta di ognuna. Le immagini non si ritoccano:
// si affiancano e basta, coi caratteri e i colori di casa.
//
// Uso:
//   node scripts/revisioni/confronto.mjs <uscita.png> "<domanda>" \
//        <a.png> "<etichetta A>" <b.png> "<etichetta B>" [<c.png> "<etichetta C>"]
//
// Esempio:
//   node scripts/revisioni/confronto.mjs /tmp/scelta.png "Il riquadro?" \
//     A.png "A · senza riquadro (adesso)" B.png "B · col riquadro grigio"
// ============================================================================
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const QUI = path.dirname(fileURLToPath(import.meta.url))

/** Larghezza e altezza di un PNG, dall'intestazione IHDR (niente librerie) */
export function misuraPng(file) {
  const b = readFileSync(file)
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) throw new Error(`non è un PNG: ${file}`)
  return { larghezza: b.readUInt32BE(16), altezza: b.readUInt32BE(20) }
}

/** La pagina che affianca le schermate: fondo crema, etichette in ottone */
export function paginaConfronto(domanda, pezzi) {
  const colonne = pezzi.map(p => `
    <figure>
      <figcaption>${p.etichetta}</figcaption>
      <img src="${p.dati}" width="${p.larghezza}" height="${p.altezza}" alt="">
    </figure>`).join('')
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><style>
  :root { --crema:#FBF9F4; --verde:#1F3D2F; --ottone:#A9884E; --filo:#E5DCCB }
  * { box-sizing: border-box }
  body { margin:0; padding:26px 26px 30px; background:var(--crema); font-family:'Nunito Sans',-apple-system,system-ui,sans-serif }
  h1 { margin:0 0 4px; font-family:Georgia,'Times New Roman',serif; font-weight:400; font-size:26px; line-height:1.25; color:var(--verde) }
  .sotto { margin:0 0 22px; font-size:13px; color:#7C857A }
  .fila { display:flex; gap:26px; align-items:flex-start }
  figure { margin:0; flex:0 0 auto }
  figcaption { margin-bottom:10px; font-size:12px; font-weight:700; letter-spacing:.8px; text-transform:uppercase; color:var(--ottone) }
  img { display:block; border:1px solid var(--filo); border-radius:10px; background:#fff }
  </style></head><body>
  <h1>${domanda}</h1>
  <p class="sotto">Le due schermate sono vere, prese dall’anteprima: guarda la differenza e dimmi quale preferisci.</p>
  <div class="fila">${colonne}</div>
  </body></html>`
}

function principale(argv) {
  const [uscita, domanda, ...resto] = argv
  if (!uscita || !domanda || resto.length < 4 || resto.length % 2 !== 0) {
    console.error('Uso: confronto.mjs <uscita.png> "<domanda>" <a.png> "<etichetta>" <b.png> "<etichetta>" [...]')
    process.exit(1)
  }
  const pezzi = []
  for (let i = 0; i < resto.length; i += 2) {
    const file = path.resolve(resto[i])
    const { larghezza, altezza } = misuraPng(file)
    // le schermate sono a due punti per pixel: si mostrano a metà misura
    pezzi.push({
      etichetta: resto[i + 1],
      larghezza: Math.round(larghezza / 2),
      altezza: Math.round(altezza / 2),
      dati: `data:image/png;base64,${readFileSync(file).toString('base64')}`,
    })
  }
  const cartella = mkdtempSync(path.join(tmpdir(), 'confronto-'))
  const html = path.join(cartella, 'confronto.html')
  writeFileSync(html, paginaConfronto(domanda, pezzi))

  const larghezza = pezzi.reduce((t, p) => t + p.larghezza, 0) + 26 * (pezzi.length + 1)
  const altezza = Math.max(...pezzi.map(p => p.altezza)) + 130
  const esito = spawnSync(process.execPath, [
    path.join(QUI, 'schermata.mjs'), `file://${html}`, String(larghezza), String(altezza), path.resolve(uscita), '--attesa', '1200',
  ], { stdio: 'inherit' })
  rmSync(cartella, { recursive: true, force: true })
  process.exit(esito.status ?? 0)
}

if (process.argv[1] && process.argv[1].endsWith('confronto.mjs')) principale(process.argv.slice(2))
