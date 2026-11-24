"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import ImageUploader from "@/components/ImageUploader";
import ComparisonViewer from "@/components/ComparisonViewer";
import MetricsPanel from "@/components/MetricsPanel";
// import HistorySection from "@/components/HistorySection";
import SynopsisModal from "@/components/SynopsisModal";
import AuthModal from "@/components/AuthModal";
import ProfileModal from "@/components/ProfileModal";
import Footer from "@/components/Footer";
import VideoProcessor from "@/components/VideoProcessor";
import BatchProcessor from "@/components/BatchProcessor";
import {
  uploadAndEnhance,
  getHistory,
  getCurrentUserProfile,
  getGuestStatus,
  logoutUser,
  getStoredUser,
} from "@/lib/api";
import {
  EnhancementResponse,
  User,
  UserHistoryRecord,
} from "@/lib/types";
import { AlertCircle, Image as ImageIcon, Film, Layers } from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"image" | "video" | "batch">("image");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<EnhancementResponse | null>(null);
  const [isSynopsisOpen, setIsSynopsisOpen] = useState<boolean>(false);

  // Authentication & Guest Quota State
  const [user, setUser] = useState<User | null>(null);
  const [guestRemaining, setGuestRemaining] = useState<number>(5);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isQuotaTriggered, setIsQuotaTriggered] = useState<boolean>(false);

  // Load user session, guest quota, and initial history on mount
  useEffect(() => {
    async function initSessionAndData() {
      // 1. Check local session and validate with backend
      try {
        const stored = getStoredUser();
        if (stored) {
          setUser(stored);
        }
        const profile = await getCurrentUserProfile();
        if (profile) {
          setUser(profile);
        }
      } catch {
        setUser(null);
      }

      // 2. Fetch guest status (remaining enhancements)
      try {
        const guestStatus = await getGuestStatus();
        setGuestRemaining(guestStatus.remaining);
      } catch (guestErr) {
        console.warn("Could not fetch guest status:", guestErr);
      }

      // 3. Fetch public enhancement history
      try {
        const records = await getHistory();
        if (records.length > 0) {
          const latest = records[0];
          setActiveResult({
            id: latest.id,
            filename: latest.filename || latest.enhanced_file,
            original_url: latest.original_url || latest.enhanced_url,
            enhanced_url: latest.enhanced_url,
            annotated_url: latest.annotated_url,
            detections: latest.detections,
            coral_health: latest.coral_health,
            metrics: latest.metrics || {
              inference_mode: "deep-learning",
              device: "system",
              processing_time_seconds: 0.12,
              estimated_psnr: 24.8,
              uiqm: 3.42,
              uciqe: 0.61,
              input_path: latest.original_url || "",
              output_path: latest.enhanced_url,
              original_dimensions: "Original",
            },
          });
        }
      } catch (err) {
        console.warn("Could not fetch initial history:", err);
      }
    }

    initSessionAndData();
  }, []);

  const handleProcess = async (file: File, forceClassical: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await uploadAndEnhance(file, forceClassical);
      setActiveResult(response);

      // Sync guest quota if user is not authenticated
      if (!user) {
        try {
          const guestStatus = await getGuestStatus();
          setGuestRemaining(guestStatus.remaining);
        } catch {
          // Ignore
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to process image. Ensure backend is running.";
      setError(message);

      // If guest quota exhausted, automatically prompt AuthModal
      if (
        message.toLowerCase().includes("quota reached") ||
        message.toLowerCase().includes("limit reached") ||
        message.toLowerCase().includes("403")
      ) {
        setIsQuotaTriggered(true);
        setIsAuthModalOpen(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectUserRecord = (record: UserHistoryRecord) => {
    setActiveTab("image");
    setIsProfileModalOpen(false);
    setActiveResult({
      id: record.id,
      filename: record.filename,
      original_url: record.raw_url,
      enhanced_url: record.enhanced_url,
      annotated_url: record.annotated_url || undefined,
      detections: record.detections || undefined,
      coral_health: record.coral_health || undefined,
      metrics: record.metrics || {
        inference_mode: record.inference_mode || "deep-learning",
        device: "system",
        processing_time_seconds: 0.12,
        estimated_psnr: record.psnr ?? 24.5,
        uiqm: record.uiqm ?? 3.42,
        uciqe: record.uciqe ?? 0.61,
        input_path: record.raw_url,
        output_path: record.enhanced_url,
        original_dimensions: "Original",
      },
    });
  };

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    try {
      const guestStatus = await getGuestStatus();
      setGuestRemaining(guestStatus.remaining);
    } catch {
      setGuestRemaining(5);
    }
  };

  const handleAuthSuccess = (authedUser: User) => {
    setUser(authedUser);
    setIsAuthModalOpen(false);
    setIsQuotaTriggered(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <Navbar
        onOpenSynopsis={() => setIsSynopsisOpen(true)}
        user={user}
        guestRemaining={guestRemaining}
        onOpenAuth={() => {
          setIsQuotaTriggered(false);
          setIsAuthModalOpen(true);
        }}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onLogout={handleLogout}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {/* Minimal Hero Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100 sm:text-2xl">
            Underwater Image Restoration
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Restore natural colors, remove haze, and enhance contrast in underwater imagery using deep learning.
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="mb-6 flex items-center gap-2 border-b border-zinc-800/80 pb-3">
          <button
            onClick={() => setActiveTab("image")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
              activeTab === "image"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <ImageIcon className="h-4 w-4 text-cyan-400" />
            <span>Image Restoration</span>
          </button>

          <button
            onClick={() => setActiveTab("video")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
              activeTab === "video"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <Film className="h-4 w-4 text-cyan-400" />
            <span>Subsea Video Enhancement</span>
          </button>

          <button
            onClick={() => setActiveTab("batch")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
              activeTab === "batch"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <Layers className="h-4 w-4 text-cyan-400" />
            <span>Batch Survey Processing</span>
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-rose-900/60 bg-rose-950/40 px-4 py-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <div className="flex-1">{error}</div>
            <button
              onClick={() => setError(null)}
              className="text-xs text-rose-400 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Content by Active Tab */}
        {activeTab === "video" ? (
          <VideoProcessor />
        ) : activeTab === "batch" ? (
          <BatchProcessor
            onInspectItem={(item) => {
              setActiveResult(item);
              setActiveTab("image");
            }}
          />
        ) : (
          <div className="flex flex-col gap-6">
            {/* Staged Ingestion / Control Bar */}
            <ImageUploader
              onProcess={handleProcess}
              isLoading={isLoading}
              activeResult={activeResult}
            />

            {/* Inspection Stage: Comparison Viewer & Telemetry */}
            {activeResult && (
              <div className="flex flex-col gap-6">
                <ComparisonViewer
                  originalUrl={activeResult.original_url}
                  enhancedUrl={activeResult.enhanced_url}
                  annotatedUrl={activeResult.annotated_url}
                  filename={activeResult.filename}
                  resultId={activeResult.id}
                  detections={activeResult.detections}
                />
                <MetricsPanel
                  metrics={activeResult.metrics}
                  detections={activeResult.detections}
                  coralHealth={activeResult.coral_health}
                />
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />

      <SynopsisModal
        isOpen={isSynopsisOpen}
        onClose={() => setIsSynopsisOpen(false)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setIsQuotaTriggered(false);
        }}
        onSuccess={handleAuthSuccess}
        isQuotaTriggered={isQuotaTriggered}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onSelectRecord={handleSelectUserRecord}
      />
    </div>
  );
}
