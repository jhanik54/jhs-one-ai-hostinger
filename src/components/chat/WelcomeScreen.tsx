'use client'

import { Sparkles, MessageSquare, Code, BookOpen } from 'lucide-react'
import { useChat } from '@/lib/hooks/useChat'

const suggestions = [
  { icon: Sparkles, text: 'Write a poem about AI' },
  { icon: MessageSquare, text: 'Explain quantum physics simply' },
  { icon: Code, text: 'Help me write React code' },
  { icon: BookOpen, text: 'Tell me a Bengali story' },
]

export function WelcomeScreen() {
  const { sendMessage, createConversation } = useChat()

  const handleSuggestion = async (text: string) => {
    await createConversation()
    sendMessage(text)
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-6">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          How can I help you today?
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          Powered by JH One AI — multiple AI engines, one smart assistant
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSuggestion(s.text)}
              className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left group"
            >
              <s.icon className="h-5 w-5 text-blue-500 group-hover:text-blue-600 flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300">{s.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
