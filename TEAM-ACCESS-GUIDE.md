# Presidium AI - Machine King Labs

## Team Access Guide

Your unified AI infrastructure: LLMs, Voice Synthesis, Embeddings, Web Search, and Deep Research - all self-hosted.

---

## Quick Start

### Connect to Presidium AI

| Service | Local URL | Remote URL (Cloudflare) |
|---------|-----------|-------------------------|
| **Ollama (LLMs)** | `http://192.168.1.211:11434` | `https://ai.machinekinglabs.com` |
| **Chatterbox (Voice)** | `http://192.168.1.211:4123` | `https://voice.machinekinglabs.com` |
| **SearXNG (Web Search)** | `http://localhost:8888` | - |

**Tailscale (VPN):** `http://100.120.206.8:11434`

---

## Available Models

### Language Models (Ollama)

| Model | Size | Best For | Command |
|-------|------|----------|---------|
| `deepseek-coder-v2:16b` | 8.9 GB | Coding, debugging, code review | `ollama run deepseek-coder-v2:16b` |
| `qwen3:30b` | 18.5 GB | Reasoning, planning, analysis | `ollama run qwen3:30b` |

### Embedding Models (Ollama)

| Model | Dimensions | Accuracy | Best For |
|-------|------------|----------|----------|
| `mxbai-embed-large` | 1024 | 64.68% MTEB | RAG, search (recommended) |
| `nomic-embed-text` | 1024 | 53.01% MTEB | Long documents (8K context) |

### Voice (Chatterbox)

| Feature | Description |
|---------|-------------|
| **TTS** | Natural text-to-speech |
| **Voice Cloning** | Clone any voice with 10 seconds of audio |
| **Languages** | 23 languages supported |
| **API** | OpenAI-compatible (`/v1/audio/speech`) |

---

## Integration Examples

### Python - Chat with LLM

```python
import ollama

# Connect to Presidium AI
client = ollama.Client(host='http://192.168.1.211:11434')

# Chat with DeepSeek Coder
response = client.chat(
    model='deepseek-coder-v2:16b',
    messages=[{'role': 'user', 'content': 'Write a Python function to parse JSON'}]
)
print(response['message']['content'])
```

### Python - Generate Embeddings

```python
import ollama

client = ollama.Client(host='http://192.168.1.211:11434')

# Generate embedding with mxbai (recommended)
response = client.embeddings(
    model='mxbai-embed-large',
    prompt='Your text to embed'
)
embedding = response['embedding']  # 1024-dimensional vector
```

### Python - Text-to-Speech

```python
import requests

# Generate speech with Chatterbox
response = requests.post(
    'http://192.168.1.211:4123/v1/audio/speech',
    json={
        'model': 'tts-1',
        'input': 'Hello from Presidium AI!',
        'voice': 'default'
    }
)

with open('output.mp3', 'wb') as f:
    f.write(response.content)
```

### Python - Clone a Voice

```python
import requests

# 1. Upload reference audio (10-30 seconds of clear speech)
with open('my_voice.wav', 'rb') as f:
    response = requests.post(
        'http://192.168.1.211:4123/v1/voices',
        files={'file': f},
        data={'voice_name': 'my_voice', 'language': 'en'}
    )

# 2. Generate speech with cloned voice
response = requests.post(
    'http://192.168.1.211:4123/v1/audio/speech',
    json={
        'input': 'This is my cloned voice speaking!',
        'voice': 'my_voice'
    }
)

with open('cloned_output.mp3', 'wb') as f:
    f.write(response.content)
```

### JavaScript/TypeScript - Chat

```typescript
import { Ollama } from 'ollama';

const ollama = new Ollama({ host: 'http://192.168.1.211:11434' });

const response = await ollama.chat({
    model: 'deepseek-coder-v2:16b',
    messages: [{ role: 'user', content: 'Explain async/await in JavaScript' }]
});

console.log(response.message.content);
```

### JavaScript/TypeScript - Embeddings

```typescript
import { Ollama } from 'ollama';

const ollama = new Ollama({ host: 'http://192.168.1.211:11434' });

const response = await ollama.embeddings({
    model: 'mxbai-embed-large',
    prompt: 'Your text to embed'
});

console.log(response.embedding); // 1024-dimensional array
```

