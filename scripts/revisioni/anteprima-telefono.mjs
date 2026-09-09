#!/usr/bin/env node
// L'ANTEPRIMA APERTA DAL TELEFONO (09/09/2026).
//
// Uguale a anteprima-home-finta.mjs, ma il finto Supabase si affaccia
// sull'indirizzo di rete del Mac invece che su 127.0.0.1: dal telefono,
// «127.0.0.1» sarebbe il telefono stesso e il login non riuscirebbe.
// Resta tutto finto e tutto in casa: nessuna riga esce dalla rete locale.
import os from 'node:os'

function indirizzoDiRete() {
  for (const schede of Object.values(os.networkInterfaces())) {
    for (const s of schede || []) {
      if (s.family === 'IPv4' && !s.internal) return s.address
    }
  }
  return '127.0.0.1'
}

const ip = indirizzoDiRete()
process.env.HOST_FINTO = ip
console.log(`[anteprima dal telefono] apri  http://${ip}:3215/anteprima-nuova  (login con una mail qualsiasi)`)
await import('./anteprima-home-finta.mjs')
