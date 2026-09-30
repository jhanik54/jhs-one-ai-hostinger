'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Square, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react'
import { useChatStore } from '@/store/chat-store'
import { useChat } from '@/lib/hooks/useChat'
import { t } from '@/lib/i18n'

type UploadRecord = { id: string; filename: string; mimeType: string; type: 'pdf' | 'image' }
type PendingFile = { file: File; uploaded?: UploadRecord }
type Usage = { limits: { pdfs: number; images: number }; used: { pdfs: number; images: number }; unlimited: boolean }

export function ChatInput() {
  const [input, setInput] = useState('')
  const [files, setFiles] = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [usage, setUsage] = useState<Usage | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const currentConversationId = useChatStore((s) => s.currentConversationId)
  const setError = useChatStore((s) => s.setError)
  const { sendMessage, createConversation, stopStreaming } = useChat()

  const refreshUsage = async () => {
    const response = await fetch('/api/usage', { cache: 'no-store' })
    if (response.ok) setUsage(await response.json())
  }
  useEffect(() => {
    let active = true
    void fetch('/api/usage', { cache: 'no-store' }).then(response => response.ok ? response.json() : null).then(data => {
      if (active && data) setUsage(data)
    }).catch(() => undefined)
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  const handleSubmit = async () => {
    const trimmed = input.trim()
    if ((!trimmed && files.length === 0) || isStreaming || uploading) return
    setUploading(true)
    setError(null)
    try {
      let conversationId = currentConversationId
      if (!conversationId) {
        conversationId = await createConversation()
        if (!conversationId) throw new Error('Unable to create a conversation. Please try again.')
      }
      const ready: PendingFile[] = []
      for (const pending of files) {
        if (pending.uploaded) { ready.push(pending); continue }
        const form = new FormData()
        form.set('conversation_id', conversationId)
        form.set('file', pending.file)
        const response = await fetch('/api/uploads', { method: 'POST', body: form })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'Unable to upload this file.')
        const uploaded: UploadRecord = { id: data.id, filename: data.filename, mimeType: data.mimeType, type: data.type }
        const item = { ...pending, uploaded }
        ready.push(item)
        setFiles(previous => previous.map(current => current.file === pending.file ? item : current))
        await refreshUsage()
      }
      const message = trimmed || 'Please analyze the attached file.'
      const sent = await sendMessage(message, ready.map(item => item.uploaded!.id), ready.map(item => ({ id: item.uploaded!.id, filename: item.uploaded!.filename, mime_type: item.uploaded!.mimeType, type: item.uploaded!.type })))
      if (sent) { setInput(''); setFiles([]) }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to upload this file.')
    } finally { setUploading(false) }
  }

  const addFiles = (selected: FileList | null) => {
    if (!selected) return
    const incoming = Array.from(selected)
    if (files.length + incoming.length > 3) { setError('Attach up to three files per message.'); return }
    setFiles(previous => [...previous, ...incoming.map(file => ({ file }))])
    if (fileRef.current) fileRef.current.value = ''
  }

  const remaining = (type: 'pdfs' | 'images') => usage ? Math.max(0, usage.limits[type] - usage.used[type]) : '—'
  const quota = usage?.unlimited ? t('chat.upload_unlimited') : t('chat.upload_remaining').replace('{pdfs}', String(remaining('pdfs'))).replace('{images}', String(remaining('images')))

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-3 sm:px-4">
      <div className="max-w-3xl mx-auto min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 text-xs text-gray-500 dark:text-gray-400">
          <span>{quota}</span>
          {uploading ? <span role="status">Uploading files…</span> : null}
        </div>
        {files.length ? <div className="mb-2 flex flex-wrap gap-2">{files.map(item => <span key={`${item.file.name}-${item.file.lastModified}`} className="flex max-w-full min-h-10 items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-2.5 text-xs"><span className="shrink-0">{item.file.type === 'application/pdf' ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}</span><span className="max-w-[180px] truncate">{item.uploaded?.filename || item.file.name}</span>{item.uploaded ? <span className="text-green-600">Ready</span> : null}<button type="button" aria-label={t('chat.remove_file')} onClick={() => setFiles(previous => previous.filter(file => file !== item))} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"><X className="h-4 w-4" /></button></span>)}</div> : null}
        <div className="flex min-w-0 items-end gap-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 px-2 sm:px-3 py-2 focus-within:border-blue-500 dark:focus-within:border-blue-400 transition-colors">
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.avif,application/pdf,image/jpeg,image/png,image/webp,image/gif,image/avif" multiple className="hidden" onChange={event => addFiles(event.target.files)} />
          <button type="button" aria-label={t('chat.attach_file')} title={t('chat.attach_file')} onClick={() => fileRef.current?.click()} disabled={isStreaming || uploading || files.length >= 3} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"><Paperclip className="h-5 w-5" /></button>
          <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSubmit() } }} placeholder={t('chat.placeholder')} rows={1} className="min-w-0 flex-1 resize-none bg-transparent py-2 text-sm text-gray-900 outline-none placeholder-gray-500 dark:text-gray-100 dark:placeholder-gray-400 max-h-[200px]" disabled={isStreaming || uploading} />
          {isStreaming ? <button type="button" aria-label="Stop response" onClick={stopStreaming} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"><Square className="h-4 w-4 text-gray-600 dark:text-gray-300" /></button> : <button type="button" aria-label={uploading ? 'Uploading' : t('chat.send')} onClick={() => void handleSubmit()} disabled={(!input.trim() && files.length === 0) || uploading} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-50"><Send className="h-4 w-4 text-white" /></button>}
        </div>
        <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">JH One AI may produce inaccurate information</p>
      </div>
    </div>
  )
}
