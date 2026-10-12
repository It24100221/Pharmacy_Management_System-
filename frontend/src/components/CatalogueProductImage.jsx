import React, { useState } from 'react'
import { Baby, PackagePlus } from 'lucide-react'

export default function CatalogueProductImage({ product }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(product.image) && !failed
  const Icon = String(product.categoryCode || '').includes('BABY') ? Baby : PackagePlus

  return <figure className="catalogue-product-figure">
    <div className="public-product-image" aria-busy={showImage && !loaded}>
      {(!showImage || !loaded) && <div className="catalogue-image-placeholder" role="img" aria-label={`Product photo unavailable for ${product.name}`}>
        <Icon size={38} aria-hidden="true" />
        <span>{showImage ? 'Loading photo…' : 'Product photo unavailable'}</span>
      </div>}
      {showImage && <img
        src={product.image}
        alt={product.imageAlt || product.name}
        loading="lazy"
        decoding="async"
        className={loaded ? 'is-loaded' : ''}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />}
    </div>
    {showImage && product.imageSourceUrl && <figcaption><a href={product.imageSourceUrl} target="_blank" rel="noreferrer">Image source</a>{product.imageLicense && ` · ${product.imageLicense}`}</figcaption>}
  </figure>
}
