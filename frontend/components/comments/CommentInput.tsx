'use client'

import { useState, useEffect } from 'react'
import { MentionsInput, Mention } from 'react-mentions'
import { Button } from '@/components/ui/button'
import { Send, Loader2 } from 'lucide-react'
import { User } from '@/types'

interface CommentInputProps {
  onSubmit: (content: string, mentions: string[]) => Promise<void>
  placeholder?: string
  projectId?: string
  loading?: boolean
}

export function CommentInput({ 
  onSubmit, 
  placeholder = "댓글을 입력하세요... (@로 멘션 가능)",
  projectId,
  loading = false
}: CommentInputProps) {
  const [value, setValue] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [mentions, setMentions] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch users for mention suggestions
  useEffect(() => {
    fetchUsers()
  }, [projectId])

  const fetchUsers = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/participants`)
      if (response.ok) {
        const data = await response.json()
        setUsers(data.participants || [])
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const handleSubmit = async () => {
    if (!value.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      // Extract mentions from the value
      const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g
      const extractedMentions: string[] = []
      let match
      
      while ((match = mentionRegex.exec(value)) !== null) {
        extractedMentions.push(match[2]) // User ID
      }

      // Convert mentions format to plain text for display
      const plainText = value.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1')
      
      await onSubmit(plainText, extractedMentions)
      setValue('')
      setMentions([])
    } catch (error) {
      console.error('Failed to submit comment:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const mentionStyle = {
    control: {
      fontSize: 14,
      fontWeight: 'normal',
    },
    '&multiLine': {
      control: {
        fontFamily: 'inherit',
        minHeight: 80,
      },
      highlighter: {
        padding: 9,
        border: '1px solid transparent',
      },
      input: {
        padding: '8px 12px',
        border: '1px solid hsl(var(--border))',
        borderRadius: 'calc(var(--radius) - 2px)',
        '&:focus': {
          outline: '2px solid transparent',
          outlineOffset: '2px',
          ringOffset: 'var(--background)',
          ring: '2px solid hsl(var(--ring))',
        },
      },
    },
    suggestions: {
      list: {
        backgroundColor: 'hsl(var(--popover))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 'calc(var(--radius) - 2px)',
        fontSize: 14,
        overflow: 'auto',
        maxHeight: 200,
      },
      item: {
        padding: '8px 12px',
        borderBottom: '1px solid hsl(var(--border))',
        cursor: 'pointer',
        '&focused': {
          backgroundColor: 'hsl(var(--accent))',
        },
      },
    },
  }

  const mentionInputStyle = {
    width: '100%',
    outline: 'none',
    border: '1px solid hsl(var(--border))',
    borderRadius: 'calc(var(--radius) - 2px)',
    padding: '8px 12px',
    fontSize: '14px',
    lineHeight: '1.5',
    minHeight: '80px',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
    '&:focus': {
      borderColor: 'hsl(var(--ring))',
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <MentionsInput
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={mentionStyle}
          placeholder={placeholder}
          disabled={loading || isSubmitting}
          allowSuggestionsAboveCursor
          inputRef={(input: any) => {
            if (input) {
              Object.assign(input.style, mentionInputStyle)
            }
          }}
        >
          <Mention
            trigger="@"
            data={users.map(user => ({
              id: user.id,
              display: user.nickname || user.username,
            }))}
            appendSpaceOnAdd
            displayTransform={(id, display) => `@${display}`}
            markup="@[__display__](__id__)"
            style={{
              backgroundColor: 'hsl(var(--primary) / 0.1)',
              color: 'hsl(var(--primary))',
              borderRadius: '3px',
              padding: '2px 4px',
            }}
          />
        </MentionsInput>
      </div>
      
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          @를 입력하여 사용자 멘션
        </p>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!value.trim() || isSubmitting || loading}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}