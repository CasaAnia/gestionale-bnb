// Orologio finto per provare che i test non dipendono dal giorno o dall'ora (17/11/2026).
// Uso: OROLOGIO_FINTO=2026-12-31T23:59:30+01:00 node --import ./scripts/prove/orologio-finto.mjs --test 'lib/**/*.test.ts'
// L'orologio parte dall'istante scelto e poi scorre normalmente: `new Date()` e `Date.now()` lo seguono.
const finto = process.env.OROLOGIO_FINTO
if (finto) {
  const inizio = Date.parse(finto)
  if (!Number.isFinite(inizio)) throw new Error(`OROLOGIO_FINTO non valido: ${finto}`)
  const Vera = Date
  const avvio = Vera.now()
  const adesso = () => inizio + (Vera.now() - avvio)
  class DateFinta extends Vera {
    constructor(...argomenti) { if (argomenti.length === 0) super(adesso()); else super(...argomenti) }
    static now() { return adesso() }
  }
  globalThis.Date = DateFinta
}
