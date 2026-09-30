'use client'

import { cn } from '@/lib/utils/cn'

interface ThinkingIndicatorProps {
  className?: string
}

export function ThinkingIndicator({ className }: ThinkingIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-2 px-4 py-3', className)}>
      <div className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-sm text-gray-500 dark:text-gray-400">JH One AI is thinking...</span>
    </div>
  )
}
