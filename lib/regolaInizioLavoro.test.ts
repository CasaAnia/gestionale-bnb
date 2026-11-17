// Regola d'inizio lavoro (17/11/2026): una sola copia pulita e aggiornata, una sessione alla volta su main.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const leggi = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

test('la regola d\'inizio lavoro sta in cima a CLAUDE.md e AGENTS.md, uguale', () => {
  const frase = /^\*\*Regola d'inizio lavoro \(17\/11\/2026\), per Claude Code, Codex e qualunque altra sessione:\*\* prima di toccare il codice, `git fetch`; la copia deve essere su `main` pulita e uguale a `origin\/main`\. Se è indietro o ha modifiche non registrate, fermati e non lavorare su quella copia\. Una sessione alla volta su `main`; mai due chat in parallelo sugli stessi file\./
  for (const f of ['CLAUDE.md', 'AGENTS.md']) assert.match(leggi(f), frase, `${f}: la regola deve essere la prima cosa`)
})

test('il registro condiviso ha il suo punto di ingresso in main (LEGGIMI.md), senza dati degli ospiti', () => {
  assert.ok(existsSync(new URL('../docs/collaborazione/LEGGIMI.md', import.meta.url)))
  const t = leggi('docs/collaborazione/LEGGIMI.md')
  assert.match(t, /STATO\.md/)
  assert.doesNotMatch(t, /\b3\d{9}\b|@[a-z0-9.-]+\.[a-z]{2,}/i, 'nessun telefono né email')
})
