import React from 'react'
import { Link } from 'react-router-dom'

const categories = [
  ['Medicine', 'Medicines and everyday health essentials'],
  ['Baby Items', 'Gentle care for growing families'],
  ['Lab Items', 'Supplies for health and testing'],
  ['Medical Accessories', 'Useful tools for care at home'],
]

export default function Dashboard() {
  return <div className="pharmacy-home public-home">
    <section className="pharmacy-hero">
      <img className="pharmacy-hero-photo" src="/images/pharmacy-hero.png" alt="" width="1536" height="1024" />
      <div className="pharmacy-container pharmacy-hero-inner">
        <div className="pharmacy-hero-copy">
          <span className="pharmacy-eyebrow">SENEVIRATHNA MEDICAL PHARMACY</span>
          <h1>Better Care.<br />Smarter Pharmacy.</h1>
          <p>Your trusted pharmacy for medicines, healthcare products and convenient services, with clear information to help you find what you need.</p>
          <div className="pharmacy-hero-actions">
            <Link className="pharmacy-button" to="/pharmacy-items">Explore Pharmacy Items</Link>
            <Link className="pharmacy-text-link" to="/about">Learn More</Link>
          </div>
        </div>
      </div>
    </section>
    <section className="pharmacy-container public-section" aria-labelledby="shop-heading">
      <div className="public-section-heading"><div><span className="pharmacy-eyebrow">FIND WHAT YOU NEED</span><h2 id="shop-heading">Explore our pharmacy items</h2></div><Link to="/pharmacy-items">View all items →</Link></div>
      <div className="public-category-grid">{categories.map(([name, description]) =>
        <Link className="public-category-card" to={`/pharmacy-items?type=${encodeURIComponent(name)}`} key={name}>
          <span className="public-category-mark" aria-hidden="true">✚</span><h3>{name}</h3><p>{description}</p><span>Browse items →</span>
        </Link>)}</div>
    </section>
    <section className="public-band"><div className="pharmacy-container public-band-inner">
      <div><span className="pharmacy-eyebrow">ABOUT US</span><h2>Care rooted in our community.</h2><p>Senevirathna Medical Pharmacy brings dependable pharmacy care and useful product information closer to you.</p><Link className="pharmacy-button" to="/about">About our pharmacy</Link></div>
      <img src="/images/pharmacy-hero.png" alt="Pharmacy shelves" loading="lazy" />
    </div></section>
    <section className="pharmacy-container public-section"><div className="public-section-heading"><div><span className="pharmacy-eyebrow">HOW WE HELP</span><h2>Pharmacy services</h2></div><Link to="/services">Explore services →</Link></div>
      <p className="public-intro">Browse medicine availability and healthcare products, and learn how our team supports prescription handling and everyday pharmacy needs.</p>
    </section>
  </div>
}
