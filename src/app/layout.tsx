import type { Metadata } from 'next'
import { Space_Grotesk, Archivo_Black } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const archivoBlack = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-head',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'TalkShowGo',
  description: 'AI show-maker control room',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${archivoBlack.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
