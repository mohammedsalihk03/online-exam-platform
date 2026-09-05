import test from 'node:test'
import assert from 'node:assert/strict'

process.env.SUPABASE_URL = ''
process.env.SUPABASE_SERVICE_ROLE_KEY = ''
process.env.SUPABASE_ANON_KEY = ''
process.env.NODE_ENV = 'test'
process.env.PYTHON_COMMAND = 'deliberately-missing-test-python'

const { createExamStore, saveQuestionStore, getQuestionsByExamIdStore, ensureTranslations } = await import('../dist/store.js')

test('asynchronous translation stores fallback text for every option and public data omits answers', async () => {
  const exam = await createExamStore({ title: 'Isolated translation test' })
  const input = {
    id: 'q-1', questionOrder: 1, questionText: 'Old question',
    options: ['A', 'B', 'C', 'D'].map(optionLetter => ({ optionLetter, optionText: optionLetter, isCorrect: optionLetter === 'B' })),
  }
  const saved = await saveQuestionStore(exam.id, input)
  assert.match(saved.id, /^[0-9a-f-]{36}$/)
  assert.equal(ensureTranslations(exam.id, [saved], 'Malayalam'), 'pending')
  await new Promise(resolve => setImmediate(resolve))
  await new Promise(resolve => setImmediate(resolve))
  let current = await getQuestionsByExamIdStore(exam.id, true)
  assert.equal(current.length, 1)
  assert.equal(ensureTranslations(exam.id, current, 'Malayalam'), 'ready')
  assert.equal(current[0].translations.find(t => t.language === 'Malayalam')?.questionText, 'Old question')
  assert.deepEqual(current[0].options.map(o => o.translations.find(t => t.language === 'Malayalam')?.optionText), ['A', 'B', 'C', 'D'])
  assert.equal(current[0].options.some(o => Object.hasOwn(o, 'isCorrect')), false)
  assert.equal((await getQuestionsByExamIdStore(exam.id))[0].options[1].isCorrect, true)
})
