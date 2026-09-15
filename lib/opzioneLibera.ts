// ============================================================================
// LIBERARE UNA CAMERA TENUTA, DAL CALENDARIO (15/09/2026, richiesta di Ania)
//
// Dal foglietto della barra tratteggiata Ania può fare due cose: liberare la
// camera e basta, oppure liberarla e aprire subito una prenotazione nuova per
// chi ha al telefono. In tutti e due i casi:
//
//  · la richiesta NON viene mai cancellata: cambia stato e resta in archivio,
//    con nome, telefono, date e prezzo proposto (Ania: «se dovessi mai
//    recuperarne una»);
//  · il motivo dice la verità, perché è quello che finisce nelle statistiche:
//    se la camera va a un altro cliente è «date assegnate a un altro», se la
//    liberi e basta è un rifiuto senza altra ragione;
//  · niente del vecchio accordo — prezzo, sconto, modo di pagare — viene
//    portato nella prenotazione nuova: quella parte da foglio bianco, con le
//    sole date che stavi guardando.
//
// Solo regole pure: la scrittura la fa la pagina del calendario.
// ============================================================================

/** Perché la camera viene liberata */
export type MotivoLibera = 'un_altro_cliente' | 'liberata'

export type ScritturaLibera = {
  stato: 'chiusa'
  chiusura_motivo: 'rifiutata'
  motivo_rifiuto: 'data_ad_altro' | 'altro'
  chiusa_at: string
}

/** I campi da scrivere sulla richiesta: pochi, e sempre gli stessi */
export function campiLibera(motivo: MotivoLibera, adesso: Date): ScritturaLibera {
  return {
    stato: 'chiusa',
    chiusura_motivo: 'rifiutata',
    motivo_rifiuto: motivo === 'un_altro_cliente' ? 'data_ad_altro' : 'altro',
    chiusa_at: adesso.toISOString(),
  }
}

/** Le date che passano alla prenotazione nuova: SOLO quelle (Ania, 15/09/2026) */
export function indirizzoPrenotazioneNuova(arrivo: string, partenza: string, ritorno = '/calendario'): string {
  const p = new URLSearchParams({ check_in: arrivo, check_out: partenza, returnTo: ritorno })
  return `/nuova?${p.toString()}`
}

export type TestoConferma = { titolo: string; righe: string[]; conferma: string }

/**
 * Il pop-up prima di toccare qualsiasi cosa. Dice per intero che cosa succede:
 * quale camera torna libera, che fine fa la richiesta e che cosa si apre dopo.
 */
export function testoConferma(
  dati: { camera: string; ospite: string; quando: string; prenotaDopo: boolean },
): TestoConferma {
  const righe = [
    `${dati.camera} torna libera ${dati.quando}.`,
    `La richiesta di ${dati.ospite} si chiude e resta in archivio: la ritrovi sempre nelle Richieste.`,
  ]
  if (dati.prenotaDopo) righe.push('Poi si apre una prenotazione nuova, tutta da compilare: restano solo le date.')
  return {
    titolo: 'Sei sicura?',
    righe,
    conferma: dati.prenotaDopo ? 'Sì, libera e prosegui' : 'Sì, libera la camera',
  }
}

/** «il 20 e il 21 settembre» / «dal 20 al 24 settembre» — per il pop-up */
export function quandoInParole(notti: string[]): string {
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
  const giorni = [...notti].sort()
  if (giorni.length === 0) return 'per quelle notti'
  const mese = (g: string) => MESI[Number(g.slice(5, 7)) - 1] ?? ''
  const numero = (g: string) => String(Number(g.slice(8, 10)))
  if (giorni.length === 1) return `il ${numero(giorni[0])} ${mese(giorni[0])}`
  if (giorni.length === 2) {
    const stessoMese = mese(giorni[0]) === mese(giorni[1])
    return stessoMese
      ? `il ${numero(giorni[0])} e il ${numero(giorni[1])} ${mese(giorni[1])}`
      : `il ${numero(giorni[0])} ${mese(giorni[0])} e il ${numero(giorni[1])} ${mese(giorni[1])}`
  }
  const primo = giorni[0], ultimo = giorni[giorni.length - 1]
  return mese(primo) === mese(ultimo)
    ? `dal ${numero(primo)} al ${numero(ultimo)} ${mese(ultimo)}`
    : `dal ${numero(primo)} ${mese(primo)} al ${numero(ultimo)} ${mese(ultimo)}`
}
