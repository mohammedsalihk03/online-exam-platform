import { randomUUID, createHash } from 'crypto'
import { supabase, isSupabaseConfigured } from './supabase.js'
import { translateTextsLocal, languageCodeMap } from './translator.js'

export interface ExamRecord {
  id: string
  title: string
  description: string
  questionCount: number
  durationMinutes: number
  startTime: string
  endTime: string
  defaultLanguage: string
  status: 'draft' | 'published'
  creatorToken: string
  publicToken: string
  createdAt: string
  updatedAt: string
}

export interface OptionTranslationRecord {
  language: string
  optionText: string
}

export interface QuestionOptionRecord {
  id?: string
  optionLetter: 'A' | 'B' | 'C' | 'D'
  optionText: string
  imageUrl?: string | null
  isCorrect?: boolean
  translations?: OptionTranslationRecord[]
}

export interface QuestionRecord {
  id: string
  examId: string
  questionOrder: number
  imageUrl: string | null
  questionText: string
  language: string
  translations?: { language: string; questionText: string }[]
  options: QuestionOptionRecord[]
  createdAt?: string
}

// In-Memory Fallback Database
const memoryExams = new Map<string, ExamRecord>()
const memoryQuestions = new Map<string, QuestionRecord[]>()

// Default sample data for fallback memory store
const sampleExamId = 'def00000-0000-4000-8000-000000000001'
const samplePublicToken = 'NEETBIO123'
const sampleCreatorToken = 'creator-token-neet-123'

const initialExam: ExamRecord = {
  id: sampleExamId,
  title: 'NEET Biology Mock Test',
  description: 'Full syllabus mock test for NEET aspirants.',
  questionCount: 60,
  durationMinutes: 90,
  startTime: '2024-01-01T00:00:00Z',
  endTime: '2030-12-31T23:59:59Z',
  defaultLanguage: 'English',
  status: 'published',
  creatorToken: sampleCreatorToken,
  publicToken: samplePublicToken,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

memoryExams.set(sampleExamId, initialExam)
memoryExams.set(sampleCreatorToken, initialExam)
memoryExams.set(samplePublicToken, initialExam)
memoryExams.set(`pub_${samplePublicToken}`, initialExam)

memoryQuestions.set(sampleExamId, [])

// API Store Operations
export async function createExamStore(data: {
  title: string
  description?: string
  questionCount?: number
  durationMinutes?: number
  startTime?: string
  endTime?: string
  defaultLanguage?: string
}): Promise<ExamRecord> {
  const id = randomUUID()
  const creatorToken = `creator_${randomUUID().replaceAll('-', '')}`
  const publicToken = `pub_${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`
  const now = new Date().toISOString()

  const newExam: ExamRecord = {
    id,
    title: data.title || 'Untitled Exam',
    description: data.description || '',
    questionCount: data.questionCount || 60,
    durationMinutes: data.durationMinutes || 90,
    startTime: data.startTime || now,
    endTime: data.endTime || '2030-12-31T23:59:59Z',
    defaultLanguage: data.defaultLanguage || 'English',
    status: 'draft',
    creatorToken,
    publicToken,
    createdAt: now,
    updatedAt: now,
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: dbData, error } = await supabase
        .from('exams')
        .insert([
          {
            id: newExam.id,
            title: newExam.title,
            description: newExam.description,
            question_count: newExam.questionCount,
            duration_minutes: newExam.durationMinutes,
            start_time: newExam.startTime,
            end_time: newExam.endTime,
            default_language: newExam.defaultLanguage,
            status: newExam.status,
            creator_token: newExam.creatorToken,
            public_token: newExam.publicToken,
          },
        ])
        .select()
        .single()

      if (error) {
        console.error('Supabase error inserting exam:', error.message)
      } else if (dbData) {
        return {
          id: dbData.id,
          title: dbData.title,
          description: dbData.description,
          questionCount: dbData.question_count,
          durationMinutes: dbData.duration_minutes,
          startTime: dbData.start_time,
          endTime: dbData.end_time,
          defaultLanguage: dbData.default_language,
          status: dbData.status,
          creatorToken: dbData.creator_token,
          publicToken: dbData.public_token,
          createdAt: dbData.created_at,
          updatedAt: dbData.updated_at,
        }
      }
    } catch (e) {
      console.error('Supabase exception:', e)
    }
  }

  // Fallback / In-Memory
  indexExamInMemory(newExam)
  memoryQuestions.set(id, [])
  return newExam
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function indexExamInMemory(exam: ExamRecord): void {
  memoryExams.set(exam.id, exam)
  memoryExams.set(exam.creatorToken, exam)
  memoryExams.set(exam.publicToken, exam)
  if (!exam.publicToken.startsWith('pub_')) {
    memoryExams.set(`pub_${exam.publicToken}`, exam)
  }
}

