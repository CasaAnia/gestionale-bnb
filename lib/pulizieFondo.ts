// Il fondo della pagina Pulizie · Oggi (riferimento approvato da Ania il
// 02/10/2026, docs/design/pulizie-fondo-riferimento.html): «Prossime pulizie»
// e «Rinvii e salti» come righe della pagina. Camera in grande, accanto il
// tipo in maiuscoletto grigio, a destra la data («sab 4 ott»), sotto chi parte
// o chi resta e «da fare». I rinvii attenuati: «Ambra · RIMANDATA · 1 → 2 ott
// · non conta fra le pulizie fatte» / «cambio saltato».
import { dataConGiorno, giornoMese, MESI_BREVI } from './dateItaliane.ts'
import type { TipoPulizia } from './pulizie.ts'

/** il tipo accanto al nome (la veste lo scrive in maiuscoletto) */
export const TIPO_PROSSIMA: Record<TipoPulizia, string> = { fine_soggiorno: 'fine soggiorno', soggiorno: 'biancheria 4 notti', cambio_camera: 'cambio camera' }

/** «sab 4 ott» */
export const dataProssima = (iso: string) => dataConGiorno(iso)

/** sotto il nome: «parte Giovanni Serra · da fare», «Lucia Ferri resta · da fare» */
export function sottoProssima(tipo: TipoPulizia, ospite: string, rimandata: boolean): string {
  return `${tipo === 'soggiorno' ? `${ospite} resta` : `parte ${ospite}`}${rimandata ? ' · rimandata' : ''} · da fare`
}

/** «1 → 2 ott», «30 set → 2 ott» */
export function daA(dal: string, al: string): string {
  const [ya, ma, da] = dal.split('-').map(Number), [yz, mz, dz] = al.split('-').map(Number)
  if (ya === yz && ma === mz) return `${da} → ${dz} ${MESI_BREVI[mz - 1]}`
  return `${giornoMese(dal)} → ${giornoMese(al)}`
}

export type RigaRinvio = { tipo: string; data: string; sotto: string }
export function rigaRinvio(d: { stato: string; data_prevista: string; prossima_data?: string | null }): RigaRinvio {
  return d.stato === 'rimandata'
    ? { tipo: 'rimandata', data: daA(d.data_prevista, d.prossima_data ?? d.data_prevista), sotto: 'non conta fra le pulizie fatte' }
    : { tipo: 'cambio saltato', data: giornoMese(d.data_prevista), sotto: 'non conta fra le pulizie fatte' }
}

export const NOTA_FONDO = 'I tempi dei giorni passati si correggono dal Registro, toccando la riga degli spazi comuni.'
