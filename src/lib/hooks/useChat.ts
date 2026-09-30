'use client'

import { useCallback, useRef } from 'react'
import { useChatStore } from '@/store/chat-store'
import type { Message } from '@/types'

export function useChat() {
  const store = useChatStore()
  const abortRef = useRef<AbortController | null>(null)
  const loadConversations = useCallback(async () => {
    const r = await fetch('/api/conversations'); if (r.ok) store.setConversations(await r.json())
  }, [store])
  const loadMessages = useCallback(async (id: string) => {
    const r = await fetch(`/api/conversations/${encodeURIComponent(id)}/messages`)
    if (!r.ok) return
    store.setMessages(await r.json()); store.setCurrentConversation(id)
  }, [store])
  const createConversation = useCallback(async (): Promise<string | null> => {
    const r = await fetch('/api/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'New Chat' }) })
    if (!r.ok) return null
    const data = await r.json(); store.addConversation(data); store.setCurrentConversation(data.id); store.setMessages([]); return data.id
  }, [store])
  const sendMessage = useCallback(async (content: string, fileIds: string[] = [], attachments: NonNullable<Message['attachments']> = []): Promise<boolean> => {
    let id = store.currentConversationId
    if (!id) { id = await createConversation(); if (!id) return false }
    const temp: Message = { id: Date.now(), conversation_id: id, role: 'user', content, attachments, created_at: new Date().toISOString() }
    store.addMessage(temp); store.setIsStreaming(true); store.setStreamingContent(''); store.setError(null)
    try {
      abortRef.current = new AbortController()
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: content, conversation_id: id, request_id: crypto.randomUUID(), file_ids: fileIds }), signal: abortRef.current.signal })
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'AI service is temporarily unavailable.') }
      const reader = response.body?.getReader(); if (!reader) throw new Error('AI service is temporarily unavailable.')
      const decoder = new TextDecoder(); let pending = ''; let full = ''; let committed = false
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        pending += decoder.decode(value, { stream: true })
        const events = pending.split('\n\n'); pending = events.pop() || ''
        for (const event of events) for (const line of event.split('\n')) if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6))
          if (data.type === 'text') { full += data.content; store.appendStreamingContent(data.content) }
          else if (data.type === 'done' && !committed) { committed = true; store.addMessage({ id: Date.now()+1, conversation_id: id!, role: 'assistant', content: full, created_at: new Date().toISOString() }) }
          else if (data.type === 'error') throw new Error(data.content || 'AI service is temporarily unavailable.')
        }
      }
      if (!committed && full) store.addMessage({ id: Date.now()+1, conversation_id: id, role: 'assistant', content: full, created_at: new Date().toISOString() })
      void loadConversations()
      return true
    } catch (e) { store.setError(e instanceof Error ? e.message : 'AI service is temporarily unavailable.'); return false }
    finally { store.setIsStreaming(false); store.setStreamingContent('') }
  }, [store, createConversation, loadConversations])
  const stopGeneration = useCallback(() => abortRef.current?.abort(), [])
  return { ...store, loadConversations, loadMessages, createConversation, sendMessage, stopGeneration, stopStreaming: stopGeneration }
}
