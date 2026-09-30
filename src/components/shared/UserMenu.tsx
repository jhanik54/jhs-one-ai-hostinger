'use client'

import { LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useRouter } from 'next/navigation'

interface UserMenuProps {
  email: string
  avatarUrl?: string | null
  displayName?: string | null
}

export function UserMenu({ email, avatarUrl, displayName }: UserMenuProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
            <User className="h-4 w-4 text-blue-600 dark:text-blue-300" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {displayName || 'User'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{email}</p>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-8 h-8 p-0 flex-shrink-0">
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  )
}
