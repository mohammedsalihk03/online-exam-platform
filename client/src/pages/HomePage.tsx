import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getExamStatisticsApi, getRecentExamsApi, type RecentExamData } from '../services/api'
import './HomePage.css'

export function HomePage() {
  const [statistics, setStatistics] = useState({ totalExams: 0, activeExams: 0 })
  const [recentExams, setRecentExams] = useState<RecentExamData[]>([])

  useEffect(() => {
    getExamStatisticsApi().then((data) => {
      if (data) setStatistics(data)
    })
    getRecentExamsApi().then((data) => {
      if (data) setRecentExams(data)
    })
  }, [])

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
        <div className="hero-content">
          <p className="hero-label">Online Exam Platform</p>
          <h1>Professional exams, delivered with confidence</h1>
          <p className="hero-description">
            A clean and dependable platform for conducting online examinations. Built for clarity, speed, and ease of use.
          </p>
          <div className="hero-actions">
            <Link to="/about" className="btn btn-primary">
              Learn More
            </Link>
            <Link to="/about" className="btn btn-outline">
              View Features
            </Link>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-stats">
            <div className="stat-card">
              <span className="stat-card-value stat-card-value--primary">{statistics.totalExams}</span>
              <span className="stat-card-label">Total Exams</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-value">{statistics.activeExams}</span>
              <span className="stat-card-label">Active Exams</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-value stat-card-value--primary">1,248</span>
              <span className="stat-card-label">Total Students</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-value stat-card-value--success">876</span>
              <span className="stat-card-label">Tests Completed</span>
            </div>
          </div>
        </div>
        </div>
      </section>
      <section className="recent-exams-section">
        <div className="container">
          <div className="recent-exams-card card">
            <div className="recent-exams-header">
              <div>
                <p className="hero-label">Exam History</p>
                <h2>Recent Exams</h2>
              </div>
            </div>
            {recentExams.length === 0 ? (
              <p className="recent-exams-empty">No exams created yet</p>
            ) : (
              <div className="recent-exams-table-wrap">
                <table className="recent-exams-table">
                  <thead>
                    <tr>
                      <th>Exam Title</th>
                      <th>Questions</th>
                      <th>Duration</th>
                      <th>Status</th>
                      <th>Created On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentExams.map((exam) => (
                      <tr key={exam.id}>
                        <td>{exam.title}</td>
                        <td>{exam.questionCount}</td>
                        <td>{exam.durationMinutes} min</td>
                        <td><span className={`exam-status exam-status--${exam.status}`}>{exam.status}</span></td>
                        <td>{new Date(exam.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
