# Talk Show Go - Quick Start

## First Time Setup

### 1. Create Desktop Shortcut
```powershell
# Run this in PowerShell (one time only)
.\create-shortcut.ps1
```

This creates a "Talk Show Go" shortcut on your desktop.

### 2. Start Everything
**Option A: Double-click the desktop shortcut**

**Option B: Run from terminal**
```powershell
.\start.ps1
```

**Option C: Use the batch file**
```cmd
start.bat
```

---

## What Gets Started

### Local Docker Services
| Service | URL | Purpose |
|---------|-----|---------|
| PostgreSQL | localhost:5432 | Database (pgvector enabled) |
| PostgREST | localhost:3333 | Direct REST API |
| Kong API | localhost:8000 | API Gateway |
| Supabase Studio | localhost:3001 | Database Admin |
| Redis | localhost:6379 | Job Queue |
| Qdrant | localhost:6333 | Vector Search |

### Presidium AI (Remote)
| Service | URL | Purpose |
|---------|-----|---------|
| Ollama | 192.168.1.211:11434 | LLMs (DeepSeek, Qwen) |
| Chatterbox | 192.168.1.211:4123 | Voice Synthesis |

### Available AI Models
| Model | Best For |
|-------|----------|
| `deepseek-coder-v2:16b` | Code, quick tasks |
| `qwen3:30b` | Reasoning, host generation |
| `mxbai-embed-large` | Embeddings (1024 dims) |
| Chatterbox TTS | Voice synthesis, cloning |

---

## Features

### Hosts
- **View**: Click the eye icon on any host
- **Edit**: Click the pencil icon to edit personality traits
- **Build**: Click "Build a Host" to generate a new host from a description

### Voice Integration
Each host can have a unique voice assigned via Chatterbox.
- Clone any voice with 10 seconds of audio
- 23 languages supported
- Natural text-to-speech

### Data Pipeline
1. **PERIMETER**: Fetch tweets and videos
2. **EXTRACTION**: Extract entities and claims
3. **AUDIT**: Score consensus and credibility
4. **NEXUS**: Generate story candidates
5. **PRODUCER**: Create narrated content

---

## Troubleshooting

### Docker not starting
```powershell
# Restart Docker Desktop, then:
docker-compose down
docker-compose up -d
```

### Presidium AI not connecting
Make sure you're on the same network as 192.168.1.211, or use Tailscale:
```
OLLAMA_HOST=http://100.120.206.8:11434
```

### Database issues
```powershell
# Reset database
docker-compose down -v
docker-compose up -d
```

### Port conflicts
Check what's using the ports:
```powershell
netstat -ano | findstr "5432 8000 3001 6379 6333"
```

---

## Environment Variables

All configured in `.env.local`:

```bash
# Twitter API (twitterapi.io)
TWITTERAPI_IO_KEY=[lives in .env, never in docs]

# Presidium AI
OLLAMA_HOST=http://192.168.1.211:11434
CHATTERBOX_URL=http://192.168.1.211:4123
PRESIDIUM_LLM_MODEL=deepseek-coder-v2:16b
PRESIDIUM_REASONING_MODEL=qwen3:30b
PRESIDIUM_EMBED_MODEL=mxbai-embed-large
```
