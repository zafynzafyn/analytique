import Anthropic from '@anthropic-ai/sdk';
import { ANALYST_SYSTEM_PROMPT } from './prompts';
import { createSupabaseTools, type SupabaseToolsConfig } from './tools';

export interface AnalystConfig {
  anthropicApiKey: string;
  supabase: SupabaseToolsConfig;
  model?: string;
  maxIterations?: number;
}

export interface AnalystMessage {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  sql?: string;
  data?: Record<string, unknown>[];
  chartSuggestion?: ChartSuggestion;
  insights?: InsightsBlock;
  error?: string;
}

export interface ChartSuggestion {
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'table';
  xAxis?: string;
  yAxis?: string;
  title?: string;
  description?: string;
  reasoning?: string;
}

export interface InsightsMetric {
  label: string;
  value: string;
  emphasis: 'primary' | 'positive' | 'negative' | 'secondary';
}

export interface InsightsBlock {
  keyAnswer: string;
  metrics: InsightsMetric[];
}

export interface PermissionDeniedBlock {
  tables: string[];
  message: string;
  suggestion: string;
}

export interface StreamEvent {
  type: 'reasoning' | 'text' | 'sql' | 'tool_call' | 'tool_result' | 'data' | 'chart' | 'insights' | 'permission_denied' | 'error' | 'done';
  content: string;
  data?: unknown;
}

type StreamCallback = (event: StreamEvent) => void;

export class DataAnalyst {
  private anthropic: Anthropic;
  private tools: ReturnType<typeof createSupabaseTools>;
  private model: string;
  private maxIterations: number;
  private conversationHistory: Anthropic.MessageParam[] = [];

  constructor(config: AnalystConfig) {
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
    this.tools = createSupabaseTools(config.supabase);
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.maxIterations = config.maxIterations || 10;
  }

  async chat(
    userMessage: string,
    onStream?: StreamCallback
  ): Promise<AnalystMessage> {
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    let iterations = 0;
    let fullResponse = '';
    let reasoning = '';
    let sql = '';
    let data: Record<string, unknown>[] | undefined;
    let chartSuggestion: ChartSuggestion | undefined;
    let insights: InsightsBlock | undefined;

    while (iterations < this.maxIterations) {
      iterations++;

      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: ANALYST_SYSTEM_PROMPT,
        tools: this.tools.definitions,
        messages: this.conversationHistory,
      });

