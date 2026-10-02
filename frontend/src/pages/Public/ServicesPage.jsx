import React from 'react'
import { Link } from 'react-router-dom'

const services = [
  ['Medicine availability', 'Check listed medicines, prices and availability before contacting the pharmacy.'],
  ['Healthcare products', 'Browse baby items, lab items and medical accessories for everyday care.'],
  ['Prescription handling', 'Our pharmacy team can guide you when a medicine requires a valid prescription.'],
  ['Customer support', 'Get help identifying suitable products and understanding pharmacy information.'],
  ['Billing and purchases', 'Our team supports in-pharmacy purchases and clear billing for the items you receive.'],
]

export default function ServicesPage() {
  return <div className="pharmacy-container public-page">
    <span className="pharmacy-eyebrow">OUR SERVICES</span><h1>Here for your everyday health needs.</h1>
    <p className="public-page-lead">From medicine availability to everyday healthcare products, we make it easier to find information and connect with the pharmacy team.</p>
    <div className="public-info-grid">{services.map(([title, description]) => <article key={title}><h2>{title}</h2><p>{description}</p></article>)}</div>
    <Link className="pharmacy-button" to="/pharmacy-items">Browse Pharmacy Items</Link>
  </div>
}
