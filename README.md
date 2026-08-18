# ExamPlatform

A simple, production-ready online exam platform.

## Tech Stack

- **Frontend:** React + TypeScript + Vite + React Router
- **Backend:** Express + TypeScript (minimal API scaffold)
- **Styling:** Plain CSS with design tokens (no UI framework)

## Project Structure

```
xmwindow/
├── client/          # React frontend
│   └── src/
│       ├── components/layout/   # Header, Footer, Layout shell
│       ├── pages/               # Route pages (Home, About, 404)
│       └── styles/              # Global CSS and variables
├── server/          # Express API (health check only for now)
└── package.json     # Root scripts to run both
```

## Getting Started

Install dependencies:

```bash
npm install
npm install --prefix client
npm install --prefix server
```

Run development (frontend + backend):

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## What's Included

- Responsive layout with sticky header and mobile navigation
- Client-side routing (`/`, `/about`, 404)
- Global styling with CSS variables
- Minimal Express server with `/api/health` endpoint

## Not Yet Implemented

- Exam system
- Authentication
- Database
