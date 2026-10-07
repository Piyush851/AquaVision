"use client";

import { X, BookOpen, Layers, Award, Users } from "lucide-react";

interface SynopsisModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SynopsisModal({ isOpen, onClose }: SynopsisModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
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
                <p className="text-zinc-300 font-medium">Department of Information Technology</p>
                <p>Engineering College, Ajmer (BTU)</p>
                <p className="mt-1"><strong className="text-zinc-300">Supervisor:</strong> Mrs. Bhanupriya Sharma</p>
              </div>
              <div>
                <p className="text-zinc-300 font-medium">Student Team:</p>
                <p>• Piyush Saini (23EEAIT043)</p>
                <p>• Kumkum Dadhich (23EEAIT039)</p>
                <p>• Piyush Balundiya (23EEAIT042)</p>
                <p>• Vishwas Sharma (23EEAIT056)</p>
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
