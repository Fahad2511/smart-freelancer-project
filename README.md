# Smart Freelancer Project & Client Management System

A React and Express app for managing freelance clients, projects, tasks, invoices, and payments.

## Features

- Client and project management, including project editing and deletion
- Project history and a Kanban task board
- Invoices with automatic invoice numbers and payment tracking
- Automatic full-budget invoice when a project is created, due 14 days after issue
- Dashboard totals and reminders for unpaid invoices due within 14 days
- Responsive layout and input validation

## Tech stack

- React, Vite, JavaScript, CSS
- Node.js, Express, better-sqlite3, SQLite

## Project structure

```text
backend/                         Express API and SQLite database
  routes/                        API route handlers
  database/                      Database connection and legacy schema script
  utils/                         Invoice helpers
Smart_freelancer/frontend/src/   React app and styles
```

## Run locally

Start the backend and frontend in separate terminals from the project root.

Backend:

```sh
cd backend
npm install
npm run dev
```

Frontend:

```sh
cd Smart_freelancer/frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The API defaults to <http://localhost:5000>. Set `PORT` to use another backend port.

## Database and demo access

The app uses `backend/freelancer.db`; the path is resolved relative to the backend code. The supplied database contains existing data. **Do not run `node database/schema.js` on it:** that script drops and recreates the projects table. A fresh database needs a safe schema initializer and a freelancer user before the app can run; this project does not currently provide a non-destructive initializer.

There is no sign-in flow. The users table supports `freelancer`, `client`, and `admin` roles, and the demo uses the first freelancer record as its owner. Authentication and role checks are not currently enforced by the API.

## API

Requests and responses use JSON. Use IDs returned by the GET endpoints. The API returns `400` for invalid input, `404` when a record is missing, and `409` for duplicate project titles or invoice numbers.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET, POST | `/api/clients` | List or create clients |
| GET | `/api/clients/demo-user` | Get the demo freelancer |
| GET, POST | `/api/projects` | List or create projects; creating a project also creates its first invoice |
| PUT | `/api/projects/:id` | Edit project details |
| PUT | `/api/projects/:id/status` | Change project status |
| POST | `/api/projects/:id/generate-invoice` | Create a full-budget invoice for an existing project with no invoices |
| DELETE | `/api/projects/:id` | Delete a project and its tasks, invoices, payments, and history; returns 204 |
| GET | `/api/projects/:id/history` | Read project activity |
| GET, POST | `/api/tasks` | List or create tasks |
| PUT | `/api/tasks/:id/status` | Change task status |
| GET, POST | `/api/invoices` | List or create invoices; invoice number is optional and generated if omitted |
| GET, POST | `/api/payments` | List or record payments |
| GET | `/api/dashboard/summary` | Read dashboard totals |

Example project request (replace `123` with a client ID returned by `GET /api/clients`):

```json
{
  "client_id": 123,
  "title": "Website redesign",
  "description": "Refresh the company website",
  "budget": 50000,
  "deadline": "2026-12-15",
  "attachment_url": "https://example.com/brief.pdf"
}
```

## Screenshots

Capture screenshots from the running app if needed for a project report. Suggested views: dashboard, project details, task board, invoices, and payments.
