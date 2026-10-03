import React, { createContext, useContext, useState } from 'react'
import authService from '../services/authService.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(authService.getSession)
  const login = async (type, credentials) => {
    const next = type === 'customer' ? await authService.customerLogin(credentials) : await authService.staffLogin(credentials)
    authService.saveSession(next); setSession(next); return next
  }
  const register = payload => authService.register(payload)
  const logout = () => { authService.clearSession(); setSession(null) }
  return <AuthContext.Provider value={{ session, login, register, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
