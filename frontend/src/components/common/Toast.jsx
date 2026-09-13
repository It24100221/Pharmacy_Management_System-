import React from 'react'
import { Check, AlertTriangle, AlertCircle, X } from './Icons.jsx'
import { useApp } from '../../context/AppContext.jsx'

const Toast = () => {
  const { toasts, dispatch } = useApp()

  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} dispatch={dispatch} />
      ))}
    </div>
  )
}

const ToastItem = ({ toast, dispatch }) => {
  const icons = {
    success: <Check size={20} />,
    error: <AlertCircle size={20} />,
    warning: <AlertTriangle size={20} />,
    info: <AlertCircle size={20} />,
  }

  return (
    <div className={`toast toast-${toast.type}`}>
      <span className="toast-icon">
        {icons[toast.type] || icons.info}
      </span>
      <div className="toast-content">
        <div className="toast-message">{toast.message}</div>
      </div>
      <button
        className="toast-close"
        onClick={() => dispatch({ type: 'REMOVE_TOAST', payload: toast.id })}
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
    </div>
  )
}

export default Toast
