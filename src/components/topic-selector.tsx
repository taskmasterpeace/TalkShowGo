'use client'

import { useState } from 'react'
import { ChevronDown, Plus, Check, Loader2 } from 'lucide-react'
import { useTopic } from '@/context/topic-context'
import {
  Button,
  Badge,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui'

export function TopicSelector() {
  const { topics, selectedTopic, isLoading, selectTopic, createTopic } = useTopic()
  const [isOpen, setIsOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    if (!newName.trim()) return

    setIsCreating(true)
    const result = await createTopic(newName.trim(), newDescription.trim() || undefined)
    setIsCreating(false)

    if (result) {
      setNewName('')
      setNewDescription('')
      setIsCreateOpen(false)
      setIsOpen(false)
    }
  }

  if (isLoading) {
    return (
      <Button variant="outline" className="gap-2" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading...</span>
      </Button>
    )
  }

  return (
    <>
      {/* Topic Dropdown */}
      <div className="relative">
        <Button
          variant="outline"
          className="gap-2 min-w-[180px] justify-between"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="font-medium truncate max-w-[150px]">
            {selectedTopic?.name || 'Select Topic'}
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown Menu */}
            <div className="absolute top-full left-0 mt-1 w-64 bg-background border-2 border-foreground shadow-brutal z-50">
              {/* Topic List */}
              <div className="max-h-64 overflow-y-auto">
                {topics.map((topic) => (
                  <button
                    key={topic.id}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-muted transition-colors ${
                      selectedTopic?.id === topic.id ? 'bg-muted' : ''
                    }`}
                    onClick={() => {
                      selectTopic(topic)
                      setIsOpen(false)
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{topic.name}</div>
                      {topic.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {topic.description}
                        </div>
                      )}
                    </div>
                    {selectedTopic?.id === topic.id && (
                      <Check className="h-4 w-4 ml-2 flex-shrink-0" />
                    )}
                  </button>
                ))}

                {topics.length === 0 && (
                  <div className="px-3 py-4 text-center text-muted-foreground text-sm">
                    No topics yet
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t-2 border-foreground" />

              {/* Create New Button */}
              <button
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-muted transition-colors font-medium"
                onClick={() => {
                  setIsOpen(false)
                  setIsCreateOpen(true)
                }}
              >
                <Plus className="h-4 w-4" />
                Create New Niche
              </button>
            </div>
          </>
        )}
      </div>

      {/* Create Topic Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Niche</DialogTitle>
            <DialogDescription>
              Add a new content niche to track and generate shows for.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Niche Name</label>
              <Input
                placeholder="e.g., Sports Commentary, True Crime, Music News"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (optional)</label>
              <Input
                placeholder="Brief description of this niche"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Niche'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