### cURL - Quick Test

```bash
# Test Ollama
curl http://192.168.1.211:11434/api/tags

# Test Chatterbox
curl http://192.168.1.211:4123/health

# Generate text
curl http://192.168.1.211:11434/api/generate -d '{
  "model": "deepseek-coder-v2:16b",
  "prompt": "Hello!",
  "stream": false
}'

# Generate speech
curl -X POST http://192.168.1.211:4123/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"input": "Hello from Presidium AI!", "voice": "default"}' \
  --output hello.mp3
```

---

## OpenAI-Compatible API

Presidium AI supports OpenAI's API format, so you can use it with any OpenAI-compatible library:

### Python (OpenAI SDK)

```python
from openai import OpenAI

# For LLMs (Ollama)
client = OpenAI(
    base_url='http://192.168.1.211:11434/v1',
    api_key='not-needed'
)

response = client.chat.completions.create(
    model='deepseek-coder-v2:16b',
    messages=[{'role': 'user', 'content': 'Hello!'}]
)
print(response.choices[0].message.content)

# For TTS (Chatterbox)
tts_client = OpenAI(
    base_url='http://192.168.1.211:4123/v1',
    api_key='not-needed'
)

response = tts_client.audio.speech.create(
    model='tts-1',
    voice='default',
    input='Hello from Presidium AI!'
)
response.stream_to_file('output.mp3')
```

---

## Web Search (SearXNG)

SearXNG is a self-hosted meta search engine that aggregates results from Google, Bing, DuckDuckGo, Wikipedia, and more - with no API limits.

### Direct Search (JSON API)

```bash
# Simple search
curl "http://localhost:8888/search?q=python+tutorial&format=json"

# Search with categories
curl "http://localhost:8888/search?q=breaking+news&format=json&categories=news"

# Search specific engines
curl "http://localhost:8888/search?q=Albert+Einstein&format=json&engines=wikipedia"
```

### Python - Web Search

```python
import requests

def search_web(query, max_results=10, categories=['general']):
    params = {
        'q': query,
        'format': 'json',
        'categories': ','.join(categories)
    }
    response = requests.get('http://localhost:8888/search', params=params)
    data = response.json()
    return data['results'][:max_results]

# Example usage
results = search_web("machine learning tutorial", max_results=5)
for r in results:
    print(f"{r['title']}: {r['url']}")
```

### JavaScript/TypeScript - Web Search

```typescript
async function searchWeb(query: string, maxResults = 10) {
    const params = new URLSearchParams({
        q: query,
        format: 'json'
    });

    const response = await fetch(`http://localhost:8888/search?${params}`);
    const data = await response.json();
    return data.results.slice(0, maxResults);
}

// Example usage
const results = await searchWeb("TypeScript best practices");
results.forEach(r => console.log(`${r.title}: ${r.url}`));
```

### Available Search Categories

- `general` - General web search
- `news` - News articles
- `social media` - Social media results
- `images` - Image search
- `videos` - Video search

### Available Engines

- `google` - Google search
- `bing` - Bing search
- `duckduckgo` - DuckDuckGo
- `wikipedia` - Wikipedia
- `google_news` - Google News
- `bing_news` - Bing News

---

## Deep Research

Deep Research performs iterative research on any topic. It searches, analyzes results with an LLM, generates follow-up questions, and repeats until it builds a comprehensive report.

### How It Works

```
Query → Generate Search Queries → Search Web → Extract Learnings
                    ↑                                    ↓
                    └──── Generate Follow-up Questions ←┘

                    (Repeats for configured depth)

                    Final Step: Generate Comprehensive Report
```

### Python - Deep Research

```python
import requests

def deep_research(query, depth=3, breadth=3):
    """
    Perform iterative deep research on a topic.

    Args:
        query: What to research
        depth: How many iterations (default 3)
        breadth: Queries per iteration (default 3)

    Returns:
        Research report with learnings and sources
    """
    # This uses SearXNG for search + Presidium LLM for analysis

    learnings = []
    sources = []

    for iteration in range(depth):
        # Generate search queries using LLM
        search_queries = generate_queries(query, learnings, breadth)

        for search_query in search_queries:
            # Search using SearXNG
            results = search_web(search_query, max_results=5)
            sources.extend([r['url'] for r in results])

            # Extract learnings using LLM
            new_learnings = extract_learnings(search_query, results)
            learnings.extend(new_learnings)

    # Generate final report
    report = generate_report(query, learnings, sources)
    return report

