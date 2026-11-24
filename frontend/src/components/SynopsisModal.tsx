"use client";

import { useEffect, useState } from "react";
import { X, BookOpen, Layers, Award, Users, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { getSystemInfo } from "@/lib/api";

interface SynopsisModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SynopsisModal({ isOpen, onClose }: SynopsisModalProps) {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        await getSystemInfo();
        if (isMounted) {
          setIsOnline(true);
        }
      } catch {
        if (isMounted) {
          setIsOnline(false);
        }
      }
    };

    if (isOpen) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 5000);
      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-cyan-400" />
            <h3 className="font-semibold text-zinc-100 text-sm sm:text-base">
              AquaVision AI — Project Synopsis & Architecture
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-5 text-xs text-zinc-300">
          {/* Dynamic Backend Status Indicator */}
          <div className="flex items-center rounded-xl border border-zinc-800 bg-zinc-950 p-3.5">
            <div className="flex items-center gap-2.5">
              {isOnline === null ? (
                <Clock className="h-4 w-4 text-zinc-400 shrink-0" />
              ) : isOnline ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              )}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-200">
                  Backend Connection Status:
                </span>
                <span
                  className={`font-medium ${
                    isOnline === null
                      ? "text-zinc-400"
                      : isOnline
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {isOnline === null
                    ? "Checking..."
                    : isOnline
                    ? "Connected"
                    : "Disconnected"}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-zinc-100">Project Overview</h4>
            <p className="mt-1 leading-relaxed text-zinc-400">
              AquaVision AI tackles underwater optical degradation (light scattering, color casts, low contrast, and blur) using deep learning. Built with a PyTorch Residual Attention U-Net backend and a modern Next.js frontend to assist marine researchers, ocean exploration, and underwater vision robotics.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-center gap-1.5 font-medium text-zinc-200 mb-1">
                <Layers className="h-4 w-4 text-cyan-400" />
                <span>Model Architecture</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-zinc-400">
                <li>Residual U-Net with Squeeze-and-Excitation (SE) channel attention</li>
                <li>L1 + MSE composite loss function</li>
                <li>Gray-World White Balance + LAB CLAHE fallback pipeline</li>
                <li>Dataset: UIEB (Underwater Image Enhancement Benchmark)</li>
              </ul>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-center gap-1.5 font-medium text-zinc-200 mb-1">
                <Award className="h-4 w-4 text-cyan-400" />
                <span>Evaluation Framework</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-zinc-400">
                <li><strong>PSNR:</strong> Peak Signal-to-Noise Ratio</li>
                <li><strong>SSIM:</strong> Structural Similarity Index</li>
                <li><strong>UIQM:</strong> Underwater Image Quality Measure</li>
                <li><strong>UCIQE:</strong> Underwater Colour Image Quality</li>
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center gap-1.5 font-medium text-zinc-200 mb-2">
              <Users className="h-4 w-4 text-cyan-400" />
              <span>Academic Credits</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-zinc-400">
              <div>
                <p className="text-zinc-300 font-medium">Department of Computer Science & Engineering</p>
                <p>Engineering College, Ajmer (BTU)</p>
                <p className="mt-1"><strong className="text-zinc-300">Supervisor:</strong> Mrs. Bhanupriya Sharma</p>
              </div>
              <div>
                <p className="text-zinc-300 font-medium">Student Team:</p>
                <p>• Piyush Saini (23EEAIT043)</p>
                <p>• Piyush Balundiya (23EEAIT042)</p>
                <p>• Kumkum Dadhich (23EEAIT039)</p>
                <p>• Vishwas Sharma (23EEAIT049)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-zinc-800 px-6 py-3 bg-zinc-950">
          <button
            onClick={onClose}
            className="rounded-lg bg-zinc-800 px-4 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
