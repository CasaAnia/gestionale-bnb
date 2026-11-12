// La data in cima alla Home «Maison» («Giovedì 12 novembre 2026»), in un
// modulo puro così si prova con `npm test`. La data arriva SEMPRE dal
// chiamante: il componente la calcola nel browser dopo il caricamento
// (12/11/2026: la Home mostrava il giorno dell'ultima pubblicazione, perché
// il testo nasceva alla costruzione della pagina sul server e
// suppressHydrationWarning lo lasciava lì).

/** «Lunedì 28 settembre 2026», nel fuso di Roma */
export function dataStriscia(d: Date): string {
  const t = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// Ogni quanto ricontrollare la data con la pagina aperta (cambio di giorno
// a mezzanotte): stesso ritmo della pagina Pulizie (30 s).
export const RICONTROLLO_DATA_MS = 30000
