import cors from 'cors'
import express from 'express'
import dotenv from 'dotenv'
import {
  createExamStore,
  getExamByIdOrTokenStore,
  getExamStatisticsStore,
  getRecentExamsStore,
  saveQuestionStore,
  getQuestionsByExamIdStore,
  publishExamStore,
  uploadImageStore,
} from './store.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT ?? 3001

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'xmwindow-api', timestamp: new Date().toISOString() })
})

app.get('/api/exams/statistics', async (_req, res) => {
  try {
    return res.json(await getExamStatisticsStore())
  } catch (error: any) {
    console.error('Error fetching exam statistics:', error)
    return res.status(500).json({ error: 'Failed to fetch exam statistics' })
  }
})

app.get('/api/exams/recent', async (_req, res) => {
  try {
    const exams = await getRecentExamsStore(5)
    return res.json({
      exams: exams.map((exam) => ({
        id: exam.id,
        title: exam.title,
        questionCount: exam.questionCount,
        durationMinutes: exam.durationMinutes,
        status: exam.status,
        createdAt: exam.createdAt,
      })),
    })
  } catch (error: any) {
    console.error('Error fetching recent exams:', error)
    return res.status(500).json({ error: 'Failed to fetch recent exams' })
  }
})

/* ==========================================================================
   Creator API Routes
   ========================================================================== */

// 1. Create Exam (Step 1)
app.post('/api/exams', async (req, res) => {
  try {
    const { title, description, questionCount, durationMinutes, startTime, endTime, defaultLanguage } = req.body

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Exam title is required' })
    }

    const exam = await createExamStore({
      title: title.trim(),
      description,
      questionCount: Number(questionCount) || 60,
      durationMinutes: Number(durationMinutes) || 90,
      startTime,
      endTime,
      defaultLanguage,
    })

    return res.status(201).json({ success: true, exam })
  } catch (error: any) {
    console.error('Error creating exam:', error)
    return res.status(500).json({ error: error.message || 'Failed to create exam' })
  }
})

// 2. Get Creator Exam Details & Questions (With Correct Answers)
app.get('/api/creator/exams/:id', async (req, res) => {
  try {
    const { id } = req.params
    const exam = await getExamByIdOrTokenStore(id)
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' })
    }

    const questions = await getQuestionsByExamIdStore(exam.id, false) // false = include correct answers for creator!

    return res.json({
      success: true,
      exam,
      questions,
    })
  } catch (error: any) {
    console.error('Error fetching creator exam:', error)
    return res.status(500).json({ error: 'Failed to fetch exam details' })
  }
})

// 3. Save Question to Exam
app.post('/api/creator/exams/:id/questions', async (req, res) => {
  try {
    const { id } = req.params
    const { questionId, questionOrder, questionText, language, imageUrl, options } = req.body

    const exam = await getExamByIdOrTokenStore(id)
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' })
    }

    if (!Array.isArray(options) || options.length === 0) {
      return res.status(400).json({ error: 'At least 1 option is required' })
    }

    const savedQ = await saveQuestionStore(exam.id, {
      id: questionId,
      questionOrder: Number(questionOrder) || 1,
      questionText: questionText || '',
      language: language || exam.defaultLanguage,
      imageUrl,
      options: options.map((opt: any) => ({
        optionLetter: opt.optionLetter || opt.id,
        optionText: opt.optionText || opt.text || '',
        imageUrl: opt.imageUrl || opt.image || null,
        isCorrect: Boolean(opt.isCorrect || opt.id === req.body.correctOptionId),
        translations: opt.translations || [],
      })),
    })

    return res.json({ success: true, question: savedQ })
  } catch (error: any) {
    console.error('Error saving question:', error)
    return res.status(500).json({ error: error.message || 'Failed to save question' })
  }
})

