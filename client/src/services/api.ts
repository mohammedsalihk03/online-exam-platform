const API_BASE_URL = 'http://localhost:3001/api'

export interface ExamData {
  id?: string
  title: string
  description?: string
  questionCount?: number
  durationMinutes?: number
  startTime?: string
  endTime?: string
  defaultLanguage?: string
  creatorToken?: string
  publicToken?: string
  status?: string
}

export interface QuestionData {
  id?: string
  questionOrder: number
  questionText: string
  language?: string
  imageUrl?: string | null
  options: {
    id: 'A' | 'B' | 'C' | 'D'
    text: string
    imageUrl?: string | null
    isCorrect?: boolean
    translations?: { language: string; optionText: string }[]
  }[]
  correctOptionId?: 'A' | 'B' | 'C' | 'D'
}

export async function getExamStatisticsApi() {
  try {
    const res = await fetch(`${API_BASE_URL}/exams/statistics`)
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Failed to fetch exam statistics')
    return json as { totalExams: number; activeExams: number }
  } catch (error) {
    console.warn('Failed to fetch exam statistics:', error)
    return null
  }
}

export interface RecentExamData {
  id: string
  title: string
  questionCount: number
  durationMinutes: number
  status: 'draft' | 'published'
  createdAt: string
}

export async function getRecentExamsApi() {
  try {
    const res = await fetch(`${API_BASE_URL}/exams/recent`)
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Failed to fetch recent exams')
    return json.exams as RecentExamData[]
  } catch (error) {
    console.warn('Failed to fetch recent exams:', error)
    return null
  }
}

// 1. Create Exam (Step 1)
export async function createExamApi(data: ExamData) {
  try {
    const res = await fetch(`${API_BASE_URL}/exams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Failed to create exam')
    return json.exam
  } catch (error) {
    console.warn('API call failed, falling back to local state:', error)
    return null
  }
}

// 2. Save Question (Step 2)
export async function saveQuestionApi(examId: string, question: QuestionData) {
  try {
    const res = await fetch(`${API_BASE_URL}/creator/exams/${examId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: question.id,
        questionOrder: question.questionOrder,
        questionText: question.questionText,
        language: question.language,
        imageUrl: question.imageUrl,
        correctOptionId: question.correctOptionId,
        options: question.options.map((o) => ({
          optionLetter: o.id,
          optionText: o.text,
          imageUrl: o.imageUrl || null,
          isCorrect: o.id === question.correctOptionId,
          translations: o.translations,
        })),
      }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Failed to save question')
    return json.question
  } catch (error) {
    console.warn('API call failed, falling back to local state:', error)
    return null
  }
}

// 3. Upload Image to Supabase / Backend Storage
export async function uploadImageApi(base64Data: string, fileName: string, mimeType: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data, fileName, mimeType }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Failed to upload image')
    return json.imageUrl as string
  } catch (error) {
    console.warn('Image upload API call failed, using inline data URL:', error)
    return base64Data
  }
}

// 4. Publish Exam
export async function publishExamApi(examId: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/creator/exams/${examId}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Failed to publish exam')
    return json
  } catch (error) {
    console.warn('Publish API call failed:', error)
    return null
  }
}

// 5. Fetch Public Student Exam Data (Strips is_correct for Security!)
export async function getPublicExamApi(publicToken: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/public/exams/${publicToken}`)
    const json = await res.json()
    if (!res.ok) {
      return {
        error: json.error || 'Exam not found',
        availability: json.availability || 'error',
        startTime: json.startTime,
        endTime: json.endTime,
        examTitle: json.examTitle,
      }
    }
    return json
  } catch (error) {
    console.warn('Failed to fetch public exam API:', error)
    return null
  }
}

// 6. Submit Student Exam Answers
export async function submitStudentExamApi(publicToken: string, answers: { [qId: string]: string }) {
  try {
    const res = await fetch(`${API_BASE_URL}/public/exams/${publicToken}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Failed to submit exam')
    return json
  } catch (error) {
    console.warn('Submit student exam failed:', error)
    return null
  }
}
