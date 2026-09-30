'use client'

import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useChatStore } from '@/store/chat-store'

interface ErrorBannerProps {
  message: string
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  const { setError } = useChatStore()

  return (
    <div className="flex items-center gap-3 px-4 py-3 mx-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl mt-2">
      <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
      <p className="text-sm text-red-700 dark:text-red-300 flex-1">{message}</p>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setError(null)}
        className="text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
      >
        Dismiss
      </Button>
    </div>
  )
}
