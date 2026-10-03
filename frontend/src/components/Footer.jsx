import React from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'

const Footer = () => <footer className="customer-site-footer"><div className="customer-home-container customer-footer-inner"><Link to="/" className="customer-site-brand"><span><Plus size={21} strokeWidth={3} /></span><strong>Senevirathna<small>Medical Pharmacy</small></strong></Link><p>Quality care, trusted medicines, and a healthier community.</p><span>© {new Date().getFullYear()} Senevirathna Medical Pharmacy</span></div></footer>
export default Footer
