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

// Capienza massima di una camera con il letto aggiuntivo: le stesse soglie di
// tariffaCamera (Amelia parte da 1 posto, le altre da 2; il letto aggiunge 1,
// Lena arriva a 4). Senza letto aggiuntivo resta la capienza base.
export function capienzaBase(room: { name?: string | null } | null | undefined): number {
  return room?.name === 'Amelia' ? 1 : 2
}
export function capienzaCamera(room: { name?: string | null; has_extra_bed?: boolean | null } | null | undefined): number {
  const base = capienzaBase(room)
  if (!room?.has_extra_bed) return base
  return room.name === 'Lena' ? 4 : base + 1
}

// Se accanto al nome della camera va scritto "+ letto aggiuntivo".
// Per Lena MAI: la camera è già venduta come tripla, quindi "Tripla + letto aggiuntivo"
// sarebbe sbagliato (a 4 ospiti il letto in più compare comunque fra i costi).
// Per le altre camere si nomina solo quando viene davvero addebitato, così l'etichetta
// e la riga di costo compaiono sempre insieme.
export function lettoDaComunicare(seg: any): boolean {
  if (seg?.rooms?.name === 'Lena') return false
  return !!seg?.extra_bed && Number(seg?.extra_bed_total || 0) > 0
}

// Totale del letto aggiuntivo da salvare: 0 quando il letto non si addebita (Lena a 3)
export function totaleLetto(room: any, numOspiti: number, giorniLetto: number): number {
  const { lettoAddebitato } = tariffaCamera(room, numOspiti)
  if (!lettoAddebitato || giorniLetto <= 0) return 0
  return Number(room?.extra_bed_price || 0) * giorniLetto
}

// ── Il letto aggiuntivo a PREZZO FISSO (Ania, 28/09/2026) ──────────────────
// Nell'inserimento di una prenotazione il letto in più non si prezza più a
// mano: vale questo listino, UNA fonte sola per la notte scelta («Sì · 10 €»),
// il conto e il salvataggio. Lena in 3 è compreso (la tripla ha già tre
// posti: la notte però si segnala, «servono 3 posti in Lena»); in 4 si paga.
// Il vecchio «extra_bed_price» delle Impostazioni resta leggibile e lo usano
// ancora le pagine della scheda, non l'inserimento.
export const LETTO_AGGIUNTIVO_A_NOTTE = {
  Amelia: 5,
  Ambra: 10,
  Allegra: 10,
  LenaIn3: 0,
  LenaIn4: 10,
} as const

/** Quanto costa una notte col letto in più, in euro: 0 = compreso */
export function lettoAggiuntivoANotte(room: { name?: string | null } | null | undefined, numOspiti: number): number {
  const nome = room?.name ?? ''
  if (nome === 'Lena') return (Number(numOspiti) || 1) >= 4 ? LETTO_AGGIUNTIVO_A_NOTTE.LenaIn4 : LETTO_AGGIUNTIVO_A_NOTTE.LenaIn3
  if (nome === 'Amelia') return LETTO_AGGIUNTIVO_A_NOTTE.Amelia
  if (nome === 'Ambra') return LETTO_AGGIUNTIVO_A_NOTTE.Ambra
  if (nome === 'Allegra') return LETTO_AGGIUNTIVO_A_NOTTE.Allegra
  return 0
}
