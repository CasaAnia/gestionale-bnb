import type { ReactNode } from 'react'
import SezioneFogli from '@/components/maison/SezioneFogli'

// I fogli di questa sezione sono alti uguali (regola dei fogli, 01/10/2026)
export default function Layout({ children }: { children: ReactNode }) {
  return <SezioneFogli sezione="clienti">{children}</SezioneFogli>
}
