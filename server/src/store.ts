import { randomUUID } from 'crypto'
import { supabase, isSupabaseConfigured } from './supabase.js'
import { translateTextsLocal } from './translator.js'

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
  isCorrect: boolean
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
memoryExams.set(`pub_${samplePublicToken}`, initialExam)
memoryExams.set(`creator_${sampleCreatorToken}`, initialExam)

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
  memoryExams.set(id, newExam)
  memoryExams.set(publicToken, newExam)
  memoryExams.set(`creator_${creatorToken}`, newExam)
  memoryExams.set(`pub_${publicToken}`, newExam)
  memoryQuestions.set(id, [])
  return newExam
}

export async function getExamByIdOrTokenStore(identifier: string): Promise<ExamRecord | null> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .or(`id.eq.${identifier},creator_token.eq.${identifier},public_token.eq.${identifier}`)
        .single()

      if (!error && data) {
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
    } catch (e) {
      console.error('Supabase exception in getExam:', e)
    }
  }

  return (
    memoryExams.get(identifier) ||
    memoryExams.get(`creator_${identifier}`) ||
    memoryExams.get(`pub_${identifier}`) ||
    null
  )
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

async function generateAndSaveTranslationsAsync(
  examId: string,
  questionId: string,
  questionText: string,
  options: QuestionOptionRecord[]
): Promise<void> {
  const autoLanguages = ['Hindi', 'Arabic', 'Urdu']
  const sourceTexts = [questionText, ...options.map((o) => o.optionText)]

  try {
    const results = await Promise.all(
      autoLanguages.map(async (lang) => {
        try {
          const translatedBatch = await translateTextsLocal(sourceTexts, lang)
          return {
            language: lang,
            questionText: translatedBatch[0] || questionText,
            optionTexts: options.map((_, idx) => translatedBatch[idx + 1] || options[idx].optionText),
          }
        } catch (e) {
          console.warn(`Translation error for ${lang}:`, e)
          return null
        }
      })
    )

    for (const res of results) {
      if (!res) continue

      // 1. Supabase update
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('question_translations').upsert([
            {
              question_id: questionId,
              language: res.language,
              question_text: res.questionText,
            },
          ])

          for (let i = 0; i < options.length; i++) {
            const opt = options[i]
            if (opt.id) {
              await supabase.from('option_translations').upsert([
                {
                  option_id: opt.id,
                  language: res.language,
                  option_text: res.optionTexts[i] || opt.optionText,
                },
              ])
            }
          }
        } catch (dbErr) {
          console.warn('Supabase update warning for async translations:', dbErr)
        }
      }

      // 2. Memory store update
      const list = memoryQuestions.get(examId) || []
      const qIdx = list.findIndex((q) => q.id === questionId)
      if (qIdx >= 0) {
        const q = list[qIdx]
        const qTrans = q.translations || [{ language: q.language || 'English', questionText: q.questionText }]
        const existingQTIdx = qTrans.findIndex((t) => t.language === res.language)
        if (existingQTIdx >= 0) {
          qTrans[existingQTIdx] = { language: res.language, questionText: res.questionText }
        } else {
          qTrans.push({ language: res.language, questionText: res.questionText })
        }
        q.translations = qTrans

        q.options = q.options.map((opt, optIdx) => {
          const optTrans = opt.translations || [{ language: q.language || 'English', optionText: opt.optionText }]
          const existingOTIdx = optTrans.findIndex((t) => t.language === res.language)
          const textForLang = res.optionTexts[optIdx] || opt.optionText
          if (existingOTIdx >= 0) {
            optTrans[existingOTIdx] = { language: res.language, optionText: textForLang }
          } else {
            optTrans.push({ language: res.language, optionText: textForLang })
          }
          return {
            ...opt,
            translations: optTrans,
          }
        })

        list[qIdx] = q
        memoryQuestions.set(examId, list)
      }
    }
  } catch (err) {
    console.warn('Async translation error:', err)
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
  const qId = data.id || randomUUID()
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

      if (!qErr) {
        // Upsert Translation for source language
        await supabase.from('question_translations').upsert([
          {
            question_id: qRecord.id,
            language: qRecord.language,
            question_text: qRecord.questionText,
          },
        ])

        // Upsert Options
        for (const opt of qRecord.options) {
          const { data: savedOpt } = await supabase
            .from('question_options')
            .upsert([
              {
                question_id: qRecord.id,
                option_letter: opt.optionLetter,
                option_text: opt.optionText,
                image_url: opt.imageUrl || null,
                is_correct: opt.isCorrect,
              },
            ])
            .select()
            .single()

          const optId = savedOpt?.id || opt.id
          if (optId) {
            opt.id = optId
            await supabase.from('option_translations').upsert([
              {
                option_id: optId,
                language: qRecord.language,
                option_text: opt.optionText,
              },
            ])
          }
        }
      }
    } catch (e) {
      console.error('Supabase exception saving question:', e)
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

  // Asynchronously generate Hindi, Arabic, Urdu translations in background (parallel non-blocking)
  generateAndSaveTranslationsAsync(examId, qRecord.id, data.questionText, qRecord.options).catch(
    (err) => console.warn('Background translation error:', err)
  )

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
          question_translations (language, question_text),
          question_options (id, option_letter, option_text, image_url, is_correct, option_translations (language, option_text))
        `)
        .eq('exam_id', examId)
        .order('question_order', { ascending: true })

      if (!qErr && qData) {
        return qData.map((q: any) => {
          const translations = (q.question_translations || []).map((t: any) => ({
            language: t.language,
            questionText: t.question_text,
          }))
          const mainTrans = translations.find((t: any) => t.language === 'English') || translations[0]
          const opts = (q.question_options || []).map((o: any) => {
            const optTranslations = (o.option_translations || []).map((ot: any) => ({
              language: ot.language,
              optionText: ot.option_text,
            }))
            return {
              id: o.id,
              optionLetter: o.option_letter,
              optionText: o.option_text,
              imageUrl: o.image_url || null,
              isCorrect: isPublic ? false : Boolean(o.is_correct),
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
    }
  }

  // Memory fallback
  const list = memoryQuestions.get(examId) || []

  if (isPublic) {
    // SECURITY ENFORCEMENT: Strip isCorrect for public student requests!
    return list.map((q) => ({
      ...q,
      translations: q.translations || [{ language: q.language || 'English', questionText: q.questionText }],
      options: q.options.map((o) => ({
        ...o,
        optionLetter: o.optionLetter,
        optionText: o.optionText,
        imageUrl: o.imageUrl || null,
        isCorrect: false, // Stripped!
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
  const exam = await getExamByIdOrTokenStore(examId)
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

  memoryExams.set(exam.id, exam)
  memoryExams.set(exam.publicToken, exam)
  memoryExams.set(`pub_${exam.publicToken}`, exam)
  memoryExams.set(`creator_${exam.creatorToken}`, exam)
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
