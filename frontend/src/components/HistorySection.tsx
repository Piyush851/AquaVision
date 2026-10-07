"use client";

import { HistoryRecord } from "@/lib/types";
import { resolveImageUrl } from "@/lib/api";
import { History, ArrowRight } from "lucide-react";

interface HistorySectionProps {
  history: HistoryRecord[];
  onSelect: (record: HistoryRecord) => void;
  activeId?: string;
}

export default function HistorySection({
  history,
  onSelect,
  activeId,
}: HistorySectionProps) {
  if (!history || history.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-medium tracking-tight text-zinc-200">
            Recent Enhancements
          </h3>
        </div>
        <span className="text-xs text-zinc-500">{history.length} items</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {history.slice(0, 6).map((item) => {
          const isSelected = activeId === item.id;
          const enhancedSrc = resolveImageUrl(item.enhanced_url);

          return (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className={`group flex flex-col overflow-hidden rounded-lg border text-left transition-all ${
                isSelected
                  ? "border-cyan-400/80 bg-zinc-900 ring-1 ring-cyan-400/50"
                  : "border-zinc-800/80 bg-zinc-950 hover:border-zinc-700"
              }`}
            >
              <div className="relative aspect-video w-full overflow-hidden bg-zinc-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={enhancedSrc}
                  alt={item.enhanced_file}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              </div>

              <div className="flex items-center justify-between p-2">
                <span className="text-[11px] font-mono text-zinc-400 truncate max-w-[80px]">
                  #{item.id}
                </span>
                <ArrowRight className="h-3 w-3 text-zinc-600 group-hover:text-cyan-400 transition-colors" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
