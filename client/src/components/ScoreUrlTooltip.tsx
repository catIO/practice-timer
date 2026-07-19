import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getUrlPreview } from '@/lib/utils';

interface ScoreUrlTooltipProps {
  url: string | null | undefined;
  children: React.ReactElement;
}

export function ScoreUrlTooltip({ url, children }: ScoreUrlTooltipProps) {
  if (!url) {
    return children;
  }

  const preview = getUrlPreview(url);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs break-all font-mono text-xs">
          {preview}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
