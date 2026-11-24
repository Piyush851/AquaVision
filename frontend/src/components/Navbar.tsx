"use client";

import { useEffect, useState, useRef } from "react";
import {
  Waves,
  Info,
  BarChart3,
  User as UserIcon,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { User } from "@/lib/types";
import ModelSwitcher from "./ModelSwitcher";
import BenchmarkModal from "./BenchmarkModal";

interface NavbarProps {
  onOpenSynopsis: () => void;
  user: User | null;
  guestRemaining: number;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
}

export default function Navbar({
  onOpenSynopsis,
  user,
  guestRemaining,
  onOpenAuth,
  onOpenProfile,
  onLogout,
}: NavbarProps) {
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Waves className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold tracking-tight text-zinc-100 text-base">
                  AquaVision
                </span>
              </div>
              <p className="text-xs text-zinc-400 hidden sm:block">
                Underwater Image Enhancement System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Model Switcher */}
            <ModelSwitcher />

            {/* Benchmark & Metrology Trigger */}
            <button
              onClick={() => setIsBenchmarkOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-800/40 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:border-cyan-500/60 hover:bg-zinc-800 hover:text-white"
              title="Multi-Model Benchmark & Optical Metrology Comparison"
            >
              <BarChart3 className="h-3.5 w-3.5 text-cyan-400" />
              <span className="hidden md:inline">Benchmarks</span>
            </button>

            {/* Guest Quota Badge (if unauthenticated) */}
            {!user && (
              <button
                onClick={onOpenAuth}
                className={`hidden sm:flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${guestRemaining <= 1
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                    : guestRemaining <= 3
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                      : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                  }`}
                title="Free enhancements remaining in current guest session"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${guestRemaining <= 1 ? "bg-rose-400" : "bg-cyan-400"
                    } animate-pulse`}
                />
                <span>{guestRemaining}/5 Guest Left</span>
              </button>
            )}

            {/* User Profile or Sign In Trigger */}
            {!user ? (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition-all hover:from-cyan-500 hover:to-blue-600 hover:text-white"
                title="Sign in or create free researcher account"
              >
                <UserIcon className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </button>
            ) : (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-cyan-500/50 hover:bg-zinc-800"
                  title="Account and Profile Menu"
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-[10px] font-bold text-zinc-950">
                    {getInitials(user.name)}
                  </div>
                  <span className="max-w-[90px] truncate hidden md:inline">
                    {user.name}
                  </span>
                  <ChevronDown className="h-3 w-3 text-zinc-400" />
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-800 bg-zinc-950 p-1.5 shadow-2xl shadow-cyan-950/30 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="border-b border-zinc-800/80 px-3 py-2 text-left">
                      <p className="text-xs font-semibold text-zinc-100 truncate">
                        {user.name}
                      </p>
                      <p className="text-[11px] text-zinc-400 truncate">
                        {user.email}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenProfile();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-white mt-1"
                    >
                      <UserIcon className="h-3.5 w-3.5 text-cyan-400" />
                      <span>View Profile & History</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLogout();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={onOpenSynopsis}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100"
              title="Project Information & Architecture"
            >
              <Info className="h-3.5 w-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Details</span>
            </button>
          </div>
        </div>
      </header>

      {/* Benchmark Metrology Modal */}
      <BenchmarkModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
      />
    </>
  );
}

