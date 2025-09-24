import './globals.css'
import { AuthProvider } from '@/context/AuthContext'

export const metadata = {
  title: 'HireHelper',
  description: 'AI-Powered Interview Platform'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
