# Dia TTS Service - Multi-Voice Dialogue Generation
# Supports [S1]/[S2] speaker tags and emotional markers

FROM nvidia/cuda:12.6.0-runtime-ubuntu22.04

# Install Python and dependencies
RUN apt-get update && apt-get install -y \
    python3.10 \
    python3-pip \
    git \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install core dependencies directly (skip full Dia package to avoid gradio hash issues)
RUN pip install --no-cache-dir \
    torch==2.6.0 \
    torchaudio==2.6.0 \
    transformers \
    accelerate \
    fastapi \
    uvicorn \
    python-multipart \
    soundfile \
    safetensors

# Copy our FastAPI wrapper
COPY dia-api.py /app/

# Download model on build (cache in container)
RUN python3 -c "from transformers import AutoProcessor, DiaForConditionalGeneration; \
    AutoProcessor.from_pretrained('nari-labs/Dia-1.6B-0626'); \
    DiaForConditionalGeneration.from_pretrained('nari-labs/Dia-1.6B-0626')"

EXPOSE 8765

# Run FastAPI server
CMD ["python3", "/app/dia-api.py"]
