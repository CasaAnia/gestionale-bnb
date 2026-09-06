// Collega in "catene" le prenotazioni dello stesso soggiorno con cambio camera: stesso group_id
// (condiviso da 2+ prenotazioni), oppure — in assenza di group_id — stesso ospite, camere diverse,
// date contigue o sovrapposte (ma non identiche: due camere nelle stesse identiche date sono una
// prenotazione multipla contemporanea, non un cambio camera).

export type ChangeEdge = { fromId: string; toId: string }

// "Taglio a incastro" delle barre di un soggiorno con cambio camera (usato da
// Calendario e Arrivi): il lato tagliato indica che il soggiorno prosegue
// (taglio a destra) o proviene (taglio a sinistra) da un'altra camera.
export function chainClipPath(cutLeft: boolean, cutRight: boolean): string {
  if (cutLeft && cutRight) return 'polygon(0 0, 100% 0, calc(100% - 12px) 100%, 12px 100%)'
  if (cutLeft) return 'polygon(0 0, 100% 0, 100% 100%, 12px 100%)'
  if (cutRight) return 'polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%)'
  return 'none'
}

export type ChangeGroups = {
  chainKeyOf: Record<string, string>
  edges: ChangeEdge[]
}

export function buildChangeGroups(bookings: any[]): ChangeGroups {
  const n = bookings.length
  const parent = Array.from({ length: n }, (_, i) => i)
  function find(x: number): number {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] }
    return x
  }
  function union(a: number, b: number) {
    a = find(a); b = find(b)
    if (a !== b) parent[a] = b
  }

  const byGroupId = new Map<string, number[]>()
  bookings.forEach((b, i) => {
    if (!b.group_id) return
    if (!byGroupId.has(b.group_id)) byGroupId.set(b.group_id, [])
    byGroupId.get(b.group_id)!.push(i)
  })
  byGroupId.forEach(idxs => { for (let k = 1; k < idxs.length; k++) union(idxs[0], idxs[k]) })
  const explicitGroupIds = new Set([...byGroupId.entries()].filter(([, idxs]) => idxs.length >= 2).map(([gid]) => gid))

  const byGuest = new Map<string, number[]>()
  bookings.forEach((b, i) => {
    if (!b.guest_id) return
    if (!byGuest.has(b.guest_id)) byGuest.set(b.guest_id, [])
    byGuest.get(b.guest_id)!.push(i)
  })
  byGuest.forEach(idxs => {
    for (let x = 0; x < idxs.length; x++) {
      for (let y = x + 1; y < idxs.length; y++) {
        const a = bookings[idxs[x]], b = bookings[idxs[y]]
        if (a.room_id === b.room_id) continue
        if (a.check_in === b.check_in && a.check_out === b.check_out) continue
        if (a.check_in <= b.check_out && b.check_in <= a.check_out) union(idxs[x], idxs[y])
      }
    }
  })

  const components = new Map<number, number[]>()
  bookings.forEach((_, i) => {
    const r = find(i)
    if (!components.has(r)) components.set(r, [])
    components.get(r)!.push(i)
  })

  const chainKeyOf: Record<string, string> = {}
  const edges: ChangeEdge[] = []

  components.forEach(idxs => {
    if (idxs.length < 2) return
    const sorted = idxs.map(i => bookings[i]).sort((a, b) => a.check_in.localeCompare(b.check_in))
    const hasChange = sorted.some((b, i) => i > 0 && b.room_id !== sorted[i - 1].room_id)
    const hasExplicitLink = sorted.some(b => b.group_id && explicitGroupIds.has(b.group_id))
    if (!hasChange && !hasExplicitLink) return
    const key = `chain-${[...sorted.map(b => b.id)].sort()[0]}`
    sorted.forEach(b => { chainKeyOf[b.id] = key })
    for (let i = 0; i < sorted.length - 1; i++) {
      edges.push({ fromId: sorted[i].id, toId: sorted[i + 1].id })
    }
  })

  return { chainKeyOf, edges }
}

// Spostamenti (cambi camera) la cui data di arrivo nella nuova camera cade in una delle date indicate
// (tipicamente oggi e domani), pronti per essere elencati in una riga riassuntiva.
export function getUpcomingRoomChanges(
  bookings: any[],
  roomNameById: Record<string, string>,
  dates: string[]
): { id: string; guest: string; fromRoom: string; toRoom: string; date: string }[] {
  const { edges } = buildChangeGroups(bookings)
  const byId = new Map(bookings.map(b => [b.id, b]))
  const moves = edges
    .map(e => {
      const from = byId.get(e.fromId)
      const to = byId.get(e.toId)
      if (!from || !to) return null
      if (!dates.includes(to.check_in)) return null
      return {
        id: `${e.fromId}-${e.toId}`,
        guest: to.guest_name || to.guests?.full_name || to.guests?.phone || '',
        fromRoom: roomNameById[from.room_id] || '',
        toRoom: roomNameById[to.room_id] || '',
        date: to.check_in,
      }
    })
    .filter((m): m is NonNullable<typeof m> => !!m)
  moves.sort((a, b) => a.date.localeCompare(b.date))
  return moves
}

// Colore del «pezzetto tagliato» (Ania, 06/09/2026): con più cambi camera nello
// stesso giorno, la parte obliqua della barra che parte e quella della barra che
// arriva hanno lo stesso colore, così si vede quale segue quale. Quattro tinte
// già in uso nel gestionale (ottone, oro scuro, oliva, ruggine), assegnate alle
// catene in ordine di data del primo segmento; oltre la quarta si ricomincia.
export const COLORI_CAMBIO = ['#A9884E', '#7A5C1E', '#5a6b3f', '#8a4f2f']

// id prenotazione → colore della sua catena (solo le prenotazioni con cambio camera)
type PrenotazioneCatena = { id: string; room_id: string; check_in: string; check_out: string; group_id?: string | null; guest_id?: string | null }
export function coloriCatene(bookings: PrenotazioneCatena[]): Record<string, string> {
  const { chainKeyOf } = buildChangeGroups(bookings)
  const inizio = new Map<string, string>()
  for (const b of bookings) {
    const k = chainKeyOf[b.id]
    if (!k) continue
    if (!inizio.has(k) || b.check_in < inizio.get(k)!) inizio.set(k, b.check_in)
  }
  const catene = [...inizio.entries()].sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]))
  const colore = new Map(catene.map(([k], i) => [k, COLORI_CAMBIO[i % COLORI_CAMBIO.length]]))
  const out: Record<string, string> = {}
  for (const b of bookings) { const k = chainKeyOf[b.id]; if (k) out[b.id] = colore.get(k)! }
  return out
}
