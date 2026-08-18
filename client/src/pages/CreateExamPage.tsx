import { useState, useRef } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { createExamApi, saveQuestionApi, uploadImageApi, publishExamApi } from '../services/api'
import './CreateExamPage.css'

const step1Languages = [
  'English',
  'Hindi',
  'Arabic',
  'Malayalam',
  'Urdu',
]

const questionLanguages = [
  'English',
  'Hindi',
  'Arabic',
  'Malayalam',
  'Urdu',
]

export interface QuestionOption {
  id: 'A' | 'B' | 'C' | 'D'
  text: string
  image?: string | null
}

export interface Question {
  id: string | number
  text: string
  options: QuestionOption[]
  correctOptionId: 'A' | 'B' | 'C' | 'D'
}

const defaultOptions: QuestionOption[] = [
  { id: 'A', text: '', image: null },
  { id: 'B', text: '', image: null },
  { id: 'C', text: '', image: null },
  { id: 'D', text: '', image: null },
]

export function CreateExamPage() {
  // Wizard step state: 1 = Basic Details, 2 = Add Questions, 3 = Exam Created/Preview
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Exam Backend Identity State
  const [examId, setExamId] = useState<string | null>(null)
  const [publicToken, setPublicToken] = useState<string | null>(null)
  const [isPublished, setIsPublished] = useState(false)
  const [copied, setCopied] = useState(false)

  // Step 1 State
  const [title, setTitle] = useState('NEET Biology Mock Test')
  const [description, setDescription] = useState('Full syllabus mock test for NEET aspirants.')
  const [questionCount, setQuestionCount] = useState('60')
  const [duration, setDuration] = useState('90')
  const [startDate, setStartDate] = useState('2024-05-25')
  const [startTime, setStartTime] = useState('10:00')
  const [endDate] = useState('2030-12-31')
  const [endTime] = useState('23:59')
  const [language, setLanguage] = useState('English')

  // Step 2 & 3 State
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: 'q-1',
      text: '',
      options: [
        { id: 'A', text: '', image: null },
        { id: 'B', text: '', image: null },
        { id: 'C', text: '', image: null },
        { id: 'D', text: '', image: null },
      ],
      correctOptionId: 'A',
    },
  ])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)

  // Current Question Form State
  const [questionText, setQuestionText] = useState('')
  const [questionType, setQuestionType] = useState('Multiple Choice (4 options)')
  const [selectedLangTab, setSelectedLangTab] = useState('English')
  const [options, setOptions] = useState<QuestionOption[]>(defaultOptions)
  const [correctOptionId, setCorrectOptionId] = useState<'A' | 'B' | 'C' | 'D'>('A')

  // Step 3 Student Preview State
  const [previewPage, setPreviewPage] = useState(1)
  const [studentAnswers, setStudentAnswers] = useState<{ [qId: string]: string }>({})

  const optionFileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})

  // Questions pagination for Preview mode (5 questions per page)
  const questionsPerPage = 5
  const totalPages = Math.max(1, Math.ceil(questions.length / questionsPerPage))
  const displayedQuestions = questions.slice(
    (previewPage - 1) * questionsPerPage,
    previewPage * questionsPerPage
  )

  // Load question data into form state
  function loadQuestionData(q: Question) {
    setQuestionText(q.text)
    setOptions(
      q.options
        ? q.options.map((o) => ({ id: o.id, text: o.text || '', image: o.image || null }))
        : defaultOptions
    )
    setCorrectOptionId(q.correctOptionId)
  }

  async function handleStep1Submit(event: FormEvent) {
    event.preventDefault()
    const startLocalDate = startDate ? new Date(`${startDate}T${startTime || '00:00'}:00`) : new Date()
    const startIso = !isNaN(startLocalDate.getTime()) ? startLocalDate.toISOString() : new Date().toISOString()

    const endLocalDate = endDate ? new Date(`${endDate}T${endTime || '23:59'}:00`) : new Date('2030-12-31T23:59:59')
    const endIso = !isNaN(endLocalDate.getTime()) ? endLocalDate.toISOString() : '2030-12-31T23:59:59.000Z'

    const createdExam = await createExamApi({
      title,
      description,
      questionCount: Number(questionCount) || 60,
      durationMinutes: Number(duration) || 90,
      startTime: startIso,
      endTime: endIso,
      defaultLanguage: language,
    })

    if (createdExam) {
      setExamId(createdExam.id)
      if (createdExam.publicToken) {
        setPublicToken(createdExam.publicToken)
      }
    }

    setStep(2)
  }

  async function handlePrevQuestion() {
    if (currentQuestionIndex > 0) {
      const updatedQuestions = await saveCurrentQuestion()
      const prevIdx = currentQuestionIndex - 1
      setCurrentQuestionIndex(prevIdx)
      loadQuestionData(updatedQuestions[prevIdx])
    }
  }

  async function handleNextQuestion() {
    if (currentQuestionIndex < questions.length - 1) {
      const updatedQuestions = await saveCurrentQuestion()
      const nextIdx = currentQuestionIndex + 1
      setCurrentQuestionIndex(nextIdx)
      loadQuestionData(updatedQuestions[nextIdx])
    }
  }

  async function saveCurrentQuestion() {
    const updatedQuestion: Question = {
      id: questions[currentQuestionIndex]?.id || `q-${currentQuestionIndex + 1}`,
      text: questionText,
      options: options.map((o) => ({ id: o.id, text: o.text, image: o.image || null })),
      correctOptionId,
    }

    const updatedQuestions = [...questions]
    updatedQuestions[currentQuestionIndex] = updatedQuestion
    setQuestions(updatedQuestions)

    if (examId) {
      await saveQuestionApi(examId, {
        id: String(updatedQuestion.id),
        questionOrder: currentQuestionIndex + 1,
        questionText,
        language: selectedLangTab,
        options: options.map((o) => ({
          id: o.id,
          text: o.text,
          imageUrl: o.image || null,
        })),
        correctOptionId,
      })
    }

    return updatedQuestions
  }

  async function handleAddQuestion() {
    const updatedQuestions = await saveCurrentQuestion()
    const newQ: Question = {
      id: `q-${updatedQuestions.length + 1}`,
      text: '',
      options: [
        { id: 'A', text: '', image: null },
        { id: 'B', text: '', image: null },
        { id: 'C', text: '', image: null },
        { id: 'D', text: '', image: null },
      ],
      correctOptionId: 'A',
    }
    const newQuestions = [...updatedQuestions, newQ]
    setQuestions(newQuestions)
    setCurrentQuestionIndex(newQuestions.length - 1)
    setQuestionText('')
    setOptions(newQ.options)
    setCorrectOptionId('A')
  }

  async function handleSaveAndContinue() {
    await saveCurrentQuestion()
    if (examId) {
      const res = await publishExamApi(examId)
      if (res && res.exam && res.exam.publicToken) {
        setPublicToken(res.exam.publicToken)
      }
    }
    setStep(3)
  }

  async function handlePublishExam() {
    let activeToken = publicToken
    if (examId) {
      const res = await publishExamApi(examId)
      if (res && res.exam && res.exam.publicToken) {
        activeToken = res.exam.publicToken
        setPublicToken(activeToken)
      }
    }

    if (!activeToken) {
      activeToken = `pub_${Math.random().toString(36).substring(2, 10).toUpperCase()}`
      setPublicToken(activeToken)
    }

    setIsPublished(true)
  }

  function handleCopyLink() {
    if (!publicToken) return
    const fullUrl = `${window.location.origin}/exam/${publicToken}`
    navigator.clipboard.writeText(fullUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleOptionImageUpload(optionId: 'A' | 'B' | 'C' | 'D', e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = async (event) => {
        const rawBase64 = event.target?.result as string
        setOptions((prev) =>
          prev.map((opt) => (opt.id === optionId ? { ...opt, image: rawBase64 } : opt))
        )
        const uploadedUrl = await uploadImageApi(rawBase64, file.name, file.type)
        if (uploadedUrl) {
          setOptions((prev) =>
            prev.map((opt) => (opt.id === optionId ? { ...opt, image: uploadedUrl } : opt))
          )
        }
      }
      reader.readAsDataURL(file)
    }
  }

  function handleRemoveOptionImage(optionId: 'A' | 'B' | 'C' | 'D') {
    setOptions((prev) =>
      prev.map((opt) => (opt.id === optionId ? { ...opt, image: null } : opt))
    )
    if (optionFileInputRefs.current[optionId]) {
      optionFileInputRefs.current[optionId]!.value = ''
    }
  }

  function handleOptionTextChange(id: 'A' | 'B' | 'C' | 'D', value: string) {
    setOptions((prev) =>
      prev.map((opt) => (opt.id === id ? { ...opt, text: value } : opt))
    )
  }

  function handleStudentAnswerSelect(questionId: string | number, optionId: string) {
    setStudentAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }))
  }

  return (
    <section className="create-exam">
      <div className={`container create-exam-container ${step === 2 || step === 3 ? 'create-exam-container-wide' : ''}`}>
        {step === 1 && (
          <article className="card create-exam-card">
            <header className="create-exam-header">
              <span className="step-badge" aria-hidden="true">
                1
              </span>
              <h1>Create New Exam – Basic Details</h1>
            </header>

            <form className="create-exam-form" onSubmit={handleStep1Submit} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="exam-title">
                  Exam Title <span className="required-star">*</span>
                </label>
                <input
                  id="exam-title"
                  type="text"
                  className="form-input"
                  placeholder="Enter exam title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="exam-description">
                  Description <span className="form-label-optional">(Optional)</span>
                </label>
                <textarea
                  id="exam-description"
                  className="form-textarea"
                  placeholder="Enter exam description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="question-count">
                    Total Questions <span className="required-star">*</span>
                  </label>
                  <input
                    id="question-count"
                    type="number"
                    className="form-input"
                    placeholder="e.g. 60"
                    min={1}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(e.target.value)}
                  />
                  <span className="field-hint">Numeric value</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="exam-duration">
                    Duration <span className="required-star">*</span>
                  </label>
                  <div className="input-with-suffix">
                    <input
                      id="exam-duration"
                      type="number"
                      className="form-input"
                      placeholder="e.g. 90"
                      min={1}
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                    />
                    <span className="input-suffix">minutes</span>
                  </div>
                </div>
              </div>

              <fieldset className="form-fieldset">
                <legend className="form-legend">Exam Date &amp; Time <span className="required-star">*</span></legend>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label visually-hidden" htmlFor="start-date">
                      Start Date
                    </label>
                    <div className="input-with-icon">
                      <input
                        id="start-date"
                        type="date"
                        className="form-input"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                      <CalendarIcon />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label visually-hidden" htmlFor="start-time">
                      Start Time
                    </label>
                    <div className="input-with-icon">
                      <input
                        id="start-time"
                        type="time"
                        className="form-input"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                      <ClockIcon />
                    </div>
                  </div>
                </div>
              </fieldset>

              <div className="form-group">
                <label className="form-label" htmlFor="exam-language">
                  Language
                </label>
                <div className="select-wrapper">
                  <select
                    id="exam-language"
                    className="form-select"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    {step1Languages.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                  <ChevronIcon />
                </div>
              </div>

              <button type="submit" className="btn btn-primary create-exam-submit">
                Create Exam
                <ArrowIcon />
              </button>
            </form>
          </article>
        )}

        {step === 2 && (
          <article className="card create-exam-card step-2-card">
            <header className="create-exam-header">
              <span className="step-badge" aria-hidden="true">
                2
              </span>
              <h1>Create Exam – Add Questions</h1>
            </header>

            {/* Exam Meta Info Bar */}
            <div className="exam-meta-bar">
              <div className="exam-meta-title-group">
                <h2 className="exam-meta-title">{title || 'NEET Biology Mock Test'}</h2>
              </div>
              <div className="exam-meta-right">
                <span className="questions-count-badge">
                  Questions: {currentQuestionIndex + 1}/{questionCount || 60}
                </span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setStep(3)}
                >
                  Preview Exam
                </button>
              </div>
            </div>

            {/* Question Navigator & Type Bar */}
            <div className="question-nav-row">
              <div className="question-nav-group">
                <span className="question-num-label">Question {currentQuestionIndex + 1}</span>
                <div className="question-nav-btns">
                  <button
                    type="button"
                    className="nav-arrow-btn"
                    onClick={handlePrevQuestion}
                    disabled={currentQuestionIndex === 0}
                    title="Previous Question"
                    aria-label="Previous Question"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="nav-arrow-btn"
                    onClick={handleNextQuestion}
                    disabled={currentQuestionIndex >= questions.length - 1}
                    title="Next Question"
                    aria-label="Next Question"
                  >
                    ›
                  </button>
                </div>
              </div>

              <div className="question-type-group">
                <label htmlFor="q-type-select" className="question-type-label">
                  Question Type
                </label>
                <div className="select-wrapper">
                  <select
                    id="q-type-select"
                    className="form-select q-type-select"
                    value={questionType}
                    onChange={(e) => setQuestionType(e.target.value)}
                  >
                    <option value="Multiple Choice (4 options)">Multiple Choice (4 options)</option>
                    <option value="Multiple Choice (5 options)">Multiple Choice (5 options)</option>
                    <option value="True / False">True / False</option>
                  </select>
                  <ChevronIcon />
                </div>
              </div>
            </div>

            {/* Language Tabs */}
            <div className="lang-tabs-container" role="tablist" aria-label="Question languages">
              {questionLanguages.map((langTab) => (
                <button
                  key={langTab}
                  type="button"
                  role="tab"
                  aria-selected={selectedLangTab === langTab}
                  className={`lang-tab ${selectedLangTab === langTab ? 'active' : ''}`}
                  onClick={() => setSelectedLangTab(langTab)}
                >
                  {langTab}
                </button>
              ))}
            </div>

            {/* Question Input Box */}
            <div className="form-group question-box">
              <label className="form-label" htmlFor="question-text">
                Question ({selectedLangTab})
              </label>
              <textarea
                id="question-text"
                className="form-textarea question-textarea-simple"
                rows={4}
                placeholder="Enter question text..."
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
              />
            </div>

            {/* Options List A-D */}
            <div className="options-section">
              <div className="options-header">
                <span className="options-title">Options (Choose one correct answer)</span>
              </div>

              <div className="options-list">
                {options.map((option) => {
                  const isCorrect = correctOptionId === option.id
                  return (
                    <div key={option.id} className={`option-row ${isCorrect ? 'option-row-correct' : ''}`}>
                      <label className="option-radio-label">
                        <input
                          type="radio"
                          name="correct-option-group"
                          checked={isCorrect}
                          onChange={() => setCorrectOptionId(option.id)}
                          className="option-radio-input"
                        />
                        <span className="option-letter-badge">{option.id}</span>
                      </label>

                      <div className="option-input-container">
                        <input
                          type="text"
                          className="form-input option-text-input"
                          placeholder={`Option ${option.id} text`}
                          value={option.text}
                          onChange={(e) => handleOptionTextChange(option.id, e.target.value)}
                        />

                        {/* Hidden File Input per Option */}
                        <input
                          type="file"
                          accept="image/*"
                          className="visually-hidden"
                          ref={(el) => {
                            optionFileInputRefs.current[option.id] = el
                          }}
                          onChange={(e) => handleOptionImageUpload(option.id, e)}
                        />

                        {/* Option Image Preview or Upload Button */}
                        {option.image ? (
                          <div className="option-image-preview-inline">
                            <img src={option.image} alt={`Option ${option.id}`} />
                            <button
                              type="button"
                              className="remove-option-img-btn"
                              onClick={() => handleRemoveOptionImage(option.id)}
                              title="Remove Option Image"
                              aria-label="Remove Option Image"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="option-attach-img-btn"
                            onClick={() => optionFileInputRefs.current[option.id]?.click()}
                            title="Attach Option Image"
                          >
                            <ImageIcon />
                            <span>Image</span>
                          </button>
                        )}
                      </div>

                      {isCorrect && (
                        <div className="option-actions">
                          <span className="correct-answer-label">Correct Answer</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="step-2-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setStep(1)}
              >
                Cancel
              </button>

              <div className="right-action-buttons">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleAddQuestion}
                >
                  Add Question
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveAndContinue}
                >
                  Save / Continue
                </button>
              </div>
            </div>
          </article>
        )}

        {step === 3 && (
          <article className="card create-exam-card student-preview-card">
            {/* Publish Success & Share Link Section */}
            {isPublished && publicToken && (
              <div className="publish-success-section">
                <div className="publish-success-header">
                  <span className="success-icon" aria-hidden="true">✓</span>
                  <div className="publish-success-text">
                    <h3 className="publish-success-title">Exam Published Successfully!</h3>
                    <p className="publish-success-desc">
                      Your exam is live. Share the link below with students to take the exam.
                    </p>
                  </div>
                </div>
                <div className="publish-share-box">
                  <input
                    type="text"
                    readOnly
                    className="form-input share-url-input"
                    value={`${window.location.origin}/exam/${publicToken}`}
                  />
                  <div className="share-actions">
                    <button
                      type="button"
                      className="btn btn-primary copy-link-btn"
                      onClick={handleCopyLink}
                    >
                      {copied ? 'Copied!' : 'Copy Link'}
                    </button>
                    <a
                      href={`${window.location.origin}/exam/${publicToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline open-exam-btn"
                    >
                      Open Exam ↗
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Top Navigation Header Bar */}
            <div className="student-header-bar">
              <button
                type="button"
                className="btn btn-outline student-nav-btn"
                disabled={previewPage === 1}
                onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
              >
                <ArrowLeftIcon />
                Previous
              </button>

              <div className="student-lang-display">
                <GlobeIcon />
                <span>{language || 'English'}</span>
                <ChevronIcon />
              </div>

              <button
                type="button"
                className="btn btn-primary student-nav-btn"
                disabled={previewPage === totalPages}
                onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ArrowIcon />
              </button>
            </div>

            {/* Page Counter & Circular Navigation */}
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
                    onClick={() => setPreviewPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>
            </div>

            {/* Exam Section Title Line */}
            <div className="student-section-header">
              <h2 className="student-exam-title">{title || 'NEET Biology Mock Test'}</h2>
              <span className="student-questions-badge">{displayedQuestions.length} Questions</span>
            </div>

            {/* Questions List (5 questions per page, vertical scrollable) */}
            <div className="student-questions-list">
              {displayedQuestions.map((q, idx) => {
                const globalIndex = (previewPage - 1) * questionsPerPage + idx + 1
                return (
                  <div key={q.id} className="student-question-item">
                    <div className="student-q-badge">{globalIndex}</div>

                    <div className="student-q-content">
                      <h3 className="student-q-text">{q.text || `Question ${globalIndex}`}</h3>

                      <div className="student-options-list">
                        {q.options.map((opt) => {
                          const isChecked = studentAnswers[q.id] === opt.id
                          return (
                            <label key={opt.id} className="student-option-row">
                              <input
                                type="radio"
                                name={`student-q-${q.id}`}
                                checked={isChecked}
                                onChange={() => handleStudentAnswerSelect(q.id, opt.id)}
                                className="student-option-radio"
                              />
                              <div className="student-option-content">
                                {(opt.text || !opt.image) && (
                                  <span className="student-option-text">
                                    <strong>{opt.id}.</strong> {opt.text}
                                  </span>
                                )}
                                {!opt.text && opt.image && <strong className="student-option-letter">{opt.id}.</strong>}
                                {opt.image && (
                                  <div className="student-option-image-wrapper">
                                    <img src={opt.image} alt={`Option ${opt.id}`} className="student-option-image" />
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

            {/* Bottom Action Footer */}
            <div className="student-footer-bar">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setStep(2)}
              >
                ‹ Back to Question Builder
              </button>

              <button
                type="button"
                className="btn btn-primary student-submit-btn"
                onClick={handlePublishExam}
              >
                <SendIcon />
                {isPublished ? 'Exam Published' : 'Publish Exam'}
              </button>
            </div>
          </article>
        )}
      </div>
    </section>
  )
}

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function ArrowLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg
      className="input-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg
      className="input-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg
      className="select-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}



