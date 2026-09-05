import test from 'node:test'
import assert from 'node:assert/strict'

process.env.SUPABASE_URL = ''
process.env.SUPABASE_SERVICE_ROLE_KEY = ''
process.env.SUPABASE_ANON_KEY = ''
process.env.NODE_ENV = 'test'
process.env.PYTHON_COMMAND = 'deliberately-missing-test-python'
process.env.AZURE_TRANSLATOR_KEY = 'test-only-key'

const { createExamStore, saveQuestionStore, getExamByCreatorIdentifierStore, getExamByPublicTokenStore, getQuestionsByExamIdStore } = await import('../dist/store.js')
const { isSupabaseConfigured } = await import('../dist/supabase.js')

test('public token cannot access creator exam details with answer keys', async () => {
  assert.equal(isSupabaseConfigured, false, 'security test must run against memory storage')
  const exam = await createExamStore({ title: 'Security isolation test' })
  const creatorViaPublic = await getExamByCreatorIdentifierStore(exam.publicToken)
  const publicViaPublic = await getExamByPublicTokenStore(exam.publicToken)
  const creatorViaId = await getExamByCreatorIdentifierStore(exam.id)
  const creatorViaToken = await getExamByCreatorIdentifierStore(exam.creatorToken)

  assert.equal(creatorViaPublic, null, 'public token must not resolve on creator routes')
  assert.equal(publicViaPublic?.id, exam.id, 'public token resolves on public routes')
  assert.equal(creatorViaId?.id, exam.id, 'exam UUID resolves on creator routes')
  assert.equal(creatorViaToken?.id, exam.id, 'creator token resolves on creator routes')

  await saveQuestionStore(exam.id, {
    id: 'q-1',
    questionOrder: 1,
    questionText: 'Secret question',
    options: ['A', 'B', 'C', 'D'].map(optionLetter => ({
      optionLetter,
      optionText: optionLetter,
      isCorrect: optionLetter === 'B',
    })),
  })

  const creatorQuestions = await getQuestionsByExamIdStore(exam.id, false)
  assert.equal(creatorQuestions[0].options[1].isCorrect, true)

  const publicQuestions = await getQuestionsByExamIdStore(exam.id, true)
  assert.equal(publicQuestions[0].options.some(o => Object.hasOwn(o, 'isCorrect')), false)
})
