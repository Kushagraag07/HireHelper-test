'use client'

import React, { useState,useContext } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Card, CardContent, CardDescription,
  CardHeader, CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
   Mail, Lock, User, CheckCircle,
  AlertCircle, Eye, EyeOff, Shield, Sparkles
} from 'lucide-react'
import { AuthContext } from '@/context/AuthContext'

// Use same-origin proxy via Next.js rewrites. Ignore any external base URL.
const API = ''

export default function AuthPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '', password: '', name: ''
  })

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
const { setUser } = useContext(AuthContext) 
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (error) setError('')
  }

  function validate() {
    if (!formData.email || !formData.password) {
      setError('Email and password are required'); return false
    }
    if (!isLogin && !formData.name) {
      setError('Name is required for signup'); return false
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters'); return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address'); return false
    }
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true); setError(''); setSuccess('')
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup'
      const payload  = isLogin
        ? { email: formData.email, password: formData.password }
        : { email: formData.email, password: formData.password, name: formData.name }

      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const contentType = res.headers.get('content-type') || ''
      const data = contentType.includes('application/json') ? await res.json() : null

      if (res.ok) {
        setSuccess(data?.message || (isLogin ? 'Login successful' : 'User created'))
        setUser(data?.user ?? null)
        setTimeout(() => router.push('/dashboard'), 1500)
      } else {
        setError(data?.detail || `Request failed (${res.status})`)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-blue-50 to-cyan-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-cyan-400/20 to-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-xl relative overflow-hidden">
          {/* Decorative top border */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500"></div>
          
          <CardHeader className="text-center pb-8 pt-8">
            {/* Logo/Icon */}
            <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-violet-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Shield className="h-8 w-8 text-white" />
            </div>
            
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
              {isLogin ? 'Welcome Back' : 'Join Us'}
            </CardTitle>
            <CardDescription className="text-slate-600 text-base mt-2">
              {isLogin ? 'Sign in to continue your journey' : 'Create your account to get started'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 px-8 pb-8">
            {success && (
              <Alert className="border-emerald-200 bg-emerald-50/80 backdrop-blur-sm">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <AlertDescription className="text-emerald-800 font-medium">
                  {success}
                </AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert className="border-red-200 bg-red-50/80 backdrop-blur-sm">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800 font-medium">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-700 font-medium">Full Name</Label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-violet-500 transition-colors" />
                    <Input
                      id="name" name="name" type="text"
                      placeholder="Enter your full name"
                      value={formData.name}
                      onChange={handleChange}
                      className="pl-11 h-12 border-2 border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 rounded-xl transition-all duration-200 bg-white/70 backdrop-blur-sm"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 font-medium">Email Address</Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-violet-500 transition-colors" />
                  <Input
                    id="email" name="email" type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="pl-11 h-12 border-2 border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 rounded-xl transition-all duration-200 bg-white/70 backdrop-blur-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-violet-500 transition-colors" />
                  <Input
                    id="password" name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    className="pl-11 pr-11 h-12 border-2 border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 rounded-xl transition-all duration-200 bg-white/70 backdrop-blur-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-500 transition-colors p-1 rounded-md"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] mt-6"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>{isLogin ? 'Signing in...' : 'Creating account...'}</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                    <Sparkles className="h-4 w-4" />
                  </div>
                )}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white/90 text-slate-500">
                  {isLogin ? "Don't have an account?" : 'Already have an account?'}
                </span>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess('') }}
                className="text-violet-600 hover:text-violet-700 font-semibold transition-colors duration-200 hover:underline"
              >
                {isLogin ? 'Create new account' : 'Sign in instead'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}