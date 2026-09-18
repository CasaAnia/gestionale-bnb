'use client'
// ============================================================================
// I CAMPI «NOME» E «COGNOME» DEL CLIENTE — UN SOLO COMPONENTE (18/09/2026).
//
// Regola fissa n. 1 (REGOLE-FISSE.md, Ania): nome e cognome partono con la
// maiuscola OVUNQUE, mentre si scrive. Tre volte la correzione era stata
// rifatta e persa, perché ogni modulo aveva i suoi <input> e un modulo nuovo
// nasceva senza. Da oggi i campi del nome sono SOLO qui: ogni modulo (cliente
// nuovo dell'inserimento, «Dati della cliente», «Cambia cliente», nuova e
// modifica richiesta, «Con lei», pagine vecchie dei clienti) monta questo
// componente, e lib/nomiOvunque.test.ts fallisce se da qualche parte
// ricompare un campo del nome fatto a mano.
//
// Cosa fa ogni campo:
//  - maiuscoleNelCampo (lib/maiuscole) nell'onChange: corregge il campo
//    tenendo il cursore e passa su il valore già giusto («mario rossi» →
//    «Mario Rossi», «d'angelo» → «D'Angelo», «anna-maria» → «Anna-Maria»);
//  - autoCapitalize="words" per la tastiera dell'iPhone;
//  - ordine fisso: prima Nome, poi Cognome (regola fissa n. 2).
//
// La VESTE la decide chi lo monta, con `avvolgi`: riceve l'etichetta e il
// campo e li mette nella sua riga (RigaCampo dell'inserimento, la <p> grigia
// delle Richieste, la <label> delle pagine vecchie). Senza `avvolgi` c'è la
// veste classica: <div><p>Etichetta</p>campo</div>.
//
// È un file .ts senza JSX (createElement) così i test lo importano e lo
// fanno girare davvero in Node: scrivo «mario rossi», leggo «Mario Rossi».
// ============================================================================
import { createElement, type CSSProperties, type ReactNode } from 'react'
import { maiuscoleNelCampo, type CampoTesto } from '../lib/maiuscole.ts'

export type EtichettaNome = 'Nome' | 'Cognome' | 'Nome e cognome' | (string & {})
export type Avvolgi = (etichetta: EtichettaNome, campo: ReactNode) => ReactNode

/** Gli attributi che OGNI campo del nome porta: tastiera iPhone in maiuscolo, niente suggerimenti */
export const ATTRIBUTI_CAMPO_NOME = { type: 'text', autoCapitalize: 'words', autoComplete: 'off' } as const

export const CLASSE_FILA = 'grid grid-cols-2 gap-2'
export const CLASSE_ETICHETTA = 'text-sm text-stone mb-1'

type Campo = {
  valore: string
  onValore: (valore: string) => void
  etichetta: EtichettaNome
  dati: string
  classeCampo?: string
  stile?: CSSProperties
  placeholder?: string
  autoFocus?: boolean
}

// L'unico <input> del nome di tutto il gestionale
function campoNome(c: Campo): ReactNode {
  return createElement('input', {
    ...ATTRIBUTI_CAMPO_NOME,
    value: c.valore,
    'data-campo': c.dati,
    'aria-label': c.etichetta,
    placeholder: c.placeholder,
    className: c.classeCampo,
    style: c.stile,
    autoFocus: c.autoFocus,
    onChange: (e: { target: CampoTesto }) => c.onValore(maiuscoleNelCampo(e.target)),
  })
}

function avvolgiClassico(classeEtichetta: string): Avvolgi {
  return function vesteClassica(etichetta, campo) {
    return createElement('div', { className: 'min-w-0' }, createElement('p', { className: classeEtichetta }, etichetta), campo)
  }
}

export type PropsCampiNomeCognome = {
  nome: string
  cognome: string
  onNome: (nome: string) => void
  onCognome: (cognome: string) => void
  /** come si mette l'etichetta attorno al campo; senza: <div><p>Etichetta</p>campo</div> */
  avvolgi?: Avvolgi
  /** la fila che tiene i due campi affiancati */
  classeFila?: string
  stileFila?: CSSProperties
  classeCampo?: string
  stile?: CSSProperties
  classeEtichetta?: string
  placeholderNome?: string
  placeholderCognome?: string
  /** data-campo="nome"/"cognome"; con prefisso «persona-» diventa persona-nome/persona-cognome */
  prefissoDati?: string
}

/** Nome e cognome affiancati: prima il nome, poi il cognome, sempre */
export default function CampiNomeCognome(p: PropsCampiNomeCognome): ReactNode {
  const avvolgi = p.avvolgi ?? avvolgiClassico(p.classeEtichetta ?? CLASSE_ETICHETTA)
  const prefisso = p.prefissoDati ?? ''
  return createElement('div', { className: p.classeFila ?? CLASSE_FILA, style: p.stileFila, 'data-campi-nome-cognome': '' },
    avvolgi('Nome', campoNome({ valore: p.nome, onValore: p.onNome, etichetta: 'Nome', dati: `${prefisso}nome`, classeCampo: p.classeCampo, stile: p.stile, placeholder: p.placeholderNome })),
    avvolgi('Cognome', campoNome({ valore: p.cognome, onValore: p.onCognome, etichetta: 'Cognome', dati: `${prefisso}cognome`, classeCampo: p.classeCampo, stile: p.stile, placeholder: p.placeholderCognome })),
  )
}

export type PropsCampoNomeCognome = {
  valore: string
  onValore: (valore: string) => void
  /** come si mette l'etichetta attorno al campo; senza: il campo da solo */
  avvolgi?: Avvolgi
  etichetta?: EtichettaNome
  classeCampo?: string
  stile?: CSSProperties
  placeholder?: string
  autoFocus?: boolean
  dati?: string
}

/**
 * Il campo unico «Nome e cognome» (guests.full_name, bookings.guest_name):
 * le pagine vecchie dei clienti e della prenotazione, i contatti aggiuntivi.
 * Stessa regola: maiuscola mentre si scrive e tastiera in maiuscolo.
 */
export function CampoNomeCognome(p: PropsCampoNomeCognome): ReactNode {
  const etichetta = p.etichetta ?? 'Nome e cognome'
  const campo = campoNome({ valore: p.valore, onValore: p.onValore, etichetta, dati: p.dati ?? 'nome-e-cognome', classeCampo: p.classeCampo, stile: p.stile, placeholder: p.placeholder, autoFocus: p.autoFocus })
  return p.avvolgi ? p.avvolgi(etichetta, campo) : campo
}