function mapExamRow(data: any): ExamRecord {
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    questionCount: data.question_count,
    durationMinutes: data.duration_minutes,
    startTime: data.start_time,
    endTime: data.end_time,
    defaultLanguage: data.default_language,
    status: data.status,
    creatorToken: data.creator_token,
    publicToken: data.public_token,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

/** Public student routes only — never accepts creator tokens or bare exam UUIDs. */
export async function getExamByPublicTokenStore(publicToken: string): Promise<ExamRecord | null> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .eq('public_token', publicToken)
        .single()

      if (!error && data) return mapExamRow(data)
    } catch (e) {
      console.error('Supabase exception in getExamByPublicToken:', e)
    }
  }

  return memoryExams.get(publicToken) || memoryExams.get(`pub_${publicToken}`) || null
}

/** Creator routes only — accepts exam UUID or creator_token, never public_token. */
export async function getExamByCreatorIdentifierStore(identifier: string): Promise<ExamRecord | null> {
  if (!UUID_PATTERN.test(identifier) && !identifier.startsWith('creator_')) {
    return null
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const field = UUID_PATTERN.test(identifier) ? 'id' : 'creator_token'
      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .eq(field, identifier)
        .single()

      if (!error && data) return mapExamRow(data)
    } catch (e) {
      console.error('Supabase exception in getExamByCreatorIdentifier:', e)
    }
  }

  if (UUID_PATTERN.test(identifier)) {
    return memoryExams.get(identifier) || null
  }
  return memoryExams.get(identifier) || null
}

/** @deprecated Internal scoring only — loads exam by public token for submit handler. */
export async function getExamByIdOrTokenStore(identifier: string): Promise<ExamRecord | null> {
  return getExamByPublicTokenStore(identifier)
}

export async function getExamStatisticsStore(): Promise<{ totalExams: number; activeExams: number }> {
  const now = new Date()

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('exams').select('status, start_time, end_time')

      if (!error && data) {
        return {
          totalExams: data.length,
          activeExams: data.filter((exam) =>
            exam.status === 'published' && now >= new Date(exam.start_time) && now <= new Date(exam.end_time)
          ).length,
        }
      }
    } catch (e) {
      console.error('Supabase exception fetching exam statistics:', e)
    }
  }

  const exams = [...new Map([...memoryExams.values()].map((exam) => [exam.id, exam])).values()]
  return {
    totalExams: exams.length,
    activeExams: exams.filter((exam) =>
      exam.status === 'published' && now >= new Date(exam.startTime) && now <= new Date(exam.endTime)
    ).length,
  }
}

export async function getRecentExamsStore(limit = 5): Promise<ExamRecord[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (!error && data) {
        return data.map((exam: any) => ({
          id: exam.id,
          title: exam.title,
          description: exam.description,
          questionCount: exam.question_count,
          durationMinutes: exam.duration_minutes,
          startTime: exam.start_time,
          endTime: exam.end_time,
          defaultLanguage: exam.default_language,
          status: exam.status,
          creatorToken: exam.creator_token,
          publicToken: exam.public_token,
          createdAt: exam.created_at,
          updatedAt: exam.updated_at,
        }))
      }
    } catch (e) {
      console.error('Supabase exception fetching recent exams:', e)
    }
  }

  return [...new Map([...memoryExams.values()].map((exam) => [exam.id, exam])).values()]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}

