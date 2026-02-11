'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Trash2, Sparkles, MessageSquare, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble, type Message } from './MessageBubble';
import { ChatHistory } from './ChatHistory';
import {
  type Conversation,
  loadConversations,
  saveConversations,
  loadCurrentConversationId,
  saveCurrentConversationId,
  createNewConversation,
  updateConversation,
  deleteConversation,
  renameConversation,
} from '@/lib/chat-history';
import {
  type ConversationExchangeData,
  generateConversationReportHTML,
  captureChartAsDataUrl,
  openReportInNewWindow,
} from '@/lib/report-generator';
import { loadTablePermissions } from '@/lib/table-permissions';

interface StreamEvent {
  type: 'reasoning' | 'text' | 'sql' | 'tool_call' | 'tool_result' | 'data' | 'chart' | 'insights' | 'permission_denied' | 'error' | 'done';
  content: string;
  data?: unknown;
}

export function ChatPanel() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentResponse, setCurrentResponse] = useState<Partial<Message> | null>(null);
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);
  const [isExportingConversation, setIsExportingConversation] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chartRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [isHydrated, setIsHydrated] = useState(false);

  // Get current conversation's messages
  const currentConversation = conversations.find(c => c.id === currentConversationId);
  const messages = currentConversation?.messages || [];

  // Load conversations from localStorage on mount
  useEffect(() => {
    const storedConversations = loadConversations();
    const storedCurrentId = loadCurrentConversationId();

    if (storedConversations.length > 0) {
      setConversations(storedConversations);
      // Set current conversation to stored ID or most recent
      if (storedCurrentId && storedConversations.some(c => c.id === storedCurrentId)) {
        setCurrentConversationId(storedCurrentId);
      } else {
        setCurrentConversationId(storedConversations[0].id);
      }
    } else {
      // Create initial conversation
      const initial = createNewConversation();
      setConversations([initial]);
      setCurrentConversationId(initial.id);
    }
    setIsHydrated(true);
  }, []);

  // Save conversations to localStorage whenever they change
  useEffect(() => {
    if (isHydrated && conversations.length > 0) {
      saveConversations(conversations);
    }
  }, [conversations, isHydrated]);

  // Save current conversation ID
  useEffect(() => {
    if (isHydrated && currentConversationId) {
      saveCurrentConversationId(currentConversationId);
    }
  }, [currentConversationId, isHydrated]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentResponse, scrollToBottom]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    // Update conversation with new user message
    if (currentConversationId) {
      setConversations(prev => updateConversation(prev, currentConversationId, [...messages, userMessage]));
    }
    setInput('');
    setIsLoading(true);
    setCurrentResponse({
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    });

    try {
      // Load current permissions and send with request
      const permissions = loadTablePermissions();

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          conversationId: currentConversationId,
          permissions: {
            defaultAccess: permissions.defaultAccess,
            tables: permissions.tables.map(t => ({
              table: t.table,
              schema: t.schema,
              accessLevel: t.accessLevel,
              blockedColumns: t.blockedColumns,
            })),
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let sql: string | undefined;
      let data: Record<string, unknown>[] | undefined;
      let chartSuggestion: Message['chartSuggestion'];
      let insights: Message['insights'];
      let permissionDenied: Message['permissionDenied'];
      const toolCalls: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data_str = line.slice(6);
            if (data_str === '[DONE]') continue;

            try {
              const event: StreamEvent = JSON.parse(data_str);

              switch (event.type) {
                case 'text':
                  accumulatedContent += event.content;
                  setCurrentResponse((prev) => ({
                    ...prev,
                    content: accumulatedContent,
                  }));
                  break;

                case 'sql':
                  sql = event.content;
                  setCurrentResponse((prev) => ({
                    ...prev,
                    sql,
                  }));
                  break;

                case 'tool_call':
                  toolCalls.push(event.content);
                  break;

                case 'data':
                  if (event.data && typeof event.data === 'object') {
                    const result = event.data as { data?: Record<string, unknown>[] };
                    data = result.data;
                    setCurrentResponse((prev) => ({
                      ...prev,
                      data,
                    }));
                  }
                  break;

                case 'chart':
                  if (event.data) {
                    chartSuggestion = event.data as Message['chartSuggestion'];
                    setCurrentResponse((prev) => ({
                      ...prev,
                      chartSuggestion,
                    }));
                  }
                  break;

                case 'insights':
                  if (event.data) {
                    insights = event.data as Message['insights'];
                    setCurrentResponse((prev) => ({
                      ...prev,
                      insights,
                    }));
                  }
                  break;

                case 'permission_denied':
                  if (event.data) {
                    permissionDenied = event.data as Message['permissionDenied'];
                    setCurrentResponse((prev) => ({
                      ...prev,
                      permissionDenied,
                    }));
                  }
                  break;

                case 'error':
                  setCurrentResponse((prev) => ({
                    ...prev,
                    content: prev?.content + '\n\nError: ' + event.content,
                    error: event.content,
                  }));
                  break;
              }
            } catch {
              // Ignore parse errors for incomplete JSON
            }
          }
        }
      }

      // Finalize the message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: accumulatedContent,
        timestamp: new Date(),
        sql,
        data,
        chartSuggestion,
        insights,
        permissionDenied,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };

      // Update conversation with assistant response
      if (currentConversationId) {
        setConversations(prev => updateConversation(prev, currentConversationId, [...messages, userMessage, assistantMessage]));
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      // Update conversation with error message
      if (currentConversationId) {
        setConversations(prev => updateConversation(prev, currentConversationId, [...messages, userMessage, errorMessage]));
      }
    } finally {
      setIsLoading(false);
      setCurrentResponse(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const clearChat = async () => {
    try {
      await fetch('/api/chat', { method: 'DELETE' });
      // Clear current conversation's messages
      if (currentConversationId) {
        setConversations(prev => updateConversation(prev, currentConversationId, []));
      }
    } catch (error) {
      console.error('Failed to clear chat:', error);
    }
  };

  const handleNewConversation = () => {
    const newConv = createNewConversation();
    setConversations(prev => [newConv, ...prev]);
    setCurrentConversationId(newConv.id);
  };

  const handleSelectConversation = (id: string) => {
    setCurrentConversationId(id);
  };

  const handleDeleteConversation = (id: string) => {
    setConversations(prev => {
      const updated = deleteConversation(prev, id);
      // If we deleted the current conversation, select another one
      if (id === currentConversationId) {
        if (updated.length > 0) {
          setCurrentConversationId(updated[0].id);
        } else {
          // Create a new conversation if all were deleted
          const newConv = createNewConversation();
          setCurrentConversationId(newConv.id);
          return [newConv];
        }
      }
      return updated;
    });
  };

  const handleDeleteAllConversations = () => {
    // Clear all conversations and create a fresh one
    const newConv = createNewConversation();
    setConversations([newConv]);
    setCurrentConversationId(newConv.id);
    // Clear the localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('analytique-conversations');
    }
  };

  const handleRenameConversation = (id: string, newTitle: string) => {
    setConversations(prev => renameConversation(prev, id, newTitle));
  };

  const toggleHistoryCollapse = () => {
    setIsHistoryCollapsed(prev => !prev);
  };

  const exportConversation = async () => {
    if (isExportingConversation || messages.length === 0) return;
    setIsExportingConversation(true);

    try {
      // Build exchanges from message pairs
      const exchanges: ConversationExchangeData[] = [];

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.role === 'user') {
          // Find the next assistant message
          const assistantMsg = messages[i + 1];
          if (assistantMsg && assistantMsg.role === 'assistant') {
            let chartSvg: string | undefined;

            // Try to capture chart if data exists
            if (assistantMsg.data && assistantMsg.data.length > 0) {
              const chartContainer = chartRefs.current.get(assistantMsg.id);
              if (chartContainer) {
                chartSvg = (await captureChartAsDataUrl(chartContainer)) || undefined;
              }
            }

            exchanges.push({
              question: msg.content,
              answer: assistantMsg.content,
              insights: assistantMsg.insights,
              data: assistantMsg.data,
              chartSvg,
            });
          }
        }
      }

      if (exchanges.length === 0) {
        console.warn('No complete exchanges found');
        return;
      }

      const html = generateConversationReportHTML({
        title: currentConversation?.title || 'Conversation Report',
        exchanges,
        generatedAt: new Date(),
      });

      openReportInNewWindow(html);
    } catch (error) {
      console.error('Failed to export conversation:', error);
    } finally {
      setIsExportingConversation(false);
    }
  };

  // Store chart ref for a message
  const setChartRef = useCallback((messageId: string, ref: HTMLDivElement | null) => {
    if (ref) {
      chartRefs.current.set(messageId, ref);
    } else {
      chartRefs.current.delete(messageId);
    }
  }, []);

  return (
    <div className="flex h-full">
      {/* Chat History Sidebar */}
      <ChatHistory
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onDeleteAllConversations={handleDeleteAllConversations}
        onRenameConversation={handleRenameConversation}
        isCollapsed={isHistoryCollapsed}
        onToggleCollapse={toggleHistoryCollapse}
      />

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 bg-gradient-to-b from-background to-muted/20">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-card/50 backdrop-blur-sm animate-fade-in-down">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-brand">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Data Analyst</h2>
              <p className="text-xs text-muted-foreground">Powered by Claude AI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportConversation}
              disabled={messages.length === 0 || isExportingConversation}
              className="transition-all duration-200"
            >
              {isExportingConversation ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Export PDF
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              disabled={messages.length === 0}
              className="transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4 max-w-4xl mx-auto">
            {messages.length === 0 && !currentResponse && (
              <div className="text-center py-16 animate-fade-in">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-brand mb-6 animate-float">
                  <MessageSquare className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Ask me anything about your data!</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  I can explore your database schema, write SQL queries, and visualize results.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    'What tables do I have?',
                    'Show me the schema',
                    'Count all records',
                  ].map((suggestion, i) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="px-4 py-2 text-sm rounded-full border bg-card hover:bg-accent
                               transition-all duration-200 hover:scale-105 hover:shadow-md
                               animate-fade-in-up"
                      style={{ animationDelay: `${i * 100}ms` }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => {
              // Find the previous user message for assistant responses
              const userQuestion = message.role === 'assistant' && index > 0
                ? messages.slice(0, index).reverse().find(m => m.role === 'user')?.content
                : undefined;

              return (
                <div
                  key={message.id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(index * 50, 200)}ms` }}
                >
                  <MessageBubble
                    message={message}
                    userQuestion={userQuestion}
                    onChartRef={message.role === 'assistant' && message.data
                      ? (ref) => setChartRef(message.id, ref)
                      : undefined
                    }
                  />
                </div>
              );
            })}

            {currentResponse && (
              <div className="animate-fade-in">
                <MessageBubble
                  message={currentResponse as Message}
                  isStreaming
                />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-4 border-t bg-card/50 backdrop-blur-sm animate-fade-in-up">
          <div className="flex gap-3 max-w-4xl mx-auto">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your data..."
              className="min-h-[60px] resize-none transition-all duration-200
                       focus:ring-2 focus:ring-accent/50 focus:border-accent"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="h-[60px] w-[60px] rounded-xl bg-gradient-brand hover:opacity-90
                       transition-all duration-200 hover:scale-105 hover:shadow-lg
                       disabled:opacity-50 disabled:scale-100"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
