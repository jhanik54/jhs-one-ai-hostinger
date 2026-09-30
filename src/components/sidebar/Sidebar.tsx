'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, PanelLeftClose, PanelLeft } from 'lucide-react'
import { SearchBar } from './SearchBar'
import { SidebarItem } from './SidebarItem'
import { UserMenu } from '@/components/shared/UserMenu'
import { useChat } from '@/lib/hooks/useChat'
import { useAppStore } from '@/store/app-store'

export function Sidebar() {
  const [search, setSearch] = useState('')
  const [user, setUser] = useState<{ email: string; avatar_url?: string | null; display_name?: string | null } | null>(null)
  const [usage,setUsage]=useState<{plan:string;limits:{messages:number;pdfs:number;images:number};used:{messages:number;pdfs:number;images:number};unlimited:boolean}|null>(null)
  const { conversations, currentConversationId, loadConversations, loadMessages, createConversation, removeConversation, updateConversation } = useChat()
  const { sidebarOpen, setSidebarOpen } = useAppStore()

  useEffect(() => {
    const init = async () => {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const u = await response.json()
        setUser({ email: u.email, avatar_url: u.image, display_name: u.name })
        fetch('/api/usage').then(r=>r.ok?r.json():null).then(data=>{if(data)setUsage(data)}).catch(()=>undefined)
        loadConversations()
      }
    }
    init()
  }, [loadConversations])

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  )

  const handleNewChat = () => {
    createConversation()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/conversations?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    removeConversation(id)
  }

  const handleRename = async (id: string, title: string) => {
    await fetch(`/api/conversations/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ title }) })
    updateConversation(id, { title })
  }

  if (!sidebarOpen) {
    return (
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-3 left-3 z-50 p-2 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-900"
      >
        <PanelLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
      </button>
    )
  }

  return (
    <div className="w-72 flex-shrink-0 flex flex-col bg-gray-50 dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">History</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewChat}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <Plus className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <PanelLeftClose className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>

      <SearchBar value={search} onChange={setSearch} />

      <div className="flex-1 overflow-y-auto py-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
            {search ? 'No results found' : 'No conversations yet'}
          </p>
        ) : (
          filtered.map((conv) => (
            <SidebarItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === currentConversationId}
              onClick={() => loadMessages(conv.id)}
              onRename={(title) => handleRename(conv.id, title)}
              onDelete={() => handleDelete(conv.id)}
            />
          ))
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800">
        {usage && <div className="px-4 pt-3 text-xs text-gray-500"><div className="mb-1 flex justify-between"><span>{usage.plan} plan</span><Link href="/plans" className="text-blue-600">Upgrade</Link></div>{usage.unlimited?'Unlimited usage':(['messages','pdfs','images'] as const).map((key)=>`${Math.max(0,usage.limits[key]-usage.used[key])}/${usage.limits[key]} ${key} left`).join(' · ')}</div>}
        {user && <UserMenu email={user.email} avatarUrl={user.avatar_url} displayName={user.display_name} />}
      </div>
    </div>
  )
}
