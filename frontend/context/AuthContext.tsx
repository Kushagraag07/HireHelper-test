'use client'

import React, {
  createContext,
  useState,
  useEffect,
  ReactNode,
  Dispatch,
  SetStateAction
} from 'react'

interface User {
  id: string
  email: string
  name: string
  created_at: string
}

interface AuthContextType {
  user: User | null
  ready: boolean
  setUser: Dispatch<SetStateAction<User | null>>
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  ready: false,
  setUser: () => {}
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  // Use same-origin proxy via Next.js rewrites
  const API = ''

  useEffect(() => {
    fetch(`${API}/api/auth/me`, { credentials: 'include' })
      .then(async res => {
        if (!res.ok) throw new Error('unauthenticated')
        const contentType = res.headers.get('content-type') || ''
        if (!contentType.includes('application/json')) throw new Error('unexpected')
        return res.json()
      })
      .then((u: User) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setReady(true))
  }, [API])

  return (
    <AuthContext.Provider value={{ user, ready, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}
