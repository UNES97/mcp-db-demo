# APMT AI Operations Assistant

AI-powered terminal intelligence platform for APM Terminals. Ask questions about vessel operations, yard inventory, gate activity, and equipment performance using natural language. Powered by Claude (Anthropic).

## Features

**AI Chat**
- Natural language queries against live terminal database
- 31 specialized database tools (vessels, yard, gate, equipment, delays)
- Smart follow-up suggestions after each response
- Natural language date handling ("last week", "this month", "Q1")
- Multi-step analysis for root cause questions
- Conversation history (SQLite)

**Visualization**
- Interactive charts (ApexCharts) — bar, line, pie, doughnut
- Paginated tables and charts (10 items per page)
- Terminal Overview — full dashboard in one query
- Weekly comparison mode (moves, productivity, delays)

**Reports**
- Expand to fullscreen modal
- Export to PDF with charts (html2canvas + jsPDF)
- Email report delivery (SMTP)
- Response feedback (thumbs up/down)

**Executive Queries (HQ)**
- CMPH vs target benchmarking
- Best/worst vessel ranking
- Delay root cause analysis
- Delay breakdown by category
- Gate throughput patterns
- Berth utilization trends
- Dwell time analysis

**UX**
- KPI summary cards (auto-refresh)
- Voice input with terminal vocabulary correction
- Onboarding tour (driver.js)
- Keyboard shortcuts (Ctrl+K, Ctrl+E, Ctrl+N)
- Sound notification on response
- Two-layer caching (query + response)
- Admin health dashboard (/admin)
- Maersk Headline font

## Quick Start

### Prerequisites
- Node.js 20+
- MySQL 8.0
- Anthropic API key

### Setup

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your MySQL and Anthropic credentials

# Build
npm run build

# Start
npm start
```

The app will import the demo database on first run and start at http://localhost:3000.

### Environment Variables

```env
# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root
DB_NAME=compass_db

# AI
ANTHROPIC_API_KEY=sk-ant-...
# CLAUDE_MODEL=claude-sonnet-4-20250514

# Server
CHAT_SERVER_PORT=3000

# Cache TTLs (minutes)
CACHE_TTL_STATIC=60
CACHE_TTL_SLOW=60
CACHE_TTL_LIVE=60
CACHE_TTL_RESPONSE=60

# Email (optional)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password
```

## Docker

```bash
docker compose up -d
```

Or deploy to Coolify — the `MYSQL_DATABASE` env var creates the DB automatically.

## Project Structure

```
src/
  chat-server.ts    # Express server, Claude API, all endpoints
  chat-history.ts   # SQLite conversation history (sql.js)
  database.ts       # MySQL connection pool
  init-database.ts  # Auto-import demo data on first run
  queries.ts        # All SQL queries (50+)
public/
  index.html        # UI (Tailwind CSS, Lucide icons)
  script.js         # Frontend logic (charts, pagination, voice, etc.)
  fonts/            # Maersk Headline webfont
demo_database.sql   # Slim demo dataset (1.8MB, ~30 vessel visits)
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Chat with Claude (tool calling) |
| `/api/kpis` | GET | Live KPI summary |
| `/api/conversations` | GET/POST | List/create conversations |
| `/api/conversations/:id` | GET/DELETE | Get/delete conversation |
| `/api/feedback` | POST | Submit response feedback |
| `/api/send-report` | POST | Email a report |
| `/api/health` | GET | Health check + cache stats |
| `/api/cache` | DELETE | Clear all caches |
| `/admin` | GET | Admin dashboard |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Focus chat input |
| `Ctrl+E` | Export last response |
| `Ctrl+N` | New chat |
| `Esc` | Close modals |
| `?` | Show shortcuts |
