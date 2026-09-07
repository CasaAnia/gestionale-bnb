#!/usr/bin/env node
// ============================================================================
// SCHERMATA DI UN'ANTEPRIMA FINTA con Chrome headless via CDP (07/09/2026).
// Il pannello del browser dell'app resta a volte nascosto (document.hidden):
// lì i confini Suspense di Next non si aprono. Qui Chrome è headless «nuovo»
// (documento visibile) e la misura del viewport si impone con
// Emulation.setDeviceMetricsOverride, che headless rispetta (--window-size no).
// Nessuna libreria: WebSocket nativo di Node ≥ 22.
//
// Uso:
//   node scripts/revisioni/schermata.mjs <url> <larghezza> <altezza> <file.png> [opzioni]
//   --login              fa il login sull'anteprima finta (qualsiasi email)
//   --prima "<js>"       JS (async, può usare await) eseguito dopo il caricamento, prima dello scatto
//   --leggi "<js>"       JS il cui valore (JSON) viene stampato su stdout dopo lo scatto
//   --intera             cattura tutta la pagina, non solo il viewport
//   --attesa <ms>        attesa dopo il caricamento (default 2500)
//   --ricarica "<js>"    dopo --prima ricarica la pagina, aspetta, esegue questo JS (prove di riapertura)
// Esempio:
//   node scripts/revisioni/schermata.mjs http://localhost:3214/richieste 390 844 /tmp/r.png --login \
//     --prima "document.querySelector('button').click()" --leggi "document.title"
// ============================================================================
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

function argomenti(argv) {
  const [url, w, h, file, ...resto] = argv
  const o = { url, width: Number(w), height: Number(h), file, login: false, prima: null, leggi: null, intera: false, attesa: 2500, ricarica: null }
  for (let i = 0; i < resto.length; i++) {
    const a = resto[i]
    if (a === '--login') o.login = true
    else if (a === '--intera') o.intera = true
    else if (a === '--prima') o.prima = resto[++i]
    else if (a === '--leggi') o.leggi = resto[++i]
    else if (a === '--attesa') o.attesa = Number(resto[++i])
    else if (a === '--ricarica') o.ricarica = resto[++i]
  }
  if (!url || !o.width || !o.height || !file) { console.error('Uso: schermata.mjs <url> <larghezza> <altezza> <file.png> [--login] [--prima js] [--leggi js] [--intera] [--attesa ms]'); process.exit(2) }
  return o
}

class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.attese = new Map(); this.eventi = []; ws.onmessage = e => this.ricevi(JSON.parse(e.data)) }
  ricevi(m) {
    if (m.id && this.attese.has(m.id)) { const { ok, ko } = this.attese.get(m.id); this.attese.delete(m.id); if (m.error) ko(new Error(m.error.message)); else ok(m.result); return }
    if (m.method) for (const f of this.eventi) f(m)
  }
  invia(method, params = {}, sessionId) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params, sessionId }))
    return new Promise((ok, ko) => this.attese.set(id, { ok, ko }))
  }
  aspetta(method, sessionId, ms = 15000) {
    return new Promise((ok, ko) => {
      const t = setTimeout(() => { this.eventi.splice(this.eventi.indexOf(f), 1); ko(new Error(`nessun ${method} entro ${ms} ms`)) }, ms)
      const f = m => { if (m.method === method && (!sessionId || m.sessionId === sessionId)) { clearTimeout(t); this.eventi.splice(this.eventi.indexOf(f), 1); ok(m.params) } }
      this.eventi.push(f)
    })
  }
}

const dormi = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const o = argomenti(process.argv.slice(2))
  const profilo = mkdtempSync(path.join(tmpdir(), 'schermata-'))
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profilo}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
  const wsUrl = await new Promise((ok, ko) => {
    let buf = ''
    chrome.stderr.on('data', d => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) ok(m[1]) })
    chrome.on('exit', c => ko(new Error(`Chrome uscito con codice ${c}`)))
    setTimeout(() => ko(new Error('Chrome non ha aperto la porta di debug')), 15000)
  })
  const ws = new WebSocket(wsUrl)
  await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko })
  const cdp = new Cdp(ws)
  try {
    const { targetId } = await cdp.invia('Target.createTarget', { url: 'about:blank' })
    const { sessionId: s } = await cdp.invia('Target.attachToTarget', { targetId, flatten: true })
    await cdp.invia('Page.enable', {}, s)
    await cdp.invia('Runtime.enable', {}, s)
    const mobile = o.width < 768
    await cdp.invia('Emulation.setDeviceMetricsOverride', { width: o.width, height: o.height, deviceScaleFactor: 2, mobile }, s)
    if (mobile) await cdp.invia('Emulation.setTouchEmulationEnabled', { enabled: true }, s)
    const valuta = async (js, awaitPromise = true) => {
      const r = await cdp.invia('Runtime.evaluate', { expression: `(async () => { ${js} })()`, awaitPromise, returnByValue: true }, s)
      if (r.exceptionDetails) throw new Error(`JS: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`)
      return r.result?.value
    }
    const vai = async url => {
      const carico = cdp.aspetta('Page.loadEventFired', s)
      await cdp.invia('Page.navigate', { url }, s)
      await carico
    }
    if (o.login) {
      const u = new URL(o.url)
      await vai(`${u.origin}/login?da=${encodeURIComponent(u.pathname + u.search)}`)
      await dormi(1500)
      await valuta(`
        const set = (el, v) => { const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; d.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
        const [e, p] = document.querySelectorAll('input'); set(e, 'revisione@locale'); set(p, 'finta')
        document.querySelector('button[type=submit], button').click()
        for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 250)); if (!location.pathname.startsWith('/login')) break }
        return location.href`)
      await dormi(1000)
      const dove = await valuta('return location.pathname + location.search')
      const voluto = new URL(o.url)
      if (dove !== voluto.pathname + voluto.search) await vai(o.url)
    } else {
      await vai(o.url)
    }
    await dormi(o.attesa)
    if (o.prima) await valuta(o.prima)
    if (o.ricarica !== null) {
      const carico = cdp.aspetta('Page.loadEventFired', s)
      await cdp.invia('Page.reload', {}, s)
      await carico
      await dormi(o.attesa)
      await valuta(o.ricarica)
    }
    const shot = await cdp.invia('Page.captureScreenshot', { format: 'png', captureBeyondViewport: o.intera }, s)
    writeFileSync(o.file, Buffer.from(shot.data, 'base64'))
    if (o.leggi) console.log(JSON.stringify(await valuta(o.leggi), null, 1))
    console.error(`schermata ${o.width}×${o.height} → ${o.file}`)
  } finally {
    ws.close()
    chrome.kill('SIGKILL')
    await new Promise(r => chrome.on('exit', r))
    for (let i = 0; i < 5; i++) { try { rmSync(profilo, { recursive: true, force: true }); break } catch { await dormi(200) } }
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
