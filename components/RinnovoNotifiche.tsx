'use client'

import { useEffect } from 'react'

// Rinnovo automatico dell'iscrizione alle notifiche push.
//
// Gli "indirizzi" push rilasciati da Apple/Google scadono da soli, e quando
// succede lib/inviaPush.ts elimina (giustamente) l'iscrizione morta dal
// registro: senza questo componente si resta senza pop-up, in silenzio,
// finché non si riattiva a mano da Impostazioni (successo il 18/8/2026).
//
// Qui, a ogni apertura dell'app, se il permesso alle notifiche è già stato
// concesso ricreiamo l'iscrizione se manca e la risalviamo comunque sul
// server: se la riga era stata eliminata rinasce, se c'è già si aggiorna.

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export default function RinnovoNotifiche() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

    ;(async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')
        await navigator.serviceWorker.ready
        let sub = await reg.pushManager.getSubscription()
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          })
        }
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub),
        })
      } catch {
        // Silenzioso: se non riesce (es. offline) riproverà alla prossima apertura
      }
    })()
  }, [])

  return null
}
