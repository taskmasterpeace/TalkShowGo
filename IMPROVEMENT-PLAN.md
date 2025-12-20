# Talk Show Go - Ultimate Talk Show Platform Improvement Plan

## Vision

Transform Talk Show Go into the ultimate platform for creating automated talk shows, debate shows, panel discussions, and multi-host content with professional-quality audio output.

---

## Phase 1: Multi-Voice Audio Infrastructure

### 1.1 Install Audio Composition Libraries

**New Dependencies:**
```bash
npm install fluent-ffmpeg @ffmpeg-installer/ffmpeg
npm install @types/fluent-ffmpeg --save-dev
```

**Files to Create:**
- `src/lib/audio/composer.ts` - Audio segment composition
- `src/lib/audio/mixer.ts` - Multi-track mixing
- `src/lib/audio/effects.ts` - Audio effects (transitions, gaps)

### 1.2 Multi-Voice TTS Generator

**File: `src/lib/audio/multi-voice-tts.ts`**

```typescript
interface VoiceSegment {
  hostId: string
  voiceId: string
  text: string
  startTime?: number
  duration?: number
}

interface MultiVoiceScript {
  segments: VoiceSegment[]
  format: 'debate' | 'panel' | 'interview'
  transitionStyle: 'quick' | 'natural' | 'dramatic'
}

async function generateMultiVoiceAudio(script: MultiVoiceScript): Promise<Buffer> {
  // 1. Generate audio for each segment with assigned voice
  // 2. Add transition gaps between speakers
  // 3. Compose into single audio file
  // 4. Return final MP3 buffer
}
```

### 1.3 Script Formatting with Speaker Markers

**Format:**
```
[HOST:marcus_blaze]
Let me tell you something about this battle...

[HOST:devon_sharp]
Hold on, Marcus. You're missing the point here.

[HOST:marcus_blaze]
I said what I said!
```

---

## Phase 2: Show Format System

### 2.1 Show Format Definitions

**File: `src/lib/shows/formats.ts`**

| Format | Hosts | Structure | Best For |
|--------|-------|-----------|----------|
| `solo_news` | 1 | Intro → Stories → Outro | Daily briefings |
| `debate` | 2 | Intro → Setup → Side A → Side B → Rebuttal → Conclusion | Controversial topics |
| `panel` | 3-4 | Intro → Overview → Round Robin → Discussion → Wrap | Multiple perspectives |
| `interview` | 2 | Intro → Questions → Follow-ups → Closing | Deep dives on people |
| `reaction` | 1-2 | Clip → Reaction → Discussion | Live event coverage |

### 2.2 Database Schema Updates

**New Migration: `015_multi_host_shows.sql`**

```sql
-- Show format definitions
CREATE TABLE show_formats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  min_hosts INTEGER DEFAULT 1,
  max_hosts INTEGER DEFAULT 1,
  structure JSONB NOT NULL,  -- [{segment: "intro", speaker: "host_1"}, ...]
  transition_style VARCHAR(50) DEFAULT 'natural',
  requires_conflict BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Show productions with multi-host support
CREATE TABLE show_productions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  format_id UUID REFERENCES show_formats(id),
  template_id UUID REFERENCES show_templates(id),
  topic_id UUID REFERENCES topics(id),

  -- Multi-host assignment
  host_assignments JSONB NOT NULL,  -- {host_1: "marcus_blaze", host_2: "devon_sharp"}
  voice_assignments JSONB NOT NULL, -- {marcus_blaze: "voice_id_1", devon_sharp: "voice_id_2"}

  -- Script with speaker markers
  script_segments JSONB NOT NULL,   -- [{host: "marcus_blaze", text: "..."}, ...]

  -- Audio output
  audio_segments JSONB,             -- URLs for individual segments
  composed_audio_url VARCHAR(500),  -- Final mixed audio

  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.3 Host Voice Assignments

**Update hosts table:**
```sql
ALTER TABLE hosts ADD COLUMN voice_id VARCHAR(100);
ALTER TABLE hosts ADD COLUMN voice_settings JSONB DEFAULT '{}';
```

**Assign voices to existing hosts:**
- Maya Sterling: `ElevenLabs voice ID for professional female`
- Marcus Blaze: `ElevenLabs voice ID for energetic male`
- Devon Sharp: `ElevenLabs voice ID for witty male`
- Tasha Raw: `ElevenLabs voice ID for bold female`
- James Noble: `ZJ7BlVZrxZKBDMTIK5c9` (existing Algorithm voice)
- DJ Momentum: `ElevenLabs voice ID for hype male`
- King Knowledge: `ElevenLabs voice ID for wise male`

---

## Phase 3: Debate Show Implementation

### 3.1 Debate Script Generator

**File: `src/lib/shows/debate-generator.ts`**

```typescript
interface DebateConfig {
  topic: string
  sideA: {
    position: string
    host: HostPersonality
    arguments: string[]
  }
  sideB: {
    position: string
    host: HostPersonality
    arguments: string[]
  }
  moderator?: HostPersonality
  rounds: number
  style: 'heated' | 'respectful' | 'comedic'
}

