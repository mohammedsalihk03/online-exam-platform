import { Link } from 'react-router-dom'
import './Footer.css'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <span className="footer-logo">ExamPlatform</span>
          <p className="footer-tagline">
            A clean, reliable platform for online examinations.
          </p>
        </div>

        <nav className="footer-nav">
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
        </nav>

        <p className="footer-copy">&copy; {year} ExamPlatform. All rights reserved.</p>
      </div>
    </footer>
  )
}
