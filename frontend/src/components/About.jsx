import React from 'react'
import { CheckCircle2, HeartPulse, ShieldCheck, UsersRound } from 'lucide-react'

const points = [['Trusted medicines', ShieldCheck], ['Professional pharmacy service', HeartPulse], ['Customer-focused healthcare', UsersRound]]
const About = () => <section className="customer-home-section customer-about" id="about"><div className="customer-home-container customer-about-grid"><div className="customer-about-image"><img src="/images/pharmacy-hero.png" alt="Pharmacist preparing a customer order" /><span><CheckCircle2 size={18} /> Care in every detail</span></div><div className="customer-about-copy"><p className="customer-eyebrow">ABOUT OUR PHARMACY</p><h2>Healthcare that feels closer.</h2><p>Senevirathna Medical Pharmacy provides quality healthcare products and pharmacy services with a focus on customer care, safety, and convenience.</p><div className="customer-about-points">{points.map(([label, Icon]) => <div key={label}><span><Icon size={18} /></span><strong>{label}</strong></div>)}</div></div></div></section>
export default About
