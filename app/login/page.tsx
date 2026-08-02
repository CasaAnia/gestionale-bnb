'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
      setErrore(
        error.message === 'Invalid login credentials'
          ? 'Email o password non corretti'
          : 'Non riesco ad accedere. Riprova tra un momento.'
      )
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
