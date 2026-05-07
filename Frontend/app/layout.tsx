import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { AuthWrapper } from '@/components/auth-provider';
import { I18nProvider } from '@/components/i18n-provider';

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Zambia Digital ID System',
  description: 'Official Zambia Digital Identity Management System — register, verify, and manage your digital identity.',
  generator: 'v0.app',
  icons: {
    icon: '/assets/zamren_logo.png',
    apple: '/assets/zamren_logo.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <I18nProvider>
          <AuthWrapper>
           {children}
          </AuthWrapper>
        </I18nProvider>
        <Analytics />
      </body>
    </html>
  )
}
