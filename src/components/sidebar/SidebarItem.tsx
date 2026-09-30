'use client'

import { useState } from 'react'
import { MessageSquare, Trash2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/format'
import type { Conversation } from '@/types'

interface SidebarItemProps {
  conversation: Conversation
  isActive: boolean
  onClick: () => void
  onRename: (title: string) => void
  onDelete: () => void
}

export function SidebarItem({ conversation, isActive, onClick, onRename, onDelete }: SidebarItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(conversation.title)

  const handleRename = () => {
    onRename(editTitle)
    setIsEditing(false)
  }

  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 px-3 py-2.5 mx-2 rounded-lg cursor-pointer transition-colors',
        isActive
          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
      )}
      onClick={onClick}
    >
      <MessageSquare className="h-4 w-4 flex-shrink-0" />

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename()
              if (e.key === 'Escape') setIsEditing(false)
            }}
            className="w-full bg-white dark:bg-gray-700 rounded px-1 py-0.5 text-sm outline-none border border-blue-500"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <p className="text-sm truncate">{conversation.title}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(conversation.updated_at)}</p>
          </>
        )}
      </div>

      <div className="hidden group-hover:flex items-center gap-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setIsEditing(true)
            setEditTitle(conversation.title)
          }}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
