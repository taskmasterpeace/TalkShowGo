'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [story, setStory] = useState<any>(null)
  const [editedScript, setEditedScript] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [isApproving, setIsApproving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Fetch story
    fetch(`/api/stories/${params.id}`)
      .then(r => r.json())
      .then(data => {
        setStory(data)
        setEditedScript(data.script || '')
        setIsLoading(false)
      })
      .catch(err => {
        console.error('Failed to load story:', err)
        setIsLoading(false)
      })
  }, [params.id])

  const handleApprove = async () => {
    setIsApproving(true)

    try {
      // Update script if edited
      await fetch(`/api/stories/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: editedScript,
          script_review_status: 'approved',
          review_notes: reviewNotes
        })
      })

      // Trigger audio generation
      await fetch(`/api/stories/${params.id}/generate-audio`, {
        method: 'POST'
      })

      router.push(`/studio/stories/${params.id}`)
    } catch (error) {
      console.error('Failed to approve story:', error)
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    try {
      await fetch(`/api/stories/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script_review_status: 'rejected',
          review_notes: reviewNotes
        })
      })

      router.push('/studio/stories')
    } catch (error) {
      console.error('Failed to reject story:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Producer Review</h1>

      {story && (
        <>
          <div className="mb-4">
            <h2 className="font-semibold">{story.headline}</h2>
            <p className="text-sm text-gray-600">
              {story.word_count} words • ~{Math.round(story.word_count / 150)} min read
            </p>
          </div>

          <div className="mb-6">
            <label className="block font-medium mb-2">Script</label>
            <textarea
              value={editedScript}
              onChange={(e) => setEditedScript(e.target.value)}
              className="w-full h-96 p-4 border rounded font-mono text-sm"
            />
          </div>

          <div className="mb-6">
            <label className="block font-medium mb-2">Review Notes</label>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Optional notes about edits or concerns..."
              className="w-full h-24 p-4 border rounded"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleApprove}
              disabled={isApproving}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {isApproving ? 'Generating Audio...' : 'Approve & Generate Audio'}
            </button>

            <button
              onClick={handleReject}
              className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reject
            </button>
          </div>
        </>
      )}
    </div>
  )
}
