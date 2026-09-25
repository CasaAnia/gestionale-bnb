import { type PrenotazionePulizie, NOTTI_CAMBIO, CUTOFF_STORICO, addDaysStr, type Decisione } from './pulizie.ts'
const SOGGIORNI_SENZA_CAMBIO = ['9d539f6d-85c8-4da6-9da6-7aaa74dce042']

export function stimeStoriche(rooms: {id: string}[], bookings: PrenotazionePulizie[], td: string, events: Decisione[] = []) {
  const pulizie: {roomId: string; date: string}[] = [], cambi: {roomId: string; date: string}[] = []
    // --- Stime per il passato (prima del confine) ---
    for (const room of rooms) {
      const own = bookings
        .filter(b => b.room_id === room.id && ['confermata', 'completata'].includes(b.status ?? ''))
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
        const ids = new Set(s.map(b => b.id))
        if (events.some(e => e.booking_id && ids.has(e.booking_id) && e.tipo !== 'soggiorno')) return
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
        // Una prossima data è una previsione, non la prova dei cambi passati.
        // Quando ci sono decisioni storiche conserviamo quelle: ricostruire
        // anche un calendario teorico conterebbe due volte i cambi rinviati.
        const ids = new Set(s.map(b => b.id))
        if (events.some(e => e.booking_id && ids.has(e.booking_id) && e.tipo === 'soggiorno'
          && (e.data_effettiva || e.data_prevista) < CUTOFF_STORICO)) continue
        for (let d = addDaysStr(inizio, NOTTI_CAMBIO); d < limite && d <= td; d = addDaysStr(d, NOTTI_CAMBIO)) {
          cambi.push({ roomId: room.id, date: d })
        }
      }
    }

  return { pulizie, cambi }
}
