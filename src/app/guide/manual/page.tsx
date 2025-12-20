'use client'

import { useState, useMemo } from 'react'
import { AppShell } from '@/components/layout'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  BookOpen,
  Search,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react'
import { USER_MANUAL, searchManual, type ManualChapter, type ManualSection } from '@/lib/user-manual'
import ReactMarkdown from 'react-markdown'
import Link from 'next/link'

export default function ManualPage() {
  const [selectedChapter, setSelectedChapter] = useState<string>('getting-started')
  const [selectedSection, setSelectedSection] = useState<string>('what-is-ck')
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set(['getting-started']))
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ReturnType<typeof searchManual>>([])
  const [isSearching, setIsSearching] = useState(false)

  // Find the current chapter and section
  const currentChapter = useMemo(() => {
    return USER_MANUAL.find(c => c.id === selectedChapter)
  }, [selectedChapter])

  const currentSection = useMemo(() => {
    return currentChapter?.sections.find(s => s.id === selectedSection)
  }, [currentChapter, selectedSection])

  // Toggle chapter expansion
  const toggleChapter = (chapterId: string) => {
    const newExpanded = new Set(expandedChapters)
    if (newExpanded.has(chapterId)) {
      newExpanded.delete(chapterId)
    } else {
      newExpanded.add(chapterId)
    }
    setExpandedChapters(newExpanded)
  }

  // Select a section
  const selectSection = (chapterId: string, sectionId: string) => {
    setSelectedChapter(chapterId)
    setSelectedSection(sectionId)
    setIsSearching(false)
    // Ensure chapter is expanded
    if (!expandedChapters.has(chapterId)) {
      setExpandedChapters(new Set([...expandedChapters, chapterId]))
    }
  }

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (query.length >= 2) {
      const results = searchManual(query)
      setSearchResults(results)
      setIsSearching(true)
    } else {
      setSearchResults([])
      setIsSearching(false)
    }
  }

  // Navigate to next/previous section
  const getAdjacentSection = (direction: 'next' | 'prev'): { chapterId: string; sectionId: string } | null => {
    const allSections: { chapterId: string; sectionId: string }[] = []
    for (const chapter of USER_MANUAL) {
      for (const section of chapter.sections) {
        allSections.push({ chapterId: chapter.id, sectionId: section.id })
      }
    }

    const currentIndex = allSections.findIndex(
      s => s.chapterId === selectedChapter && s.sectionId === selectedSection
    )

    if (currentIndex === -1) return null

    const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1
    return allSections[targetIndex] || null
  }

  const prevSection = getAdjacentSection('prev')
  const nextSection = getAdjacentSection('next')

  return (
    <AppShell topicName="Guide">
      <div className="flex gap-6 h-[calc(100vh-120px)]">
        {/* Sidebar - Table of Contents */}
        <div className="w-72 flex-shrink-0 overflow-y-auto border-r pr-4">
          <div className="sticky top-0 bg-background pb-4">
            <h2 className="font-head text-xl flex items-center gap-2 mb-4">
              <BookOpen className="h-5 w-5 text-primary" />
              USER MANUAL
            </h2>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search manual..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Search Results */}
          {isSearching && searchResults.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
              </p>
              {searchResults.slice(0, 10).map((result, i) => (
                <button
                  key={i}
                  onClick={() => selectSection(result.chapter.id, result.section.id)}
                  className="w-full text-left p-2 rounded-lg hover:bg-muted text-sm"
                >
                  <p className="font-medium">{result.section.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{result.snippet}</p>
                </button>
              ))}
            </div>
          )}

          {isSearching && searchResults.length === 0 && searchQuery.length >= 2 && (
            <p className="text-sm text-muted-foreground mb-4">No results found</p>
          )}

          {/* Chapters */}
          <nav className="space-y-1">
            {USER_MANUAL.map((chapter) => (
              <div key={chapter.id}>
                <button
                  onClick={() => toggleChapter(chapter.id)}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted text-left"
                >
                  <span className="flex items-center gap-2">
                    <span>{chapter.icon}</span>
                    <span className="font-medium">{chapter.title}</span>
                  </span>
                  {expandedChapters.has(chapter.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>

                {expandedChapters.has(chapter.id) && (
                  <div className="ml-6 mt-1 space-y-1">
                    {chapter.sections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => selectSection(chapter.id, section.id)}
                        className={`w-full text-left p-2 rounded-lg text-sm ${
                          selectedChapter === chapter.id && selectedSection === section.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                        }`}
                      >
                        {section.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          {currentSection ? (
            <div className="max-w-3xl">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Link href="/guide" className="hover:text-foreground">Guide</Link>
                <ChevronRight className="h-4 w-4" />
                <span>{currentChapter?.title}</span>
                <ChevronRight className="h-4 w-4" />
                <span className="text-foreground">{currentSection.title}</span>
              </div>

              {/* Content */}
              <Card className="border-2">
                <CardContent className="pt-6 prose prose-neutral dark:prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => (
                        <h1 className="font-head text-3xl border-b-2 pb-2 mb-4">{children}</h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="font-head text-xl mt-6 mb-3">{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="font-semibold text-lg mt-4 mb-2">{children}</h3>
                      ),
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-4">
                          <table className="border-collapse border-2 border-foreground w-full">
                            {children}
                          </table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th className="border-2 border-foreground bg-muted px-3 py-2 text-left font-semibold">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="border-2 border-foreground px-3 py-2">{children}</td>
                      ),
                      code: ({ className, children }) => {
                        const isBlock = className?.includes('language-')
                        if (isBlock) {
                          return (
                            <pre className="bg-muted p-4 rounded-lg overflow-x-auto border-2 border-foreground">
                              <code className="text-sm">{children}</code>
                            </pre>
                          )
                        }
                        return (
                          <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
                            {children}
                          </code>
                        )
                      },
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          className="text-primary underline hover:no-underline"
                          target={href?.startsWith('http') ? '_blank' : undefined}
                        >
                          {children}
                          {href?.startsWith('http') && (
                            <ExternalLink className="inline h-3 w-3 ml-1" />
                          )}
                        </a>
                      ),
                    }}
                  >
                    {currentSection.content}
                  </ReactMarkdown>
                </CardContent>
              </Card>

              {/* Navigation */}
              <div className="flex justify-between mt-6">
                {prevSection ? (
                  <Button
                    variant="outline"
                    onClick={() => selectSection(prevSection.chapterId, prevSection.sectionId)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                ) : (
                  <div />
                )}
                {nextSection && (
                  <Button
                    onClick={() => selectSection(nextSection.chapterId, nextSection.sectionId)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a section from the menu
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
