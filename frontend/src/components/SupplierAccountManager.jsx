import React, { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { supplySettingsService } from '../services/apiService.js'

export default function SupplierAccountManager() {
  const { suppliers, showToast } = useApp()
  const [accounts, setAccounts] = useState([])
  const [form, setForm] = useState({ user_id: '', supplier_id: '', username: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const load = async () => { try { setAccounts((await supplySettingsService.accounts()).data.accounts); setError('') } catch (e) { setError(e.response?.data?.message || 'Unable to load supplier accounts') } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  const submit = async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('')
    try {
      if (form.user_id) await supplySettingsService.linkAccount(Number(form.user_id), Number(form.supplier_id))
      else await supplySettingsService.createAccount({ username: form.username, password: form.password, supplier_id: Number(form.supplier_id) })
      setForm({ user_id: '', supplier_id: '', username: '', password: '' }); await load(); showToast('Supplier login linked to company', 'success')
    } catch (e) { setError(e.response?.data?.message || 'Unable to save supplier login') } finally { setBusy(false) }
  }
  return <section className="workflow-panel supplier-account-manager"><h2>Supplier login assignment</h2><p>Link each supplier login to its company so requests and notifications reach the correct supplier.</p>{error && <p role="alert" className="public-auth-error">{error}</p>}
    {loading ? <p>Loading supplier accounts…</p> : <><ul>{accounts.map(account => <li key={account.user_id}>{account.username} — {account.company_name || 'Not linked'}</li>)}</ul>
      <form onSubmit={submit}><fieldset disabled={busy} className="supply-form-grid">
        <label>Login<select className="form-control" value={form.user_id} onChange={event => setForm({ ...form, user_id: event.target.value })}><option value="">Create new supplier login</option>{accounts.filter(account => !account.supplier_id).map(account => <option key={account.user_id} value={account.user_id}>{account.username}</option>)}</select></label>
        <label>Supplier company<select className="form-control" required value={form.supplier_id} onChange={event => setForm({ ...form, supplier_id: event.target.value })}><option value="">Select company</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.company_name} (#{supplier.id})</option>)}</select></label>
        {!form.user_id && <><label>Username<input className="form-control" required pattern="[A-Za-z0-9_.-]{3,50}" autoComplete="off" value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} /></label><label>Password<input className="form-control" type="password" minLength="12" maxLength="72" required autoComplete="new-password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></label></>}
        <button className="btn btn-primary" type="submit">{busy ? 'Saving…' : 'Save supplier login'}</button>
      </fieldset></form></>}
  </section>
}
