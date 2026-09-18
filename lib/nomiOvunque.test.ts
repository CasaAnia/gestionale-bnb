// ============================================================================
// REGOLA FISSA n. 1 (REGOLE-FISSE.md, Ania, 18/09/2026): la maiuscola
// automatica su nome e cognome, OVUNQUE. Tre volte la correzione era stata
// fatta e persa (07/09 in /nuova; il 13/09 il modulo nuovo dell'inserimento
// è nato con campi suoi, senza). Questo file la blocca in tre modi:
//  1. la FUNZIONE (lib/maiuscole.conIniziali) con i casi difficili;
//  2. il COMPONENTE condiviso (components/CampiNomeCognome) fatto girare
//     davvero: scrivo «mario rossi», leggo «Mario Rossi» nel campo e nello
//     stato; e per OGNI modulo il dato che si salva;
//  3. le GUARDIE sui sorgenti: un campo del nome fuori dal componente, o un
//     full_name scritto senza nomeDaSalvare, fanno fallire la suite.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { conIniziali, conInizialiNomeCognome, conInizialiDigitando } from './maiuscole.ts'
import { nomeDaSalvare, nomeDaSalvareONull } from './guestName.ts'
import { campiNuovoCliente, campiDaModulo, type ModuloCliente } from './datiCliente.ts'
import { nuovoClienteDaModulo } from './cambiaCliente.ts'
import CampiNomeCognome, { CampoNomeCognome, ATTRIBUTI_CAMPO_NOME } from '../components/CampiNomeCognome.ts'

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const leggi = (p: string) => readFileSync(join(RADICE, p), 'utf8')
const COMPONENTE = 'components/CampiNomeCognome.ts'

// ── 1. La funzione ──────────────────────────────────────────────────────────
test('conIniziali: ogni parola con la maiuscola, apostrofi, trattini, spazi doppi', () => {
  assert.equal(conIniziali('mario rossi'), 'Mario Rossi')
  assert.equal(conIniziali("d'angelo"), "D'Angelo")
  assert.equal(conIniziali("arturo d’iorio"), "Arturo D’Iorio")      // apostrofo tipografico dell'iPhone
  assert.equal(conIniziali('de luca'), 'De Luca')
  assert.equal(conIniziali('anna-maria'), 'Anna-Maria')
  assert.equal(conIniziali('  anna   maria   de  luca '), 'Anna Maria De Luca')
  assert.equal(conIniziali('MARIO'), 'MARIO')                         // il resto non si tocca
  assert.equal(conIniziali('McDonald'), 'McDonald')
  assert.equal(conIniziali('łukasz'), 'Łukasz')
  assert.equal(conIniziali(''), '')
  assert.equal(conIniziali(null), '')
})

test('nomeDaSalvare: nome poi cognome, con la maiuscola, anche dal campo unico', () => {
  assert.equal(nomeDaSalvare({ nome: 'mario', cognome: 'rossi' }), 'Mario Rossi')
  assert.equal(nomeDaSalvare({ nome: ' anna-maria ', cognome: "d'angelo" }), "Anna-Maria D'Angelo")
  assert.equal(nomeDaSalvare({ nome: 'mario', cognome: '' }), 'Mario')
  assert.equal(nomeDaSalvare({ full_name: 'mario  rossi' }), 'Mario Rossi')
  assert.equal(nomeDaSalvareONull({ full_name: '   ' }), null)
  assert.equal(nomeDaSalvareONull({ nome: 'de', cognome: 'luca' }), 'De Luca')
})

test('conInizialiNomeCognome: nome e cognome della richiesta, il resto intatto', () => {
  const v = conInizialiNomeCognome({ nome: 'mario', cognome: 'rossi', arrivo: '2026-10-01', note: 'x' })
  assert.deepEqual(v, { nome: 'Mario', cognome: 'Rossi', arrivo: '2026-10-01', note: 'x' })
})

// ── 2. Il componente, fatto girare davvero ──────────────────────────────────
type Elemento = ReactElement<Record<string, unknown>>
function elementi(nodo: ReactNode, out: Elemento[] = []): Elemento[] {
  if (Array.isArray(nodo)) { for (const n of nodo) elementi(n, out); return out }
  if (!isValidElement(nodo)) return out
  const el = nodo as Elemento
  out.push(el)
  elementi(el.props.children as ReactNode, out)
  return out
}
const campi = (nodo: ReactNode) => elementi(nodo).filter(e => e.type === 'input')

