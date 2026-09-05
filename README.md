# Online Exam Platform

A multilingual full-stack online examination platform built with **React, TypeScript, Express, and Supabase**.

## Tech Stack

* **Frontend:** React + TypeScript + Vite
* **Backend:** Express + TypeScript
* **Database:** Supabase
* **Translation:** Local Python translation service
* **Styling:** CSS

## Features

### Creator Portal

* Create and publish exams
* Auto-save question editing
* Option text and image support
* Exam preview
* Shareable public exam links

### Student Portal

* Public exam access without login
* Language selection
* Multilingual question support
* 5-question pagination
* Question shuffle on refresh
* Timer continuity
* Final submission confirmation

## Getting Started

```bash
npm install
npm ci --prefix client
npm ci --prefix server
npm run dev
```

* Frontend: http://localhost:5173
* Backend: http://localhost:3001

## Project Structure

```text
client/      React frontend
server/      Express backend
reference/   Screenshots
```

> This project was developed as a real-world freelance online examination platform.

## Translation setup

English (`en`) is kept unchanged. Python/Argos Translate provides Hindi (`hi`),
Arabic (`ar`), and Urdu (`ur`). The official Argos index has no Malayalam model;
Malayalam (`ml`) uses Azure Translator's v3 REST API. Create an Azure Translator
resource and configure its key/region on the backend. Do not put secrets in Vite
variables. Only English question/option text is sent to Azure, never answer keys.

Use a project virtual environment (Python 3.11+; tested locally with Python 3.13):

```powershell
python -m venv server/.venv
server/.venv/Scripts/python.exe -m pip install -r server/translation/requirements.txt
$env:XDG_DATA_HOME = Join-Path (Get-Location) '.translation-data'
$env:XDG_CACHE_HOME = Join-Path (Get-Location) '.translation-cache'
server/.venv/Scripts/python.exe server/translation/install_models.py
$env:PYTHON_COMMAND = Join-Path (Get-Location) 'server/.venv/Scripts/python.exe'
npm run dev
```

On Linux, use `python3 -m venv server/.venv` and
`server/.venv/bin/python` for the install and model setup commands. Use the same
`XDG_DATA_HOME` and `XDG_CACHE_HOME` during setup and runtime. Alternatively set
them persistently in `server/.env` along with an absolute `PYTHON_COMMAND` path.
The supplied Dockerfile handles these paths automatically.

Copy `server/.env.example` to `server/.env` and configure Supabase and Azure.
For a new database run `server/src/schema.sql`; for an existing database run
`server/translation/migration.sql` in the Supabase SQL editor before starting the
updated server. The migration adds source fingerprints without deleting content.
Old unverified translations are ignored and regenerated on demand.

The model installer pins English→Hindi 1.1, English→Arabic 1.0 and English→Urdu 1.9,
and warms inference during installation so sentence-splitting assets exist before
an exam is taken. Argos Translate is pinned to 1.11.0. Installation requires network
access; Hindi/Arabic/Urdu inference is local after setup. Malayalam requires
outbound HTTPS access to Azure at runtime.

Question saves return after source persistence. Translation jobs run in the
background; Argos subprocesses are serialized to bound model memory consumption.
Both the question and all options are sent as a batch. Results are stored in
`question_translations` and `option_translations`, using their composite conflict
keys and source hashes to reject stale results after edits. Existing builder IDs
(`q-1`, etc.) resolve to a stable UUID by exam/question order.

The public endpoint accepts `?language=Hindi` (language names, not codes) and
returns `translationStatus`: `ready`, `pending`, or `failed`. Readiness includes
every nonempty question and option. Missing results trigger regeneration, including
after a server restart. Failed jobs have a 30-second retry cooldown. The student
waits up to 60 seconds, then receives an explicit retry message; no English
fallback is presented as a completed translation. Refresh also checks readiness
before showing translated content. English bypasses translation completely.

