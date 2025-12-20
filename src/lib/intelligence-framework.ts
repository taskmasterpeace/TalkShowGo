/**
 * Intelligence Framework
 *
 * A repeatable, refinable system for gathering intelligence from sources.
 * Works with any niche (battle rap, hood content, sports, etc.)
 *
 * Two modes:
 * - MONITOR: What's happening NOW? Sweep sources, detect patterns
 * - RESEARCH: What happened with X? Search and gather historical content
 */

import { supabase } from './db'

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

// Types
export interface IntelligenceConfig {
  topic_id: string
  hours_back?: number  // For monitor mode (overrides topic config)
  min_sources?: number // Minimum sources to consider a "story" (overrides topic config)
}

export interface TopicIntelConfig {
  hours_back: number
  min_sources: number
  known_entities: string[]
  story_patterns: string[]
}

/**
 * Get topic-specific intel config from database
 */
async function getTopicConfig(topic_id: string): Promise<TopicIntelConfig> {
  const { data: topic } = await supabase
    .from('topics')
    .select('intel_config')
    .eq('id', topic_id)
    .single()

  const config = topic?.intel_config || {}

  // Defaults if not set
  return {
    hours_back: config.hours_back || 48,
    min_sources: config.min_sources || 2,
    known_entities: config.known_entities || [],
    story_patterns: config.story_patterns || ['vs', 'responds', 'beef']
  }
}

export interface MonitorResult {
  run_id: string
  videos_found: number
  stories_detected: DetectedStory[]
  raw_videos: VideoData[]
}

export interface ResearchResult {
  run_id: string
  query: string
  videos_found: number
  story_id?: string
  sources: VideoData[]
}

export interface DetectedStory {
  id?: string
  name: string
  type: 'breaking' | 'ongoing' | 'historical' | 'beef' | 'event'
  source_count: number
  total_engagement: number
  key_entities: string[]
  keywords: string[]
  sources: VideoData[]
}

export interface VideoData {
  video_id: string
  title: string
  channel_id: string
  channel_name: string
  published_at: string
  view_count?: number
  description?: string
  url: string
}

/**
 * MONITOR MODE
 * Sweep all trusted sources, gather recent content, detect patterns
 */
