import { Outlet, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { Header } from './Header'
import { Footer } from './Footer'
import './Layout.css'

export function Layout() {
  const location = useLocation()
  const [isPublicExamFinal, setIsPublicExamFinal] = useState(false)
  const isPublicExamFlow = location.pathname.startsWith('/exam/')

  return (
    <div className="layout">
      {!isPublicExamFlow && !isPublicExamFinal && <Header />}
      <main className="main">
        <Outlet context={{ setIsPublicExamFinal }} />
      </main>
      {!isPublicExamFlow && !isPublicExamFinal && <Footer />}
    </div>
  )
}
