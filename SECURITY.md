# Security Guidelines

## Before Committing

### Checklist
- [ ] No API keys are hardcoded in source files
- [ ] `.env` and `.env.local` are NOT committed (check `.gitignore`)
- [ ] No private IP addresses (192.168.x.x, 10.x.x.x) in source code
- [ ] Database credentials use environment variables
- [ ] JWT secrets use environment variables

### Sensitive Files (DO NOT COMMIT)
```
.env
.env.local
.env.development
.env.production
*.pem
*.key
secrets/
credentials/
```

### Safe to Commit
```
.env.example      # Contains placeholder values only
docker-compose.yml # Uses ${ENV_VAR:-default} syntax
```

## API Keys

### Storage Options

1. **Environment Variables** (Recommended for production)
   - Set in server environment or CI/CD
   - Never logged or exposed

2. **Settings UI** (For development)
   - Navigate to Settings > API Keys
   - Keys stored in database `api_keys` table
   - Auto-verified before saving

### Supported Services
| Service | Env Variable | Notes |
|---------|--------------|-------|
| Perplexity | `PERPLEXITY_API_KEY` | AI search, 5 free credits/month |
| Twitter | `TWITTER_API_KEY` | twitterapi.io (not official) |
| ElevenLabs | `ELEVENLABS_API_KEY` | Text-to-speech |
| OpenAI | `OPENAI_API_KEY` | GPT models |
| Anthropic | `ANTHROPIC_API_KEY` | Claude models |
| YouTube | `YOUTUBE_API_KEY` | Optional - youtubei.js is free |

## Database Security

- Default credentials (`postgres:postgres`) are for local development ONLY
- Production should use strong, unique passwords
- JWT secret must be at least 32 characters
- Use `JWT_SECRET` environment variable

## Reporting Security Issues

If you discover a security vulnerability, please do NOT create a public issue.
Instead, contact the maintainers directly.

## Security Scan Results

Last scan: December 2024

### Fixed Issues
- [x] Removed hardcoded YouTube API key from `docker-compose.yml`
- [x] Removed hardcoded Twitter API key from `docker-compose.yml`
- [x] Removed hardcoded YouTube API key from `intelligence-framework.ts`
- [x] Removed hardcoded YouTube API key from `discover-sources/route.ts`
- [x] Replaced hardcoded local IPs (192.168.x.x) with localhost defaults
- [x] Enhanced `.gitignore` with security exclusions
- [x] Updated `.env.example` with comprehensive documentation

### Verified Safe
- [x] No API keys in source code (src/)
- [x] No private IPs in source code
- [x] `.env` files properly gitignored
- [x] Database credentials use env vars with safe local defaults
- [x] JWT secret uses env var with reminder to change
