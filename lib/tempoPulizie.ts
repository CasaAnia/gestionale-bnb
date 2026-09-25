export type Cronometro = { trascorsi: number; avviato: number | null }
export const secondiTrascorsi = (t: Cronometro, ora: number) => t.trascorsi + (t.avviato === null ? 0 : Math.max(0, Math.floor((ora - t.avviato) / 1000)))
export const fermaCronometro = (t: Cronometro, ora: number): Cronometro => ({ trascorsi: secondiTrascorsi(t, ora), avviato: null })
export const minutiCronometro = (t: Cronometro, ora: number) => Math.ceil(secondiTrascorsi(t, ora) / 60)
