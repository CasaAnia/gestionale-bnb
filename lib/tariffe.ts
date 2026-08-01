// Regole di tariffa e letti aggiuntivi delle 4 camere: UNICA fonte per prezzo a notte,
// letti occupati dal pool (in tutta la casa ce ne sono solo 2) e letto addebitato al
// cliente. La usano nuova prenotazione, modifica e conferme, così i tre punti non
// possono più divergere fra loro.
//
//  Amelia  (singola)       1 osp → 70 · 2 osp → 70 + 5 letto = 75, 1 letto dal pool
//  Allegra (matrimoniale) ≤2 osp → 80 · 3 osp → 80 + 10 letto = 90, 1 letto dal pool
//  Ambra   (matrimoniale) ≤2 osp → 80 · 3 osp → 80 + 10 letto = 90, 1 letto dal pool
//  Lena    (matrimoniale venduta come tripla)
//                         ≤2 osp → 80
//                          3 osp → 90 tutto compreso, 1 letto dal pool NON addebitato
//                          4 osp → 90 + 10 letto = 100, 2 letti dal pool
//
// Il terzo posto di Lena è un letto aggiuntivo vero e proprio: occupa il pool (serve a
// noi per sapere che è impegnato) ma al cliente non si comunica, perché la tripla è già
// venduta con tre posti letto.

export const EXTRA_BED_MAX = 2

export type TariffaCamera = {
  prezzoNotte: number      // tariffa della camera → campo price_per_night
  lettiPool: number        // letti impegnati dal pool: 0, 1 o 2
  lettoAddebitato: boolean // se true il letto va come voce a parte nelle conferme
}

export function tariffaCamera(room: any, numOspiti: number): TariffaCamera {
  const base = Number(room?.base_price || 0)
  const n = Number(numOspiti) || 1
  if (!room) return { prezzoNotte: base, lettiPool: 0, lettoAddebitato: false }

  // Lena: tripla con prezzo dedicato (double_price) e letto non addebitato fino a 3 ospiti
  if (room.name === 'Lena') {
    if (n <= 2) return { prezzoNotte: base, lettiPool: 0, lettoAddebitato: false }
    const tripla = Number(room.double_price || base)
    if (n === 3) return { prezzoNotte: tripla, lettiPool: 1, lettoAddebitato: false }
    return { prezzoNotte: tripla, lettiPool: 2, lettoAddebitato: true }
  }

  // Amelia parte da 1 posto, Allegra e Ambra da 2: oltre la capienza scatta il letto
  const capienza = room.name === 'Amelia' ? 1 : 2
  if (!room.has_extra_bed || n <= capienza) return { prezzoNotte: base, lettiPool: 0, lettoAddebitato: false }
  return { prezzoNotte: base, lettiPool: 1, lettoAddebitato: true }
}

// Totale del letto aggiuntivo da salvare: 0 quando il letto non si addebita (Lena a 3)
export function totaleLetto(room: any, numOspiti: number, giorniLetto: number): number {
  const { lettoAddebitato } = tariffaCamera(room, numOspiti)
  if (!lettoAddebitato || giorniLetto <= 0) return 0
  return Number(room?.extra_bed_price || 0) * giorniLetto
}
