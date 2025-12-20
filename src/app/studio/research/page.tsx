'use client'

import { useState, useRef, useEffect } from 'react'
import { AppShell } from '@/components/layout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import {
  MessageSquare,
  Send,
  Loader2,
  Database,
  Brain,
  Search,
  FileText,
  User,
  Bot,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Zap,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  timestamp: Date
}

interface Source {
  id: string
  content: string
  type: 'tweet' | 'claim' | 'entity'
  similarity: number
  metadata: {
    author?: string
    date?: string
    claimType?: string
    entityType?: string
  }
}

interface RAGStatus {
  embeddingProvider: { available: boolean; provider: string | null }
  llmProvider: { available: boolean; provider: string | null }
  vectorStore: { available: boolean; totalDocuments: number }
  ready: boolean
}

// ============================================
// CHAT MESSAGE COMPONENT
// ============================================

function ChatMessage({ message }: { message: Message }) {
  const [sourcesExpanded, setSourcesExpanded] = useState(false)

  return (
    <div
      className={`flex gap-4 ${
        message.role === 'user' ? 'justify-end' : 'justify-start'
      }`}
    >
      {message.role === 'assistant' && (
        <div className="w-10 h-10 rounded-none border-2 border-foreground bg-primary flex items-center justify-center flex-shrink-0">
          <Bot className="h-5 w-5 text-primary-foreground" />
        </div>
      )}

      <div
        className={`max-w-[80%] ${
          message.role === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted border-2 border-foreground'
        } p-4`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-foreground/20">
            <button
              onClick={() => setSourcesExpanded(!sourcesExpanded)}
              className="flex items-center gap-2 text-sm opacity-70 hover:opacity-100"
            >
              <FileText className="h-4 w-4" />
              {message.sources.length} sources
              {sourcesExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {sourcesExpanded && (
              <div className="mt-2 space-y-2">
                {message.sources.map((source, i) => (
                  <div
                    key={source.id}
                    className="text-sm p-2 bg-background/50 border border-foreground/20"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {source.type}
                      </Badge>
                      <span className="text-xs opacity-60">
                        {(source.similarity * 100).toFixed(0)}% match
                      </span>
                      {source.metadata.author && (
                        <span className="text-xs opacity-60">
                          @{source.metadata.author}
                        </span>
                      )}
                    </div>
                    <p className="text-xs opacity-80 line-clamp-3">
                      {source.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-xs opacity-50 mt-2">
          {message.timestamp.toLocaleTimeString()}
        </p>
      </div>

      {message.role === 'user' && (
        <div className="w-10 h-10 rounded-none border-2 border-foreground bg-secondary flex items-center justify-center flex-shrink-0">
          <User className="h-5 w-5" />
        </div>
      )}
    </div>
  )
}

// ============================================
// STATUS INDICATOR
// ============================================

function StatusIndicator({ status }: { status: RAGStatus | null }) {
  if (!status) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking status...
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1">
        {status.embeddingProvider.available ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-red-500" />
        )}
        Embeddings
      </div>
      <div className="flex items-center gap-1">
        {status.llmProvider.available ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-red-500" />
        )}
        LLM
      </div>
      <div className="flex items-center gap-1">
        {status.vectorStore.available ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-red-500" />
        )}
        Vectors ({status.vectorStore.totalDocuments} docs)
      </div>
    </div>
  )
}

// ============================================
// MAIN PAGE
// ============================================

export default function ResearchPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<'general' | 'story' | 'entity' | 'factcheck' | 'legal'>('story')
  const [status, setStatus] = useState<RAGStatus | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Check RAG status on mount
  useEffect(() => {
    checkStatus()
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/rag/status')
      const data = await res.json()
      setStatus(data)
    } catch (error) {
      console.error('Status check failed:', error)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/rag/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          mode,
        }),
      })

      const data = await res.json()

      if (data.error) {
        throw new Error(data.error)
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${
          error instanceof Error ? error.message : 'Unknown error'
        }. Make sure your local LLM is running.`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <AppShell topicName="Studio">
      <div className="h-[calc(100vh-120px)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-head text-3xl flex items-center gap-3">
              <Brain className="h-8 w-8 text-primary" />
              RESEARCH CHAT
            </h1>
            <p className="text-muted-foreground">
              Chat with your data using local LLMs. Ask about trends, verify claims, research stories.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <StatusIndicator status={status} />
            <Button variant="outline" onClick={checkStatus} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-4 mb-4">
          <span className="text-sm text-muted-foreground">Research Mode:</span>
          <div className="flex gap-2">
            {[
              { value: 'story', label: 'Story Research', icon: Search },
              { value: 'entity', label: 'Entity Deep Dive', icon: User },
              { value: 'factcheck', label: 'Fact Check', icon: FileText },
              { value: 'legal', label: 'Legal/Docs', icon: AlertCircle },
              { value: 'general', label: 'General', icon: MessageSquare },
            ].map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={mode === value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode(value as any)}
                className="gap-2"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="py-3 border-b-2 border-foreground flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              {mode === 'story' && 'Story Research Assistant'}
              {mode === 'entity' && 'Entity Research Assistant'}
              {mode === 'factcheck' && 'Fact Check Assistant'}
              {mode === 'legal' && 'Legal/Document Research'}
              {mode === 'general' && 'General Research Assistant'}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={clearChat} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                <Brain className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-semibold mb-2">Start a conversation</p>
                <p className="text-sm max-w-md">
                  {mode === 'story' &&
                    'Ask about potential stories, trends, or what people are talking about.'}
                  {mode === 'entity' &&
                    'Research specific people, events, or organizations in your data.'}
                  {mode === 'factcheck' &&
                    'Verify claims by checking what multiple sources say.'}
                  {mode === 'legal' &&
                    'Research allegations, court documents, paperwork, and legal matters. Searches for official records.'}
                  {mode === 'general' &&
                    'Ask anything about the data in your knowledge base.'}
                </p>
                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  {mode === 'story' && (
                    <>
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => setInput("What are the hottest topics right now?")}
                      >
                        Hottest topics?
                      </Badge>
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => setInput("What controversies are brewing?")}
                      >
                        Controversies brewing?
                      </Badge>
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => setInput("What would make a good debate topic?")}
                      >
                        Debate topics?
                      </Badge>
                    </>
                  )}
                  {mode === 'entity' && (
                    <>
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => setInput("Who are the most mentioned people?")}
                      >
                        Most mentioned?
                      </Badge>
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => setInput("What events are coming up?")}
                      >
                        Upcoming events?
                      </Badge>
                    </>
                  )}
                  {mode === 'factcheck' && (
                    <>
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => setInput("What claims have the most disagreement?")}
                      >
                        Most disputed claims?
                      </Badge>
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => setInput("What has been confirmed by multiple sources?")}
                      >
                        Confirmed claims?
                      </Badge>
                    </>
                  )}
                  {mode === 'legal' && (
                    <>
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => setInput("Find court documents or paperwork about [NAME]")}
                      >
                        Find paperwork
                      </Badge>
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => setInput("What snitching or informant allegations exist?")}
                      >
                        Snitching allegations?
                      </Badge>
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => setInput("Find [NAME]'s real name for court records")}
                      >
                        Find real name
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            ) : (
              messages.map(message => (
                <ChatMessage key={message.id} message={message} />
              ))
            )}

            {isLoading && (
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-none border-2 border-foreground bg-primary flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="bg-muted border-2 border-foreground p-4 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Researching...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </CardContent>

          {/* Input Area */}
          <div className="p-4 border-t-2 border-foreground">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  status?.ready
                    ? 'Ask about your data...'
                    : 'Waiting for LLM connection...'
                }
                disabled={!status?.ready || isLoading}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || !status?.ready || isLoading}
                className="gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send
              </Button>
            </div>
            {!status?.ready && status && (
              <p className="text-xs text-red-500 mt-2">
                RAG system not ready. Make sure Ollama is running with an embedding model (nomic-embed-text recommended).
              </p>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  )
}
