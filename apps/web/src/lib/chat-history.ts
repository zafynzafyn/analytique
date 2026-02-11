import type { Message } from '@/components/chat/MessageBubble';

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

const STORAGE_KEY = 'analytique-conversations';
const CURRENT_CONVERSATION_KEY = 'analytique-current-conversation';

export function generateConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateTitle(messages: Message[]): string {
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (firstUserMessage) {
    const content = firstUserMessage.content;
    // Truncate to first 50 chars
    return content.length > 50 ? content.substring(0, 47) + '...' : content;
  }
  return 'New Conversation';
}

export function loadConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((conv: Conversation) => ({
        ...conv,
        createdAt: new Date(conv.createdAt),
        updatedAt: new Date(conv.updatedAt),
        messages: conv.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })),
      }));
    }
  } catch (e) {
    console.error('Failed to load conversations:', e);
  }
  return [];
}

export function saveConversations(conversations: Conversation[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (e) {
    console.error('Failed to save conversations:', e);
  }
}

export function loadCurrentConversationId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CURRENT_CONVERSATION_KEY);
}

export function saveCurrentConversationId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CURRENT_CONVERSATION_KEY, id);
}

export function createNewConversation(): Conversation {
  return {
    id: generateConversationId(),
    title: 'New Conversation',
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function updateConversation(
  conversations: Conversation[],
  conversationId: string,
  messages: Message[]
): Conversation[] {
  return conversations.map(conv => {
    if (conv.id === conversationId) {
      return {
        ...conv,
        messages,
        title: messages.length > 0 ? generateTitle(messages) : conv.title,
        updatedAt: new Date(),
      };
    }
    return conv;
  });
}

export function deleteConversation(
  conversations: Conversation[],
  conversationId: string
): Conversation[] {
  return conversations.filter(conv => conv.id !== conversationId);
}

export function renameConversation(
  conversations: Conversation[],
  conversationId: string,
  newTitle: string
): Conversation[] {
  return conversations.map(conv => {
    if (conv.id === conversationId) {
      return {
        ...conv,
        title: newTitle,
        updatedAt: new Date(),
      };
    }
    return conv;
  });
}

// Format relative time
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
