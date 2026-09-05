// ============================================================================
// «DA DOVE ARRIVANO GLI OSPITI» (08/09/2026, sera): la provenienza è del
// CLIENTE (0037): ogni prenotazione la legge dal cliente, anche quelle
// vecchie. Per il periodo scelto una riga per fonte (ogni struttura per nome,
// Google, Passaparola, Non so) con clienti, soggiorni, di cui ritorni (cliente
// con un soggiorno concluso prima di quell'arrivo) e ricavi per soggiorno
// (lib/statistiche: competenza sulle notti nel periodo), ordinate per ricavi.
// Solo confermate; un soggiorno = group_id (cambio camera contato una volta).
// Sotto, «Strutture»: soggiorni e ricavi di ciascuna nell'anno in corso.
// ============================================================================
import { prenotazioneValida, type PrenotazioneStat } from './tipi.ts'
import { ricaviSoggiornoCent } from './intervallo.ts'
import { provenienzaDi, ETICHETTA_PROVENIENZA, clienteConProvenienza, type PrenotazioneConCliente, type Provenienza } from '../provenienza.ts'
import { eraGiaStato, type SoggiornoStorico } from '../clienteCheTorna.ts'

export type PrenotazioneProvenienza = PrenotazioneStat & SoggiornoStorico & PrenotazioneConCliente

export type RigaFonte = { chiave: string; label: string; clienti: number; soggiorni: number; ritorni: number; ricaviCent: number }
export type DaDoveArrivano = { righe: RigaFonte[]; totale: RigaFonte; colonnePresenti: boolean }

type Acc = { clienti: Set<string>; soggiorni: number; ritorni: number; ricaviCent: number }
const nuovoAcc = (): Acc => ({ clienti: new Set(), soggiorni: 0, ritorni: 0, ricaviCent: 0 })

// Soggiorni (gruppi) che toccano [da, a), con il primo segmento e i ricavi nel periodo
function soggiorniNelPeriodo(prenotazioni: PrenotazioneProvenienza[], da: string, a: string) {
  const gruppi = new Map<string, PrenotazioneProvenienza[]>()
  for (const b of prenotazioni.filter(prenotazioneValida)) {
    if (!(b.check_in < a && b.check_out > da)) continue
    const k = b.group_id || b.id
    if (!gruppi.has(k)) gruppi.set(k, [])
    gruppi.get(k)!.push(b)
  }
  return [...gruppi.entries()].map(([chiave, segmenti]) => ({
    chiave, segmenti,
    primo: [...segmenti].sort((x, y) => x.check_in.localeCompare(y.check_in))[0],
    ricaviCent: ricaviSoggiornoCent(segmenti, da, a),
  }))
}

const chiaveCliente = (b: PrenotazioneProvenienza) => b.guest_id || (b.guests?.phone ? `tel:${b.guests.phone}` : `nome:${(b.guest_name || b.guests?.full_name || '').toLowerCase()}`) || b.id
const chiaveFonte = (p: { provenienza: Provenienza; struttura_nome: string | null }) => (p.provenienza === 'altra_struttura' && p.struttura_nome ? `struttura:${p.struttura_nome.trim().toLowerCase()}` : p.provenienza)
const labelFonte = (p: { provenienza: Provenienza; struttura_nome: string | null }) => (p.provenienza === 'altra_struttura' && p.struttura_nome ? p.struttura_nome.trim() : p.provenienza === 'altra_struttura' ? 'Altra struttura (senza nome)' : ETICHETTA_PROVENIENZA[p.provenienza])

export function daDoveArrivano(prenotazioni: PrenotazioneProvenienza[], storico: SoggiornoStorico[], da: string, a: string): DaDoveArrivano {
  const fonti = new Map<string, { label: string; acc: Acc }>()
  const totale = nuovoAcc()
  let colonnePresenti = false
  for (const s of soggiorniNelPeriodo(prenotazioni, da, a)) {
    const p = provenienzaDi(s.primo)
    if (clienteConProvenienza(s.primo.guests) || 'provenienza' in s.primo) colonnePresenti = true
    const k = chiaveFonte(p)
    if (!fonti.has(k)) fonti.set(k, { label: labelFonte(p), acc: nuovoAcc() })
    const ritorno = eraGiaStato(s.primo, storico)
    for (const acc of [fonti.get(k)!.acc, totale]) {
      acc.clienti.add(chiaveCliente(s.primo))
      acc.soggiorni += 1
      if (ritorno) acc.ritorni += 1
      acc.ricaviCent += s.ricaviCent
    }
  }
  const riga = (chiave: string, label: string, acc: Acc): RigaFonte => ({ chiave, label, clienti: acc.clienti.size, soggiorni: acc.soggiorni, ritorni: acc.ritorni, ricaviCent: acc.ricaviCent })
  // Tutte le fonti fisse compaiono anche a zero; le strutture solo se hanno soggiorni
  for (const p of ['google', 'passaparola', 'non_so'] as Provenienza[]) if (!fonti.has(p)) fonti.set(p, { label: ETICHETTA_PROVENIENZA[p], acc: nuovoAcc() })
  const righe = [...fonti.entries()].map(([k, v]) => riga(k, v.label, v.acc))
    .sort((x, y) => y.ricaviCent - x.ricaviCent || y.soggiorni - x.soggiorni || x.label.localeCompare(y.label, 'it'))
  return { righe, totale: riga('totale', 'Totale', totale), colonnePresenti }
}

// «Strutture» nell'anno: soggiorni e ricavi di ciascuna struttura in [1 gen, 1 gen dopo)
export type RigaStruttura = { nome: string; soggiorni: number; ricaviCent: number }
export function struttureDellAnno(prenotazioni: PrenotazioneProvenienza[], anno: number): RigaStruttura[] {
  const out = daDoveArrivano(prenotazioni, [], `${anno}-01-01`, `${anno + 1}-01-01`)
  return out.righe.filter(r => r.chiave.startsWith('struttura:')).map(r => ({ nome: r.label, soggiorni: r.soggiorni, ricaviCent: r.ricaviCent }))
}
