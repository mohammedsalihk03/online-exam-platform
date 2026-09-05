import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const languageCodeMap: Record<string, string> = {
  English: 'en', Hindi: 'hi', Arabic: 'ar', Malayalam: 'ml', Urdu: 'ur',
}

let queue: Promise<unknown> = Promise.resolve()

function translateViaPython(texts: string[], target: string): Promise<string[]> {
  const task = queue.then(() => new Promise<string[]>((resolve) => {
    const child = spawn(process.env.PYTHON_COMMAND || (process.platform === 'win32' ? 'python' : 'python3'),
      [fileURLToPath(new URL('../translation/translate.py', import.meta.url))],
      { env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, windowsHide: true })
    let output = ''
    let stderr = ''
    const timeout = setTimeout(() => {
      child.kill()
      console.error(`Translation timed out for ${target}; using English fallback`)
      resolve([...texts])
    }, 180_000)
    child.stdout.setEncoding('utf8').on('data', chunk => { output += chunk })
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr = (stderr + chunk).slice(-4000) })
    child.on('error', error => {
      clearTimeout(timeout)
      console.error(`Translation subprocess error for ${target}:`, error)
      resolve([...texts])
    })
    child.stdin.on('error', error => {
      clearTimeout(timeout)
      console.error(`Translation stdin error for ${target}:`, error)
      resolve([...texts])
    })
    child.on('close', code => {
      clearTimeout(timeout)
      if (stderr.trim()) console.error(`Translation stderr (${target}):`, stderr.trim())
      try {
        const parsed = JSON.parse(output)
        if (code !== 0 || parsed.error) throw new Error(parsed.error || stderr || `Python exited ${code}`)
        if (!Array.isArray(parsed.results) || parsed.results.length !== texts.length) {
          throw new Error('Translation returned an incomplete batch')
        }
        resolve(parsed.results.map((translated: unknown, index: number) => {
          const source = texts[index]
          if (!source.trim()) return source
          if (typeof translated === 'string' && translated.trim()) return translated
          console.error(`Translation empty for ${target} item ${index}; using English fallback`)
          return source
        }))
      } catch (error) {
        console.error(`Translation parse failure for ${target}:`, error instanceof Error ? error.message : error)
        resolve([...texts])
      }
    })
    child.stdin.end(JSON.stringify({ texts, target }))
  }))
  queue = task.catch(() => undefined)
  return task
}

export function translateTextsLocal(texts: string[], language: string): Promise<string[]> {
  if (language === 'English') return Promise.resolve([...texts])
  const target = languageCodeMap[language]
  if (!target) return Promise.reject(new Error(`Unsupported language: ${language}`))
  if (texts.every(t => !t.trim())) return Promise.resolve([...texts])
  return translateViaPython(texts, target)
}
