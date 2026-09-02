// Generazione del PNG dell'immagine WhatsApp (conferma e proposta): stessa
// resa (pixelRatio 2, sfondo carta) per entrambe. Solo browser.
import { toPng } from 'html-to-image'

export async function generaPng(el: HTMLElement, nomeFile: string): Promise<{ dataUrl: string; file: File }> {
  await document.fonts.ready
  const dataUrl = await toPng(el, { pixelRatio: 2, backgroundColor: '#f9f6f1', cacheBust: true })
  const blob = await (await fetch(dataUrl)).blob()
  return { dataUrl, file: new File([blob], nomeFile, { type: 'image/png' }) }
}

export const isIOS = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)
export const isMobile = () => isIOS() || (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent))

// Telefono: porta l'immagine nella galleria (iPhone: foglio di condivisione →
// «Salva immagine»; Android: download in galleria). Computer: download.
export async function salvaImmagine(el: HTMLElement, nomeFile: string): Promise<void> {
  const { dataUrl, file } = await generaPng(el, nomeFile)
  if (isIOS() && navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file] })
    return
  }
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// Computer: copia il PNG negli appunti (poi Cmd+V nella chat). Il pattern con
// la Promise dentro ClipboardItem è richiesto da Safari.
export async function copiaImmagine(el: HTMLElement, nomeFile: string): Promise<void> {
  try {
    const blobPromise = generaPng(el, nomeFile).then(r => r.file as Blob)
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })])
  } catch {
    const { file } = await generaPng(el, nomeFile)
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': file })])
  }
}
