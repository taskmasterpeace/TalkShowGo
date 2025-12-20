import type { Metadata } from 'next'
import { Space_Grotesk, Archivo_Black } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

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
  title: 'Talk Show Go',
  description: 'AI-powered content generation for talk shows, narratives, and storytelling',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${archivoBlack.variable}`}>
      <body className="font-sans antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
