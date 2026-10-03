import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import authService from '../services/authService.js'
import { AUTH_STATES } from '../config/authorization.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [status, setStatus] = useState(AUTH_STATES.INITIALIZING)
  const [error, setError] = useState('')

  const restoreSession = useCallback(async () => {
    const stored = authService.getSession()
    if (!stored) {
      setSession(null)
      setStatus(AUTH_STATES.UNAUTHENTICATED)
      setError('')
      return null
    }

    setStatus(AUTH_STATES.INITIALIZING)
    try {
      const identity = await authService.getCurrent()
      const restored = { ...identity, token: stored.token }
      authService.saveSession(restored)
      setSession(restored)
      setStatus(AUTH_STATES.AUTHENTICATED)
      setError('')
      return restored
    } catch (requestError) {
      if (requestError.kind === AUTH_STATES.API_UNAVAILABLE) {
        setSession(stored)
        setStatus(AUTH_STATES.API_UNAVAILABLE)
        setError('The API is unavailable. Check the backend and retry.')
        return null
      }
      authService.clearSession()
      setSession(null)
      setStatus(AUTH_STATES.UNAUTHENTICATED)
      setError('')
      return null
    }
  }, [])

  useEffect(() => { restoreSession() }, [restoreSession])

  useEffect(() => {
    const invalidate = () => {
      authService.clearSession()
      setSession(null)
      setStatus(AUTH_STATES.UNAUTHENTICATED)
      setError('Your session has expired. Please sign in again.')
    }
    window.addEventListener('pharmacy:auth-invalid', invalidate)
    return () => window.removeEventListener('pharmacy:auth-invalid', invalidate)
  }, [])

  const login = async (type, credentials) => {
    const next = type === 'customer' ? await authService.customerLogin(credentials) : await authService.staffLogin(credentials)
    authService.saveSession(next)
    setSession(next)
    setStatus(AUTH_STATES.AUTHENTICATED)
    setError('')
    return next
  }
  const register = payload => authService.register(payload)
  const logout = () => {
    authService.clearSession()
    setSession(null)
    setStatus(AUTH_STATES.UNAUTHENTICATED)
    setError('')
    window.dispatchEvent(new CustomEvent('pharmacy:logout'))
  }
  return <AuthContext.Provider value={{ session, status, error, login, register, logout, retryAuth: restoreSession }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
