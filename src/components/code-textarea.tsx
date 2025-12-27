'use client'

/**
 * CODE TEXTAREA
 *
 * Syntax-highlighted textarea for editing prompts with {variable} placeholders.
 * Uses a simple overlay approach without heavy dependencies.
 */

import React, { useState, useRef, useEffect } from 'react'

interface CodeTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
  disabled?: boolean
}

export default function CodeTextarea({
  value,
  onChange,
  placeholder,
  rows = 10,
  className = '',
  disabled = false,
}: CodeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLPreElement>(null)

  // Sync scroll between textarea and highlight overlay
  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }

  // Highlight {variables} in the text
  const highlightText = (text: string): string => {
    // Escape HTML
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    // Highlight {variables}
    text = text.replace(/(\{[a-zA-Z_][a-zA-Z0-9_]*\})/g, '<span class="text-blue-500 font-semibold">$1</span>')

    // Add a trailing newline to prevent layout issues
    if (text.endsWith('\n')) {
      text += ' '
    }

    return text
  }

  return (
    <div className={`relative ${className}`}>
      {/* Highlighted background */}
      <pre
        ref={highlightRef}
        className="absolute inset-0 p-3 m-0 font-mono text-sm text-transparent pointer-events-none overflow-auto whitespace-pre-wrap break-words"
        style={{
          lineHeight: '1.5',
          tabSize: 2,
        }}
        aria-hidden="true"
      >
        <code
          dangerouslySetInnerHTML={{
            __html: highlightText(value || ''),
          }}
        />
      </pre>

      {/* Actual editable textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onScroll={handleScroll}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={`
          relative w-full p-3 font-mono text-sm bg-transparent
          border border-gray-300 rounded-md
          resize-y
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
          caret-gray-900
          overflow-auto whitespace-pre-wrap break-words
        `}
        style={{
          lineHeight: '1.5',
          tabSize: 2,
          color: 'rgb(17 24 39)', // text-gray-900
        }}
        spellCheck={false}
      />
    </div>
  )
}

/**
 * VARIABLE TOOLBAR
 *
 * Quick insertion toolbar for {variable} placeholders
 */

interface VariableToolbarProps {
  variables: Array<{ name: string; description?: string; required?: boolean }>
  onInsert: (variableName: string) => void
  className?: string
}

export function VariableToolbar({ variables, onInsert, className = '' }: VariableToolbarProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <span className="text-sm text-gray-600 font-medium self-center">Quick insert:</span>
      {variables.map(variable => (
        <button
          key={variable.name}
          onClick={() => onInsert(`{${variable.name}}`)}
          className={`
            px-2 py-1 text-xs font-mono rounded
            ${variable.required ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-100 text-gray-700 border border-gray-300'}
            hover:bg-blue-200 hover:border-blue-400
            transition-colors
          `}
          title={variable.description || variable.name}
        >
          {`{${variable.name}}`}
          {variable.required && <span className="ml-1 text-red-500">*</span>}
        </button>
      ))}
    </div>
  )
}
