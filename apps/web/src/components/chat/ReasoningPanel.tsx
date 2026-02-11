'use client';

import { Brain } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ReasoningStep {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'decision';
  content: string;
  timestamp: Date;
}

interface ReasoningPanelProps {
  steps: ReasoningStep[];
  isActive?: boolean;
}

export function ReasoningPanel({ steps, isActive }: ReasoningPanelProps) {
  if (steps.length === 0 && !isActive) {
    return null;
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Brain className="h-4 w-4" />
          Agent Reasoning
          {isActive && (
            <span className="ml-2 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={index}
                className="text-sm border-l-2 border-muted pl-3 py-1"
              >
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <span className="capitalize">{step.type.replace('_', ' ')}</span>
                  <span>
                    {step.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-foreground whitespace-pre-wrap">
                  {step.content}
                </div>
              </div>
            ))}

            {isActive && steps.length === 0 && (
              <div className="text-sm text-muted-foreground animate-pulse">
                Analyzing your question...
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
