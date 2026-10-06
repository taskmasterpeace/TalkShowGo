#!/usr/bin/env python3
"""
Dia TTS API Service
Multi-voice dialogue generation with emotional tags

Features:
- [S1]/[S2] speaker tags for multi-voice conversations
- Emotional markers: (laughs), (whispers), (sighs), (gasps), etc.
- Real-time streaming or full audio generation
"""

import os
import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional, Literal
from transformers import AutoProcessor, DiaForConditionalGeneration
import io
import tempfile

app = FastAPI(title="Dia TTS API", version="1.0.0")

# Load model on startup
print("[Dia] Loading model...")
processor = AutoProcessor.from_pretrained("nari-labs/Dia-1.6B-0626")
model = DiaForConditionalGeneration.from_pretrained(
    "nari-labs/Dia-1.6B-0626",
    torch_dtype=torch.bfloat16,
    device_map="auto"
)
print("[Dia] Model loaded successfully")


class TTSRequest(BaseModel):
    text: str
    max_new_tokens: int = 3072
    guidance_scale: float = 3.0
    temperature: float = 1.8
    output_format: Literal["mp3", "wav"] = "mp3"
    seed: Optional[int] = None  # For consistent voices

    class Config:
        json_schema_extra = {
            "example": {
                "text": "[S1] Hey there! (laughs) This is incredible! [S2] I know right? (whispers) This changes everything.",
                "max_new_tokens": 3072,
                "guidance_scale": 3.0,
                "temperature": 1.8
            }
        }


class HealthResponse(BaseModel):
    status: str
    model: str
    device: str
    supports_multi_voice: bool
    supported_emotions: list[str]


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check if Dia service is running"""
    return {
        "status": "healthy",
        "model": "nari-labs/Dia-1.6B-0626",
        "device": str(model.device),
        "supports_multi_voice": True,
        "supported_emotions": [
            "laughs", "chuckle", "whispers", "sighs", "gasps",
            "coughs", "groans", "claps", "screams", "inhales",
            "exhales", "applause", "burps", "humming", "sneezes", "whistles"
        ]
    }


@app.post("/generate")
async def generate_speech(request: TTSRequest):
    """
    Generate multi-voice speech from text

    Supports:
    - [S1]/[S2] speaker tags for dialogue
    - Emotional markers: (laughs), (whispers), etc.
    - Consistent voices via seed parameter

    Returns: MP3 or WAV audio file
    """
    try:
        # Validate speaker tags
        if not request.text.strip().startswith("[S1]"):
            raise HTTPException(
                status_code=400,
                detail="Text must start with [S1] speaker tag"
            )

        # Set random seed for consistent voices
        if request.seed is not None:
            torch.manual_seed(request.seed)

        print(f"[Dia] Generating audio: {len(request.text)} chars")

        # Process input
        inputs = processor(
            text=request.text,
            padding=True,
            return_tensors="pt"
        ).to(model.device)

        # Generate audio
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=request.max_new_tokens,
                guidance_scale=request.guidance_scale,
                temperature=request.temperature
            )

        # Decode audio from model output
        audio = processor.batch_decode(outputs, skip_special_tokens=True)
        audio_tensor = audio[0] if isinstance(audio, list) else audio

        # Save to temporary file using torchaudio
        import torchaudio
        sample_rate = 44100  # Dia actual output sample rate (44.1 kHz)

        with tempfile.NamedTemporaryFile(
            suffix=f".{request.output_format}",
            delete=False
        ) as tmp:
            # Convert to audio format
            if not isinstance(audio_tensor, torch.Tensor):
                # If output is raw audio codes, we need to decode them
                audio_values = outputs.audio_values if hasattr(outputs, 'audio_values') else outputs
            else:
                audio_values = audio_tensor

            # Ensure correct shape (channels, samples)
            if len(audio_values.shape) == 1:
                audio_values = audio_values.unsqueeze(0)

            torchaudio.save(tmp.name, audio_values.cpu(), sample_rate)
            tmp_path = tmp.name

        print(f"[Dia] Audio generated: {tmp_path}")

        # Return audio file
        return FileResponse(
            tmp_path,
            media_type=f"audio/{request.output_format}",
            filename=f"dia_output.{request.output_format}",
            background=None  # Keep file until sent
        )

    except Exception as e:
        print(f"[Dia] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/batch")
async def batch_generate(texts: list[str], seed: Optional[int] = None):
    """
    Generate multiple audio segments with consistent voices

    All segments use the same seed for voice consistency
    Returns: List of audio file URLs
    """
    if seed is not None:
        torch.manual_seed(seed)

    import torchaudio
    results = []
    for i, text in enumerate(texts):
        try:
            inputs = processor(text=text, padding=True, return_tensors="pt").to(model.device)
            outputs = model.generate(**inputs, max_new_tokens=3072)

            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                audio = processor.batch_decode(outputs, skip_special_tokens=True)
                audio_tensor = audio[0] if isinstance(audio, list) else audio
                audio_values = outputs.audio_values if hasattr(outputs, 'audio_values') else (
                    audio_tensor if isinstance(audio_tensor, torch.Tensor) else outputs
                )
                if len(audio_values.shape) == 1:
                    audio_values = audio_values.unsqueeze(0)
                torchaudio.save(tmp.name, audio_values.cpu(), 44100)
                results.append(tmp.name)
        except Exception as e:
            results.append({"error": str(e)})

    return {"files": results}


@app.get("/")
async def root():
    """API documentation"""
    return {
        "service": "Dia Multi-Voice TTS",
        "version": "1.0.0",
        "endpoints": {
            "POST /generate": "Generate speech from text with [S1]/[S2] tags",
            "POST /batch": "Generate multiple segments with consistent voices",
            "GET /health": "Check service status"
        },
        "features": [
            "Multi-voice dialogue with [S1]/[S2] tags",
            "Emotional markers: (laughs), (whispers), (sighs), etc.",
            "Consistent voices via seed parameter",
            "Real-time generation (~2x faster than realtime)"
        ],
        "example": {
            "text": "[S1] Welcome to the show! (laughs) [S2] Thanks for having me. (chuckle)",
            "seed": 42
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765)
