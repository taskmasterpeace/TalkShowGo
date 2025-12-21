# Ollama Setup Guide

Ollama provides local LLM capabilities for Talk Show Go - entity extraction, deep research, and content generation.

---

## What is Ollama?

Ollama is a tool for running large language models locally. It's:
- Free and open source
- Runs on your hardware
- No API costs
- Privacy-preserving

---

## Installation

### Windows

1. Download from https://ollama.ai/download
2. Run the installer
3. Ollama starts automatically

### Mac

```bash
# Using Homebrew
brew install ollama

# Or download from https://ollama.ai/download
```

### Linux

```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

---

## Verify Installation

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Or use Ollama CLI
ollama list
```

---

## Install Models

Talk Show Go works with various models. Recommended:

```bash
# General purpose (small, fast)
ollama pull llama3.2

# Coding and analysis
ollama pull deepseek-coder-v2:16b

# Larger, more capable
ollama pull qwen3:30b

# Embeddings (for vector search)
ollama pull mxbai-embed-large
```

**Model Sizes:**
- llama3.2: ~4GB
- deepseek-coder-v2:16b: ~9GB
- qwen3:30b: ~17GB

---

## Configure Talk Show Go

Edit `.env.local`:

```env
# Local Ollama
OLLAMA_HOST=http://localhost:11434

# Or remote Ollama server
OLLAMA_HOST=http://192.168.1.211:11434
```

---

## Verify in Talk Show Go

1. Visit http://localhost:3000/studio/system-status
2. Look for "Ollama" under AI Services
3. Should show "Connected (X models loaded)"

Or via API:
```bash
curl http://localhost:3000/api/system/status | jq '.services.ai'
```

---

## Remote Ollama Setup

### On the Ollama Server

1. Install Ollama (as above)
2. Configure to listen on all interfaces:

```bash
# Linux
OLLAMA_HOST=0.0.0.0:11434 ollama serve

# Or edit systemd service
sudo systemctl edit ollama
# Add:
# [Service]
# Environment="OLLAMA_HOST=0.0.0.0:11434"
```

3. Open firewall port 11434

### On Talk Show Go Machine

```env
OLLAMA_HOST=http://192.168.1.211:11434
```

---

## Model Selection

### For Entity Extraction
- **Recommended:** llama3.2 or mistral
- Fast responses, good at structured output

### For Deep Research
- **Recommended:** deepseek-coder-v2:16b or qwen3
- Better at analysis and synthesis

### For Content Generation
- **Recommended:** llama3.2 or larger
- Creative writing, dialogue generation

---

## Performance Tuning

### GPU Acceleration

Ollama automatically uses GPU if available:
- NVIDIA: CUDA (auto-detected)
- AMD: ROCm (Linux)
- Apple: Metal (auto-detected)

Check GPU usage:
```bash
# NVIDIA
nvidia-smi

# Watch continuously
watch -n 1 nvidia-smi
```

### Memory Requirements

| Model Size | RAM Needed | VRAM Needed |
|------------|------------|-------------|
| 7B | 8GB | 6GB |
| 13B | 16GB | 10GB |
| 30B+ | 32GB+ | 24GB+ |

---

## Troubleshooting

### "Connection refused"
```bash
# Check if Ollama is running
curl http://localhost:11434/

# Start Ollama
ollama serve
```

### "No models found"
```bash
# List installed models
ollama list

# Pull a model
ollama pull llama3.2
```

### Slow responses
- Try smaller model
- Check GPU is being used
- Reduce context length

### Remote connection fails
- Check firewall rules
- Verify OLLAMA_HOST in `.env.local`
- Test with curl from Talk Show Go machine

---

## Alternatives

If you don't want to use Ollama:

### Cloud LLMs
```env
# Use OpenAI instead
OPENAI_API_KEY=sk-...

# Or Anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

### Other Local Options
- LM Studio
- LocalAI
- vLLM

---

## Next Steps

- [Back to Deployment Guide](../DEPLOYMENT.md)
- [SearXNG Setup](./SEARXNG.md)
- [Voice Configuration](./VOICE.md)
