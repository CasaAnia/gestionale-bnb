// Regole di sicurezza del gestionale (Fase 2A.1) — modello PURO della
// protezione installata dalla 0021: la stessa logica del trigger
// private.proteggi_ultimo_owner() e delle policy owner-only, testabile
// senza database.

export type Membro = { userId: string; role: 'owner' | 'member' }

// Il trigger della 0021: un owner non può essere eliminato o declassato se
// è l'ULTIMO — il gestionale non deve mai restare con zero proprietari.
export function modificaMembro(
  membri: Membro[],
  userId: string,
  azione: { tipo: 'rimuovi' } | { tipo: 'cambia_ruolo'; ruolo: 'owner' | 'member' },
): Membro[] {
  const m = membri.find(x => x.userId === userId)
  if (!m) throw new Error('Membro inesistente')
  const owners = membri.filter(x => x.role === 'owner').length
  const toglieOwner = m.role === 'owner' &&
    (azione.tipo === 'rimuovi' || azione.ruolo !== 'owner')
  if (toglieOwner && owners === 1) {
    throw new Error("Operazione negata: non si può eliminare o declassare l'ULTIMO owner.")
  }
  if (azione.tipo === 'rimuovi') return membri.filter(x => x.userId !== userId)
  return membri.map(x => x.userId === userId ? { ...x, role: azione.ruolo } : x)
}

// Le policy della 0021, in sintesi verificabile: chi può fare cosa.
export function puoAccedereAiDati(membri: Membro[], userId: string | null): boolean {
  // niente accesso anonimo; autenticato ma non in lista = niente
  return userId != null && membri.some(m => m.userId === userId)
}
export function puoGestireMembri(membri: Membro[], userId: string | null): boolean {
  return userId != null && membri.some(m => m.userId === userId && m.role === 'owner')
}
