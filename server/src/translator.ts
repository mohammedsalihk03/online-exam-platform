import { spawn } from 'child_process'

const languageCodeMap: { [key: string]: string } = {
  Hindi: 'hi',
  Arabic: 'ar',
  Urdu: 'ur',
}

export async function translateTextsLocal(
  texts: string[],
  targetLanguageName: string
): Promise<string[]> {
  const targetCode = languageCodeMap[targetLanguageName]
  if (!targetCode) {
    return texts
  }

  const validTexts = texts.map((t) => t || '')
  if (validTexts.every((t) => !t.trim())) {
    return validTexts
  }

  return new Promise<string[]>((resolve) => {
    try {
      const pythonScript = `
import sys, json, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')

try:
    data = json.load(sys.stdin)
    texts = data.get('texts', [])
    target = data.get('target', 'hi')

    import argostranslate.translate
    installed = argostranslate.translate.get_installed_languages()
    lang_en = next((l for l in installed if l.code == 'en'), None)
    lang_to = next((l for l in installed if l.code == target), None)

    results = []
    if lang_en and lang_to:
        translator = lang_en.get_translation(lang_to)
        for t in texts:
            if t and t.strip():
                try:
                    results.append(translator.translate(t))
                except Exception:
                    results.append(t)
            else:
                results.append('')
    else:
        results = texts

    print(json.dumps({'results': results}, ensure_ascii=False))
except Exception as e:
    print(json.dumps({'error': str(e)}))
`

      const child = spawn('python', ['-c', pythonScript])
      let outputData = ''

      child.stdout.on('data', (chunk) => {
        outputData += chunk.toString('utf-8')
      })

      child.on('close', (code) => {
        if (code === 0 && outputData.trim()) {
          try {
            const parsed = JSON.parse(outputData.trim())
            if (parsed.results && Array.isArray(parsed.results)) {
              return resolve(parsed.results)
            }
          } catch (e) {
            console.warn('Translation JSON parse error:', e)
          }
        }
        resolve(validTexts)
      })

      child.on('error', (err) => {
        console.warn('Translation process error:', err)
        resolve(validTexts)
      })

      child.stdin.write(JSON.stringify({ texts: validTexts, target: targetCode }))
      child.stdin.end()
    } catch (err) {
      console.warn('Failed to start translation script:', err)
      resolve(validTexts)
    }
  })
}
