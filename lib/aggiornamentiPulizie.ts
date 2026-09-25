// La stessa notifica invalida riepiloghi e recuperi in tutte le schede aperte.
// Il focus copre anche gli aggiornamenti fatti da un altro dispositivo.
export function osservaAggiornamentiPulizie(target: Pick<Window, 'addEventListener' | 'removeEventListener'>, aggiorna: () => void) {
  const eventi = ['pulizie-salvataggi', 'storage', 'focus'] as const
  for (const evento of eventi) target.addEventListener(evento, aggiorna)
  return () => { for (const evento of eventi) target.removeEventListener(evento, aggiorna) }
}