def generate_queries(query, learnings, num_queries):
    """Use LLM to generate targeted search queries"""
    client = ollama.Client(host='http://192.168.1.211:11434')

    prompt = f"""Generate {num_queries} search queries to research: "{query}"

Previous learnings: {learnings[-10:] if learnings else 'None yet'}

Return JSON: {{"queries": ["query1", "query2", ...]}}"""

    response = client.chat(
        model='qwen3:30b',
        messages=[{'role': 'user', 'content': prompt}]
    )

    # Parse and return queries
    import json
    return json.loads(response['message']['content'])['queries']

def extract_learnings(query, results):
    """Use LLM to extract key learnings from search results"""
    client = ollama.Client(host='http://192.168.1.211:11434')

    contents = "\n".join([f"- {r['title']}: {r['content']}" for r in results])

    prompt = f"""Analyze these search results for: "{query}"

Results:
{contents}

Extract 3 key learnings. Return JSON: {{"learnings": ["learning1", "learning2", "learning3"]}}"""

    response = client.chat(
        model='qwen3:30b',
        messages=[{'role': 'user', 'content': prompt}]
    )

    import json
    return json.loads(response['message']['content'])['learnings']

def generate_report(query, learnings, sources):
    """Generate final research report"""
    client = ollama.Client(host='http://192.168.1.211:11434')

    prompt = f"""Write a comprehensive research report on: "{query}"

Based on these learnings:
{chr(10).join(f'- {l}' for l in learnings)}

Include all facts, names, dates, and specific details. Format in markdown."""

    response = client.chat(
        model='qwen3:30b',
        messages=[{'role': 'user', 'content': prompt}]
    )

    report = response['message']['content']
    report += f"\n\n## Sources\n\n" + "\n".join(f"- {url}" for url in set(sources))

    return report
```

### Example Usage

```python
# Research a topic
report = deep_research("History of artificial intelligence", depth=3, breadth=3)
print(report)

# Save to file
with open('ai_history_report.md', 'w') as f:
    f.write(report)
```

---

## LangChain Integration

```python
from langchain_community.llms import Ollama
from langchain_community.embeddings import OllamaEmbeddings

# LLM
llm = Ollama(
    base_url='http://192.168.1.211:11434',
    model='deepseek-coder-v2:16b'
)

response = llm.invoke('Write a SQL query to find duplicate emails')

# Embeddings
embeddings = OllamaEmbeddings(
    base_url='http://192.168.1.211:11434',
    model='mxbai-embed-large'
)

vector = embeddings.embed_query('Your text here')
```

---

## VS Code / Cursor Integration

### Continue.dev Extension

Add to `~/.continue/config.json`:

```json
{
  "models": [
    {
      "title": "DeepSeek Coder (Presidium AI)",
      "provider": "ollama",
      "model": "deepseek-coder-v2:16b",
      "apiBase": "http://192.168.1.211:11434"
    },
    {
      "title": "Qwen 30B (Presidium AI)",
      "provider": "ollama",
      "model": "qwen3:30b",
      "apiBase": "http://192.168.1.211:11434"
    }
  ],
  "embeddingsProvider": {
    "provider": "ollama",
    "model": "mxbai-embed-large",
    "apiBase": "http://192.168.1.211:11434"
  }
}
```

### Cursor Settings

In Cursor, add custom model:
- API Base: `http://192.168.1.211:11434/v1`
- Model: `deepseek-coder-v2:16b`

---

## Storing Embeddings (pgvector in Supabase)

We use Supabase with pgvector for vector storage. Here's how to store and query embeddings:

