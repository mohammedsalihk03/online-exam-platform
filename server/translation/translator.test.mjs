import test from 'node:test'
import assert from 'node:assert/strict'
import { translateTextsLocal, languageCodeMap } from '../dist/translator.js'

test('exact five language mappings and unmodified English', async () => {
  assert.deepEqual(languageCodeMap, { English: 'en', Hindi: 'hi', Arabic: 'ar', Malayalam: 'ml', Urdu: 'ur' })
  const input = ['Question?', ' A ', '', '123', 'Water']
  assert.deepEqual(await translateTextsLocal(input, 'English'), input)
  await assert.rejects(translateTextsLocal(input, 'Unknown'), /Unsupported language/)
})

test('missing python returns English fallback instead of crashing', async () => {
  const original = process.env.PYTHON_COMMAND
  process.env.PYTHON_COMMAND = 'deliberately-missing-test-python'
  try {
    const input = ['Question', 'A', 'B', 'C', 'D']
    assert.deepEqual(await translateTextsLocal(input, 'Hindi'), input)
    assert.deepEqual(await translateTextsLocal(input, 'Malayalam'), input)
  } finally {
    if (original === undefined) delete process.env.PYTHON_COMMAND
    else process.env.PYTHON_COMMAND = original
  }
})
