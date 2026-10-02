import React from 'react'
import { useParams } from 'react-router-dom'
import ProductEditor from './ProductEditor.jsx'
export default function EditMedicinePage() { const { id } = useParams(); return <ProductEditor id={Number(id)} /> }
