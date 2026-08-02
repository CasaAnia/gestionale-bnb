'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Messaggi chiari al posto dell'inglese di Supabase. Il caso non previsto
// mostra il messaggio originale: nasconderlo dietro un "riprova" generico
// rende impossibile capire cosa è andato storto.
function traduciErrore(messaggio: string): string {
  const m = messaggio.toLowerCase()

  if (m.includes('invalid login credentials')) {
    return 'Email o password non corretti.'
  }
  if (m.includes('email not confirmed')) {
    return "Utente creato ma email non confermata. In Supabase, Authentication → Users, apri l'utente e confermalo (o ricrealo spuntando «Auto Confirm User»)."
  }
  if (m.includes('email logins are disabled') || m.includes('email provider')) {
    return 'Il login via email è disattivato in Supabase: Authentication → Providers → Email, attivalo.'
  }
  if (m.includes('too many requests') || m.includes('rate limit')) {
    return 'Troppi tentativi ravvicinati. Aspetta un minuto e riprova.'
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Non riesco a raggiungere il server. Controlla la connessione.'
  }

  return `Errore: ${messaggio}`
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function entra(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrore(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setErrore(traduciErrore(error.message))
      setLoading(false)
      return
    }

    // refresh() così il proxy rilegge il cookie appena scritto e smette di
    // rimandare al login.
    const destinazione = searchParams.get('da') || '/'
    router.replace(destinazione)
    router.refresh()
  }

  return (
    <form onSubmit={entra} className="w-full max-w-sm">
      <div className="text-center mb-8">
        <h1 className="font-serif text-3xl text-green-dark">Casa Ania</h1>
        <p
          className="text-[11px] uppercase mt-1"
          style={{ color: 'var(--color-brass)', letterSpacing: '2px' }}
        >
          Gestionale
        </p>
      </div>

      <div className="bg-white rounded-xl p-5 border border-card-border shadow-sm">
        <label className="block mb-4">
          <span className="text-xs text-gray-500 mb-1 block">Email</span>
          <input
            type="email"
            required
            autoComplete="username"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-card-border rounded-lg p-3 text-base focus:outline-none focus:border-green-mid"
          />
        </label>

        <label className="block mb-5">
          <span className="text-xs text-gray-500 mb-1 block">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-card-border rounded-lg p-3 text-base focus:outline-none focus:border-green-mid"
          />
        </label>

        {errore && (
          <p className="bg-[#F6E4DE] text-[#8C3B2E] rounded-lg px-3 py-2 text-sm mb-4">
            {errore}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-mid text-white rounded-xl py-3 font-semibold disabled:opacity-50"
        >
          {loading ? 'Accesso...' : 'Entra'}
        </button>
      </div>
    </form>
  )
}

export default function Login() {
  return (
    // fixed inset-0 per ignorare i margini che il layout riserva alla
    // navigazione, qui nascosta.
    <div className="fixed inset-0 bg-cream flex items-center justify-center p-6 z-50">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  )
}
