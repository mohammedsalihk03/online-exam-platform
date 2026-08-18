import { useState, useEffect } from 'react'
import { useParams, Link, useOutletContext } from 'react-router-dom'
import { getPublicExamApi, submitStudentExamApi } from '../services/api'
import './CreateExamPage.css'

const languages = ['English', 'Hindi', 'Arabic', 'Malayalam', 'Urdu']

interface PublicExamSession {
  language: string
  endsAt: number
}

function getPublicExamSession(publicToken?: string): PublicExamSession | null {
  if (!publicToken || typeof window === 'undefined') return null

  try {
    const storedSession = sessionStorage.getItem(`public-exam-session:${publicToken}`)
    return storedSession ? JSON.parse(storedSession) : null
  } catch {
    return null
  }
}

function savePublicExamSession(publicToken: string, session: PublicExamSession) {
  sessionStorage.setItem(`public-exam-session:${publicToken}`, JSON.stringify(session))
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function StudentExamPage() {
  const { publicToken } = useParams<{ publicToken: string }>()
  const { setIsPublicExamFinal } = useOutletContext<{
    setIsPublicExamFinal: (isFinal: boolean) => void
  }>()

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [availability, setAvailability] = useState<string>('available')
  const [startTime, setStartTime] = useState<string | null>(null)
  const [endTime, setEndTime] = useState<string | null>(null)

  const [exam, setExam] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])

  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => getPublicExamSession(publicToken)?.language || 'English')
  const [hasStarted, setHasStarted] = useState<boolean>(() => Boolean(getPublicExamSession(publicToken)))

  const [previewPage, setPreviewPage] = useState(1)
  const [studentAnswers, setStudentAnswers] = useState<{ [qId: string]: string }>({})
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    const savedSession = getPublicExamSession(publicToken)
    return savedSession ? Math.max(0, Math.ceil((savedSession.endsAt - Date.now()) / 1000)) : 5400
  })
  const [submittedReceipt, setSubmittedReceipt] = useState<any>(null)

  useEffect(() => {
    setIsPublicExamFinal(Boolean(submittedReceipt))
    return () => setIsPublicExamFinal(false)
  }, [submittedReceipt, setIsPublicExamFinal])

  useEffect(() => {
    async function loadPublicExam() {
      if (!publicToken) return
      setLoading(true)
      const data = await getPublicExamApi(publicToken)

      if (!data) {
        setErrorMsg('Unable to connect to server. Please try again later.')
        setLoading(false)
        return
      }

      if (data.error || data.availability !== 'available') {
        setAvailability(data.availability || 'error')
        setErrorMsg(data.error || 'Exam is currently unavailable.')
        setStartTime(data.startTime || null)
        setEndTime(data.endTime || null)
        if (data.examTitle) {
          setExam({ title: data.examTitle })
        }
        setLoading(false)
        return
      }

      setExam(data.exam)
      const savedSession = getPublicExamSession(publicToken)
      if (savedSession && languages.includes(savedSession.language)) {
        setSelectedLanguage(savedSession.language)
        setHasStarted(true)
        setSecondsRemaining(Math.max(0, Math.ceil((savedSession.endsAt - Date.now()) / 1000)))
      } else if (data.exam && data.exam.defaultLanguage && languages.includes(data.exam.defaultLanguage)) {
        setSelectedLanguage(data.exam.defaultLanguage)
        setSecondsRemaining((data.exam.durationMinutes || 90) * 60)
      }
      setQuestions(shuffleArray(data.questions || []))
      setPreviewPage(1)
      setStudentAnswers({})
      setLoading(false)
    }

    loadPublicExam()
  }, [publicToken])

  // Timer countdown effect
  useEffect(() => {
    if (!hasStarted || loading || availability !== 'available' || submittedReceipt) return
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          handleSubmitExam()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [hasStarted, loading, availability, submittedReceipt])

  function formatTime(totalSeconds: number) {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const questionsPerPage = 5
  const totalPages = Math.max(1, Math.ceil(questions.length / questionsPerPage))
  const displayedQuestions = questions.slice(
    (previewPage - 1) * questionsPerPage,
    previewPage * questionsPerPage
  )

  function handleSelectAnswer(questionId: string, optionLetter: string) {
    setStudentAnswers((prev) => ({
      ...prev,
      [questionId]: optionLetter,
    }))
  }

  function handleStartExam() {
    if (!publicToken) return
    const durationSeconds = (exam?.durationMinutes || 90) * 60
    const session = {
      language: selectedLanguage,
      endsAt: Date.now() + durationSeconds * 1000,
    }
    savePublicExamSession(publicToken, session)
    setSecondsRemaining(durationSeconds)
    setHasStarted(true)
  }

  async function handleSubmitExam() {
    if (!publicToken) return
    const res = await submitStudentExamApi(publicToken, studentAnswers)
    if (res && res.receipt) {
      setSubmittedReceipt(res.receipt)
    } else {
      setSubmittedReceipt({
        examTitle: exam?.title || 'Exam',
        totalQuestions: questions.length,
        answeredCount: Object.keys(studentAnswers).length,
        submittedAt: new Date().toISOString(),
      })
    }
  }

  if (loading) {
    return (
      <section className="section">
        <div className="container" style={{ textAlign: 'center' }}>
          <h2>Loading Examination...</h2>
        </div>
      </section>
    )
  }

  if (availability !== 'available') {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: '36rem' }}>
          <article className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <h2 style={{ marginBottom: '1rem', color: '#ef4444' }}>
              {availability === 'not_started' ? 'Exam Not Started' : 'Exam Ended'}
            </h2>
            <p style={{ marginBottom: '1.5rem', fontSize: '1rem' }}>{errorMsg}</p>
            {startTime && (
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Scheduled Start Time: <strong>{new Date(startTime).toLocaleString()}</strong>
              </p>
            )}
            {endTime && (
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Scheduled End Time: <strong>{new Date(endTime).toLocaleString()}</strong>
              </p>
            )}
            <div style={{ marginTop: '2rem' }}>
              <Link to="/" className="btn btn-primary">
                Return to Home
              </Link>
            </div>
          </article>
        </div>
      </section>
    )
  }

  if (submittedReceipt) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: '36rem' }}>
          <article className="card" style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
            <div className="success-circle" style={{ margin: '0 auto 1.5rem' }}>
              ✓
            </div>
            <h2>Exam Submitted Successfully!</h2>
            <p style={{ margin: '0.5rem 0 1.5rem', color: '#6b7280' }}>
              Thank you for completing your exam.
            </p>
            <div className="exam-summary-card">
              <div className="summary-item">
                <span className="summary-label">Exam Title</span>
                <span className="summary-value">{submittedReceipt.examTitle}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Total Questions</span>
                <span className="summary-value">{submittedReceipt.totalQuestions}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Questions Attempted</span>
                <span className="summary-value">{submittedReceipt.answeredCount}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Submission Time</span>
                <span className="summary-value">{new Date(submittedReceipt.submittedAt).toLocaleTimeString()}</span>
              </div>
            </div>
          </article>
        </div>
      </section>
    )
  }

  if (!hasStarted) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: '36rem' }}>
          <article className="card" style={{ padding: '2.5rem 2rem' }}>
            <header style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-text)' }}>
                {exam?.title || 'Examination'}
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
                Please select your preferred language to begin the exam.
              </p>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
              {languages.map((lang) => {
                const isSelected = selectedLanguage === lang
                return (
                  <label
                    key={lang}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.875rem 1.25rem',
                      border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isSelected ? 'var(--color-primary-light)' : 'var(--color-bg-elevated)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                    }}
                  >
                    <input
                      type="radio"
                      name="student-language-selection"
                      value={lang}
                      checked={isSelected}
                      onChange={() => setSelectedLanguage(lang)}
                      style={{ width: '1.125rem', height: '1.125rem', accentColor: 'var(--color-primary)' }}
                    />
                    <span style={{ fontSize: '1rem' }}>{lang}</span>
                  </label>
                )
              })}
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.875rem', fontSize: '1.05rem', fontWeight: 600 }}
              onClick={handleStartExam}
            >
              Start Exam
            </button>
          </article>
        </div>
      </section>
    )
  }

  return (
    <section className="create-exam">
      <div className="container create-exam-container create-exam-container-wide">
        <article className="card create-exam-card student-preview-card">
          {/* Header Bar with Previous, Language, Timer, Next */}
          <div className="student-header-bar">
            <button
              type="button"
              className="btn btn-outline student-nav-btn"
              disabled={previewPage === 1}
              onClick={() => {
                setPreviewPage((p) => Math.max(1, p - 1))
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              ‹ Previous
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span className="student-lang-display">🌐 {selectedLanguage || exam?.defaultLanguage || 'English'}</span>
              <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '0.875rem', backgroundColor: '#fee2e2', padding: '0.25rem 0.75rem', borderRadius: '0.375rem' }}>
                ⏱ {formatTime(secondsRemaining)}
              </span>
            </div>

            <button
              type="button"
              className="btn btn-primary student-nav-btn"
              disabled={previewPage === totalPages}
              onClick={() => {
                setPreviewPage((p) => Math.min(totalPages, p + 1))
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              Next ›
            </button>
          </div>

          {/* Page Counter & Circular Pagination */}
          <div className="student-page-nav-section">
            <span className="student-page-counter">
              {previewPage} / {totalPages}
            </span>
            <div className="circular-page-buttons">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  className={`page-circle-btn ${previewPage === pageNum ? 'active' : ''}`}
                  onClick={() => {
                    setPreviewPage(pageNum)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  {pageNum}
                </button>
              ))}
            </div>
          </div>

          {/* Exam Section Title Header */}
          <div className="student-section-header">
            <h2 className="student-exam-title">{exam?.title || 'Examination'}</h2>
            <span className="student-questions-badge">{displayedQuestions.length} Questions</span>
          </div>

          {/* Questions List (5 per page) */}
          <div className="student-questions-list">
            {displayedQuestions.map((q: any, idx: number) => {
              const globalIndex = (previewPage - 1) * questionsPerPage + idx + 1
              const translation = (q.translations || []).find(
                (t: any) => t.language && t.language.toLowerCase() === selectedLanguage.toLowerCase()
              )
              const questionTextDisplay = translation?.questionText || q.questionText || q.text || `Question ${globalIndex}`

              return (
                <div key={q.id || globalIndex} className="student-question-item">
                  <div className="student-q-badge">{globalIndex}</div>

                  {q.imageUrl && (
                    <div className="student-q-image-container">
                      <img src={q.imageUrl} alt={`Question ${globalIndex}`} className="student-q-image" />
                    </div>
                  )}

                  <div className="student-q-content">
                    <h3 className="student-q-text">{questionTextDisplay}</h3>

                    <div className="student-options-list">
                      {(q.options || []).map((opt: any) => {
                        const letter = opt.optionLetter || opt.id
                        const optTranslation = (opt.translations || []).find(
                          (ot: any) => ot.language && ot.language.toLowerCase() === selectedLanguage.toLowerCase()
                        )
                        const text = optTranslation?.optionText || opt.optionText || opt.text
                        const imageUrl = opt.imageUrl || opt.image
                        const isChecked = studentAnswers[q.id] === letter

                        return (
                          <label key={letter} className="student-option-row">
                            <input
                              type="radio"
                              name={`public-q-${q.id}`}
                              checked={isChecked}
                              onChange={() => handleSelectAnswer(q.id, letter)}
                              className="student-option-radio"
                            />
                            <div className="student-option-content">
                              {(text || !imageUrl) && (
                                <span className="student-option-text">
                                  <strong>{letter}.</strong> {text}
                                </span>
                              )}
                              {!text && imageUrl && <strong className="student-option-letter">{letter}.</strong>}
                              {imageUrl && (
                                <div className="student-option-image-wrapper">
                                  <img src={imageUrl} alt={`Option ${letter}`} className="student-option-image" />
                                </div>
                              )}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer Bar with Submit */}
          <div className="student-footer-bar" style={{ justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-primary student-submit-btn"
              onClick={handleSubmitExam}
            >
              Submit Exam
            </button>
          </div>
        </article>
      </div>
    </section>
  )
}
