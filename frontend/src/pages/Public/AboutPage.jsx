import React from 'react'
import { Link } from 'react-router-dom'

export default function AboutPage() {
  return <div className="pharmacy-container public-page">
    <span className="pharmacy-eyebrow">ABOUT OUR PHARMACY</span>
    <h1>Care you can count on.</h1>
    <p className="public-page-lead">Senevirathna Medical Pharmacy helps our community find medicines and healthcare products with clear, practical information and a personal approach to service.</p>
    <div className="public-info-grid">
      <article><h2>Everyday pharmacy care</h2><p>Explore our available medicines, baby items, lab items and medical accessories. Catalog cards show current availability and prescription requirements where applicable.</p></article>
      <article><h2>Digital convenience</h2><p>Search our catalog before you visit and find the product information you need in one place. Our team remains here to help with pharmacy questions.</p></article>
    </div>
    <Link className="pharmacy-button" to="/pharmacy-items">Explore Pharmacy Items</Link>
  </div>
}
