// Conto economico del soggiorno: UNICA fonte per prezzo pieno, sconto e totale.
// La usano scheda, modifica (anteprima), WhatsApp, locandina, bonifico,
// statistiche e i salvataggi di total_amount, così non possono divergere.
//
// Due modi d'uso, decisi da cosa si passa:
//  - LETTURA: il record salvato COMPLETO di total_amount → per le prenotazioni
//    senza sconto (discount_type null) il totale salvato è autorevole: i dati
//    storici non vengono mai reinterpretati.
//  - RICALCOLO: i valori nuovi del form SENZA total_amount → il totale si
//    deriva dai dati. Va usato solo al salvataggio, e solo quando è cambiato
//    un campo economico (date, camera, ospiti, letto, tariffa, sconto).
//
// Lo sconto percentuale si arrotonda al centesimo UNA SOLA VOLTA, qui dentro:
// nessun altro componente deve rifare il calcolo.

export type ContoSoggiorno = {
  prezzoPieno: number
  sconto: number
  totale: number
  notti: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function calcNottiConto(checkIn?: string, checkOut?: string): number {
  if (!checkIn || !checkOut) return 0
  return Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
}

export function contoSoggiorno(b: {
  check_in?: string
  check_out?: string
  price_per_night?: number | string | null
  extra_bed_total?: number | string | null
  discount_type?: string | null
  discount_value?: number | string | null
  total_amount?: number | string | null
}): ContoSoggiorno {
  const notti = calcNottiConto(b.check_in, b.check_out)
  const pieno = round2(Number(b.price_per_night || 0) * Math.max(notti, 0) + Number(b.extra_bed_total || 0))
  const tipo = b.discount_type || null
  const valore = Number(b.discount_value)

  if (tipo === 'percentage' && valore > 0 && valore < 100 && pieno > 0) {
    const sconto = Math.round(pieno * valore) / 100
    return { prezzoPieno: pieno, sconto, totale: round2(pieno - sconto), notti }
  }
  if (tipo === 'target_total' && valore > 0 && valore < pieno) {
    return { prezzoPieno: pieno, sconto: round2(pieno - valore), totale: round2(valore), notti }
  }
  // Nessuno sconto valido: se c'è un totale salvato quello comanda (LETTURA),
  // altrimenti si deriva dai dati (RICALCOLO)
  const salvato = b.total_amount === undefined || b.total_amount === null ? null : Number(b.total_amount)
  const totale = salvato !== null && isFinite(salvato) ? round2(salvato) : pieno
  return { prezzoPieno: totale, sconto: 0, totale, notti }
}

// Somma dei pagamenti registrati e residuo da pagare: il conto del soggiorno
// non sa nulla dei pagamenti, il saldo si calcola sempre così, a parte
export function residuoDaPagare(totale: number, acconti: { amount: number | string }[] | null | undefined): number {
  const ricevuto = (acconti || []).reduce((s, a) => s + Number(a.amount || 0), 0)
  return round2(Math.max(0, totale - ricevuto))
}
