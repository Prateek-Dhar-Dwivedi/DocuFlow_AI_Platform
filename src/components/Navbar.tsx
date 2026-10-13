"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Files, Bot, Sparkles, Activity } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/chat", label: "Conversational Q&A", icon: MessageSquare },
    { href: "/documents", label: "Document Registry", icon: Files },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[#E2E8F0] bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <Link href="/chat" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1D4ED8] shadow-sm group-hover:bg-blue-800 transition-colors">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-[#0F172A]">DocuFlow AI</span>
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-[#1D4ED8] border border-blue-200">
                UiPath Ingestion
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">Pinecone Serverless & RAG Platform</p>
          </div>
        </Link>

        {/* Navigation links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href === "/chat" && pathname === "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-[#1D4ED8] font-semibold border border-blue-200/60 shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-[#0F172A]"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-[#1D4ED8]" : "text-slate-500"}`} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Status badges - No dots */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-[#1D4ED8]">
            <Bot className="h-3.5 w-3.5 text-[#1D4ED8]" />
            <span>UiPath Bot Endpoint Ready</span>
          </div>
        </div>
      </div>
    </header>
  );
}
