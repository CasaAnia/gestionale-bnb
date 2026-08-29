'use client'
// Involucro solo-client (come per l'anteprima 3A): il guscio si monta senza
// SSR così lo stato iniziale letto dall'URL è deterministico.
import dynamic from 'next/dynamic'

const Prova = dynamic(() => import('./Prova'), { ssr: false })
export default function NuoveSpeseClient() {
  return <Prova />
}