// 4. Publish Exam
app.post('/api/creator/exams/:id/publish', async (req, res) => {
  try {
    const { id } = req.params
    const publishedExam = await publishExamStore(id)

    if (!publishedExam) {
      return res.status(404).json({ error: 'Exam not found' })
    }

    return res.json({
      success: true,
      message: 'Exam published successfully',
      exam: publishedExam,
      shareUrl: `/exam/${publishedExam.publicToken}`,
    })
  } catch (error: any) {
    console.error('Error publishing exam:', error)
    return res.status(500).json({ error: 'Failed to publish exam' })
  }
})

// 5. Image Upload Endpoint (Base64 / File Buffer)
app.post('/api/upload', async (req, res) => {
  try {
    const { base64Data, fileName, mimeType } = req.body

    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'Image data and mimeType are required' })
    }

    // Strip prefix if included
    const cleanBase64 = base64Data.includes('base64,') ? base64Data.split('base64,')[1] : base64Data
    const buffer = Buffer.from(cleanBase64, 'base64')

    const imageUrl = await uploadImageStore(buffer, fileName || 'upload.png', mimeType)
    return res.json({ success: true, imageUrl })
  } catch (error: any) {
    console.error('Upload error:', error)
    return res.status(400).json({ error: error.message || 'Image upload failed' })
  }
})

/* ==========================================================================
   Public Student API Routes (Strict Security: No Correct Answers Exposed!)
   ========================================================================== */

// 1. Get Public Student Exam (Validates Start/End Times & Strips is_correct!)
app.get('/api/public/exams/:publicToken', async (req, res) => {
  try {
    const { publicToken } = req.params
    const exam = await getExamByIdOrTokenStore(publicToken)

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found or link is invalid' })
    }

    // Availability Window Check
    const now = new Date()
    const startTime = new Date(exam.startTime)
    const endTime = new Date(exam.endTime)

    if (now < startTime) {
      return res.status(403).json({
        error: 'Exam not started yet',
        availability: 'not_started',
        startTime: exam.startTime,
        examTitle: exam.title,
      })
    }

    if (now > endTime) {
      return res.status(403).json({
        error: 'Exam has ended',
        availability: 'ended',
        endTime: exam.endTime,
        examTitle: exam.title,
      })
    }

    // SECURITY GUARANTEE: isPublic = true strips all is_correct flags!
    const questions = await getQuestionsByExamIdStore(exam.id, true)

    return res.json({
      success: true,
      availability: 'available',
      exam: {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        questionCount: exam.questionCount,
        durationMinutes: exam.durationMinutes,
        defaultLanguage: exam.defaultLanguage,
        publicToken: exam.publicToken,
      },
      questions,
    })
  } catch (error: any) {
    console.error('Error fetching public exam:', error)
    return res.status(500).json({ error: 'Failed to load public exam' })
  }
})

// 2. Submit Student Exam Answers
app.post('/api/public/exams/:publicToken/submit', async (req, res) => {
  try {
    const { publicToken } = req.params
    const { answers } = req.body // { [questionId]: optionLetter }

    const exam = await getExamByIdOrTokenStore(publicToken)
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' })
    }

    const questions = await getQuestionsByExamIdStore(exam.id, false)
    let score = 0
    let answeredCount = 0

    if (answers && typeof answers === 'object') {
      questions.forEach((q) => {
        const studentOption = answers[q.id]
        if (studentOption) {
          answeredCount++
          const correctOpt = q.options.find((o) => o.isCorrect)
          if (correctOpt && correctOpt.optionLetter === studentOption) {
            score++
          }
        }
      })
    }

    return res.json({
      success: true,
      message: 'Exam submitted successfully',
      receipt: {
        examTitle: exam.title,
        totalQuestions: questions.length,
        answeredCount,
        submittedAt: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error('Error submitting student exam:', error)
    return res.status(500).json({ error: 'Failed to submit exam' })
  }
})

// Start Server
app.listen(PORT, () => {
  console.log(`XMWindow API Server running on http://localhost:${PORT}`)
})
