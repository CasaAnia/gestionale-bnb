// ============================================================================
// PROVENIENZA DELL'OSPITE (08/09/2026): «Come ci ha trovato» su richieste e
// prenotazioni. Valori fissi (google, passaparola, altra_struttura, non_so),
// nome della struttura solo con altra_struttura, elenco dei nomi noti con i
// suggerimenti ordinati per ospiti già portati. Funzioni pure, senza Supabase;
// le colonne arrivano con la proposta 0036 (prima: campo nascosto + avviso).
// ============================================================================

export type Provenienza = 'google' | 'passaparola' | 'altra_struttura' | 'non_so'
export const PROVENIENZE: { chiave: Provenienza; label: string }[] = [
  { chiave: 'google', label: 'Google' },
  { chiave: 'passaparola', label: 'Passaparola' },
  { chiave: 'altra_struttura', label: 'Altra struttura' },
  { chiave: 'non_so', label: 'Non so' },
]
export const PROVENIENZA_DEFAULT: Provenienza = 'non_so'
export const PROVENIENZA_DAL_SITO: Provenienza = 'google'
export const ETICHETTA_PROVENIENZA: Record<Provenienza, string> = Object.fromEntries(PROVENIENZE.map(p => [p.chiave, p.label])) as Record<Provenienza, string>

// I nomi già noti, precaricati anche dalla 0036 (stesso elenco)
export const STRUTTURE_NOTE = ['Umana', 'Nida', 'RB (Rosa Bianca)', 'Elyse', 'BM (Borgo Manzoni)']

export const AVVISO_0036 = 'Serve la migrazione 0036 (provenienza e strutture): il campo «Come ci ha trovato» sarà disponibile dopo'

export function normalizzaProvenienza(x: unknown): Provenienza {
  return PROVENIENZE.some(p => p.chiave === x) ? (x as Provenienza) : PROVENIENZA_DEFAULT
}

export type CampiProvenienza = { provenienza: Provenienza; struttura_nome: string | null }

// Dai valori del modulo ai campi da salvare: la struttura vale SOLO con «Altra struttura»
export function campiProvenienza(provenienza: unknown, struttura: string | null | undefined): CampiProvenienza {
  const p = normalizzaProvenienza(provenienza)
  const nome = (struttura ?? '').trim().replace(/\s+/g, ' ')
  return { provenienza: p, struttura_nome: p === 'altra_struttura' && nome ? nome : null }
}

// Colonne o tabella della 0036 assenti (PostgREST: colonna sconosciuta, tabella non in cache)
export function manca0036(e: { code?: string; message?: string } | null | undefined): boolean {
  if (!e) return false
  const codice = String(e.code ?? ''), msg = String(e.message ?? '')
  if (codice === 'PGRST205' || codice === '42P01') return /strutture/i.test(msg) || true
  return (codice === '42703' || codice === 'PGRST204') && /provenienza|struttura_nome/i.test(msg)
}
export const colonne0036Presenti = (riga: Record<string, unknown> | null | undefined) => !!riga && 'provenienza' in riga

// Suggerimenti mentre si scrive: i nomi noti che contengono il testo, ordinati
// per ospiti già portati (più in alto chi ne ha portati di più), poi per nome.
// Con testo vuoto: tutto l'elenco nello stesso ordine.
export type StrutturaNota = { nome: string; ospiti: number }
const piano = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

export function suggerimentiStrutture(testo: string, note: StrutturaNota[], massimo = 6): StrutturaNota[] {
  const t = piano(testo)
  return [...note]
    .filter(s => !t || piano(s.nome).includes(t))
    .sort((a, b) => b.ospiti - a.ospiti || a.nome.localeCompare(b.nome, 'it'))
    .slice(0, massimo)
}

// Il nome scritto è già fra i noti? (senza distinguere maiuscole e accenti)
export function strutturaNota(nome: string, note: { nome: string }[]): string | null {
  const t = piano(nome)
  return note.find(s => piano(s.nome) === t)?.nome ?? null
}

