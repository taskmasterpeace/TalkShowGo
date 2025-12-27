'use client'

import { useTopic } from '@/context/topic-context'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui'

export function TopicTabs() {
  const { topics, selectedTopic, selectTopic } = useTopic()

  if (!topics || topics.length === 0) return null
  if (topics.length === 1) return null // Hide if only one topic

  return (
    <Tabs value={selectedTopic?.id || ''} onValueChange={(topicId) => {
      const topic = topics.find(t => t.id === topicId)
      if (topic) selectTopic(topic)
    }}>
      <TabsList className="border-b-2 border-foreground w-full justify-start rounded-none bg-transparent p-0">
        {topics.map((topic) => (
          <TabsTrigger
            key={topic.id}
            value={topic.id}
            className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/10 px-6 py-3 font-medium"
          >
            {topic.name}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
