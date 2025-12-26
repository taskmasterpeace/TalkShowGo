'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

export interface Topic {
  id: string
  name: string
  description?: string
  status: string
  created_at: string
}

interface TopicContextType {
  topics: Topic[]
  selectedTopic: Topic | null
  isLoading: boolean
  error: string | null
  selectTopic: (topic: Topic) => void
  refreshTopics: () => Promise<void>
  createTopic: (name: string, description?: string) => Promise<Topic | null>
}

const TopicContext = createContext<TopicContextType | null>(null)

export function TopicProvider({ children }: { children: React.ReactNode }) {
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTopics = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/topics')
      if (!res.ok) throw new Error('Failed to fetch topics')
      const data = await res.json()

      // Sort by created_at ascending (oldest first) - Battle Rap is the oldest
      const sortedTopics = Array.isArray(data)
        ? data.sort((a: Topic, b: Topic) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
        : []

      setTopics(sortedTopics)

      // Try to restore previously selected topic from localStorage
      const savedTopicId = localStorage.getItem('selectedTopicId')
      if (savedTopicId) {
        const savedTopic = sortedTopics.find((t: Topic) => t.id === savedTopicId)
        if (savedTopic) {
          setSelectedTopic(savedTopic)
          return
        }
      }

      // Default to first topic (oldest/original)
      if (sortedTopics.length > 0) {
        setSelectedTopic(sortedTopics[0])
        localStorage.setItem('selectedTopicId', sortedTopics[0].id)
      }
    } catch (err) {
      console.error('Error fetching topics:', err)
      setError(err instanceof Error ? err.message : 'Failed to load topics')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Only run on client side to avoid SSR fetch issues
    if (typeof window !== 'undefined') {
      fetchTopics()
    }
  }, [fetchTopics])

  const selectTopic = useCallback((topic: Topic) => {
    setSelectedTopic(topic)
    localStorage.setItem('selectedTopicId', topic.id)
  }, [])

  const createTopic = useCallback(async (name: string, description?: string): Promise<Topic | null> => {
    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to create topic')
      }

      const newTopic = await res.json()

      // Refresh topics list and select the new one
      await fetchTopics()
      setSelectedTopic(newTopic)
      localStorage.setItem('selectedTopicId', newTopic.id)

      return newTopic
    } catch (err) {
      console.error('Error creating topic:', err)
      setError(err instanceof Error ? err.message : 'Failed to create topic')
      return null
    }
  }, [fetchTopics])

  return (
    <TopicContext.Provider
      value={{
        topics,
        selectedTopic,
        isLoading,
        error,
        selectTopic,
        refreshTopics: fetchTopics,
        createTopic,
      }}
    >
      {children}
    </TopicContext.Provider>
  )
}

export function useTopic() {
  const context = useContext(TopicContext)
  if (!context) {
    throw new Error('useTopic must be used within a TopicProvider')
  }
  return context
}
