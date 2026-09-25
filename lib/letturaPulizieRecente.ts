// Una lettura lenta precedente a un rinvio non può sovrascrivere la lettura
// successiva al salvataggio. La chiusura invalida anche le risposte pendenti.
export function letturaPulizieRecente<T>(leggi: () => Promise<T>, pubblica: (dati: T) => void, errore: () => void) {
 let revisione = 0, aperta = true
 return {
  async ricarica() {
   if (!aperta) return
   const propria = ++revisione
   try { const dati = await leggi(); if (aperta && propria === revisione) pubblica(dati) }
   catch { if (aperta && propria === revisione) errore() }
  },
  chiudi() { aperta = false; revisione++ },
 }
}
