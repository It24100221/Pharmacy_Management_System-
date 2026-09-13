import React, { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import {
  Pill, ShoppingCart, Building2, ClipboardPlus, Package, AlertTriangle,
  Clock, Activity, ChevronRight, ChevronLeft, Users, CheckCircle,
  ArrowRight, User, Receipt
} from '../../components/common/Icons.jsx'

const heroSlides = [
  { title: <>Better care.<br />Smarter pharmacy.</>, description: 'A little more connected. A lot more care. Bring your medicines, people and everyday pharmacy operations together in one place.', cta: 'Manage Inventory', route: '/medicines', label: 'Medicine management' },
  { title: <>Less waiting.<br />More caring.</>, description: 'Make every transaction feel effortless. Find medicines, prepare accurate bills and keep your stock up to date as you serve your community.', cta: 'Start a New Sale', route: '/sales', label: 'Sales and billing' },
  { title: <>Connected records.<br />Thoughtful care.</>, description: 'From the first prescription to the final receipt, keep customer records and medicine availability connected at every step.', cta: 'Create Prescription', route: '/prescriptions/create', label: 'Prescription management' },
]

const shortcuts = [
  { title: 'Medicine inventory', text: 'Every medicine, in one place', icon: Pill, route: '/medicines' },
  { title: 'Sales & billing', text: 'A smoother checkout', icon: ShoppingCart, route: '/sales' },
  { title: 'Prescriptions', text: 'Connected customer care', icon: ClipboardPlus, route: '/prescriptions/create' },
  { title: 'Suppliers & stock', text: 'Keep your shelves ready', icon: Package, route: '/purchases' },
]

const aboutTabs = [
  { title: 'Our pharmacy', text: 'Senevirathna Medical Pharmacy brings everyday pharmacy work into one connected workspace. From managing medicines to preparing prescriptions, we make it easier to focus on the people you serve.' },
  { title: 'Our approach', text: 'Good care starts with the details. Keep a clear view of medicine availability, follow expiry dates, receive stock and prepare accurate bills through a simple, connected workflow.' },
  { title: 'Our commitment', text: 'Make every day more organized and every customer interaction more personal. Keep the information your team needs close at hand, from customer records to prescription history.' },
]

const services = [
  { icon: Pill, number: '01', title: 'Your inventory, under control.', text: 'Find medicines quickly, monitor stock levels and stay ahead of expiry dates with a clear view of every item.', cta: 'Explore inventory', route: '/medicines' },
  { icon: Receipt, number: '02', title: 'Make every sale simple.', text: 'Prepare bills, calculate totals and generate receipts. Your inventory updates as each sale is completed.', cta: 'Open sales & billing', route: '/sales' },
  { icon: ClipboardPlus, number: '03', title: 'Care that stays connected.', text: 'Manage customer records, create prescriptions and check medicine availability before moving to billing.', cta: 'Manage prescriptions', route: '/prescriptions/create' },
]

const Dashboard = () => {
  const { medicines, suppliers, customers, prescriptions, activities } = useApp()
  const [heroIndex, setHeroIndex] = useState(0)
  const [aboutIndex, setAboutIndex] = useState(0)
  const aboutRefs = useRef([])
  const currentSlide = heroSlides[heroIndex]
  const lowStockItems = useMemo(() => medicines.filter(m => m.stockStatus === 'low_stock' || m.stockStatus === 'out_of_stock').sort((a, b) => a.quantity - b.quantity).slice(0, 4), [medicines])
  const expiryItems = useMemo(() => medicines.filter(m => m.expiryStatus === 'near_expiry' || m.expiryStatus === 'expired').sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate)).slice(0, 4), [medicines])
  const recentActivity = activities.slice(0, 6)
  const getDaysRemaining = date => Math.ceil((new Date(date) - new Date()) / 86400000)
  const formatTimeAgo = isoString => {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 60000))
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
    return `${Math.floor(minutes / 1440)}d ago`
  }
  const activityIcons = { receipt: Receipt, package: Package, clipboard: ClipboardPlus, pencil: Pill, user: User, pill: Pill, building: Building2, activity: Activity }
  const activityColors = { sale: 'var(--primary-bright)', stock: 'var(--success)', prescription: 'var(--info)', medicine: 'var(--warning)', customer: 'var(--text-secondary)', supplier: 'var(--info)' }
  const onTabKeyDown = (event, index) => {
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % aboutTabs.length
    else if (event.key === 'ArrowLeft') next = (index + aboutTabs.length - 1) % aboutTabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = aboutTabs.length - 1
    else return
    event.preventDefault()
    setAboutIndex(next)
    aboutRefs.current[next]?.focus()
  }

  return (
    <div className="pharmacy-home">
      <section className="pharmacy-hero" aria-label="Pharmacy highlights" aria-roledescription="carousel">
        <img className="pharmacy-hero-photo" src="/images/pharmacy-hero.png" alt="" fetchPriority="high" width="1536" height="1024" />
        <div className="pharmacy-container pharmacy-hero-inner">
          <div className="pharmacy-hero-copy" aria-live="polite" aria-atomic="true">
            <div className="pharmacy-eyebrow hero-kicker"><span /> YOUR COMMUNITY. YOUR PHARMACY.</div>
            <h1>{currentSlide.title}</h1>
            <p>{currentSlide.description}</p>
            <div className="pharmacy-hero-actions">
              <Link className="pharmacy-button" to={currentSlide.route}>{currentSlide.cta}<ArrowRight size={18} /></Link>
              <a href="#services" className="pharmacy-text-link">Explore our services <ChevronRight size={17} /></a>
            </div>
          </div>
          <div className="pharmacy-hero-bottom">
            <span className="hero-care-note"><CheckCircle size={17} /> A simpler day. A healthier community.</span>
            <div className="pharmacy-carousel-controls">
              <button onClick={() => setHeroIndex((heroIndex + heroSlides.length - 1) % heroSlides.length)} aria-label="Previous slide"><ChevronLeft size={19} /></button>
              <div className="pharmacy-carousel-dots">
                {heroSlides.map((slide, index) => <button key={slide.label} className={heroIndex === index ? 'active' : ''} aria-label={`Show slide ${index + 1}: ${slide.label}`} aria-current={heroIndex === index ? 'true' : undefined} onClick={() => setHeroIndex(index)}><span /></button>)}
              </div>
              <button onClick={() => setHeroIndex((heroIndex + 1) % heroSlides.length)} aria-label="Next slide"><ChevronRight size={19} /></button>
              <span className="pharmacy-slide-count">0{heroIndex + 1} <span>/ 03</span></span>
            </div>
          </div>
        </div>
      </section>

      <section className="pharmacy-shortcuts pharmacy-container" aria-label="Quick access">
        {shortcuts.map(({ title, text, icon: Icon, route }) => <Link key={title} to={route} className="pharmacy-shortcut">
          <span className="pharmacy-shortcut-icon"><Icon size={24} strokeWidth={1.6} /></span>
          <span><strong>{title}</strong><small>{text}</small></span><ArrowRight className="shortcut-arrow" size={17} />
        </Link>)}
      </section>

      <section className="pharmacy-about pharmacy-container" id="about">
        <div className="pharmacy-about-visual">
          <img src="/images/pharmacy-hero.png" alt="A pharmacist reviewing medicine information on a tablet" loading="lazy" width="520" height="460" />
          <div className="pharmacy-care-card"><span><CheckCircle size={28} /></span><div><strong>People at the heart.<br />Care in every detail.</strong><small>Senevirathna Medical Pharmacy</small></div></div>
          <span className="about-image-caption">EVERYDAY CARE, THOUGHTFULLY CONNECTED</span>
        </div>
        <div className="pharmacy-about-copy">
          <span className="pharmacy-eyebrow">A LITTLE ABOUT US</span>
          <h2>A healthier community<br />starts with better care.</h2>
          <p className="pharmacy-section-intro">Your neighborhood pharmacy, with a more connected way to work.</p>
          <div className="pharmacy-about-tabs" role="tablist" aria-label="About our pharmacy">
            {aboutTabs.map((tab, index) => <button key={tab.title} role="tab" id={`about-tab-${index}`} aria-selected={aboutIndex === index} aria-controls="about-panel" tabIndex={aboutIndex === index ? 0 : -1} ref={el => { aboutRefs.current[index] = el }} onKeyDown={event => onTabKeyDown(event, index)} onClick={() => setAboutIndex(index)}>{tab.title}</button>)}
          </div>
          <div className="pharmacy-about-panel" id="about-panel" role="tabpanel" aria-labelledby={`about-tab-${aboutIndex}`} tabIndex={0}><p>{aboutTabs[aboutIndex].text}</p></div>
          <div className="pharmacy-about-checks"><span><CheckCircle size={17} /> Organized medicine records</span><span><CheckCircle size={17} /> Connected customer care</span></div>
          <Link className="pharmacy-text-link" to="/customers">Get to know your customers <ArrowRight size={17} /></Link>
        </div>
      </section>

      <section className="pharmacy-numbers" aria-label="Pharmacy at a glance">
        <div className="pharmacy-container">
          {[{ icon: Pill, value: medicines.length, label: 'Medicines managed', route: '/medicines' }, { icon: Users, value: customers.length, label: 'Registered customers', route: '/customers' }, { icon: Building2, value: suppliers.length, label: 'Connected suppliers', route: '/suppliers' }, { icon: ClipboardPlus, value: prescriptions.length, label: 'Prescriptions recorded', route: '/customers' }].map(({ icon: Icon, value, label, route }) => <Link key={label} to={route}><Icon size={27} strokeWidth={1.5} /><strong>{value.toLocaleString()}</strong><span>{label}</span></Link>)}
        </div>
      </section>

      <section className="pharmacy-services pharmacy-container" id="services">
        <div className="pharmacy-section-heading"><div><span className="pharmacy-eyebrow">HERE FOR EVERY PART OF YOUR DAY</span><h2>One pharmacy.<br />Everything connected.</h2></div><p>Thoughtfully designed tools to make the everyday easier, so your team can focus on what matters.</p></div>
        <div className="pharmacy-service-grid">
          {services.map(({ icon: Icon, number, title, text, cta, route }) => <article className="pharmacy-service-card" key={title}><div className="service-card-top"><span><Icon size={29} strokeWidth={1.5} /></span><small>{number}</small></div><h3>{title}</h3><p>{text}</p><Link className="pharmacy-text-link" to={route}>{cta}<ArrowRight size={17} /></Link></article>)}
        </div>
      </section>
      {/* ======================== ALERTS + ACTIVITY ======================== */}
      <section className="content-section">
        <div className="content-container">
          <div className="section-header">
            <div className="section-eyebrow">Operational Alerts</div>
            <h2 className="section-title">Inventory Health</h2>
          </div>

          <div className="alert-grid">
            {/* Low Stock Alerts */}
            <div className="alert-section">
              <div className="alert-section-header">
                <div className="alert-section-title" style={{ color: 'var(--warning)' }}>
                  <AlertTriangle size={18} /> Low Stock Alerts
                </div>
                <Link to="/medicines/low-stock" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--primary-bright)', fontWeight: 'var(--font-weight-semibold)' }}>
                  View All <ChevronRight size={12} style={{ verticalAlign: 'middle' }} />
                </Link>
              </div>
              {lowStockItems.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table className="alert-table">
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th style={{ textAlign: 'center' }}>Stock</th>
                        <th style={{ textAlign: 'center' }}>Reorder</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStockItems.map(m => (
                        <tr key={m.id}>
                          <td style={{ fontWeight: 600 }}>{m.name}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: m.quantity === 0 ? 'var(--danger)' : 'var(--warning)' }}>
                            {m.quantity}
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{m.minStockLevel}</td>
                          <td style={{ textAlign: 'center' }}>
                            {m.stockStatus === 'out_of_stock' ? (
                              <span className="badge badge-out-of-stock">OUT OF STOCK</span>
                            ) : (
                              <span className="badge badge-low-stock">LOW STOCK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  All medicines are well stocked.
                </div>
              )}
            </div>

            {/* Expiry Alerts */}
            <div className="alert-section">
              <div className="alert-section-header">
                <div className="alert-section-title" style={{ color: 'var(--danger)' }}>
                  <Clock size={18} /> Expiry Monitoring
                </div>
                <Link to="/medicines/expiry" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--primary-bright)', fontWeight: 'var(--font-weight-semibold)' }}>
                  View All <ChevronRight size={12} style={{ verticalAlign: 'middle' }} />
                </Link>
              </div>
              {expiryItems.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table className="alert-table">
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th>Expiry Date</th>
                        <th style={{ textAlign: 'center' }}>Days</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expiryItems.map(m => {
                        const days = getDaysRemaining(m.expiryDate)
                        return (
                          <tr key={m.id}>
                            <td style={{ fontWeight: 600 }}>{m.name}</td>
                            <td style={{ color: 'var(--text-secondary)' }}>{m.expiryDate}</td>
                            <td style={{ textAlign: 'center', fontWeight: 600, color: m.expiryStatus === 'expired' ? 'var(--danger)' : 'var(--warning)' }}>
                              {m.expiryStatus === 'expired' ? `${Math.abs(days)}d past` : `${days}d left`}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {m.expiryStatus === 'expired' ? (
                                <span className="badge badge-expired">EXPIRED</span>
                              ) : (
                                <span className="badge badge-near-expiry">NEAR EXPIRY</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  All medicines are within valid expiry.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ======================== RECENT ACTIVITY ======================== */}
      <section className="content-section" style={{ paddingTop: 0 }}>
        <div className="content-container">
          <div className="recent-activity-section-full">
            <div className="recent-activity-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontWeight: 'var(--font-weight-bold)' }}>
                <Activity size={18} /> Recent Activity
              </div>
            </div>
            <div className="recent-activity-list">
              {recentActivity.length > 0 ? recentActivity.map((item) => {
                const Icon = activityIcons[item.icon] || Activity
                const color = activityColors[item.type] || 'var(--text-secondary)'
                return (
                  <div key={item.id} className="activity-item">
                    <div className="activity-icon" style={{ background: 'var(--surface-elevated)', color }}>
                      <Icon size={16} />
                    </div>
                    <div className="activity-content">
                      <div className="activity-title">{item.title}</div>
                      <div className="activity-time">{formatTimeAgo(item.time)}</div>
                    </div>
                  </div>
                )
              }) : (
                <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  No recent activity. Start by adding a medicine or completing a sale.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Dashboard

