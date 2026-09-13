import React, { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import TopNav from './TopNav.jsx'
import Footer from './Footer.jsx'
import MobileDrawer from './MobileDrawer.jsx'
import Toast from '../common/Toast.jsx'
import ScrollToTop from '../common/ScrollToTop.jsx'

const AppLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname, hash, key } = useLocation()

  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0, behavior: 'instant' })
    setMobileOpen(false)
  }, [pathname, hash, key])

  return (
    <div className={`app-layout ${pathname === '/' ? 'home-layout' : 'workspace-layout'}`}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div className="pharmacy-utility">
        <div className="pharmacy-container">
          <span>Care for your community. Confidence in every day.</span>
          <span className="utility-workspace"><span aria-hidden="true" /> Senevirathna Medical Pharmacy</span>
        </div>
      </div>
      <TopNav onMobileOpen={() => setMobileOpen(true)} />
      <MobileDrawer isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <main className="main-content" id="main-content" tabIndex={-1}>
        <div className="page-content">
          <Outlet />
        </div>
      </main>

      <Footer />
      <Toast />
      <ScrollToTop />
    </div>
  )
}

export default AppLayout