// Un campo finto come quello del telefono: valore e cursore
function campoFinto(value: string) {
  const cursore: Array<[number, number]> = []
  return { value, selectionStart: value.length, selectionEnd: value.length, setSelectionRange: (a: number, b: number) => { cursore.push([a, b]) }, cursore }
}

test('CampiNomeCognome: prima Nome poi Cognome, tastiera in maiuscolo, «mario rossi» → «Mario Rossi» nel campo e nello stato', () => {
  const ricevuto: Record<string, string> = {}
  const albero = CampiNomeCognome({ nome: '', cognome: '', onNome: v => { ricevuto.nome = v }, onCognome: v => { ricevuto.cognome = v } })
  const [nome, cognome, ...altri] = campi(albero)
  assert.equal(altri.length, 0, 'ci sono più di due campi')
  assert.equal(nome.props['data-campo'], 'nome')
  assert.equal(cognome.props['data-campo'], 'cognome')
  for (const c of [nome, cognome]) {
    assert.equal(c.props.autoCapitalize, 'words')
    assert.equal(c.props.autoComplete, 'off')
    assert.equal(c.props.type, 'text')
  }
  assert.equal(ATTRIBUTI_CAMPO_NOME.autoCapitalize, 'words')

  const campoNome = campoFinto('mario')
  ;(nome.props.onChange as (e: { target: typeof campoNome }) => void)({ target: campoNome })
  assert.equal(campoNome.value, 'Mario', 'il campo non è stato corretto')
  assert.equal(ricevuto.nome, 'Mario')
  assert.deepEqual(campoNome.cursore, [[5, 5]], 'il cursore non è rimasto dov’era')

  const campoCognome = campoFinto("d'angelo")
  ;(cognome.props.onChange as (e: { target: typeof campoCognome }) => void)({ target: campoCognome })
  assert.equal(campoCognome.value, "D'Angelo")
  assert.equal(ricevuto.cognome, "D'Angelo")

  // le etichette, nell'ordine
  const testi = elementi(albero).filter(e => e.type === 'p').map(e => e.props.children)
  assert.deepEqual(testi, ['Nome', 'Cognome'])
})

test('CampiNomeCognome con la veste di chi lo monta (avvolgi): i campi restano quelli del componente', () => {
  const etichette: string[] = []
  const albero = CampiNomeCognome({
    nome: 'Anna', cognome: '', onNome: () => {}, onCognome: () => {}, prefissoDati: 'persona-',
    avvolgi: (etichetta, campo) => { etichette.push(etichetta); return campo },
  })
  assert.deepEqual(etichette, ['Nome', 'Cognome'])
  const [nome, cognome] = campi(albero)
  assert.equal(nome.props['data-campo'], 'persona-nome')
  assert.equal(cognome.props['data-campo'], 'persona-cognome')
  assert.equal(nome.props.value, 'Anna')
  assert.equal(nome.props.autoCapitalize, 'words')
})

test('CampoNomeCognome (campo unico «Nome e cognome»): stessa regola', () => {
  let stato = ''
  const albero = CampoNomeCognome({ valore: stato, onValore: v => { stato = v }, placeholder: 'Nome e cognome' })
  const [campo, ...altri] = campi(albero)
  assert.equal(altri.length, 0)
  assert.equal(campo.props.autoCapitalize, 'words')
  assert.equal(campo.props['aria-label'], 'Nome e cognome')
  const finto = campoFinto('mario rossi')
  ;(campo.props.onChange as (e: { target: typeof finto }) => void)({ target: finto })
  assert.equal(finto.value, 'Mario Rossi')
  assert.equal(stato, 'Mario Rossi')
  // e con la veste
  const conVeste = CampoNomeCognome({ valore: '', onValore: () => {}, etichetta: 'Nome cliente', avvolgi: (e, c) => [e, c] })
  assert.ok(Array.isArray(conVeste) && conVeste[0] === 'Nome cliente')
})

test('campo e valore salvato coincidono: quello che si vede nel campo è quello che va su Supabase', () => {
  for (const scritto of ['mario rossi', "anna d'angelo", 'anna-maria de luca', 'łukasz nowak']) {
    const nelCampo = conInizialiDigitando(scritto)
    assert.equal(nomeDaSalvare({ full_name: nelCampo }), nelCampo)
  }
})

