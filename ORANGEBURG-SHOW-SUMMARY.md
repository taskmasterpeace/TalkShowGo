# Orangeburg Weekly Roundup - Two-Host Talk Show

## ✅ Successfully Created!

### What We Built

A **two-host dialogue show** covering Orangeburg, SC news from the last 7 days.

### The Hosts

**Sarah Mitchell** (Voice: Female, Warm)
- Community-focused anchor
- Conversational local news style
- ElevenLabs Voice ID: `EXAVITQu4vr4xnSDxMaL`

**Marcus Johnson** (Voice: Male, Deep)
- Analytical co-host
- Thoughtful analyst style
- ElevenLabs Voice ID: `TxGEqnHWrfWFTfGW9XjX`

### News Covered (Last 7 Days)

The system found **19 recent videos** from Orangeburg sources:

1. **MCIS Selects Orangeburg County** - Nearly 400 jobs coming to the area
2. **Traffic Safety** - Fatal hit-and-runs and accidents (WRDW News 12, Live 5 News)
3. **SC State University** - Sports and campus updates
4. **Law Enforcement** - Local incidents and public safety updates
5. **Community Development** - Economic growth and local government news

### Output Files

📁 **Full Show Audio**
- `orangeburg-weekly-roundup-full.mp3` (1.2 MB, 1:12 duration)
- Complete two-host dialogue with alternating voices

📁 **Individual Segments** (in `orangeburg-show-audio/`)
- 11 separate MP3 files
- Each labeled by speaker (SARAH or MARCUS)
- Can be re-edited or rearranged

📄 **Script**
- `orangeburg-show-script.txt`
- Full dialogue transcript with speaker labels

### How It Works

```
1. Search YouTube channels → Find recent Orangeburg news
2. Extract key stories → Parse video titles and metadata
3. Generate dialogue → Create natural co-host conversation
4. Split by speaker → Separate SARAH and MARCUS lines
5. Generate audio → Use ElevenLabs with 2 different voices
6. Combine segments → ffmpeg merges into full show
```

### Sample Dialogue

```
SARAH: Good evening, Orangeburg! I'm Sarah Mitchell.

MARCUS: And I'm Marcus Johnson. Welcome to Orangeburg Weekly
        Roundup, where we bring you the stories that matter most
        to our community.

SARAH: We've got some important updates from around the city
       this week. Marcus, what's catching your attention?

MARCUS: Well Sarah, there's been quite a bit of activity.
        News 19 WLTX reported on MCIS selecting Orangeburg County
        for their first South Carolina operation.

SARAH: That's right. And we're also seeing updates from
       WRDW News 12 about troopers asking for tips in a pair
       of deadly Orangeburg County hit and runs...
```

### Next Steps / Improvements

**To regenerate with fresh news:**
```bash
node create-orangeburg-show.mjs
node generate-two-host-audio.mjs
```

**To use different voices:**
Edit voice IDs in `generate-two-host-audio.mjs`:
```javascript
const VOICES = {
  SARAH: 'YOUR_VOICE_ID_HERE',
  MARCUS: 'YOUR_VOICE_ID_HERE'
}
```

**To customize the script:**
1. Edit `orangeburg-show-script.txt`
2. Re-run `node generate-two-host-audio.mjs`
3. Audio will regenerate with your changes

### System Architecture

**Orangeburg Topic Setup:**
- Topic ID: `20eeae67-b5f0-4af8-a9d0-059dad99dfe5`
- 6 Twitter sources
- 8 YouTube channels:
  - Times and Democrat
  - Orangeburg Department of Public Safety
  - City of Orangeburg
  - Orangeburg County Sheriff
  - SC State University
  - Claflin University
  - News 19 WLTX
  - WIS News 10

**New Tools Created:**
- `create-orangeburg-show.mjs` - News aggregation + script generation
- `generate-two-host-audio.mjs` - Multi-voice audio generation

---

## ✨ YES, we can do two-host shows with different voices!

The system successfully demonstrated:
- ✅ Multiple YouTube sources for local news
- ✅ Automated script generation from real news
- ✅ Dialogue format (not single narrator)
- ✅ Two distinct AI voices (male + female)
- ✅ Natural co-host conversation flow
- ✅ Individual segments + combined full show

Duration: ~72 seconds
File size: 1.2 MB
Format: MP3, 128 kbps, 44.1 kHz mono