// A source fingerprint invalidates old English fallbacks and results from edited text.
function sourceHash(text: string): string {
  return createHash('sha256').update('translation-v2:' + text).digest('hex')
}

type TranslationJob = { state: 'pending' | 'failed'; retryAt: number }
const translationJobs = new Map<string, TranslationJob>()

function hasTranslation(q: QuestionRecord, language: string): boolean {
  return (!q.questionText.trim() || Boolean(q.translations?.some(t => t.language === language && t.questionText.trim()))) &&
    q.options.every(o => !o.optionText.trim() || o.translations?.some(t => t.language === language && t.optionText.trim()))
}

export function ensureTranslations(examId: string, questions: QuestionRecord[], language: string): 'ready' | 'pending' | 'failed' {
  if (!languageCodeMap[language]) throw new Error('Unsupported language')
  if (language === 'English') return 'ready'
  let state: 'ready' | 'pending' | 'failed' = 'ready'
  for (const q of questions) {
    if (hasTranslation(q, language)) continue
    const fingerprint = sourceHash(JSON.stringify([q.questionText, ...q.options.map(o => [o.optionLetter, o.optionText])]))
    const key = `${examId}:${q.id}:${language}:${fingerprint}`
    let job = translationJobs.get(key)
    if (!job || (job.state === 'failed' && Date.now() >= job.retryAt)) {
      job = { state: 'pending', retryAt: 0 }
      translationJobs.set(key, job)
      const currentJob = job
      void generateTranslation(examId, q, language).then(() => {
        translationJobs.delete(key)
      }).catch(error => {
        console.warn(`Translation failed (${q.id}, ${language}):`, error instanceof Error ? error.message : error)
        currentJob.state = 'failed'
        currentJob.retryAt = Date.now() + 30_000
        // Failed entries need only survive the retry cooldown.
        setTimeout(() => { if (translationJobs.get(key) === currentJob) translationJobs.delete(key) }, 30_000).unref()
      })
    }
    if (job.state === 'failed') state = 'failed'
    else if (state !== 'failed') state = 'pending'
  }
  return state
}

async function generateTranslation(examId: string, q: QuestionRecord, language: string): Promise<void> {
  const sources = [q.questionText, ...q.options.map(o => o.optionText)]
  let batch: string[]
  try {
    batch = await translateTextsLocal(sources, language)
  } catch (error) {
    console.error(`Translation batch failed (${q.id}, ${language}):`, error instanceof Error ? error.message : error)
    batch = [...sources]
  }
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('question_translations').upsert([{
      question_id: q.id, language, question_text: batch[0], source_hash: sourceHash(q.questionText),
    }], { onConflict: 'question_id,language' })
    if (error) throw error
    for (const [index, option] of q.options.entries()) {
      if (!option.id) throw new Error('Cannot persist translation without option ID')
      const { error } = await supabase.from('option_translations').upsert([{
        option_id: option.id, language, option_text: batch[index + 1], source_hash: sourceHash(option.optionText),
      }], { onConflict: 'option_id,language' })
      if (error) throw error
    }
  }
  const current = memoryQuestions.get(examId)?.find(item => item.id === q.id)
  if (!current) return
  if (current.questionText === q.questionText) {
    current.translations = [...(current.translations || []).filter(t => t.language !== language), { language, questionText: batch[0] }]
  }
  for (const [index, oldOption] of q.options.entries()) {
    const option = current.options.find(o => o.optionLetter === oldOption.optionLetter)
    if (option && option.optionText === oldOption.optionText) {
      option.translations = [...(option.translations || []).filter(t => t.language !== language), { language, optionText: batch[index + 1] }]
    }
  }
}

