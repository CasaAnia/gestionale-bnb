// ============================================================================
// «DA CONTROLLARE» DELLA PROPOSTA (11/09/2026, veste approvata da Ania): le
// poche cose da guardare PRIMA di rispondere a una richiesta. Logica pura.
//
// Si mostrano soltanto le voci vere: se non ce n'è nessuna la pagina scrive
// una riga sola, «✓ Tutto a posto». Niente elenchi di «nessuna» (Ania).
//
//  · Stesse date — un'altra richiesta aperta vuole le stesse notti;
//  · Cliente che torna — è già stata qui, con l'ultimo soggiorno.
// ============================================================================
import { condividonoGiorni } from './richiesteCalendario.ts'
import { dalAl } from './richiesteTesti.ts'
import { elencoNotti, type DateRichiesta } from './nottiRichieste.ts'
import { periodoCompatto } from './dateItaliane.ts'
import type { SoggiorniDellaPersona } from './clienteCheTorna.ts'

export type VoceControllo = {
  chiave: string
  etichetta: string
  titolo: string
  dettaglio: string | null
  link: { testo: string; href: string } | null
}

export type RichiestaVicina = DateRichiesta & { id: string; nome: string; cognome?: string | null }

// «dal 29 al 31 ottobre», oppure le notti scelte una per una
const quandoRichiesta = (r: DateRichiesta): string =>
  r.notti_richieste ? `le notti del ${elencoNotti(r.notti_richieste)}` : dalAl(r.arrivo, r.partenza)

// Altre richieste APERTE che vogliono almeno una delle stesse notti. Chi
// chiama passa solo le aperte: qui non si guarda lo stato, si guardano le date.
export function vociStesseDate(richiesta: DateRichiesta & { id: string }, altre: RichiestaVicina[]): VoceControllo[] {
  return altre
    .filter(a => a.id !== richiesta.id && condividonoGiorni(richiesta, a))
    .map(a => ({
      chiave: `stesse_date_${a.id}`,
      etichetta: 'Stesse date',
      titolo: `Anche ${a.nome} ha chiesto ${quandoRichiesta(a)}`,
      dettaglio: 'se le proponi le stesse camere, una delle due resterà senza',
      link: { testo: `Apri la richiesta di ${a.nome}`, href: `/richieste?apri=${a.id}` },
    }))
}

// «È già stata qui 3 volte» con l'ultimo soggiorno. Senza soggiorni conclusi
// non compare nulla: un cliente nuovo non è una cosa da controllare.
export function voceClienteCheTorna(soggiorni: SoggiorniDellaPersona, hrefCliente: string | null): VoceControllo | null {
  if (soggiorni.volte <= 0) return null
  const u = soggiorni.ultimo
  const camere = u && u.camere.length ? `${u.camere.join(' → ')}, ` : ''
  const ospiti = u ? ` · ${u.ospiti} ${u.ospiti === 1 ? 'ospite' : 'ospiti'}` : ''
  return {
    chiave: 'cliente_torna',
    etichetta: 'Cliente che torna',
    titolo: soggiorni.volte === 1 ? 'È già stata qui 1 volta' : `È già stata qui ${soggiorni.volte} volte`,
    dettaglio: u ? `l'ultima: ${camere}${periodoCompatto(u.check_in, u.check_out, { anno: true })}${ospiti}` : null,
    link: hrefCliente ? { testo: 'Vedi i soggiorni', href: hrefCliente } : null,
  }
}
