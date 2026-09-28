// ============================================================================
// Le parole della conferma di salvataggio «B» (riferimento del 28/09/2026):
// «Salvato», sotto «Arrivo di Paolo Conti · 11:42» e «il foglio si chiude da
// solo fra un istante». Puro, si prova in Node.
// ============================================================================
export const SALVATO = 'Salvato'
export const CHIUSURA_DA_SOLA = 'il foglio si chiude da solo fra un istante'
export const DURATA_SALVATO_MS = 1200

/** L'ora di Roma, «11:42» */
export function oraSalvato(quando: Date): string {
  return new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }).format(quando)
}

/** «Arrivo di Paolo Conti · 11:42» */
export const testoSalvato = (cosa: string, quando: Date) => `${cosa} · ${oraSalvato(quando)}`

/** Cosa è stato salvato, in parole: una per foglio */
export const COSA_SALVATA = {
  arrivo: (nome: string) => `Arrivo di ${nome}`,
  pulizia: (camera: string) => `Pulizia di ${camera}`,
  pagamento: (nome: string) => `Pagamento di ${nome}`,
  rimandata: (camera: string) => `Pulizia di ${camera} rimandata`,
  saltata: (camera: string) => `Pulizia di ${camera} saltata`,
} as const
