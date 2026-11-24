"use client";

import { useEffect, useState } from "react";
import {
  X,
  User as UserIcon,
  Mail,
  Calendar,
  Layers,
  Download,
  Eye,
  Filter,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { getUserHistory, resolveImageUrl } from "@/lib/api";
import { User, UserHistoryRecord } from "@/lib/types";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSelectRecord?: (record: UserHistoryRecord) => void;
}

export default function ProfileModal({
  isOpen,
  onClose,
  user,
  onSelectRecord,
}: ProfileModalProps) {
  const [history, setHistory] = useState<UserHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [modelFilter, setModelFilter] = useState<string>("all");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !user) return;
    let isMounted = true;
    getUserHistory()
      .then((records) => {
        if (isMounted) setHistory(records);
      })
      .catch((err) => {
        console.warn("Failed to load user history:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  // Filter models
  const availableModels = Array.from(
    new Set(history.map((r) => r.model_name).filter(Boolean))
  );

  const filteredHistory = history.filter((r) => {
    if (modelFilter === "all") return true;
    return r.model_name.toLowerCase() === modelFilter.toLowerCase();
  });

  const formattedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Active Member";

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className="relative flex flex-col w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-cyan-950/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <UserIcon className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                Researcher Profile & Telemetry
              </h2>
              <p className="text-[11px] text-zinc-400">
                Manage your credentials and view historical optical inspections
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            title="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Details Banner */}
        <div className="border-b border-zinc-800/80 bg-zinc-900/40 p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-xl font-bold text-white shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
                {getInitials(user.name)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-zinc-100">{user.name}</h3>
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-zinc-500" />
                    {user.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                    Joined {formattedDate}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Metrics Badges */}
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 px-4 py-2 text-center">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">
                  Total Enhanced
                </span>
                <span className="text-lg font-bold text-cyan-400">
                  {user.total_enhancements || history.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Gallery Section */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Clock className="h-4 w-4 text-cyan-400" />
                Chronological Enhancement History
              </h4>
              <p className="text-xs text-zinc-400">
                Stored in PostgreSQL with full non-reference optical telemetry
              </p>
            </div>

            {/* Model Filter Pills */}
            {availableModels.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <Filter className="h-3.5 w-3.5 text-zinc-500 mr-1 shrink-0" />
                <button
                  onClick={() => setModelFilter("all")}
                  className={`rounded-lg px-2.5 py-1 transition-all shrink-0 ${
                    modelFilter === "all"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  All ({history.length})
                </button>
                {availableModels.map((m) => (
                  <button
                    key={m}
                    onClick={() => setModelFilter(m)}
                    className={`rounded-lg px-2.5 py-1 transition-all shrink-0 ${
                      modelFilter.toLowerCase() === m.toLowerCase()
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                        : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* History Cards */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-500">
              <span className="h-6 w-6 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin mb-3" />
              <p className="text-xs">Loading database records from PostgreSQL...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 py-16 text-center text-zinc-500">
              <Layers className="h-10 w-10 text-zinc-600 mb-2 stroke-1" />
              <p className="text-sm font-medium text-zinc-400">No enhancement history yet</p>
              <p className="text-xs text-zinc-600 mt-1 max-w-sm">
                Enhance your first underwater image in the main workspace and it will be permanently cataloged here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredHistory.map((item) => {
                const itemDate = item.created_at
                  ? new Date(item.created_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Recorded";

                return (
                  <div
                    key={item.id}
                    className="group relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 transition-all hover:border-cyan-500/40 hover:bg-zinc-900/90"
                  >
                    {/* Visual Comparison Thumbnails */}
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="relative flex items-center -space-x-3 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resolveImageUrl(item.raw_url)}
                          alt="Raw underwater sample"
                          className="h-16 w-20 rounded-lg object-cover border border-zinc-700/60 shadow-md"
                        />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resolveImageUrl(item.enhanced_url)}
                          alt="Enhanced result"
                          className="h-16 w-20 rounded-lg object-cover border-2 border-cyan-500 shadow-lg shadow-cyan-500/20"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs font-semibold text-zinc-200">
                            {item.filename}
                          </span>
                          <span className="rounded bg-cyan-950/60 border border-cyan-800/40 px-1.5 py-0.5 text-[10px] font-medium text-cyan-300 shrink-0">
                            {item.model_name}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-zinc-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {itemDate}
                        </p>

                        {/* Optical Metric Highlights */}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                          {item.psnr !== undefined && item.psnr !== null && (
                            <span className="rounded bg-zinc-800/80 px-2 py-0.5 text-zinc-300 font-mono">
                              PSNR: <strong className="text-cyan-400">{item.psnr.toFixed(1)} dB</strong>
                            </span>
                          )}
                          {item.uiqm !== undefined && item.uiqm !== null && (
                            <span className="rounded bg-zinc-800/80 px-2 py-0.5 text-zinc-300 font-mono">
                              UIQM: <strong className="text-emerald-400">{item.uiqm.toFixed(2)}</strong>
                            </span>
                          )}
                          {item.uciqe !== undefined && item.uciqe !== null && (
                            <span className="rounded bg-zinc-800/80 px-2 py-0.5 text-zinc-300 font-mono">
                              UCIQE: <strong className="text-blue-400">{item.uciqe.toFixed(2)}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Triggers */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t border-zinc-800/60 sm:border-0 pt-2 sm:pt-0">
                      {onSelectRecord && (
                        <button
                          onClick={() => {
                            onSelectRecord(item);
                            onClose();
                          }}
                          className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-cyan-500/50 hover:bg-zinc-800 hover:text-white"
                          title="Load this enhancement into the interactive split comparator"
                        >
                          <Eye className="h-3.5 w-3.5 text-cyan-400" />
                          <span>Compare</span>
                        </button>
                      )}

                      <a
                        href={resolveImageUrl(item.enhanced_url)}
                        download={`AquaVision_${item.id}_enhanced.png`}
                        className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-cyan-500 hover:text-white"
                        title="Download enhanced high-resolution image"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
