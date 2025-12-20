# Talk Show Go

AI-powered content generation platform for talk shows, documentaries, and narrative storytelling. Monitor social media, extract entities and claims, and automatically produce publication-ready audio content.

## What It Does

Talk Show Go transforms the way content creators produce audio shows:

- **Automated Research** - Scans Twitter and YouTube for trending topics in your niche
- **Entity Intelligence** - Extracts and tracks people, organizations, and events with context
- **Narrative Assembly** - Builds coherent stories from multiple signals and sources
- **AI Voices** - Generates professional audio with customizable host personalities
- **Multi-Format Output** - Creates daily shows, documentaries, deep dives, and more

## Use Cases

| Format | Description |
|--------|-------------|
| **Daily News Show** | Automated daily briefing on trending topics in your niche |
| **Documentary Narrative** | Deep-dive stories with historical context and multiple sources |
| **Interview Breakdowns** | Summarize and analyze long-form interviews |
| **Topic Explainers** | Educational content breaking down complex subjects |
| **Opinion/Commentary** | Hot takes and analysis with personality |

## Quick Start

```bash
# Install dependencies
npm install

# Start Docker services (Postgres + Redis)
docker-compose up -d

# Run database migrations
npm run db:migrate

# Start development server
npm run dev

# In another terminal, start workers
npm run worker
```

## The Pipeline

Talk Show Go uses an intelligence pipeline with military-inspired codenames:

| Phase | Codename | Purpose |
|-------|----------|---------|
| 1 | **OUTPOST** | Topic setup & source configuration |
| 2 | **PERIMETER** | Signal monitoring (Twitter/YouTube scanning) |
| 3 | **EXTRACTION** | Entity extraction from content |
| 4 | **AUDIT** | Credibility scoring & source evaluation |
| 5 | **TRIBUNAL** | Claim verification & nominations |
| 6 | **NEXUS** | Story assembly from signals |
| 7 | **SANCTION** | Story approval & script generation |
| 8 | **SIGNAL** | Export & distribution |

## Tech Stack

- **Frontend**: Next.js 14, Tailwind CSS
- **Backend**: Node.js, PostgreSQL (pgvector), Redis + BullMQ
- **AI**: Local LLMs (Ollama), OpenAI, Anthropic Claude
- **Voice**: ElevenLabs, Chatterbox TTS
- **Search**: SearXNG (self-hosted), Perplexity Sonar
- **Sources**: Twitter (twitterapi.io), YouTube (youtubei.js)

## Features

### The Studio

The Studio is your production hub:

- **Daily Show** - Create automated daily news shows
- **Templates** - Customize show formats and intros
- **Hosts** - Choose from 7 AI host personalities
- **Voices** - Manage TTS voices and clone your own
- **Prompts** - Fine-tune AI generation prompts

### Research Sources

| Source | Cost | Best For |
|--------|------|----------|
| YouTube (youtubei.js) | Free | Video content, transcripts |
| Twitter (twitterapi.io) | $0.15/1K tweets | Real-time trends |
| SearXNG | Free (self-hosted) | Web search, documents |
| Perplexity Sonar | 5 credits/month | AI-enhanced search |

### Entity Intelligence

Every person, organization, and event is tracked with context:
- Role and affiliations
- Credibility scoring
- Mention history
- Cross-referenced claims

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/talkshowgo

# AI Services
PRESIDIUM_URL=http://localhost:11434
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key

# Voice
ELEVENLABS_API_KEY=your-key
CHATTERBOX_URL=http://localhost:4123

# Sources
TWITTER_API_KEY=your-key
YOUTUBE_API_KEY=your-key
PERPLEXITY_API_KEY=your-key
```

## Project Structure

```
src/
├── app/                 # Next.js pages
│   ├── api/            # API routes
│   ├── studio/         # Production hub
│   ├── outpost/        # Source management
│   ├── perimeter/      # Signal monitor
│   ├── extraction/     # Entity map
│   ├── nexus/          # Story desk
│   └── guide/          # User manual
├── components/
│   ├── ui/             # UI components
│   └── layout/         # App shell
├── lib/                # Core libraries
│   ├── rag/            # Vector search
│   └── workers/        # Job processors
└── workers/            # Background jobs
```

## Host Personalities

Talk Show Go includes 7 distinct host personalities:

1. **Maya Sterling** - Investigative anchor (Rachel Maddow style)
2. **Marcus Blaze** - Hot take king (Stephen A Smith style)
3. **Devon Sharp** - Witty satirist (Jon Stewart style)
4. **Tasha Raw** - Unfiltered real talk
5. **James Noble** - Smooth documentary narrator
6. **DJ Momentum** - High energy hype
7. **King Knowledge** - Street analyst

## Documentation

- [CLAUDE.md](CLAUDE.md) - Development guidelines
- [SECURITY.md](SECURITY.md) - Security best practices
- [API-DOCS.md](API-DOCS.md) - API reference
- [QUICKSTART.md](QUICKSTART.md) - Getting started guide

## Development

```bash
# Run linting
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

## License

MIT
