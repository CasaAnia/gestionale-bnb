#!/usr/bin/env node
// ============================================================================
// Collaudo contratto — PASSO 0b: la PASSWORD del database del progetto
// di prova (serve alle sessioni pg dei passi 4 e 5; il passo 0 salva
// solo ref e chiavi API). Canale: la solita procedura dei segreti —
// dashboard → reset database password → appunti → file locale
// ~/.gestionale-2b/db-pass.txt (600), MAI in chat/log/repo; il file si
// cancella a fine collaudo insieme al token.
// Questo passo la TRAVASA in progetto.json (600) e cancella il file.
// ============================================================================
import { readFileSync, rmSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { progetto, salvaProgetto } from '../fase2b/api.mjs'

const percorso = join(homedir(), '.gestionale-2b', 'db-pass.txt')
if (!existsSync(percorso)) {
  console.error(`STOP: manca ${percorso}.
Procedura (il file nasce PROTETTO prima che la password lo tocchi, e non
si sovrascrive mai un file esistente): dashboard del progetto di PROVA →
Settings → Database → Reset database password → copia negli appunti, poi
in un terminale:
  ( umask 077 && set -C && pbpaste > ${percorso} )
(umask 077: il file nasce 600; set -C: se esiste già la scrittura viene
RIFIUTATA — in quel caso verificarlo e cancellarlo, mai sovrascriverlo;
mai incollare la password in chat o in un comando visibile).`)
  process.exit(1)
}
const permessi = statSync(percorso).mode & 0o777
if (permessi !== 0o600) {
  console.error(`STOP: ${percorso} ha permessi ${permessi.toString(8)}, attesi 600 — il file va creato con umask 077 (vedi procedura), non protetto dopo.`)
  process.exit(1)
}
const password = readFileSync(percorso, 'utf8').trim()
if (!password) { console.error('STOP: file della password vuoto.'); process.exit(1) }
const p = progetto()
salvaProgetto({ ...p, db_pass: password })
rmSync(percorso)
console.log('Password del database salvata in progetto.json (600); file temporaneo cancellato. Ricorda: a fine collaudo va cambiata di nuovo dal dashboard.')
