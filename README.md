# TalkShowGo

AI-powered content generation platform for talk shows, documentaries, and narrative storytelling. Monitor social media, extract entities and claims, and automatically produce publication-ready audio content.

## Quick Start

### One-Click Start (Windows)
```
Double-click: start.bat
   — or —
Right-click start.ps1 → Run with PowerShell
```

### Command Line
```bash
# Clone and install
git clone https://github.com/yourusername/talkshowgo.git
cd talkshowgo
npm install

# Configure environment
cp .env.example .env.local

# Start everything
npm run go
```

Visit **http://localhost:3000** to access the app.

> **First time?** Run the Setup Wizard at `/studio/setup` or check the [Deployment Guide](docs/DEPLOYMENT.md).

---

## What It Does

TalkShowGo transforms content creation with an automated intelligence pipeline:

| Capability | Description |
|------------|-------------|
| **Automated Research** | Scans Twitter and YouTube for trending topics in your niche |
| **Entity Intelligence** | Extracts people, organizations, and events with context |
| **Story Assembly** | Builds coherent narratives from multiple sources |
| **Multi-Voice Audio** | Generates professional dialogue with Dia TTS |
| **Multi-Format Output** | Daily shows, documentaries, deep dives, and more |

---

## The Intelligence Pipeline

TalkShowGo uses 8 phases with military-inspired codenames:

```
OUTPOST → PERIMETER → EXTRACTION → AUDIT → TRIBUNAL → NEXUS → SANCTION → SIGNAL
   ↓           ↓            ↓          ↓         ↓         ↓         ↓         ↓
 Setup     Monitor      Extract     Score    Verify   Assemble   Approve   Export
```

| Phase | Page | Purpose |
|-------|------|---------|
| **OUTPOST** | `/outpost` | Configure topics, sources, and entities |
| **PERIMETER** | `/perimeter` | Monitor Twitter/YouTube for signals |
| **EXTRACTION** | `/extraction` | Extract entities and claims from content |
| **AUDIT** | `/audit` | Score source credibility |
| **TRIBUNAL** | `/tribunal` | Community verification and nominations |
| **NEXUS** | `/nexus` | Assemble signals into story candidates |
| **SANCTION** | `/sanction` | Approve stories and generate scripts |
| **SIGNAL** | `/signal` | Export and distribute content |

---

## The Studio

Your production hub at `/studio`:

| Feature | Description |
|---------|-------------|
| **Daily Show** | 5-step wizard to create automated news shows |
| **Schedules** | Automate show generation (daily, weekly, interval) |
| **Templates** | Customize show formats, intros, and outros |
| **Hosts** | 8 AI host personalities with unique styles |
| **Entities** | Manage entity context, roles, and affiliations |
| **Sources** | Configure Twitter and YouTube sources |

### Host Personalities

| Host | Style |
|------|-------|
| **Maya Sterling** | Investigative anchor (Rachel Maddow) |
| **Marcus Blaze** | Hot take king (Stephen A Smith) |
| **Devon Sharp** | Witty satirist (Jon Stewart) |
| **Tasha Raw** | Unfiltered real talk |
| **James Noble** | Smooth documentary narrator |
| **DJ Momentum** | High energy hype |
| **King Knowledge** | Street analyst |
| **Algorithm Institute** | Battle rap documentary narrator |

---

## Tech Stack

### Core Services (Docker)
- **PostgreSQL** + pgvector — Main database
- **Redis** + BullMQ — Job queue
- **PostgREST** — REST API for database
- **Kong** — API gateway
- **SearXNG** — Self-hosted web search
- **Qdrant** — Vector database for RAG

### Voice Generation
- **Dia TTS** (Primary) — Multi-voice dialogue with emotional markers
- **ElevenLabs** (Legacy) — Single voice generation

### AI Services
- **Ollama** — Local LLM for entity extraction
- **OpenAI / Anthropic** — Cloud LLM options

### Data Sources
| Source | Cost | Use Case |
|--------|------|----------|
| YouTube (youtubei.js) | Free | Videos, transcripts, comments |
| Twitter (twitterapi.io) | $0.15/1K tweets | Real-time trends |
| SearXNG | Free | Web search |
| Perplexity Sonar | 5 credits/month | AI-enhanced research |

---

## Environment Variables

Create `.env.local` from `.env.example`:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/talkshowgo

# AI Services
OLLAMA_HOST=http://localhost:11434
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key

# Voice (Dia runs locally, no key needed)
ELEVENLABS_API_KEY=your-key  # Optional legacy

# Sources
TWITTER_API_KEY=your-key
PERPLEXITY_API_KEY=your-key
```

---

## Commands

```bash
# Development
npm run go              # Start Docker + Next.js
npm run dev             # Start Next.js only
npm run worker          # Start background worker

# Docker
npm run docker:up       # Start all services
npm run docker:reset    # Wipe and restart

# Health Checks
npm run check:db        # Database connection
npm run check:ai        # LLM service
npm run check:voice     # Dia TTS

# Production
npm run build           # Build for production
npm run start           # Start production server
npm run lint            # Run linting
```

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── studio/            # Production hub
│   ├── outpost/           # Source management
│   ├── perimeter/         # Signal monitor
│   ├── extraction/        # Entity map
│   ├── audit/             # Credibility ledger
│   ├── nexus/             # Story desk
│   └── settings/          # Configuration
├── components/
│   ├── ui/                # UI components (shadcn)
│   └── layout/            # App shell, sidebar
├── context/               # React context (TopicContext)
├── lib/                   # Core libraries
│   ├── dia.ts            # Dia TTS client
│   ├── youtube-api.ts    # YouTube client
│   ├── twitter-api.ts    # Twitter client
│   └── hosts/            # Host personalities
└── workers/               # Background job processors
```

---

## Documentation

| Guide | Description |
|-------|-------------|
| [CLAUDE.md](CLAUDE.md) | Development guidelines and API reference |
| [Deployment Guide](docs/DEPLOYMENT.md) | Complete setup from scratch |
| [Architecture](docs/ARCHITECTURE.md) | System design and data flow |
| [Docker Services](docs/docker/SERVICES.md) | All Docker services explained |
| [Dia Migration](docs/DIA-MIGRATION.md) | Multi-voice TTS setup |
| [Common Issues](docs/troubleshooting/COMMON-ISSUES.md) | FAQ and fixes |
| [Health Checks](docs/troubleshooting/HEALTH-CHECKS.md) | Service verification |

---

## Current Niche: Battle Rap

TalkShowGo is currently configured for battle rap coverage:

- **16 Twitter sources** — URL, KOTD, RBE, JayBlac, Angry Fan, etc.
- **6 YouTube channels** — URLTV, KOTD, RBE, No Studio'N, etc.
- **62 entities** — Battlers, bloggers, leagues tracked with context
- **Voice** — Algorithm Institute documentary narrator style

---

## License

MIT
