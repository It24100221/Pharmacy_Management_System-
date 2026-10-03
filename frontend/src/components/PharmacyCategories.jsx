import React from 'react'
import { Baby, HeartPulse, Microscope, Stethoscope } from 'lucide-react'
import { Link } from 'react-router-dom'

const categories = [['Medicine', 'Prescription medicines, OTC care, vitamins, and pain relief.', HeartPulse], ['Baby Items', 'Baby creams, shampoo, diapers, and gentle care products.', Baby], ['Lab Items', 'Testing equipment, laboratory supplies, and accessories.', Microscope], ['Medical Accessories', 'Thermometers, pressure machines, masks, and monitoring tools.', Stethoscope]]
const PharmacyCategories = () => <section className="customer-home-section customer-categories" id="pharmacy-items"><div className="customer-home-container"><div className="customer-section-heading"><div><p className="customer-eyebrow">PHARMACY ITEMS</p><h2>Everything you need,<br />in one place.</h2></div><Link className="customer-inline-link" to="/pharmacy-items">Browse all items <span>→</span></Link></div><div className="customer-category-grid">{categories.map(([name, description, Icon]) => <article key={name}><div className="customer-category-icon"><Icon size={26} /></div><h3>{name}</h3><p>{description}</p><Link to="/pharmacy-items">View Items <span>→</span></Link></article>)}</div></div></section>
export default PharmacyCategories
