export const TOKEN_KEY = 'pharmacy_session_token'

export function getToken(storage = sessionStorage) { return storage.getItem(TOKEN_KEY) }
export function setToken(token, storage = sessionStorage) { storage.setItem(TOKEN_KEY, token) }
export function clearToken(storage = sessionStorage) { storage.removeItem(TOKEN_KEY) }
