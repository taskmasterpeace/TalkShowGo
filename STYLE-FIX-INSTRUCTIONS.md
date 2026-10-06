# How to Fix Algorithm Institute Style - Action Plan

## The Problem
Generated stories use noir/crime thriller language ("fluorescent lights", "sickly green pallor") instead of Algorithm Institute's actual straightforward documentary style.

## Root Cause
The style profile at `data/styles/algorithm-institute-of-battle-rap.json` was analyzed from 5 videos:
- 3 were crime/legal stories with noir narration
- Only 2 were standard biographical documentaries

The AI learned BOTH styles and is now using the dramatic noir style for everything.

## The Fix (Choose One)

### Option 1: Quick Fix (5 minutes)
Replace the current style file with the fixed version:

```bash
# Backup current file
cp data/styles/algorithm-institute-of-battle-rap.json data/styles/algorithm-institute-of-battle-rap-BACKUP.json

# Use the fixed version
cp data/styles/algorithm-institute-of-battle-rap-FIXED.json data/styles/algorithm-institute-of-battle-rap.json
```

### Option 2: Re-analyze Channel (Better, 30 minutes)
Re-run the style analyzer with videos filtered to exclude crime stories:

```bash
# Use the style analyzer API to re-analyze
# Select only news commentary, reactions, battle breakdowns
# Exclude videos with titles containing: "snitch", "arrested", "trial", "confessions"
```

### Option 3: Create Two Profiles (Best, 1 hour)
Create separate style profiles for different content types:

1. `algorithm-institute-news.json` - For daily news/commentary
   - Use only reaction videos, news commentary, battle breakdowns
   - Straightforward documentary style

2. `algorithm-institute-documentary.json` - For deep dives on crime/legal topics
   - Can include noir style for specific story types
   - Used only when story involves legal matters

Then update story generation to auto-select based on story type.

## What Changed in the Fixed Version

### Before (WRONG):
```json
"tone_descriptors": ["Cinematic", "Suspenseful", "Noir-influenced", "Dramatic"]
"opening_patterns": [
  "Setting vivid scene with specific details (fluorescent lights, time stamps, locations)",
  "Opening with atmospheric description of key location"
]
```

### After (CORRECT):
```json
"tone_descriptors": ["Documentary-style", "Informative", "Straightforward", "Biographical"]
"opening_patterns": [
  "Opening with 'In the world of battle rap...' followed by the main topic",
  "Introducing subject with stage name, born name, and hometown",
  "Direct introduction of key players without atmospheric scene-setting"
]
```

## Test the Fix

Generate a story about "T-Rex says he beat Murda Mook" and check the opening:

### Bad (noir style):
```
The fluorescent lights of URL headquarters cast long shadows across the
concrete walls at 11:47 PM on a Tuesday night in Queens...
```

### Good (correct style):
```
In the world of battle rap, few claims generate more debate than when a
veteran says they beat an undisputed legend. This week, T-Rex, born Trevor
Smith Jr., did exactly that...
```

## Implementation Notes

### Where the style is used:
- `src/lib/story-pipeline.ts` line 524-542 (loads style profile)
- `src/lib/style-analyzer.ts` line 330-350 (generates style prompt)

### How it works:
1. Story generation calls `buildStoryPrompt()`
2. If `config.channel_style_file` is set, it loads the style profile
3. `generateStylePrompt()` converts the profile into instructions for the AI
4. The AI follows those instructions when writing

### To use the fixed style:
```typescript
await generateStory(research, {
  style: 'documentary',
  tone: 'engaging',
  channel_style_file: 'algorithm-institute-of-battle-rap'  // Uses the JSON file
})
```

## Style Guidelines Reference

### DO Use:
- "In the world of battle rap..."
- "[Name], born [Real Name], was a [role] from [hometown]"
- "He got his start in [year/era]..."
- "What followed was..."
- Straightforward factual narration
- Clear chronological progression
- Algorithm Institute outro/jingle

### DO NOT Use:
- "Fluorescent lights"
- "Sickly green pallor"
- "Cast shadows across..."
- "Dawn crept toward..."
- Atmospheric scene-setting
- Specific timestamps like "11:47 PM"
- Noir/crime thriller language

## Future Improvements

1. **Story Type Detection**
   - Auto-detect if story is crime/legal
   - Use noir style ONLY for those stories
   - Default to straightforward style for daily news

2. **Multiple Style Profiles**
   - Create profiles for different content types
   - Let the system choose the right style automatically

3. **Style Mixing Prevention**
   - Add validation to detect when style profile has mixed styles
   - Warn during analysis if multiple distinct styles are found

4. **Better Video Selection**
   - Filter videos by topic when analyzing
   - Exclude outliers (crime stories when analyzing news style)
   - Select videos that match the desired use case

## Expected Results

After applying the fix:

- **Daily news shows** will sound like straightforward battle rap coverage
- **No more noir language** unless the story is actually about a crime/legal matter
- **Consistent with Algorithm Institute's actual voice** for news commentary
- **Professional but accessible** tone, not overdramatic

## Questions?

Check these files:
- `STYLE-ANALYSIS-FINDINGS.md` - Detailed analysis of what went wrong
- `data/styles/algorithm-institute-of-battle-rap-FIXED.json` - The corrected profile
- `algorithm-show-script.txt` - Example of the noir problem

The AI isn't broken - it's doing exactly what we told it to do. We just need to tell it the right thing.