### Setup (One-time)

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Create embeddings table
CREATE TABLE documents (
    id BIGSERIAL PRIMARY KEY,
    content TEXT,
    embedding vector(1024),  -- mxbai-embed-large dimensions
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create HNSW index for fast search
CREATE INDEX ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### Store Embeddings

```python
import ollama
from supabase import create_client

# Get embedding from Presidium AI
client = ollama.Client(host='http://192.168.1.211:11434')
response = client.embeddings(model='mxbai-embed-large', prompt='Your document text')
embedding = response['embedding']

# Store in Supabase
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
supabase.table('documents').insert({
    'content': 'Your document text',
    'embedding': embedding,
    'metadata': {'source': 'example'}
}).execute()
```

### Search (Semantic)

```python
# Get query embedding
query_embedding = client.embeddings(
    model='mxbai-embed-large',
    prompt='What is machine learning?'
)['embedding']

# Search similar documents
results = supabase.rpc('match_documents', {
    'query_embedding': query_embedding,
    'match_threshold': 0.7,
    'match_count': 5
}).execute()
```

---

## Environment Variables

Add to your `.env` or shell profile:

```bash
# Presidium AI endpoints
export OLLAMA_HOST=http://192.168.1.211:11434
export PRESIDIUM_LLM_URL=http://192.168.1.211:11434
export PRESIDIUM_TTS_URL=http://192.168.1.211:4123
export PRESIDIUM_EMBED_MODEL=mxbai-embed-large
export PRESIDIUM_LLM_MODEL=deepseek-coder-v2:16b

# SearXNG
export SEARXNG_URL=http://localhost:8888
```

---

## Model Recommendations

| Task | Model | Why |
|------|-------|-----|
| Writing code | `deepseek-coder-v2:16b` | Optimized for code generation |
| Code review | `deepseek-coder-v2:16b` | Understands code patterns |
| Debugging | `deepseek-coder-v2:16b` | Fast, accurate fixes |
| Planning/architecture | `qwen3:30b` | Better reasoning |
| Complex analysis | `qwen3:30b` | Larger context, deeper thinking |
| Documentation | `qwen3:30b` | Better writing quality |
| Deep research | `qwen3:30b` | Better at iterative analysis |
| Embeddings (RAG) | `mxbai-embed-large` | 21% more accurate than nomic |
| Long documents | `nomic-embed-text` | 8K token context window |
| Voice synthesis | Chatterbox | Natural TTS + voice cloning |
| Web search | SearXNG | No limits, self-hosted |

---

## Troubleshooting

### "Connection refused"
- Is Presidium AI running? Ask the server admin
- Are you on the same network (or VPN)?
- Try Tailscale IP: `100.120.206.8`

### Slow responses
- `qwen3:30b` is larger and slower - use `deepseek-coder-v2:16b` for faster responses
- If multiple people are using it, requests queue up

### "Model not found"
- Check model name spelling (case-sensitive)
- List available models: `curl http://192.168.1.211:11434/api/tags`

### Voice not working
- Chatterbox needs ~2 minutes to start up on first run
- Check health: `curl http://192.168.1.211:4123/health`

### SearXNG not working
- Start it: `docker-compose up -d searxng`
- Check: `curl http://localhost:8888/search?q=test&format=json`

---

## API Reference

### Ollama Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tags` | GET | List available models |
| `/api/generate` | POST | Generate text completion |
| `/api/chat` | POST | Chat completion |
| `/api/embeddings` | POST | Generate embeddings |
| `/api/ps` | GET | Show running models |
| `/v1/chat/completions` | POST | OpenAI-compatible chat |

### Chatterbox Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/audio/speech` | POST | Generate speech (OpenAI-compatible) |
| `/v1/audio/speech/stream` | POST | Stream audio |
| `/v1/voices` | GET | List available voices |
| `/v1/voices` | POST | Upload voice for cloning |
| `/health` | GET | Health check |
| `/languages` | GET | List supported languages |

### SearXNG Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/search?q=...&format=json` | GET | Search with JSON response |
| `/search?q=...&categories=news` | GET | Search specific category |
| `/search?q=...&engines=wikipedia` | GET | Search specific engine |
| `/healthz` | GET | Health check |

---

## Questions?

Contact the server admin for:
- New model requests
- New service deployments
- Access issues
- Performance concerns

---

**Presidium AI** - Machine King Labs
*Your AI, Your Infrastructure, Your Control*