      // Process the response
      let hasToolUse = false;
      const toolResults: Anthropic.MessageParam[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          fullResponse += block.text;

          // Extract reasoning, SQL, chart suggestions, and insights from text
          const parsed = this.parseResponse(block.text);
          if (parsed.reasoning) reasoning += parsed.reasoning;
          if (parsed.sql) sql = parsed.sql;
          if (parsed.chartSuggestion) chartSuggestion = parsed.chartSuggestion;
          if (parsed.insights) {
            insights = parsed.insights;
            onStream?.({
              type: 'insights',
              content: parsed.insights.keyAnswer,
              data: parsed.insights,
            });
          }

          onStream?.({
            type: 'text',
            content: block.text,
          });
        } else if (block.type === 'tool_use') {
          hasToolUse = true;

          onStream?.({
            type: 'tool_call',
            content: block.name,
            data: block.input,
          });

          // Execute the tool
          const result = await this.tools.handleToolCall(
            block.name,
            block.input as Record<string, unknown>
          );

          onStream?.({
            type: 'tool_result',
            content: result,
          });

          // Parse result for data
          try {
            const parsed = JSON.parse(result);
            if (parsed.success && parsed.result?.data) {
              data = parsed.result.data;
              onStream?.({
                type: 'data',
                content: 'Query executed successfully',
                data: parsed.result,
              });
            }
          } catch {
            // Not JSON or no data
          }

          // Track SQL from execute_sql tool
          if (block.name === 'execute_sql' && block.input) {
            sql = (block.input as { sql: string }).sql;
            onStream?.({
              type: 'sql',
              content: sql,
            });
          }

          toolResults.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
            }],
          });
        }
      }

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response.content,
      });

      // Add tool results if any
      if (toolResults.length > 0) {
        for (const result of toolResults) {
          this.conversationHistory.push(result);
        }
      }

      // If no tool use, we're done
      if (!hasToolUse || response.stop_reason === 'end_turn') {
        break;
      }
    }

    onStream?.({
      type: 'done',
      content: 'Analysis complete',
    });

    return {
      role: 'assistant',
      content: fullResponse,
      reasoning,
      sql: sql || undefined,
      data,
      chartSuggestion,
      insights,
    };
  }

  async *chatStream(userMessage: string): AsyncGenerator<StreamEvent> {
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    let iterations = 0;

    while (iterations < this.maxIterations) {
      iterations++;

      const stream = await this.anthropic.messages.stream({
        model: this.model,
        max_tokens: 4096,
        system: ANALYST_SYSTEM_PROMPT,
        tools: this.tools.definitions,
        messages: this.conversationHistory,
      });

      let currentText = '';
      let toolUseBlocks: Array<{ id: string; name: string; input: unknown }> = [];
      let hasToolUse = false;

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          const delta = event.delta;
          if ('text' in delta && delta.text) {
            currentText += delta.text;
            yield {
              type: 'text',
              content: delta.text,
            };
          } else if ('partial_json' in delta) {
            // Tool input is being streamed
          }
        } else if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            hasToolUse = true;
            toolUseBlocks.push({
              id: event.content_block.id,
              name: event.content_block.name,
              input: {},
            });
          }
        } else if (event.type === 'content_block_stop') {
          // Block finished
        }
      }

      // Get the final message to extract complete tool inputs
      const finalMessage = await stream.finalMessage();

      // Parse accumulated text for insights, chart suggestions, and permission denied
      const parsed = this.parseResponse(currentText);
      if (parsed.insights) {
        yield {
          type: 'insights',
          content: parsed.insights.keyAnswer,
          data: parsed.insights,
        };
      }
      if (parsed.chartSuggestion) {
        yield {
          type: 'chart',
          content: parsed.chartSuggestion.type,
          data: parsed.chartSuggestion,
        };
      }
      if (parsed.permissionDenied) {
        yield {
          type: 'permission_denied',
          content: parsed.permissionDenied.message,
          data: parsed.permissionDenied,
        };
      }

      // Update tool blocks with final inputs
      for (const block of finalMessage.content) {
        if (block.type === 'tool_use') {
          const toolBlock = toolUseBlocks.find(t => t.id === block.id);
          if (toolBlock) {
            toolBlock.input = block.input;
          }
        }
      }

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: finalMessage.content,
      });

      // Execute tools and continue if needed
      if (hasToolUse) {
        for (const tool of toolUseBlocks) {
          yield {
            type: 'tool_call',
            content: tool.name,
            data: tool.input,
          };

          if (tool.name === 'execute_sql' && tool.input) {
            yield {
              type: 'sql',
              content: (tool.input as { sql: string }).sql,
            };
          }

          const result = await this.tools.handleToolCall(
            tool.name,
            tool.input as Record<string, unknown>
          );

          yield {
            type: 'tool_result',
            content: result,
          };

          // Parse and emit data
          try {
            const parsed = JSON.parse(result);
            if (parsed.success && parsed.result?.data) {
              yield {
                type: 'data',
                content: 'Query executed successfully',
                data: parsed.result,
              };
            }
          } catch {
            // Not JSON
          }

          this.conversationHistory.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: tool.id,
              content: result,
            }],
          });
        }

        // Continue the loop for follow-up
        if (finalMessage.stop_reason !== 'end_turn') {
          continue;
        }
      }

      // No more tool use or end_turn, we're done
      break;
    }

    yield {
      type: 'done',
      content: 'Analysis complete',
    };
  }

  private parseResponse(text: string): {
    reasoning?: string;
    sql?: string;
    chartSuggestion?: ChartSuggestion;
    insights?: InsightsBlock;
    permissionDenied?: PermissionDeniedBlock;
  } {
    const result: {
      reasoning?: string;
      sql?: string;
      chartSuggestion?: ChartSuggestion;
      insights?: InsightsBlock;
      permissionDenied?: PermissionDeniedBlock;
    } = {};

    // Extract SQL from markdown code blocks
    const sqlMatch = text.match(/```sql\n([\s\S]*?)```/);
    if (sqlMatch) {
      result.sql = sqlMatch[1].trim();
    }

    // Look for insights blocks
    const insightsMatch = text.match(/```insights\n([\s\S]*?)```/);
    if (insightsMatch) {
      try {
        const parsed = JSON.parse(insightsMatch[1]);
        if (parsed.keyAnswer && Array.isArray(parsed.metrics)) {
          result.insights = {
            keyAnswer: parsed.keyAnswer,
            metrics: parsed.metrics.map((m: { label: string; value: string; emphasis?: string }) => ({
              label: m.label,
              value: m.value,
              emphasis: m.emphasis || 'secondary',
            })),
          };
        }
      } catch {
        // Not valid insights JSON
      }
    }

    // Look for permission_denied blocks
    const permissionMatch = text.match(/```permission_denied\n([\s\S]*?)```/);
    if (permissionMatch) {
      try {
        const parsed = JSON.parse(permissionMatch[1]);
        if (parsed.tables && parsed.message) {
          result.permissionDenied = {
            tables: parsed.tables,
            message: parsed.message,
            suggestion: parsed.suggestion || 'Please update your permissions in Security Settings.',
          };
        }
      } catch {
        // Not valid permission_denied JSON
      }
    }

    // Look for chart suggestions in JSON blocks
    const chartMatch = text.match(/```json\n([\s\S]*?)```/);
    if (chartMatch) {
      try {
        const parsed = JSON.parse(chartMatch[1]);
        if (parsed.chartType || parsed.type) {
          result.chartSuggestion = {
            type: parsed.chartType || parsed.type,
            xAxis: parsed.xAxis,
            yAxis: parsed.yAxis,
            title: parsed.title,
            description: parsed.description,
            reasoning: parsed.reasoning,
          };
        }
      } catch {
        // Not valid chart JSON
      }
    }

    // Simple reasoning extraction - text before SQL or data
    const reasoningMatch = text.match(/^([\s\S]*?)(?:```|$)/);
    if (reasoningMatch && reasoningMatch[1].trim()) {
      result.reasoning = reasoningMatch[1].trim();
    }

    return result;
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  getHistory(): Anthropic.MessageParam[] {
    return [...this.conversationHistory];
  }
}
