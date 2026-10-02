import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import api from '../services/api.js'
import { getToken, setToken, clearToken } from '../utils/session.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  useEffect(() => {
    const token = getToken()
    if (!token) { setLoading(false); return }
    api.get('/auth/me')
      .then(response => setUser(response.data.data.user))
      .catch(() => logout())
      .finally(() => setLoading(false))
  }, [logout])

  const login = async (identifier, password) => {
    const response = await api.post('/auth/login', { identifier, password })
    const { token, user: signedInUser } = response.data.data
    setToken(token)
    setUser(signedInUser)
    return signedInUser
  }

  const register = async data => {
    const response = await api.post('/auth/register', data)
    return response.data
  }

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>
    {children}
  </AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth requires AuthProvider')
  return context
}
