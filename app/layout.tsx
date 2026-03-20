import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GIGA Dashboard - Prevaler',
  description: 'Directorio Médico - Sistema GIGA v3.0',
  keywords: 'médicos, directorio médico, Prevaler, GIGA, especialidades, sedes',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}