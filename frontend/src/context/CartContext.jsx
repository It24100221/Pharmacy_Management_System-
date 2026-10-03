import React, { createContext, useContext, useEffect, useState } from 'react'

const CartContext = createContext(null)
const readCart = () => { try { return JSON.parse(localStorage.getItem('pharmacy_customer_cart')) || [] } catch { return [] } }

export function CartProvider({ children }) {
  const [cart, setCart] = useState(readCart)
  useEffect(() => {
    const clearForLogout = () => setCart([])
    window.addEventListener('pharmacy:logout', clearForLogout)
    return () => window.removeEventListener('pharmacy:logout', clearForLogout)
  }, [])
  const save = next => { setCart(next); localStorage.setItem('pharmacy_customer_cart', JSON.stringify(next)) }
  const addItem = medicine => {
    const existing = cart.find(item => item.medicineId === medicine.id)
    if (existing) return save(cart.map(item => item.medicineId === medicine.id ? { ...item, quantity: Math.min(item.quantity + 1, medicine.quantity) } : item))
    save([...cart, { medicineId: medicine.id, name: medicine.name, category: medicine.category, quantity: 1, unitPrice: medicine.unitPrice, availableQuantity: medicine.quantity, batchNumber: medicine.batchNumber }])
  }
  const updateQuantity = (medicineId, quantity) => quantity < 1 ? save(cart.filter(item => item.medicineId !== medicineId)) : save(cart.map(item => item.medicineId === medicineId ? { ...item, quantity: Math.min(quantity, item.availableQuantity) } : item))
  const removeItem = medicineId => save(cart.filter(item => item.medicineId !== medicineId))
  const clear = () => save([])
  const total = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  return <CartContext.Provider value={{ cart, addItem, updateQuantity, removeItem, clear, total }}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)