Argos batches time out after 180 seconds and Azure requests after 30 seconds.
Arabic's model can copy title-cased single-word options: natural-language output
with no target-script characters is retried in lowercase, then rejected if still
untranslated. Original English, numbers, and acronyms are preserved. Machine
translation quality still needs exam-author review, especially technical terms.

## Render configuration

`render.yaml` defines an Express Docker Web Service and a Vite Static Site.
No deployment has been performed. Apply the Supabase migration first.

- Backend root/context: repository root; Dockerfile: `./Dockerfile`.
- Backend build: Render builds the Dockerfile (no separate dashboard build command).
  It installs Python/Argos/models and runs `npm ci --prefix server` and
  `npm run build --prefix server`.
- Backend start: `npm run start --prefix server` (Docker `CMD`). Express uses Render's
  `PORT`; health check: `/api/health`.
- Frontend build: `npm ci --prefix client && npm run build --prefix client`.
- Frontend output: `client/dist`. Rewrite `/*` to `/index.html` for public exam links.
- Set frontend `VITE_API_BASE_URL=https://YOUR-API.onrender.com/api` before building.
- Set backend `CORS_ORIGIN=https://YOUR-FRONTEND.onrender.com` (comma-separated if
  multiple origins are required), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `AZURE_TRANSLATOR_KEY`, and `AZURE_TRANSLATOR_REGION` (omit region only for a
  global Translator resource). The Dockerfile sets `NODE_ENV=production`,
  `PYTHON_COMMAND`, UTF-8, and the model data/cache directories.

Production refuses to start without Supabase service-role configuration or CORS
origins. Never deploy the development memory fallback for real exams. The health
endpoint reports process liveness, not database/model readiness. Model setup fails
the Docker build when a required Argos package is unavailable. Size the backend
memory/CPU for the models and load-test expected exam sizes before launch.

For a local production build simulation:

```powershell
$env:VITE_API_BASE_URL = 'http://localhost:3001/api'
npm run build
npm run start
# In another terminal:
npm run preview --prefix client
```

`vite preview` is only a local preview; Render serves `client/dist` as a Static Site.
With Docker available, run `docker build -t exam-api .` and
`docker run --env-file server/.env -e PORT=10000 -p 10000:10000 exam-api`.
Do not override the container's Python path with a local Windows path in that env file.

## Verification and known limitations

Run `npm test --prefix server`, `npm run build`, and `npm run lint --prefix client`.
Tests cover complete batch validation, missing credentials, provider failures,
async saves, job deduplication, stale-edit protection, missing option D, stable
question IDs and omission of correct-answer fields. Mocked provider tests do not
constitute live Malayalam verification.

Browser verification on 2026-09-05 used the production Vite build (`vite preview`)
and compiled Node backend with the existing development memory store, because no
Supabase credentials were available. Six questions with four options each were
created and published through the real UI. Creator navigation retained data and
the preview showed five questions on page 1 and one on page 2.

- English: all six questions and 24 options verified across two pages. Selected
  answers survived navigation. Refresh cleared answers, shuffled questions,
  returned to page 1 and retained the timer. Manual submission returned a receipt
  for one answered question; the final screen had no Home/About/Create navigation.
- Hindi: six questions and all 24 options displayed Devanagari text. Pending
  translation polling completed before the exam started. Refresh restored Hindi
  and page 1 without resetting the countdown. Semantic quality is not certified.
- Arabic: six questions and all 24 options displayed Arabic script after the
  capitalization retry fix. A screenshot confirmed readable layout. This verifies
  delivery, not semantic correctness: e.g. the model translated “Plate” as “page.”
- Urdu: six questions and all 24 options displayed Urdu/Arabic-script text, and
  layout was visually inspected. **Reliability failed:** “Cow” became “dog,”
  “Banana” became “India,” and other short options were mistranslated. Lowercasing
  was tested separately and did not reliably solve this. A better reviewed model
  or an additional provider is needed; no substitutions were hardcoded for tests.
