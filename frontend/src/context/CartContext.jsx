import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { cartService, orderService } from '../services/apiService.js'

const CartContext = createContext(null)
const emptyCart = { cart_id: null, items: [], subtotal: 0, total_items: 0 }

export function CartProvider({ children }) {
  const { session } = useAuth()
  const [state, setState] = useState(emptyCart)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isCustomer = session?.role === 'CUSTOMER'

  const apply = useCallback(payload => {
    const cart = payload?.data || payload || emptyCart
    setState({ ...cart, items: cart.items || [], subtotal: Number(cart.subtotal || 0), total_items: Number(cart.total_items || 0) })
    setError('')
    return cart
  }, [])
  const refresh = useCallback(async () => {
    if (!isCustomer) { setState(emptyCart); return emptyCart }
    setLoading(true)
    try { return apply(await cartService.get()) }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load cart.'); throw requestError }
    finally { setLoading(false) }
  }, [apply, isCustomer])
  useEffect(() => { if (isCustomer) refresh().catch(() => {}); else setState(emptyCart) }, [isCustomer, refresh, session?.userId])
  const mutate = useCallback(async action => { setLoading(true); try { return apply(await action()) } catch (requestError) { setError(requestError.response?.data?.message || 'Cart update failed.'); throw requestError } finally { setLoading(false) } }, [apply])
  const addItem = product => mutate(() => cartService.add(product.productId, 1))
  const updateQuantity = (productId, quantity) => quantity < 1 ? mutate(() => cartService.remove(productId)) : mutate(() => cartService.update(productId, quantity))
  const removeItem = productId => mutate(() => cartService.remove(productId))
  const clear = () => mutate(() => cartService.clear())
  const checkout = async () => { setLoading(true); try { const response = await orderService.checkout(); setState(emptyCart); setError(''); return response.data } catch (requestError) { setError(requestError.response?.data?.message || 'Checkout failed.'); throw requestError } finally { setLoading(false) } }
  const value = useMemo(() => ({ cart: state.items, total: state.subtotal, itemCount: state.total_items, loading, error, refresh, addItem, updateQuantity, removeItem, clear, checkout }), [state, loading, error, refresh])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)
