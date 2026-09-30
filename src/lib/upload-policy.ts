export type UploadQuotaField = 'pdfs' | 'images'

export function uploadQuotaWhere(field: UploadQuotaField, limit: number, unlimited: boolean): Partial<Record<UploadQuotaField, { lt: number }>> {
  return unlimited ? {} : { [field]: { lt: Math.max(0, limit) } }
}

export function canDownloadUploadedFile(requesterId: string, isAdmin: boolean, ownerId: string) {
  return isAdmin || requesterId === ownerId
}

export function belongsToConversation(file: { userId: string; conversationId: string | null }, userId: string, conversationId: string) {
  return file.userId === userId && file.conversationId === conversationId
}
