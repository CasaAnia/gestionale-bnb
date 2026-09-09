// ANTEPRIMA NUOVA PRENOTAZIONE — dati sintetici (09/09/2026).
// Nessuna riga esce da qui: niente Supabase, niente rete. I nomi, i numeri e
// gli importi sono inventati e NON sono un listino.

export type Valutazione = 'ottimo' | 'normale' | 'problematico'
export type Provenienza = 'chiamata' | 'google' | 'whatsapp' | 'passaparola' | 'struttura' | 'non_so'

export type SoggiornoPassato = {
  id: string
  dal: string          // ISO
  al: string           // ISO
  camera: string
  ospiti: number
  totale: number       // quanto ha pagato davvero
  pieno?: number       // prezzo pieno, solo se c'era uno sconto
}

export type Cliente = {
  id: string
  nome: string
  cognome: string
  telefono: string
  valutazione: Valutazione
  ricevuta: boolean
  provenienza: Provenienza | null
  struttura?: string
  nota?: string
  motivo?: string      // perché è problematico
  soggiorni: SoggiornoPassato[]
}

export type Camera = { id: string; nome: string; tariffa: number; capienza: number }

export const CAMERE: Camera[] = [
  { id: 'ambra', nome: 'Ambra', tariffa: 70, capienza: 3 },
  { id: 'amelia', nome: 'Amelia', tariffa: 90, capienza: 3 },
  { id: 'allegra', nome: 'Allegra', tariffa: 90, capienza: 4 },
  { id: 'lena', nome: 'Lena', tariffa: 110, capienza: 5 },
]

export const STRUTTURE = ['Umana', 'Nida', 'Rosa Bianca', 'Elyse', 'Borgo Manzoni']

export const LETTI_TOTALI = 2          // i due letti aggiuntivi della struttura
export const LETTO_IMPORTO_INIZIALE = 10

export const CLIENTI: Cliente[] = [
  {
    id: 'c1', nome: 'Chiara', cognome: 'Bianchi', telefono: '+39 342 700 4354',
    valutazione: 'ottimo', ricevuta: true, provenienza: 'passaparola',
    nota: 'Camera sul cortile, non sulla strada.',
    soggiorni: [
      { id: 's1', dal: '2026-03-12', al: '2026-03-15', camera: 'Ambra', ospiti: 3, totale: 189, pieno: 210 },
      { id: 's2', dal: '2025-08-02', al: '2025-08-06', camera: 'Amelia', ospiti: 2, totale: 360 },
      { id: 's3', dal: '2024-09-09', al: '2024-09-14', camera: 'Allegra', ospiti: 4, totale: 640, pieno: 670 },
    ],
  },
  {
    id: 'c2', nome: 'Marco', cognome: 'Bianchini', telefono: '+39 340 118 2277',
    valutazione: 'normale', ricevuta: false, provenienza: 'google',
    soggiorni: [{ id: 's4', dal: '2025-05-04', al: '2025-05-06', camera: 'Lena', ospiti: 2, totale: 220 }],
  },
  {
    id: 'c3', nome: 'Luca', cognome: 'Biancardi', telefono: '+39 333 900 4412',
    valutazione: 'problematico', ricevuta: false, provenienza: 'chiamata',
    motivo: 'Ha fumato in camera e ha discusso alla partenza (agosto 2025).',
    soggiorni: [],
  },
  {
    id: 'c4', nome: 'Anna', cognome: 'Rossi', telefono: '+39 351 906 4160',
    valutazione: 'normale', ricevuta: false, provenienza: 'struttura', struttura: 'Umana',
    soggiorni: [{ id: 's5', dal: '2026-06-01', al: '2026-06-03', camera: 'Ambra', ospiti: 1, totale: 140 }],
  },
]

// Ricerca come quella di Calendario/Arrivi/Richieste: nome, cognome, nome e
// cognome, oppure telefono anche parziale, con o senza prefisso e spazi.
export function soloCifre(t: string) { return t.replace(/\D/g, '') }
export function normalizzaTelefono(t: string) {
  const c = soloCifre(t)
  return c.startsWith('0039') ? c.slice(4) : c.startsWith('39') && c.length > 10 ? c.slice(2) : c
}
export function cerca(testo: string, elenco: Cliente[] = CLIENTI): Cliente[] {
  const t = testo.trim().toLowerCase()
  if (!t) return []
  const cifre = normalizzaTelefono(t)
  return elenco.filter(c => {
    if (cifre.length >= 3 && normalizzaTelefono(c.telefono).includes(cifre)) return true
    const intero = `${c.nome} ${c.cognome}`.toLowerCase()
    return intero.includes(t) || c.nome.toLowerCase().startsWith(t) || c.cognome.toLowerCase().startsWith(t)
  })
}