export async function saveQuestionStore(
  examId: string,
  data: {
    id?: string
    questionOrder: number
    questionText: string
    language?: string
    imageUrl?: string | null
    options: QuestionOptionRecord[]
  }
): Promise<QuestionRecord> {
  // The existing builder uses local IDs such as q-1; Supabase requires UUIDs.
  // Resolve those IDs by exam/order so navigation updates the same stored question.
  let qId = data.id
  if (!qId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(qId)) {
    const existing = await getQuestionsByExamIdStore(examId)
    qId = existing.find(q => q.questionOrder === data.questionOrder)?.id || randomUUID()
  }
  const sourceLang = data.language || 'English'

  const qRecord: QuestionRecord = {
    id: qId,
    examId,
    questionOrder: data.questionOrder,
    imageUrl: data.imageUrl || null,
    questionText: data.questionText,
    language: sourceLang,
    translations: [{ language: sourceLang, questionText: data.questionText }],
    options: data.options.map((opt) => ({
      ...opt,
      translations: [{ language: sourceLang, optionText: opt.optionText }],
    })),
  }

  if (isSupabaseConfigured && supabase) {
    try {
      // Upsert Question
      const { error: qErr } = await supabase.from('questions').upsert([
        {
          id: qRecord.id,
          exam_id: examId,
          question_order: qRecord.questionOrder,
          image_url: qRecord.imageUrl,
        },
      ])

      if (qErr) throw qErr
      if (!qErr) {
        // Upsert Translation for source language
        const { error: sourceError } = await supabase.from('question_translations').upsert([
          {
            question_id: qRecord.id,
            language: qRecord.language,
            question_text: qRecord.questionText,
          },
        ], { onConflict: 'question_id,language' })
        if (sourceError) throw sourceError

        // Upsert Options
        for (const opt of qRecord.options) {
          const { data: savedOpt, error: optionError } = await supabase
            .from('question_options')
            .upsert([
              {
                question_id: qRecord.id,
                option_letter: opt.optionLetter,
                option_text: opt.optionText,
                image_url: opt.imageUrl || null,
                is_correct: opt.isCorrect,
              },
            ], { onConflict: 'question_id,option_letter' })
            .select()
            .single()

          if (optionError) throw optionError
          const optId = savedOpt?.id || opt.id
          if (optId) {
            opt.id = optId
            const { error: optionTranslationError } = await supabase.from('option_translations').upsert([
              {
                option_id: optId,
                language: qRecord.language,
                option_text: opt.optionText,
              },
            ], { onConflict: 'option_id,language' })
            if (optionTranslationError) throw optionTranslationError
          }
        }
      }
    } catch (e) {
      console.error('Supabase exception saving question:', e)
      throw e
    }
  }

  // Memory fallback
  const list = memoryQuestions.get(examId) || []
  const existingIdx = list.findIndex((q) => q.id === qId || q.questionOrder === data.questionOrder)
  if (existingIdx >= 0) {
    list[existingIdx] = qRecord
  } else {
    list.push(qRecord)
  }
  memoryQuestions.set(examId, list)

  for (const language of ['Hindi', 'Arabic', 'Malayalam', 'Urdu']) {
    ensureTranslations(examId, [qRecord], language)
  }

  return qRecord
}