export async function runMonitor(config: IntelligenceConfig): Promise<MonitorResult> {
  const { topic_id } = config

  // Get topic-specific config (can be overridden by params)
  const topicConfig = await getTopicConfig(topic_id)
  const hours_back = config.hours_back ?? topicConfig.hours_back
  const min_sources = config.min_sources ?? topicConfig.min_sources

  // Create run record
  const { data: run } = await supabase
    .from('intelligence_runs')
    .insert({
      topic_id,
      run_type: 'monitor',
      time_window_hours: hours_back,
      status: 'running'
    })
    .select()
    .single()

  const run_id = run?.id

  try {
    // Get all trusted YouTube channels for this topic
    const { data: channels } = await supabase
      .from('youtube_channels')
      .select('channel_id, channel_name, source_profile')
      .eq('topic_id', topic_id)
      .eq('status', 'trusted')

    if (!channels || channels.length === 0) {
      throw new Error('No trusted channels found for topic')
    }

    // Gather recent videos from all channels
    const allVideos: VideoData[] = []
    const cutoff = new Date(Date.now() - hours_back * 60 * 60 * 1000)

    for (const channel of channels) {
      const videos = await getChannelRecentVideos(channel.channel_id, channel.channel_name, cutoff)
      allVideos.push(...videos)
    }

    // Detect stories from video titles using topic-specific entities
    const stories = detectStories(allVideos, min_sources, topicConfig.known_entities, topicConfig.story_patterns)

    // Store stories in database
    for (const story of stories) {
      const { data: storyRecord } = await supabase
        .from('detected_stories')
        .insert({
          topic_id,
          run_id,
          story_name: story.name,
          story_type: story.type,
          source_count: story.source_count,
          total_engagement: story.total_engagement,
          key_entities: story.key_entities,
          keywords: story.keywords,
          first_seen: story.sources[story.sources.length - 1]?.published_at,
          last_activity: story.sources[0]?.published_at
        })
        .select()
        .single()

      if (storyRecord) {
        story.id = storyRecord.id

        // Link sources to story
        for (const source of story.sources) {
          await supabase.from('story_sources').insert({
            story_id: storyRecord.id,
            source_type: 'youtube_video',
            source_id: source.video_id,
            source_title: source.title,
            source_channel: source.channel_name,
            source_url: source.url,
            published_at: source.published_at
          })
        }
      }
    }

    // Update run record
    await supabase
      .from('intelligence_runs')
      .update({
        sources_checked: channels.length,
        videos_found: allVideos.length,
        stories_detected: stories.length,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', run_id)

    return {
      run_id: run_id!,
      videos_found: allVideos.length,
      stories_detected: stories,
      raw_videos: allVideos
    }
  } catch (error) {
    await supabase
      .from('intelligence_runs')
      .update({ status: 'failed', metadata: { error: String(error) } })
      .eq('id', run_id)
    throw error
  }
}

/**
 * RESEARCH MODE
 * Search YouTube for a specific topic/story, gather all related content
 */
export async function runResearch(
  topic_id: string,
  query: string,
  options: {
    max_results?: number
    create_story?: boolean
    story_name?: string
    story_type?: string
  } = {}
): Promise<ResearchResult> {
  const { max_results = 25, create_story = true, story_name, story_type = 'historical' } = options

  // Create run record
  const { data: run } = await supabase
    .from('intelligence_runs')
    .insert({
      topic_id,
      run_type: 'research',
      query,
      status: 'running'
    })
    .select()
    .single()

  const run_id = run?.id

  try {
    // Search YouTube
    const videos = await searchYouTube(query, max_results)

    // Log the research query
    await supabase.from('research_queries').insert({
      topic_id,
      query,
      query_type: 'youtube',
      results_count: videos.length
    })

    let story_id: string | undefined

    // Get topic config for entity extraction
    const topicConfig = await getTopicConfig(topic_id)

    // Optionally create a story from results
    if (create_story && videos.length > 0) {
      const entities = extractEntitiesFromTitles(videos.map(v => v.title), topicConfig.known_entities)

      const { data: storyRecord } = await supabase
        .from('detected_stories')
        .insert({
          topic_id,
          run_id,
          story_name: story_name || query,
          story_type,
          source_count: videos.length,
          key_entities: entities,
          keywords: query.toLowerCase().split(' '),
          first_seen: videos[videos.length - 1]?.published_at,
          last_activity: videos[0]?.published_at
        })
        .select()
        .single()

      if (storyRecord) {
        story_id = storyRecord.id

        // Link sources
        for (const video of videos) {
          await supabase.from('story_sources').insert({
            story_id: storyRecord.id,
            source_type: 'youtube_search',
            source_id: video.video_id,
            source_title: video.title,
            source_channel: video.channel_name,
            source_url: video.url,
            published_at: video.published_at
          })
        }
      }
    }

    // Update run
    await supabase
      .from('intelligence_runs')
      .update({
        videos_found: videos.length,
        stories_detected: create_story ? 1 : 0,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', run_id)

    return {
      run_id: run_id!,
      query,
      videos_found: videos.length,
      story_id,
      sources: videos
    }
  } catch (error) {
    await supabase
      .from('intelligence_runs')
      .update({ status: 'failed', metadata: { error: String(error) } })
      .eq('id', run_id)
    throw error
  }
}

/**
 * Get recent videos from a channel
 */
async function getChannelRecentVideos(
  channelId: string,
  channelName: string,
  cutoff: Date
): Promise<VideoData[]> {
  try {
    // Get uploads playlist ID
    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?key=${YOUTUBE_API_KEY}&id=${channelId}&part=contentDetails`
    const channelRes = await fetch(channelUrl)
    const channelData = await channelRes.json()

    const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
    if (!uploadsPlaylistId) return []

    // Get recent videos
    const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?key=${YOUTUBE_API_KEY}&playlistId=${uploadsPlaylistId}&part=snippet&maxResults=15`
    const playlistRes = await fetch(playlistUrl)
    const playlistData = await playlistRes.json()

    if (!playlistData.items) return []

    return playlistData.items
      .filter((item: any) => new Date(item.snippet.publishedAt) >= cutoff)
      .map((item: any) => ({
        video_id: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        channel_id: channelId,
        channel_name: channelName,
        published_at: item.snippet.publishedAt,
        description: item.snippet.description,
        url: `https://youtube.com/watch?v=${item.snippet.resourceId.videoId}`
      }))
  } catch (error) {
    console.error(`Error fetching videos for ${channelName}:`, error)
    return []
  }
}

/**
 * Search YouTube for videos
 */
async function searchYouTube(query: string, maxResults: number = 25): Promise<VideoData[]> {
  const url = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&q=${encodeURIComponent(query)}&type=video&part=snippet&maxResults=${maxResults}&order=relevance`

  const res = await fetch(url)
  const data = await res.json()

  if (!data.items) return []

  return data.items.map((item: any) => ({
    video_id: item.id.videoId,
    title: item.snippet.title,
    channel_id: item.snippet.channelId,
    channel_name: item.snippet.channelTitle,
    published_at: item.snippet.publishedAt,
    description: item.snippet.description,
    url: `https://youtube.com/watch?v=${item.id.videoId}`
  }))
}

/**
 * Detect stories from video titles
 * Groups videos by common topics/entities
 * Uses topic-specific entities and patterns from config
 */
function detectStories(
  videos: VideoData[],
  minSources: number,
  knownEntities: string[],
  storyPatternKeywords: string[]
): DetectedStory[] {
  // Extract common patterns from titles
  const patterns = new Map<string, VideoData[]>()

  for (const video of videos) {
    const title = video.title.toUpperCase()

    // Check story pattern keywords (vs, responds, beef, etc.)
    for (const keyword of storyPatternKeywords) {
      if (title.includes(keyword.toUpperCase())) {
        // Try to extract context around the keyword
        const keywordUpper = keyword.toUpperCase()
        const idx = title.indexOf(keywordUpper)
        const start = Math.max(0, idx - 15)
        const end = Math.min(title.length, idx + keywordUpper.length + 15)
        const key = title.substring(start, end).trim().substring(0, 30)

        if (!patterns.has(key)) {
          patterns.set(key, [])
        }
        patterns.get(key)!.push(video)
      }
    }

    // Group by known entities from topic config
    for (const entity of knownEntities) {
      if (title.includes(entity.toUpperCase())) {
        const key = entity.toUpperCase()
        if (!patterns.has(key)) {
          patterns.set(key, [])
        }
        // Only add if not already in this group
        if (!patterns.get(key)!.find(v => v.video_id === video.video_id)) {
          patterns.get(key)!.push(video)
        }
      }
    }
  }

  // Convert patterns to stories (only those with enough sources)
  const stories: DetectedStory[] = []
  const usedVideos = new Set<string>()

  // Sort by source count descending
  const sortedPatterns = Array.from(patterns.entries())
    .sort((a, b) => b[1].length - a[1].length)

  for (const [pattern, patternVideos] of sortedPatterns) {
    // Get unique videos not already used
    const uniqueVideos = patternVideos.filter(v => !usedVideos.has(v.video_id))

    // Get unique channels
    const uniqueChannels = new Set(uniqueVideos.map(v => v.channel_id))

    if (uniqueChannels.size >= minSources) {
      // This is a story!
      const entities = extractEntitiesFromTitles(uniqueVideos.map(v => v.title), knownEntities)

      stories.push({
        name: pattern,
        type: determineStoryType(pattern, uniqueVideos),
        source_count: uniqueChannels.size,
        total_engagement: 0, // Would need view counts
        key_entities: entities,
        keywords: pattern.toLowerCase().split(/\s+/),
        sources: uniqueVideos.sort((a, b) =>
          new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
        )
      })

      // Mark videos as used
      uniqueVideos.forEach(v => usedVideos.add(v.video_id))
    }
  }

  return stories
}

/**
 * Extract entity names from video titles
 * Uses topic-specific known entities from config
 */
function extractEntitiesFromTitles(titles: string[], knownEntities: string[]): string[] {
  const entities = new Set<string>()

  for (const title of titles) {
    const upperTitle = title.toUpperCase()
    for (const entity of knownEntities) {
      if (upperTitle.includes(entity.toUpperCase())) {
        entities.add(entity.toUpperCase())
      }
    }
  }

  return Array.from(entities)
}

/**
 * Determine story type based on content
 */
function determineStoryType(pattern: string, videos: VideoData[]): 'breaking' | 'ongoing' | 'historical' | 'beef' | 'event' {
  const patternLower = pattern.toLowerCase()
  const latestVideo = videos[0]
  const hoursSinceLatest = latestVideo
    ? (Date.now() - new Date(latestVideo.published_at).getTime()) / (1000 * 60 * 60)
    : 999

  // Breaking if very recent (< 24 hours) with multiple sources
  if (hoursSinceLatest < 24 && videos.length >= 3) {
    return 'breaking'
  }

  // Event keywords
  if (patternLower.includes('cancelled') || patternLower.includes('fight') ||
      patternLower.includes('event') || patternLower.includes('stopped')) {
    return 'event'
  }

  // Beef keywords
  if (patternLower.includes('responds') || patternLower.includes('diss') ||
      patternLower.includes('snaps') || patternLower.includes('goes off')) {
    return 'beef'
  }

  // VS pattern usually ongoing
  if (patternLower.includes(' vs ')) {
    return 'ongoing'
  }

  return 'ongoing'
}

/**
 * Get all detected stories for a topic
 */
export async function getStories(
  topic_id: string,
  options: { status?: string; limit?: number } = {}
): Promise<DetectedStory[]> {
  const { status = 'active', limit = 20 } = options

  let query = supabase
    .from('detected_stories')
    .select('*, story_sources(*)')
    .eq('topic_id', topic_id)
    .order('last_activity', { ascending: false })
    .limit(limit)

  if (status) {
    query = query.eq('status', status)
  }

  const { data } = await query

  return (data || []).map(story => ({
    id: story.id,
    name: story.story_name,
    type: story.story_type,
    source_count: story.source_count,
    total_engagement: story.total_engagement,
    key_entities: story.key_entities || [],
    keywords: story.keywords || [],
    sources: (story.story_sources || []).map((s: any) => ({
      video_id: s.source_id,
      title: s.source_title,
      channel_id: '',
      channel_name: s.source_channel,
      published_at: s.published_at,
      url: s.source_url
    }))
  }))
}
