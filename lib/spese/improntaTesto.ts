// ============================================================================
// L'HASHER del contratto per browser e Node moderni: WebCrypto
// (crypto.subtle) su testo UTF-8 → SHA-256 esadecimale. È l'unico punto
// che tocca la piattaforma: nei test si può iniettare node:crypto.
// ============================================================================
import type { HasherTesto } from './contrattoRevisione.ts'

export const improntaSha256: HasherTesto = async (testo: string) => {
  const sunto = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(testo))
  return Array.from(new Uint8Array(sunto)).map(b => b.toString(16).padStart(2, '0')).join('')
}