// Elenco dei noti con gli ospiti già portati, contati dalle prenotazioni
// (soggiorni con struttura_nome): ogni soggiorno una volta (group_id o id)
export function strutturePerOspiti(nomiNoti: string[], prenotazioni: { id: string; group_id?: string | null; provenienza?: string | null; struttura_nome?: string | null; status?: string }[]): StrutturaNota[] {
  const conteggio = new Map<string, Set<string>>()
  for (const b of prenotazioni) {
    if (b.status && b.status !== 'confermata' && b.status !== 'completata') continue
    if (b.provenienza !== 'altra_struttura' || !b.struttura_nome) continue
    const k = piano(b.struttura_nome)
    if (!conteggio.has(k)) conteggio.set(k, new Set())
    conteggio.get(k)!.add(b.group_id || b.id)
  }
  const nomi = [...nomiNoti]
  for (const b of prenotazioni) if (b.provenienza === 'altra_struttura' && b.struttura_nome && !strutturaNota(b.struttura_nome, nomi.map(n => ({ nome: n })))) nomi.push(b.struttura_nome.trim())
  return nomi.map(nome => ({ nome, ospiti: conteggio.get(piano(nome))?.size ?? 0 }))
}

// Alla conferma di una richiesta: i campi da copiare sulla prenotazione
export function campiDaCopiareAllaPrenotazione(r: { provenienza?: string | null; struttura_nome?: string | null }): CampiProvenienza {
  return campiProvenienza(r.provenienza, r.struttura_nome)
}

// Riga della richiesta dal modulo del sito: provenienza google in automatico
export function conProvenienzaDalSito<T extends Record<string, unknown>>(riga: T): T & CampiProvenienza {
  return { ...riga, provenienza: PROVENIENZA_DAL_SITO, struttura_nome: null }
}

// Testo per le schede: «Google» · «Altra struttura · Umana» · «Non so»
export function testoProvenienza(c: { provenienza?: string | null; struttura_nome?: string | null }): string {
  const p = normalizzaProvenienza(c.provenienza)
  return p === 'altra_struttura' && c.struttura_nome ? `${ETICHETTA_PROVENIENZA[p]} · ${c.struttura_nome}` : ETICHETTA_PROVENIENZA[p]
}

// Cosa mostrare sotto «Quale struttura» quando il campo è attivo (08/09/2026,
// difetto visto da Ania): con un nome già completo nel campo (es. «Nida») il
// filtro per testo lasciava solo Nida, esclusa perché uguale → nessun
// bottone. Regola: se il testo è un nome noto (o vuoto) si mostrano TUTTE le
// strutture nell'ordine dei suggerimenti; altrimenti quelle che contengono il
// testo, e se non ce n'è nessuna di nuovo tutte. `attuale` = il nome noto già
// nel campo, da evidenziare.
export function suggerimentiDaMostrare(testo: string, note: StrutturaNota[]): { lista: StrutturaNota[]; attuale: string | null } {
  const attuale = strutturaNota(testo, note)
  const tutte = suggerimentiStrutture('', note, note.length)
  if (attuale || !testo.trim()) return { lista: tutte, attuale }
  const filtrate = suggerimentiStrutture(testo, note, note.length)
  return { lista: filtrate.length ? filtrate : tutte, attuale: null }
}

// ── Provenienza SUL CLIENTE (0037, 08/09/2026) ──────────────────────────────
// La provenienza appartiene al cliente (guests.provenienza / struttura_nome):
// vale per tutte le sue prenotazioni, passate e future. Le prenotazioni la
// leggono dal cliente; le richieste tengono un valore provvisorio finché il
// cliente non esiste. Prima della 0037 il campo è nascosto con l'avviso.
export const AVVISO_0037 = 'Serve la migrazione 0037 (provenienza sul cliente): il campo «Come ci ha trovato» sarà disponibile dopo'
export const mancaColonneProvenienza = manca0036

