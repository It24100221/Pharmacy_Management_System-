import React from 'react'
import { ArrowRight, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

const Hero = () => <section className="customer-hero"><img src="/images/pharmacy-hero.png" alt="Senevirathna Medical Pharmacy team providing care" /><div className="customer-hero-wash" /><div className="customer-home-container customer-hero-content"><p className="customer-eyebrow"><span /> SENEvirathna MEDICAL PHARMACY</p><h1>Better Care.<br />Smarter Pharmacy.</h1><p>Your trusted pharmacy partner providing medicines, healthcare products, and convenient pharmacy services in one place.</p><div className="customer-hero-actions"><Link className="customer-primary-button" to="/pharmacy-items">Explore Pharmacy Items <ArrowRight size={17} /></Link><a className="customer-secondary-link" href="#about">Learn More <ChevronRight size={17} /></a></div></div></section>
export default Hero
