import { type PrenotazionePulizie, NOTTI_CAMBIO, CUTOFF_STORICO, addDaysStr } from './pulizie.ts'
const SOGGIORNI_SENZA_CAMBIO = ['9d539f6d-85c8-4da6-9da6-7aaa74dce042']

export function stimeStoriche(rooms: {id: string}[], bookings: PrenotazionePulizie[], td: string) {
  const pulizie: {roomId: string; date: string}[] = [], cambi: {roomId: string; date: string}[] = []
    // --- Stime per il passato (prima del confine) ---
    for (const room of rooms) {
      const own = bookings
        .filter(b => b.room_id === room.id)
        .sort((a, b) => a.check_in.localeCompare(b.check_in))
      // Unisce i prolungamenti in soggiorni continuativi
      const soggiorni: PrenotazionePulizie[][] = []
      for (const b of own) {
        const ultimo = soggiorni[soggiorni.length - 1]
        const coda = ultimo?.[ultimo.length - 1]
        if (coda && coda.guest_id && coda.guest_id === b.guest_id && coda.check_out === b.check_in) ultimo.push(b)
        else soggiorni.push([b])
      }
      // Una pulizia per ogni soggiorno concluso prima del confine (al cambio
      // ospite la pulizia c'è sempre stata). Dal confine in poi contano solo
      // le pulizie segnate davvero.
      const conclusi = soggiorni.filter(s => s[s.length - 1].check_out <= td && s[s.length - 1].check_out < CUTOFF_STORICO)
      conclusi.forEach(s => {
        const coda = s[s.length - 1]
        const cleanedAt = s.map(x => x.cleaned_at).filter(Boolean).sort().slice(-1)[0]
        let date = cleanedAt ? cleanedAt.slice(0, 10) : coda.check_out
        // Una pulizia segnata in ritardo non può cadere dopo l'arrivo dell'ospite
        // successivo: la camera era per forza già pulita a quell'arrivo
        const arrivoDopo = soggiorni[soggiorni.indexOf(s) + 1]?.[0]?.check_in
        if (arrivoDopo && date > arrivoDopo) date = arrivoDopo
        pulizie.push({ roomId: room.id, date })
      })
      for (const s of soggiorni) {
        if (s.some(x => SOGGIORNI_SENZA_CAMBIO.includes(x.id))) continue
        const inizio = s[0].check_in
        const fine = s[s.length - 1].check_out
        // Cambi stimati SOLO fino al confine: da lì in poi valgono le decisioni vere
        const limite = CUTOFF_STORICO < fine ? CUTOFF_STORICO : fine
        const linen = s.map(x => x.linen_next_date).filter(Boolean).sort().slice(-1)[0]
        if (linen) {
          for (let d = addDaysStr(linen, -NOTTI_CAMBIO); d > inizio; d = addDaysStr(d, -NOTTI_CAMBIO)) {
            if (d < limite && d <= td) cambi.push({ roomId: room.id, date: d })
          }
        } else {
          for (let d = addDaysStr(inizio, NOTTI_CAMBIO); d < limite && d <= td; d = addDaysStr(d, NOTTI_CAMBIO)) {
            cambi.push({ roomId: room.id, date: d })
          }
        }
      }
    }

  return { pulizie, cambi }
}
