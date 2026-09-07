// Ordine dei nomi (Ania, 07/09/2026): il cliente si mostra SEMPRE «Nome
// Cognome», mai «Cognome Nome», e nome e cognome li mette insieme SOLO
// lib/guestName (nomeCompleto, nomeBreve). Questo test legge i sorgenti e
// fallisce se da qualche parte torna una concatenazione fatta a mano:
//  - cognome prima del nome, in TypeScript (template, +, [a, b]) e in SQL (||);
//  - nome + cognome messi insieme fuori dalla funzione unica (TypeScript);
//  - un modulo con il campo Cognome prima del campo Nome.
// Le migrazioni SQL già applicate (0027, 0031) compongono «nome || ' ' ||
// cognome» dentro la RPC: lì la funzione TypeScript non può arrivare, quindi
// in SQL si controlla solo che il cognome non venga mai prima.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CARTELLE = ['app', 'components', 'lib', 'supabase', 'scripts']
const SORGENTE = /\.(ts|tsx|mjs|js|sql)$/
const SALTA = /(^|\/)(node_modules|\.next|\.git)(\/|$)/
const FUNZIONE_UNICA = 'lib/guestName.ts'
const QUESTO_TEST = 'lib/ordineNomi.test.ts'

function file(cartella: string): string[] {
  const out: string[] = []
  const visita = (d: string) => {
    for (const nome of readdirSync(d)) {
      const p = join(d, nome)
      if (SALTA.test(p)) continue
      if (statSync(p).isDirectory()) visita(p)
      else if (SORGENTE.test(nome)) out.push(p)
    }
  }
  visita(cartella)
  return out
}

const sorgenti = CARTELLE.flatMap(c => file(join(RADICE, c)))
  .map(p => relative(RADICE, p))
  .filter(p => p !== FUNZIONE_UNICA && p !== QUESTO_TEST)
  .sort()

const NOME = String.raw`[\w.?!]*\bnome\b`
const COGNOME = String.raw`[\w.?!]*\bcognome\b`
// cognome prima del nome: `${x.cognome} ${x.nome}`, cognome + ' ' + nome, [x.cognome, x.nome]
const COGNOME_PRIMA_TS = [
  new RegExp(String.raw`\$\{[^}]*\bcognome\b[^}]*\}[^$\n]*\$\{[^}]*\bnome\b`),
  new RegExp(String.raw`\bcognome\b[^\n;]*?\+\s*(?:['"\x60][^'"\x60\n]*['"\x60]\s*\+\s*)?${NOME}`),
  new RegExp(String.raw`\[\s*${COGNOME}\s*,\s*${NOME}\s*\]`),
]
// cognome prima del nome in SQL: cognome || ' ' || nome
const COGNOME_PRIMA_SQL = [new RegExp(String.raw`\bcognome\b[^\n]*\|\|[^\n]*\bnome\b`, 'i')]
// nome e cognome messi insieme a mano fuori da lib/guestName (solo TypeScript/JS)
const CONCATENAZIONE_A_MANO = [
  new RegExp(String.raw`\$\{[^}]*\bnome\b[^}]*\}[^$\n]*\$\{[^}]*\bcognome\b`),
  new RegExp(String.raw`\bnome\b[^\n;]*?\+\s*(?:['"\x60][^'"\x60\n]*['"\x60]\s*\+\s*)?${COGNOME}`),
  new RegExp(String.raw`\[\s*${NOME}\s*,\s*${COGNOME}\s*\]\s*\.\s*(?:join|map|filter)`),
]

function righeCheCombaciano(percorso: string, regole: RegExp[]): string[] {
  const righe = readFileSync(join(RADICE, percorso), 'utf8').split('\n')
  const trovate: string[] = []
  righe.forEach((riga, i) => {
    if (riga.trimStart().startsWith('//') || riga.trimStart().startsWith('--')) return   // commenti
    if (regole.some(r => r.test(riga))) trovate.push(`${percorso}:${i + 1}: ${riga.trim()}`)
  })
  return trovate
}

test('i sorgenti letti sono tanti e comprendono le cartelle giuste', () => {
  assert.ok(sorgenti.length > 100, `letti solo ${sorgenti.length} file`)
  for (const c of CARTELLE) assert.ok(sorgenti.some(p => p.startsWith(c + '/')), `nessun file in ${c}/`)
  assert.ok(!sorgenti.includes(FUNZIONE_UNICA))
})

test('mai «cognome + nome» fuori da lib/guestName (TypeScript, script e SQL)', () => {
  const trovate = sorgenti.flatMap(p => righeCheCombaciano(p, p.endsWith('.sql') ? COGNOME_PRIMA_SQL : COGNOME_PRIMA_TS))
  assert.deepEqual(trovate, [], `cognome prima del nome:\n${trovate.join('\n')}`)
})

test('nome e cognome li mette insieme SOLO nomeCompleto/nomeBreve di lib/guestName', () => {
  const trovate = sorgenti.filter(p => !p.endsWith('.sql')).flatMap(p => righeCheCombaciano(p, CONCATENAZIONE_A_MANO))
  assert.deepEqual(trovate, [], `concatenazione a mano (usare nomeCompleto):\n${trovate.join('\n')}`)
})

test('le regole scoprono davvero una concatenazione sbagliata', () => {
  const sbagliate = [
    '`${r.cognome} ${r.nome}`', "r.cognome + ' ' + r.nome", 'x.cognome + x.nome', '[c.cognome, c.nome].join(" ")',
    "coalesce(v_r.cognome, '') || ' ' || coalesce(v_r.nome, '')",
  ]
  for (const s of sbagliate) {
    const regole = s.includes('||') ? COGNOME_PRIMA_SQL : COGNOME_PRIMA_TS
    assert.ok(regole.some(r => r.test(s)), `non scoperta: ${s}`)
  }
  const aMano = ['`${p.nome} ${p.cognome}`', "nome + ' ' + cognome", '[c.nome, c.cognome].join(" ")']
  for (const s of aMano) assert.ok(CONCATENAZIONE_A_MANO.some(r => r.test(s)), `non scoperta: ${s}`)
  // un oggetto {nome, cognome} o una select non sono concatenazioni
  for (const s of ["{ nome: r.nome, cognome: r.cognome }", ".select('id, nome, cognome, arrivo')", 'nomeCompleto(r)']) {
    assert.ok(![...COGNOME_PRIMA_TS, ...CONCATENAZIONE_A_MANO].some(r => r.test(s)), `falso allarme: ${s}`)
  }
})

test('nei moduli il campo Nome viene prima del campo Cognome', () => {
  for (const modulo of ['components/richieste/ModuloRichiesta.tsx', 'components/CambiaCliente.tsx']) {
    const s = readFileSync(join(RADICE, modulo), 'utf8')
    const nome = s.indexOf('>Nome</p>'), cognome = s.indexOf('>Cognome</p>')
    assert.ok(nome > 0 && cognome > 0, `${modulo}: campi Nome/Cognome non trovati`)
    assert.ok(nome < cognome, `${modulo}: il campo Cognome viene prima del campo Nome`)
  }
})
