import './AboutPage.css'

export function AboutPage() {
  return (
    <section className="section about">
      <div className="container about-inner">
        <div className="section-header">
          <h2>About ExamPlatform</h2>
          <p>
            A focused online exam solution designed for educational institutions
            and training organizations.
          </p>
        </div>

        <div className="about-content">
          <div className="card about-card">
            <h3>Our Mission</h3>
            <p>
              We believe online examinations should be straightforward, secure,
              and accessible. ExamPlatform provides a clean foundation for
              delivering assessments without distracting complexity.
            </p>
          </div>
          <div className="card about-card">
            <h3>What We Offer</h3>
            <p>
              A professional web platform with responsive design, clear
              navigation, and a structure ready to grow with your exam needs.
              More features — including exam creation, authentication, and
              reporting — will be added in upcoming phases.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
