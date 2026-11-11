# Coordinator end-to-end checks

API and real-browser checks for the Academic Coordinator, run against a **local, disposable** stack
with synthetic data only. Every script refuses a non-localhost backend or web server and a database
whose name does not end in `_e2e`. Never point it at production or at an existing school's data.

## What it covers

| Script | What it does |
|---|---|
| `seed*.mjs` | Builds two synthetic schools through the API (Admin, Principal, 3 Coordinators, class teachers, students, timetable, attendance, leave, exams, report card, notices). |
| `f1`–`f4` | API checks: appointments, school-wide directories, staff and student attendance, student and teacher leave, substitutions, academics, communication, report cards, dashboard numbers, revocation, audit attribution. Each mutation is verified in the database. |
| `b1` | Browser: Teacher/Coordinator workspace switching, reload, new tab, Back/Forward, silent token refresh, 403 never signs out, logout/login, revocation while signed in, staff-attendance labels, partial-scope timetables, phone width. |
| `b2` | Browser: primary actions through the UI (dashboard tiles vs database, approve leave, teacher leave read-only, correct staff attendance, assign cover, request a report-card correction, mark a section, appoint a Coordinator). |
| `b3` | Browser: notification deep links. |
| `crawl.mjs` | Opens every sidebar page of a workspace and reports API errors (≥400), JavaScript errors and redirects. |

Results are appended to `results.jsonl`.

## Running

1. A disposable Postgres 17 with `pgvector`, an empty database (default `edunexify_coord_e2e` on
   `127.0.0.1:55434`), and a scratch Redis (default port `6390`; its keys are flushed before each login).
2. The backend from this branch, `SPRING_PROFILES_ACTIVE=dev`, pointed at that database and Redis,
   with a test-only JWT key pair and `FRONTEND_URL=http://localhost:4200`.
3. `npm start` in the website repo (`http://localhost:4200`, API `http://localhost:8080/api`).
4. Here: `npm install`, then `npm run seed`, `npm run api`, `npm run browser`, `npm run crawl`.
   The browser scripts drive the installed Google Chrome (`playwright-core`, `channel: 'chrome'`).

The checks assume a freshly seeded database (they consume pending leave, uncovered periods and
markable staff). Recreate the database before a second run.
