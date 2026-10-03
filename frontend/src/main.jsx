import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppProvider } from './context/AppContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { CartProvider } from './context/CartContext.jsx'
import App from './App.jsx'
import './styles/variables.css'
import './styles/global.css'
import './styles/pharmacy.css'
import './styles/customer.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider><AppProvider><App /></AppProvider></CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