export async function getQuestionsByExamIdStore(
  examId: string,
  isPublic = false
): Promise<QuestionRecord[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: qData, error: qErr } = await supabase
        .from('questions')
        .select(`
          id,
          question_order,
          image_url,
          question_translations (language, question_text, source_hash),
          question_options (id, option_letter, option_text, image_url, is_correct, option_translations (language, option_text, source_hash))
        `)
        .eq('exam_id', examId)
        .order('question_order', { ascending: true })

      if (qErr) throw qErr
      if (!qErr && qData) {
        return qData.map((q: any) => {
          const englishText = (q.question_translations || []).find((t: any) => t.language === 'English')?.question_text || ''
          const translations = (q.question_translations || []).filter((t: any) => t.language === 'English' || t.source_hash === sourceHash(englishText)).map((t: any) => ({
            language: t.language,
            questionText: t.question_text,
          }))
          const mainTrans = translations.find((t: any) => t.language === 'English') || translations[0]
          const opts = (q.question_options || []).map((o: any) => {
            const optTranslations = (o.option_translations || []).filter((t: any) => t.language === 'English' || t.source_hash === sourceHash(o.option_text)).map((ot: any) => ({
              language: ot.language,
              optionText: ot.option_text,
            }))
            return {
              id: o.id,
              optionLetter: o.option_letter,
              optionText: o.option_text,
              imageUrl: o.image_url || null,
              ...(isPublic ? {} : { isCorrect: Boolean(o.is_correct) }),
              translations: optTranslations.length > 0 ? optTranslations : [{ language: 'English', optionText: o.option_text }],
            }
          })

          return {
            id: q.id,
            examId,
            questionOrder: q.question_order,
            imageUrl: q.image_url,
            questionText: mainTrans?.questionText || '',
            language: mainTrans?.language || 'English',
            translations,
            options: opts,
          }
        })
      }
    } catch (e) {
      console.error('Supabase exception fetching questions:', e)
      throw e
    }
  }

  // Memory fallback
  const list = memoryQuestions.get(examId) || []

  if (isPublic) {
    // SECURITY ENFORCEMENT: Strip isCorrect for public student requests!
    return list.map((q) => ({
      ...q,
      translations: q.translations || [{ language: q.language || 'English', questionText: q.questionText }],
      options: q.options.map(({ isCorrect: _isCorrect, ...o }) => ({
        ...o,
        optionLetter: o.optionLetter,
        optionText: o.optionText,
        imageUrl: o.imageUrl || null,
        translations: o.translations || [{ language: q.language || 'English', optionText: o.optionText }],
      })),
    }))
  }

  return list.map((q) => ({
    ...q,
    translations: q.translations || [{ language: q.language || 'English', questionText: q.questionText }],
    options: q.options.map((o) => ({
      ...o,
      translations: o.translations || [{ language: q.language || 'English', optionText: o.optionText }],
    })),
  }))

  return list
}

export async function publishExamStore(examId: string): Promise<ExamRecord | null> {
  const exam = await getExamByCreatorIdentifierStore(examId)
  if (!exam) return null

  if (!exam.publicToken) {
    exam.publicToken = `pub_${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`
  }

  exam.status = 'published'
  exam.updatedAt = new Date().toISOString()

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('exams').update({ status: 'published', public_token: exam.publicToken, updated_at: exam.updatedAt }).eq('id', exam.id)
    } catch (e) {
      console.error('Supabase error publishing exam:', e)
    }
  }

  indexExamInMemory(exam)
  return exam
}

export async function uploadImageStore(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  // Validate Image MIME type & size
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedMimeTypes.includes(mimeType)) {
    throw new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF images are allowed.')
  }
  if (fileBuffer.length > 5 * 1024 * 1024) {
    throw new Error('File size exceeds 5MB limit.')
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const storagePath = `questions/${Date.now()}_${fileName.replaceAll(/[^a-zA-Z0-9._-]/g, '')}`
      const { error } = await supabase.storage
        .from('exam-images')
        .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: true })

      if (!error) {
        const { data: publicUrlData } = supabase.storage.from('exam-images').getPublicUrl(storagePath)
        if (publicUrlData?.publicUrl) {
          return publicUrlData.publicUrl
        }
      } else {
        console.error('Supabase storage upload error:', error.message)
      }
    } catch (e) {
      console.error('Supabase storage exception:', e)
    }
  }

  // Fallback: Inline Base64 Data URL
  const base64 = fileBuffer.toString('base64')
  return `data:${mimeType};base64,${base64}`
}
