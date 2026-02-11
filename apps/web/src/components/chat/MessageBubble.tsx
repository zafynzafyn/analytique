'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Bot, ChevronDown, ChevronUp, Code, Table, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SQLBlock } from './SQLBlock';
import { DataTable } from '@/components/viz/DataTable';
import { ChartRenderer } from '@/components/viz/ChartRenderer';
import { KeyInsights, type InsightsData } from './KeyInsights';
import { PermissionDenied } from './PermissionDenied';
import {
  generateReportHTML,
  captureChartAsDataUrl,
  openReportInNewWindow,
  type ReportData,
} from '@/lib/report-generator';

export interface PermissionDeniedData {
  tables: string[];
  message: string;
  suggestion: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sql?: string;
  data?: Record<string, unknown>[];
  chartSuggestion?: {
    type: 'line' | 'bar' | 'pie' | 'scatter' | 'table';
    xAxis?: string;
    yAxis?: string;
    title?: string;
  };
  insights?: InsightsData;
  permissionDenied?: PermissionDeniedData;
  toolCalls?: string[];
  error?: string;
}

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  userQuestion?: string; // The user's question that prompted this response
  onChartRef?: (ref: HTMLDivElement | null) => void; // Callback to expose chart container ref
}

export function MessageBubble({ message, isStreaming, userQuestion, onChartRef }: MessageBubbleProps) {
  const [showSQL, setShowSQL] = useState(false);
  const [showData, setShowData] = useState(false); // Collapsed by default since chart is shown
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Expose chart container ref to parent
  useEffect(() => {
    if (onChartRef && chartContainerRef.current) {
      onChartRef(chartContainerRef.current);
    }
    return () => {
      if (onChartRef) {
        onChartRef(null);
      }
    };
  }, [onChartRef]);

  const isUser = message.role === 'user';

  // Check if this message has reportable content
  const hasReportableContent = !isUser && (message.data || message.insights || message.sql);

  const generateReport = useCallback(async () => {
    if (isGeneratingReport) return;
    setIsGeneratingReport(true);

    try {
      // Always capture chart if data is available
      let chartDataUrl: string | null = null;
      if (chartContainerRef.current && message.data && message.data.length > 0) {
        // Temporarily show chart container if hidden to capture it
        const wasHidden = chartContainerRef.current.classList.contains('hidden');
        if (wasHidden) {
          chartContainerRef.current.classList.remove('hidden');
          chartContainerRef.current.classList.add('block');
          // Wait for render
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        chartDataUrl = await captureChartAsDataUrl(chartContainerRef.current);

        // Restore hidden state if it was hidden
        if (wasHidden) {
          chartContainerRef.current.classList.remove('block');
          chartContainerRef.current.classList.add('hidden');
        }
      }

      const reportData: ReportData = {
        question: userQuestion || 'Data Analysis Query',
        answer: message.content,
        insights: message.insights,
        data: message.data,
        chartSvg: chartDataUrl || undefined,
        chartType: message.chartSuggestion?.type,
        sql: message.sql,
        generatedAt: new Date(),
      };

      const html = generateReportHTML(reportData);
      openReportInNewWindow(html);
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setIsGeneratingReport(false);
    }
  }, [isGeneratingReport, message, userQuestion]);

  return (
    <div
      className={cn(
        'flex gap-3',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}

      <div
        className={cn(
          'max-w-[80%] space-y-2',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        {/* Permission Denied - displayed prominently */}
        {!isUser && message.permissionDenied && (
          <PermissionDenied
            tables={message.permissionDenied.tables}
            message={message.permissionDenied.message}
            suggestion={message.permissionDenied.suggestion}
          />
        )}

        {/* Key Insights - displayed prominently above other content */}
        {!isUser && message.insights && (
          <KeyInsights insights={message.insights} />
        )}

        <Card
          className={cn(
            'p-4',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted',
            message.error && 'border-destructive'
          )}
        >
          <div className={cn(
            "max-w-none",
            !isUser && "prose prose-sm dark:prose-invert prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-pre:my-2"
          )}>
            {message.content ? (
              isUser ? (
                message.content
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // Style inline code with visible colors
                    code: ({ className, children, ...props }) => {
                      const isInline = !className;
                      if (isInline) {
                        return (
                          <code
                            className="px-1.5 py-0.5 rounded text-sm font-mono bg-slate-800 text-amber-300 dark:bg-slate-900 dark:text-amber-200"
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      }
                      // For code blocks with language class
                      return (
                        <code
                          className={cn(
                            className,
                            "text-slate-100 dark:text-slate-200"
                          )}
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    },
                    // Style code blocks with dark background for visibility
                    pre: ({ children }) => (
                      <pre className="p-4 rounded-lg bg-slate-900 dark:bg-slate-950 overflow-x-auto text-sm font-mono text-slate-100 border border-slate-700">
                        {children}
                      </pre>
                    ),
                    // Style tables
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-3">
                        <table className="min-w-full border-collapse border border-border">
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="border border-border px-3 py-2 bg-muted text-left font-medium">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="border border-border px-3 py-2">
                        {children}
                      </td>
                    ),
                    // Style links
                    a: ({ children, href }) => (
                      <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    ),
                    // Style blockquotes
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground my-3">
                        {children}
                      </blockquote>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              )
            ) : (
              isStreaming && <span className="animate-pulse">Thinking...</span>
            )}
          </div>

          {message.error && (
            <p className="text-destructive text-sm mt-2">
              Error: {message.error}
            </p>
          )}
        </Card>

        {/* Tool calls indicator */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {message.toolCalls.map((tool, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {tool}
              </Badge>
            ))}
          </div>
        )}

        {/* SQL Block */}
        {message.sql && (
          <Collapsible open={showSQL} onOpenChange={setShowSQL}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Code className="h-4 w-4" />
                SQL Query
                {showSQL ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SQLBlock sql={message.sql} />
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Chart - Show automatically when data is available */}
        {message.data && message.data.length > 0 && message.data.length <= 50 && (
          <Card className="p-4 overflow-auto">
            <div ref={chartContainerRef}>
              <ChartRenderer
                data={message.data}
                suggestion={message.chartSuggestion}
              />
            </div>
          </Card>
        )}

        {/* Data Results Table */}
        {message.data && message.data.length > 0 && (
          <Collapsible open={showData} onOpenChange={setShowData}>
            <div className="flex items-center gap-2">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Table className="h-4 w-4" />
                  Data Table ({message.data.length} rows)
                  {showData ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>

            <CollapsibleContent>
              <Card className="mt-2 p-4 overflow-auto">
                <DataTable data={message.data} />
              </Card>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Generate Report Button */}
        {hasReportableContent && !isStreaming && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 mt-2"
            onClick={generateReport}
            disabled={isGeneratingReport}
          >
            {isGeneratingReport ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Generate PDF Report
              </>
            )}
          </Button>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}