// ── 3. Ogni modulo: il campo condiviso E il dato salvato ────────────────────
const MODULO_VUOTO: ModuloCliente = { nome: 'mario', cognome: 'rossi', telefono: '333 111 2222', email: '', ricevuta: false, valutazione: 'normale', motivo: '', provenienza: null, struttura: '', note: '' }

test('Nuova prenotazione → cliente nuovo: campi condivisi, e si salva «Mario Rossi»', () => {
  const modulo = leggi('components/nuova/NuovoCliente.tsx')
  assert.match(modulo, /import CampiNomeCognome from '@\/components\/CampiNomeCognome'/)
  assert.match(modulo, /<CampiNomeCognome nome=\{dati\.nome\} cognome=\{dati\.cognome\} onNome=\{nome => cambia\(\{ nome \}\)\} onCognome=\{cognome => cambia\(\{ cognome \}\)\}/)
  assert.match(leggi('app/nuova-prenotazione/page.tsx'), /campiNuovoCliente\(nuovo, struttureOk\)/)
  assert.equal(campiNuovoCliente(MODULO_VUOTO, false).full_name, 'Mario Rossi')
})

test('Scheda → «Dati della cliente»: lo stesso modulo, e si salva «Mario Rossi»', () => {
  assert.match(leggi('components/scheda/FoglioCliente.tsx'), /<NuovoCliente dati=\{dati\} onDati=\{setDati\}/)
  const m = campiDaModulo(MODULO_VUOTO, { phone: '333 111 2222' }, { colonnaRicevuta: true, conProvenienza: false })
  assert.ok(m.ok)
  assert.equal(m.campi.full_name, 'Mario Rossi')
})

