import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SettingsProvider } from '@/components/app-settings'
import { SheetsProvider } from '@/components/action-sheet'
import './globals.css'

const _geist = Geist({ subsets: ['latin', 'latin-ext', 'cyrillic'] })
const _geistMono = Geist_Mono({ subsets: ['latin', 'latin-ext', 'cyrillic'] })

export const metadata: Metadata = {
  title: 'KingShot Assistant',
  description:
    'Tactical tools for Kingshot: troop calculators, a synchronised rally timer and an auto clicker.',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#090504',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <SettingsProvider>
          <SheetsProvider>{children}</SheetsProvider>
        </SettingsProvider>
        {process.env.NODE_ENV === 'production' && process.env.BUILD_TARGET !== 'android' && <Analytics />}
      </body>
    </html>
  )
}
