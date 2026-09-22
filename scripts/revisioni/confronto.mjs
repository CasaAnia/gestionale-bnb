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
// QUANDO LA DIFFERENZA È PICCOLA (Ania, 21/09/2026: «non vedo nessuna
// differenza») due schermate intere non bastano: si ritagliano sulla zona
// che cambia e le si segna. Per questo ogni schermata può portare:
//   segna:x,y,l,a   un riquadro rosso tratteggiato sulla zona che cambia
//   nota:"…"        una riga di spiegazione sotto la colonna
//
// Uso:
//   node scripts/revisioni/confronto.mjs <uscita.png> "<domanda>" \
//        <a.png> "<etichetta A>" [segna:…] [nota:…] <b.png> "<etichetta B>" …
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
  const colonne = pezzi.map(p => {
    const segno = p.segna
      ? `<span class="segno" style="left:${p.segna[0]}px;top:${p.segna[1]}px;width:${p.segna[2]}px;height:${p.segna[3]}px"></span>`
      : ''
    const nota = p.nota ? `<p class="nota">${p.nota}</p>` : ''
    return `
    <figure style="width:${p.larghezza}px">
      <figcaption>${p.etichetta}</figcaption>
      <span class="telaio">
        <img src="${p.dati}" width="${p.larghezza}" height="${p.altezza}" alt="">${segno}
      </span>
      ${nota}
    </figure>`
  }).join('')
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><style>
  :root { --crema:#FBF9F4; --verde:#1F3D2F; --ottone:#A9884E; --filo:#E5DCCB }
  * { box-sizing: border-box }
  body { margin:0; padding:26px 26px 30px; background:var(--crema); font-family:'Nunito Sans',-apple-system,system-ui,sans-serif }
  h1 { margin:0 0 4px; font-family:Georgia,'Times New Roman',serif; font-weight:400; font-size:26px; line-height:1.25; color:var(--verde) }
  .sotto { margin:0 0 22px; font-size:13px; color:#7C857A }
  .fila { display:flex; gap:26px; align-items:flex-start }
  figure { margin:0; flex:0 0 auto }
  figure > .nota { width:100% }
  figcaption { margin-bottom:10px; font-size:12px; font-weight:700; letter-spacing:.8px; text-transform:uppercase; color:var(--ottone) }
  .telaio { position:relative; display:inline-block }
  img { display:block; border:1px solid var(--filo); border-radius:10px; background:#fff }
  .segno { position:absolute; border:2px dashed #C00000; border-radius:8px; pointer-events:none }
  .nota { margin:12px 0 0; max-width:100%; font-size:13.5px; line-height:1.4; color:var(--verde) }
  </style></head><body>
  <h1>${domanda}</h1>
  <p class="sotto">${pezzi.length > 2
    ? 'Le schermate sono affiancate senza ritocchi: guarda la differenza e dimmi quale preferisci.'
    : 'Le due schermate sono vere, prese dall’anteprima: guarda la differenza e dimmi quale preferisci.'}</p>
  <div class="fila">${colonne}</div>
  </body></html>`
}

function principale(argv) {
  const [uscita, domanda, ...resto] = argv
  if (!uscita || !domanda || resto.length < 4) {
    console.error('Uso: confronto.mjs <uscita.png> "<domanda>" <a.png> "<etichetta>" [segna:x,y,l,a] [nota:…] <b.png> "<etichetta>" […]')
    process.exit(1)
  }
  const pezzi = []
  for (const token of resto) {
    if (/\.png$/i.test(token)) {
      const file = path.resolve(token)
      const { larghezza, altezza } = misuraPng(file)
      // le schermate sono a due punti per pixel: si mostrano a metà misura
      pezzi.push({
        etichetta: '', segna: null, nota: '',
        larghezza: Math.round(larghezza / 2),
        altezza: Math.round(altezza / 2),
        dati: `data:image/png;base64,${readFileSync(file).toString('base64')}`,
      })
      continue
    }
    const ultimo = pezzi[pezzi.length - 1]
    if (!ultimo) { console.error(`«${token}» viene prima di una schermata`); process.exit(1) }
    if (token.startsWith('segna:')) ultimo.segna = token.slice(6).split(',').map(Number)
    else if (token.startsWith('nota:')) ultimo.nota = token.slice(5)
    else ultimo.etichetta = token
  }
  if (pezzi.length < 2) { console.error('servono almeno due schermate'); process.exit(1) }
  const cartella = mkdtempSync(path.join(tmpdir(), 'confronto-'))
  const html = path.join(cartella, 'confronto.html')
  writeFileSync(html, paginaConfronto(domanda, pezzi))

  const larghezza = pezzi.reduce((t, p) => t + p.larghezza, 0) + 26 * (pezzi.length + 1)
  // la nota va a capo dentro la colonna: si tiene conto delle righe che fa
  const righeNota = p => Math.ceil((p.nota?.length ?? 0) / Math.max(1, Math.floor(p.larghezza / 7.6)))
  const altezzaNote = Math.max(0, ...pezzi.map(p => (p.nota ? righeNota(p) * 19 + 16 : 0)))
  const altezza = Math.max(...pezzi.map(p => p.altezza)) + 130 + altezzaNote
  const esito = spawnSync(process.execPath, [
    path.join(QUI, 'schermata.mjs'), `file://${html}`, String(larghezza), String(altezza), path.resolve(uscita), '--attesa', '1200',
  ], { stdio: 'inherit' })
  rmSync(cartella, { recursive: true, force: true })
  process.exit(esito.status ?? 0)
}

if (process.argv[1] && process.argv[1].endsWith('confronto.mjs')) principale(process.argv.slice(2))
