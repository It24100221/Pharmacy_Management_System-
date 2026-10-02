import React from 'react'
import { Link } from 'react-router-dom'
import { Plus, ChevronRight } from '../common/Icons.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { linksForUser, accountLinksForUser } from '../../utils/navigation.js'

const Footer = () => {
  const { user } = useAuth()
  const links = [...linksForUser(user), ...accountLinksForUser(user)]
  const midpoint = Math.ceil(links.length / 2)
  return (
  <footer className="site-footer">
    <div className="footer-inner">
      <div className="footer-grid">
        <div>
          <Link to="/" className="nav-brand">
            <div className="nav-brand-icon"><Plus size={30} strokeWidth={3} /></div>
            <div className="nav-brand-text"><span className="nav-brand-name">Senevirathna</span><span className="nav-brand-sub">Medical Pharmacy</span></div>
          </Link>
          <p className="footer-intro">Bringing people, medicines and everyday care together. Your community pharmacy, thoughtfully connected.</p>
        </div>
        <div>
          <h3 className="footer-col-title">Explore</h3>
          <ul className="footer-links">
            {links.slice(0, midpoint).map(([label, to]) => <li key={to}><Link to={to}><ChevronRight size={12} />{label}</Link></li>)}
          </ul>
        </div>
        <div>
          <h3 className="footer-col-title">Quick access</h3>
          <ul className="footer-links">
            {links.slice(midpoint).map(([label, to]) => <li key={to}><Link to={to}><ChevronRight size={12} />{label}</Link></li>)}
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span className="footer-copyright">&copy; {new Date().getFullYear()} Senevirathna Medical Pharmacy. All rights reserved.</span>
        <span className="footer-signoff">A simpler day. A healthier community.</span>
      </div>
    </div>
  </footer>
  )
}

export default Footer