async function generateDebateScript(config: DebateConfig): Promise<MultiVoiceScript> {
  // Use LLM to generate natural debate dialogue
  // Include rebuttals, interruptions, agreements
  // Return script with speaker markers
}
```

### 3.2 Debate API Endpoint

**File: `src/app/api/shows/debate/route.ts`**

```typescript
POST /api/shows/debate
{
  "topic_id": "...",
  "debate_topic": "Was Cassidy vs Eazy the best battle of 2024?",
  "side_a_host": "marcus_blaze",
  "side_b_host": "devon_sharp",
  "style": "heated",
  "generate_audio": true
}
```

### 3.3 Debate UI Page

**File: `src/app/studio/debate/page.tsx`**

Wizard steps:
1. Select debate topic (from proposed topics or custom)
2. Assign hosts to sides
3. Configure debate style and rounds
4. Preview generated script
5. Generate multi-voice audio

---

## Phase 4: Panel Show Implementation

### 4.1 Panel Script Generator

**File: `src/lib/shows/panel-generator.ts`**

```typescript
interface PanelConfig {
  topic: string
  moderator: HostPersonality
  panelists: HostPersonality[]  // 2-4 panelists
  format: 'round_robin' | 'free_discussion' | 'structured'
  segments: string[]  // Topics to discuss
}
```

### 4.2 Panel API Endpoint

**File: `src/app/api/shows/panel/route.ts`**

### 4.3 Panel UI Page

**File: `src/app/studio/panel/page.tsx`**

---

## Phase 5: Interview Show Implementation

### 5.1 Interview Script Generator

**File: `src/lib/shows/interview-generator.ts`**

```typescript
interface InterviewConfig {
  host: HostPersonality
  subject: Entity           // Person being discussed
  interviewStyle: 'documentary' | 'conversational' | 'investigative'
  focusAreas: string[]     // Career, controversy, predictions
  simulateGuest: boolean   // Generate guest responses
}
```

### 5.2 Guest Voice Synthesis

For interview format, generate a synthetic "guest" voice:
- Use entity enrichment data to inform responses
- Select appropriate voice from ElevenLabs library
- Generate responses in first-person as the subject

---

## Phase 6: UI/UX Improvements

### 6.1 Show Type Selector

Update `/studio` landing page:
- Cards for each show type
- Visual preview of format
- Quick stats (hosts needed, typical duration)

### 6.2 Host Assignment UI

Drag-and-drop host assignment:
- Visual host cards with photos/avatars
- Preview voice sample on hover
- Role assignment dropdown

### 6.3 Script Editor Enhancements

- Color-coded speaker sections
- Play individual segment audio
- Real-time word count per speaker
- Balance indicator (equal speaking time)

### 6.4 Audio Preview Player

- Waveform visualization
- Speaker timeline
- Jump to speaker sections
- Speed control

---

## Phase 7: Quality Improvements

### 7.1 Voice Consistency

- Store voice settings per host
- Cache voice samples for preview
- A/B testing different voices

### 7.2 Script Quality

- LLM prompts optimized for natural dialogue
- Personality-specific vocabulary
- Catchphrase injection
- Pacing markers

### 7.3 Audio Quality

- Consistent volume normalization
- Background music options (intro/outro)
- Sound effects library
- Transition sounds

---

## Implementation Priority

### Immediate (This Sprint)
1. Install ffmpeg dependencies
2. Create audio composer module
3. Add voice IDs to hosts table
4. Create debate format API

### Short Term (Next Sprint)
5. Debate UI wizard
6. Multi-voice TTS generator
7. Audio segment composition
8. Panel format implementation

### Medium Term
9. Interview format with synthetic guest
10. Advanced script editor
11. Voice preview system
12. Audio quality enhancements

### Long Term
13. Live reaction shows
14. Audience interaction features
15. Video generation (avatar-based)
16. Distribution automation (YouTube, podcast platforms)

---

## Files to Create/Modify

| File | Action | Priority |
|------|--------|----------|
| `src/lib/audio/composer.ts` | Create | High |
| `src/lib/audio/multi-voice-tts.ts` | Create | High |
| `src/lib/shows/formats.ts` | Create | High |
| `src/lib/shows/debate-generator.ts` | Create | High |
| `src/app/api/shows/debate/route.ts` | Create | High |
| `src/app/studio/debate/page.tsx` | Create | Medium |
| `supabase/migrations/015_multi_host_shows.sql` | Create | High |
| `src/lib/elevenlabs.ts` | Modify | Medium |
| `src/app/studio/page.tsx` | Modify | Medium |
| `package.json` | Modify | High |

---

## ElevenLabs Voice Requirements

To support 7 hosts with distinct voices:

1. **Professional Female** (Maya Sterling) - Investigative, measured
2. **Energetic Male** (Marcus Blaze) - Loud, passionate
3. **Witty Male** (Devon Sharp) - Sarcastic, smart
4. **Bold Female** (Tasha Raw) - Street, no-filter
5. **Documentary Male** (James Noble) - Already have: `ZJ7BlVZrxZKBDMTIK5c9`
6. **Hype Male** (DJ Momentum) - Fast, explosive
7. **Wise Male** (King Knowledge) - Measured, authentic

Consider: ElevenLabs subscription tier for multiple voices, or use voice cloning for custom voices.

---

## Success Metrics

- [ ] Generate 2-host debate show with distinct voices
- [ ] Generate 3+ host panel show
- [ ] Audio quality matches professional podcasts
- [ ] Script generation feels natural, not robotic
- [ ] UI workflow takes < 5 minutes to create show
- [ ] Support for all 7 host personalities