- Malayalam: missing-credential failure was verified in the browser. The UI
  displayed an explicit error and did not start using English. Actual Malayalam
  output has NOT been verified because no provider account/key was supplied.

The public test API response had no `isCorrect`, `is_correct`, `correctAnswer`,
or `creatorToken` fields. A separate request to the existing creator endpoint using
the same public token DID return answer keys; public-endpoint filtering alone is
not adequate security. Four automated tests pass. Both production builds pass.
Client lint reports the existing timer-hook dependency warning. Production startup
without Supabase credentials correctly fails. Docker is not installed here, so
the Docker image build and a true Render/Supabase production startup remain untested.
Image upload and timed automatic submission were not browser-tested in this run.

### Change ledger

- `server/src/translator.ts`: configurable Python executable, UTF-8 subprocess
  handling, bounded Argos concurrency, timeouts, complete-batch validation,
  explicit errors, exact language mappings and Malayalam Azure adapter.
- `server/translation/translate.py`: extracted Argos batch protocol, model presence
  checks, project-local config directory and targeted capitalization retry.
- `server/src/store.ts`: composite upsert keys/error checks, source fingerprints,
  complete readiness checks, deduplicated background work/retry cooldown, stale
  result rejection, stable UUID resolution, type-safe token lookup and omission
  of public correctness fields. These persistence changes are prerequisites for
  translation storage/retrieval with the existing schema.
- `server/src/index.ts`: language/status handling on the public endpoint and
  configurable production CORS; existing `PORT` behavior retained.
- `client/src/services/api.ts`: configurable API URL and requested-language query.
- `client/src/pages/StudentExamPage.tsx`: full-exam readiness polling, explicit
  failure/retry UI, refresh readiness check, original English rendering and
  automatic text direction. Original pagination/shuffle/submission logic retained.
- `server/src/schema.sql` and `server/translation/migration.sql`: source-hash
  columns for new/existing databases; no content deletion.
- `server/src/supabase.ts`: require production Supabase service-role configuration.
- `server/translation/requirements.txt` and `install_models.py`: pinned Argos and
  model setup/warm-up, reproducible in a virtual environment or container.
- `server/translation/translator.test.mjs`, `store.test.mjs`, and
  `server/package.json`: isolated regression tests and test command.
- `Dockerfile`, `.dockerignore`, and `render.yaml`: Node/Python/model build,
  backend start, static frontend build and SPA routing.
- `server/.env.example`, `client/.env.example`, `.gitignore`, and this `README.md`:
  environment setup, ignored local dependencies/models, deployment instructions
  and verified limitations.
- `server/package-lock.json` had a pre-existing one-line modification when this
  task began; it was preserved and was not part of the translation fix.

This is not yet a production sign-off. Malayalam requires Azure credentials and
live end-to-end verification. Supabase persistence/migration and a Docker build
must be verified in an environment with those services available.

Existing issues outside translation/deployment configuration remain:

- Creator endpoints are unauthenticated and accept public tokens/IDs, so students
  can request answer keys through the creator endpoint even though the public
  response omits correctness fields. Authentication/access control must be fixed
  before public deployment.
- The current creator UI has language tabs and one-question navigation, unlike
  the requested baseline. Its end date/time is held in state rather than exposed
  as an editable control.
- Existing timer/submission logic has not been rewritten: the session duration
  is not capped to the exam end time, timer auto-submit has a stale-closure lint
  warning, and submission can show a local success receipt after an API failure.
- Several legacy store operations can fall back to memory after database errors;
  the production configuration guard only prevents starting without credentials.
  Production database-failure behavior needs a separate persistence audit.

References: [Argos model index](https://github.com/argosopentech/argospm-index),
[Azure language support](https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support),
[Azure v3 authentication](https://learn.microsoft.com/en-us/azure/ai-services/translator/text-translation/reference/authentication),
[Render Docker deployment](https://render.com/docs/docker).
