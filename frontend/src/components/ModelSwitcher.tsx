"use client";

import { useEffect, useState, useRef } from "react";
import { Check, Layers, ChevronDown } from "lucide-react";
import { listAvailableModels, switchModel } from "@/lib/api";

interface ModelInfo {
  filename: string;
  path: string;
  size_mb: number;
  is_active: boolean;
}

export default function ModelSwitcher({ onModelSwitched }: { onModelSwitched?: () => void }) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [activeModel, setActiveModel] = useState<string>("model_combined.pth");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const fetchModels = async () => {
    try {
      const data = await listAvailableModels();
      setModels(data.available_checkpoints);
      if (data.active_model_name) {
        setActiveModel(data.active_model_name);
      }
    } catch (e) {
      console.warn("Could not load model checkpoints:", e);
    }
  };

  useEffect(() => {
    let isMounted = true;
    listAvailableModels()
      .then((data) => {
        if (!isMounted) return;
        setModels(data.available_checkpoints);
        if (data.active_model_name) {
          setActiveModel(data.active_model_name);
        }
      })
      .catch((e) => {
        console.warn("Could not load model checkpoints:", e);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleDropdown = () => {
    if (!isOpen) {
      fetchModels();
    }
    setIsOpen(!isOpen);
  };

  const handleSelectModel = async (modelName: string) => {
    if (modelName === activeModel) {
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      await switchModel(modelName);
      await fetchModels();
      if (onModelSwitched) onModelSwitched();
    } catch (err) {
      console.error("Failed to switch model checkpoint:", err);
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  const getModelLabel = (name: string) => {
    switch (name) {
      case "model_combined.pth":
        return "AquaVision-Unified (Flagship 19k Pairs)";
      case "model_lsui.pth":
        return "LSUI (Turbid Benthic Reefs)";
      case "model_euvp.pth":
        return "EUVP (Deep Ocean & Low-Light)";
      case "model.pth":
        return "UIEB (Coastal Benchmark Baseline)";
      default:
        return name;
    }
  };

  const getShortLabel = (name: string) => {
    switch (name) {
      case "model_combined.pth":
        return "Unified (19k)";
      case "model_lsui.pth":
        return "LSUI Reefs";
      case "model_euvp.pth":
        return "EUVP Abyssal";
      case "model.pth":
        return "UIEB Coastal";
      default:
        return "AquaVision";
    }
  };

  const filteredModels = models.filter((m) => !m.filename.toLowerCase().includes("backup"));

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        disabled={isLoading}
        className="flex items-center gap-2 rounded-lg border border-cyan-800/40 bg-zinc-900/90 px-3 py-1.5 text-xs text-zinc-300 hover:border-cyan-500/60 hover:text-zinc-100 transition-colors disabled:opacity-50"
        title="Select Model Checkpoint"
      >
        <Layers className="h-3.5 w-3.5 text-cyan-400" />
        <span className="font-medium text-cyan-300">
          Model: {getShortLabel(activeModel)}
        </span>
        <ChevronDown className="h-3 w-3 text-zinc-500" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 z-40 w-80 rounded-xl border border-zinc-800 bg-zinc-950 p-2 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 border-b border-zinc-900">
            Select Checkpoint Weights
          </div>
          <div className="mt-1 space-y-1">
            {filteredModels.map((m) => (
              <button
                key={m.filename}
                onClick={() => handleSelectModel(m.filename)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                  m.filename === activeModel
                    ? "bg-cyan-950/40 text-cyan-300 border border-cyan-800/40"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <div>
                  <div className="font-medium text-zinc-200">{getModelLabel(m.filename)}</div>
                </div>
                {m.filename === activeModel && (
                  <Check className="h-4 w-4 text-cyan-400 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
