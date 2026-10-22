// ============================================================================
// «CHI DORME IN CAMERA»: una persona già in elenco si MODIFICA (Ania,
// 22/10/2026), non solo si toglie e si riscrive. Il foglietto riparte dai
// dati della persona (nome spezzato in Nome e Cognome per i due campi, «chi
// è» acceso sulla sua voce o, se non è fra le voci, su «Altro» col testo) e
// al salvataggio sostituisce SOLO quella persona, al suo posto: le altre e
// il loro ordine restano come sono. Funzioni pure.
// ============================================================================
import { spezzaNome } from './guestName.ts'
import { CHI_E_VOCI, type PersonaConLei } from './nuovaPrenotazione.ts'

export type PersonaInScrittura = { nome: string; cognome: string; telefono: string; chiE: string; libero: boolean }

/** I campi del foglietto: vuoti per una persona nuova, quelli della persona da modificare */
export function personaInScrittura(p?: PersonaConLei | null): PersonaInScrittura {
  if (!p) return { nome: '', cognome: '', telefono: '', chiE: '', libero: false }
  const { nome, cognome } = spezzaNome(p.nome)
  const chiE = (p.chiE ?? '').trim()
  const voce = CHI_E_VOCI.find(v => v.toLowerCase() === chiE.toLowerCase())
  return { nome, cognome, telefono: (p.telefono ?? '').trim(), chiE: voce ?? chiE, libero: !!chiE && !voce }
}

/** L'elenco con la persona `id` sostituita al suo posto; le altre identiche */
export function personaSostituita(persone: PersonaConLei[], id: string, dati: Omit<PersonaConLei, 'id'>): PersonaConLei[] {
  return persone.map(p => (p.id === id ? { ...p, ...dati } : p))
}