export type ClienteProvenienza = { provenienza?: string | null; struttura_nome?: string | null } | null | undefined
export type PrenotazioneConCliente = { provenienza?: string | null; struttura_nome?: string | null; guests?: ClienteProvenienza }

// Il cliente ha le colonne della 0037?
export const clienteConProvenienza = (g: ClienteProvenienza): boolean => !!g && 'provenienza' in g

// Provenienza di una prenotazione: quella del cliente; se il cliente non ha
// ancora le colonne (prima della 0037) resta il valore vecchio sulla
// prenotazione (0036), altrimenti non_so
export function provenienzaDi(b: PrenotazioneConCliente): CampiProvenienza {
  if (clienteConProvenienza(b.guests)) return campiProvenienza(b.guests!.provenienza, b.guests!.struttura_nome)
  return campiProvenienza(b.provenienza, b.struttura_nome)
}

// Migrazione 0036 → cliente (stessa regola della bozza SQL): la provenienza
// della prenotazione PIÙ VECCHIA (check_in, poi created_at) che ne ha una
export function provenienzaClienteDaPrenotazioni(prenotazioni: { check_in: string; created_at?: string | null; provenienza?: string | null; struttura_nome?: string | null }[]): CampiProvenienza {
  const conProvenienza = prenotazioni
    .filter(b => normalizzaProvenienza(b.provenienza) !== 'non_so')
    .sort((a, b) => a.check_in.localeCompare(b.check_in) || String(a.created_at ?? '9999').localeCompare(String(b.created_at ?? '9999')))   // created_at nullo per ultimo, come in SQL
  return conProvenienza.length ? campiProvenienza(conProvenienza[0].provenienza, conProvenienza[0].struttura_nome) : { provenienza: PROVENIENZA_DEFAULT, struttura_nome: null }
}

// Modulo del sito: cliente nuovo → google; cliente esistente → resta la sua
export function provenienzaRichiestaDalSito(clienteEsistente: ClienteProvenienza): CampiProvenienza {
  if (!clienteEsistente) return { provenienza: PROVENIENZA_DAL_SITO, struttura_nome: null }
  return campiProvenienza(clienteEsistente.provenienza, clienteEsistente.struttura_nome)
}

// Alla conferma di una richiesta: cosa scrivere sul cliente della prenotazione
// creata. Se il cliente ha già una provenienza (diversa da non_so) resta la
// sua; altrimenti prende quella provvisoria della richiesta. null = nulla da scrivere.
export function daApplicareAlCliente(richiesta: { provenienza?: string | null; struttura_nome?: string | null }, cliente: ClienteProvenienza): CampiProvenienza | null {
  const dellaRichiesta = campiProvenienza(richiesta.provenienza, richiesta.struttura_nome)
  if (dellaRichiesta.provenienza === 'non_so') return null
  if (cliente && normalizzaProvenienza(cliente.provenienza) !== 'non_so') return null
  return dellaRichiesta
}

// Scheda cliente, sotto il nome: «da Nida · 4 soggiorni · 640 €»
export function testoFonte(c: { provenienza?: string | null; struttura_nome?: string | null }): string {
  const { provenienza, struttura_nome } = campiProvenienza(c.provenienza, c.struttura_nome)
  if (provenienza === 'altra_struttura') return struttura_nome ? `da ${struttura_nome}` : 'da altra struttura'
  if (provenienza === 'google') return 'da Google'
  if (provenienza === 'passaparola') return 'da passaparola'
  return 'provenienza non nota'
}
export function rigaCliente(c: { provenienza?: string | null; struttura_nome?: string | null }, soggiorniConclusi: number, ricaviCent: number): string {
  const euro = `${Math.round(ricaviCent / 100).toLocaleString('it-IT')} €`
  return `${testoFonte(c)} · ${soggiorniConclusi} ${soggiorniConclusi === 1 ? 'soggiorno' : 'soggiorni'} · ${euro}`
}