test('Scheda → «Cambia cliente» → nuovo: lo stesso modulo, e si salva «Mario Rossi»', () => {
  const foglio = leggi('components/scheda/FoglioCambiaCliente.tsx')
  assert.match(foglio, /<NuovoCliente dati=\{nuovo\} onDati=\{setNuovo\}/)
  assert.match(foglio, /creaClienteNuovo\(campiNuovoCliente\(nuovo, strutture\.disponibile\)/)
  assert.equal(campiNuovoCliente({ ...MODULO_VUOTO, nome: "anna-maria", cognome: "d'angelo" }, false).full_name, "Anna-Maria D'Angelo")
})

test('Scheda vecchia → «Cambia cliente» → nuovo: campi condivisi, e si salva «Mario Rossi»', () => {
  const s = leggi('components/CambiaCliente.tsx')
  assert.match(s, /<CampiNomeCognome nome=\{modulo\.nome\} cognome=\{modulo\.cognome\}/)
  const m = nuovoClienteDaModulo({ nome: 'mario', cognome: 'rossi', telefono: '333 111 2222', provenienza: 'non_so', struttura: '' }, false)
  assert.ok(m.ok)
  assert.equal(m.campi.full_name, 'Mario Rossi')
})

test('Nuova richiesta e Modifica richiesta: campi condivisi, e nel punto unico di scrittura nome e cognome hanno la maiuscola', () => {
  const modulo = leggi('components/richieste/ModuloRichiesta.tsx')
  assert.match(modulo, /<CampiNomeCognome nome=\{v\.nome\} cognome=\{v\.cognome\} onNome=\{x => set\('nome', x\)\} onCognome=\{x => set\('cognome', x\)\}/)
  assert.match(modulo, /return conInizialiNomeCognome\(\{\n\s*nome: v\.nome, cognome: v\.cognome,/)
  const dati = leggi('lib/richiesteDati.ts')
  assert.match(dati, /export async function creaRichiesta\(v: ValoriModifica\)[^\n]*\n[^\n]*= conInizialiNomeCognome\(v\)/)
  assert.match(dati, /pianoModifica\(originale, conInizialiNomeCognome\(nuovi\)\)/)
  assert.match(leggi('app/richieste/nuova/page.tsx'), /creaRichiesta\(valori\)/)
  assert.match(leggi('app/richieste/[id]/modifica/page.tsx'), /aggiornaRichiesta\(richiesta, valori\)/)
  const v = conInizialiNomeCognome({ nome: 'mario', cognome: 'rossi', arrivo: '2026-10-01', partenza: '2026-10-03' })
  assert.equal(v.nome, 'Mario')
  assert.equal(v.cognome, 'Rossi')
})

test('Richieste in arrivo dal sito: la riga si scrive con nome e cognome in maiuscolo', () => {
  const route = leggi('app/api/richieste/web/route.ts')
  assert.match(route, /const riga: Record<string, unknown> = conInizialiNomeCognome\(\{\n\s*nome: d\.nome, cognome: d\.cognome,/)
  assert.equal(conInizialiNomeCognome({ nome: 'mario', cognome: 'rossi' }).cognome, 'Rossi')
})

test('«Con lei» (chi dorme con la cliente): campi condivisi, e il nome si compone con nomeDaSalvare', () => {
  const s = leggi('components/nuova/ConLei.tsx')
  assert.match(s, /<CampiNomeCognome nome=\{nome\} cognome=\{cognome\} onNome=\{setNome\} onCognome=\{setCognome\} prefissoDati="persona-"/)
  assert.match(s, /const completo = nomeDaSalvare\(\{ nome, cognome \}\)/)
})

test('Pagine vecchie (clienti/nuovo, scheda cliente, scheda prenotazione, /nuova): campo unico condiviso e nomeDaSalvareONull', () => {
  for (const [file, quanti] of [['app/clienti/nuovo/page.tsx', 1], ['app/clienti/[id]/page.tsx', 1], ['app/prenotazioni/[id]/page.tsx', 1], ['app/nuova/page.tsx', 3]] as [string, number][]) {
    const s = leggi(file)
    assert.equal((s.match(/<CampoNomeCognome /g) ?? []).length, quanti, `${file}: campi condivisi`)
    assert.match(s, /nomeDaSalvareONull\(\{ full_name: /, `${file}: salvataggio`)
  }
  assert.equal(nomeDaSalvareONull({ full_name: 'mario rossi' }), 'Mario Rossi')
})

// ── 4. Le guardie sui sorgenti ──────────────────────────────────────────────
const SALTA = /(^|\/)(node_modules|\.next|\.git)(\/|$)/
function file(cartella: string, sorgente: RegExp): string[] {
  const out: string[] = []
  const visita = (d: string) => {
    for (const nome of readdirSync(d)) {
      const p = join(d, nome)
      if (SALTA.test(p)) continue
      if (statSync(p).isDirectory()) visita(p)
      else if (sorgente.test(nome) && !/\.test\.tsx?$/.test(nome)) out.push(relative(RADICE, p))
    }
  }
  visita(join(RADICE, cartella))
  return out.sort()
}

// Un <input> o <textarea> il cui valore è un nome di persona
const CAMPO_DEL_NOME = /\b(?:value|defaultValue)=\{[^}]*\b(nome|cognome|full_name|guest_name)\b/
// Non sono persone: le eccezioni si dichiarano qui, col motivo
const NON_PERSONE: Record<string, string> = {
  'components/spese/RevisioneSheet.tsx': 'è il nome di una voce di spesa, non di una persona',
}
function campiFattiAMano(percorso: string): string[] {
  const s = leggi(percorso)
  const trovati: string[] = []
  for (const m of s.matchAll(/<(?:input|textarea)\b[\s\S]*?(?:\/>|>)/g)) {
    if (CAMPO_DEL_NOME.test(m[0])) trovati.push(`${percorso}:${s.slice(0, m.index).split('\n').length}: ${m[0].replace(/\s+/g, ' ').slice(0, 90)}`)
  }
  for (const m of s.matchAll(/(?<!document\.)createElement\(\s*['"]input['"]/g)) {
    trovati.push(`${percorso}:${s.slice(0, m.index).split('\n').length}: createElement('input') fuori dal componente condiviso`)
  }
  return trovati
}

test('GUARDIA: nessun campo Nome/Cognome fatto a mano fuori da components/CampiNomeCognome', () => {
  const sorgenti = [...file('app', /\.tsx?$/), ...file('components', /\.tsx?$/)].filter(p => p !== COMPONENTE)
  assert.ok(sorgenti.length > 50, `letti solo ${sorgenti.length} file`)
  const trovati = sorgenti.filter(p => !(p in NON_PERSONE)).flatMap(campiFattiAMano)
  assert.deepEqual(trovati, [], `campi del nome fuori dal componente condiviso (usare CampiNomeCognome / CampoNomeCognome):\n${trovati.join('\n')}`)
  // le eccezioni esistono davvero e sono ancora campi che non sono persone
  for (const p of Object.keys(NON_PERSONE)) assert.ok(campiFattiAMano(p).length > 0, `${p}: eccezione non più necessaria, toglierla`)
  // e la regola scopre davvero un campo sbagliato
  assert.ok(CAMPO_DEL_NOME.test('<input value={dati.nome} onChange={e => cambia({ nome: e.target.value })} />'))
  assert.ok(CAMPO_DEL_NOME.test('<input value={form.full_name || \'\'} />'))
  assert.ok(!CAMPO_DEL_NOME.test('<input value={dati.struttura_nome} />'))
  assert.ok(!CAMPO_DEL_NOME.test('<input value={ricerca} placeholder="Cerca per nome" />'))
})

// full_name scritto a mano: la seconda rete vale solo se OGNI scrittura passa da nomeDaSalvare
const RADICI_DI_MODULO = new Set(['form', 'editForm', 'modulo', 'nuovo', 'modifica', 'dati', 'm', 'v', 'valori'])
function scritturaSospetta(rigaOriginale: string): string | null {
  // dentro nomeDaSalvare({ full_name: … }) il full_name è l'ingresso, non la scrittura
  const riga = rigaOriginale.replace(/\bnomeDaSalvare(?:ONull)?\(\{[^}]*\}\)/g, 'nomeDaSalvareONull(…)')
  const i = riga.indexOf('full_name:')
  if (i < 0) return null
  // il valore: fino alla prima virgola o graffa chiusa allo stesso livello
  let profondita = 0, fine = riga.length
  for (let k = i + 'full_name:'.length; k < riga.length; k++) {
    const ch = riga[k]
    if (ch === '(' || ch === '{' || ch === '[') profondita++
    else if (ch === ')' || ch === '}' || ch === ']') { if (profondita === 0) { fine = k; break } profondita-- }
    else if (ch === ',' && profondita === 0) { fine = k; break }
  }
  const valore = riga.slice(i + 'full_name:'.length, fine).trim()
  if (/\bnomeDaSalvare(ONull)?\(/.test(valore)) return null
  if (valore === "''" || valore === 'null' || valore === '""') return null
  // una copia di un dato già salvato: solo catene che finiscono in .full_name / .guest_name
  const resto = valore.replace(/\bas\s+\w+/g, '').replace(/[A-Za-z_$][\w$]*(?:\?\.|\.)[\w$?.]*/g, catena => {
    const radice = catena.split(/\?\.|\./)[0]
    return /\.(full_name|guest_name)$/.test(catena) && !RADICI_DI_MODULO.has(radice) ? '' : ' SOSPETTO '
  })
  return /^[\s|?&:!()'"]*(null|undefined)?[\s|?&:!()'"]*$/.test(resto.replace(/\b(null|undefined)\b/g, '')) ? null : valore
}

test('GUARDIA: ogni full_name che si scrive passa da nomeDaSalvare (seconda rete)', () => {
  const sorgenti = [...file('app', /\.tsx?$/), ...file('components', /\.tsx?$/), ...file('lib', /\.ts$/)]
  const trovate: string[] = []
  for (const p of sorgenti) {
    leggi(p).split('\n').forEach((riga, n) => {
      if (riga.trimStart().startsWith('//') || /full_name\??:\s*(string|null)\b/.test(riga)) return   // commenti e tipi
      const v = scritturaSospetta(riga)
      if (v) trovate.push(`${p}:${n + 1}: full_name: ${v}`)
    })
  }
  assert.deepEqual(trovate, [], `full_name scritto senza nomeDaSalvare:\n${trovate.join('\n')}`)
  // la regola scopre davvero le scritture sbagliate…
  for (const s of ['full_name: form.full_name,', 'full_name: conInizialiONull(form.full_name), phone: x,', 'full_name: nomeCompleto({ nome: m.nome, cognome: m.cognome }),', 'full_name: conIniziali(m.nome),', 'full_name: dati.nome.trim() }']) {
    assert.ok(scritturaSospetta(s), `non scoperta: ${s}`)
  }
  // …e lascia passare quelle giuste e le copie di dati già salvati
  for (const s of ['full_name: nomeDaSalvareONull({ full_name: form.full_name }), phone: x,', 'full_name: nomeDaSalvare({ nome: m.nome, cognome: m.cognome }),', 'full_name: booking.guest_name || guest?.full_name || null }', "full_name: '', phone: ''", 'full_name: (g.full_name as string) ?? null, x: 1', 'full_name: b.guest_name || b.guests?.full_name }']) {
    assert.equal(scritturaSospetta(s), null, `falso allarme: ${s}`)
  }
})
