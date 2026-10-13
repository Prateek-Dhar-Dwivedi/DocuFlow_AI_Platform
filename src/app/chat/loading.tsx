import React from "react";
import { Bot, Database, RefreshCw, Send } from "lucide-react";

export default function ChatLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-[#F8FAFC]">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-white px-4 sm:px-6 py-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 border border-blue-200 text-[#1D4ED8]">
            <Bot className="h-5 w-5 text-[#1D4ED8]" />
          </div>
          <div>
            <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
            <div className="mt-1 h-3 w-44 bg-slate-100 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-[#1D4ED8]">
          <Database className="h-3.5 w-3.5 text-[#1D4ED8]" />
          <span>Pinecone Vector DB</span>
        </div>
      </div>

      {/* Message Area Skeleton */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-4xl mx-auto w-full flex flex-col justify-center items-center">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm max-w-md w-full text-center space-y-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 border border-blue-200">
            <RefreshCw className="h-5 w-5 text-[#1D4ED8] animate-spin" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-[#0F172A]">Loading Conversational Workspace</h3>
            <p className="text-xs text-slate-500">Connecting to Pinecone index & Gemini generative engine...</p>
          </div>
          <div className="space-y-2 pt-2">
            <div className="h-8 bg-slate-100 rounded-xl animate-pulse" />
            <div className="h-8 bg-slate-50 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>

      {/* Input Bar Skeleton */}
      <div className="border-t border-[#E2E8F0] bg-white p-4 sm:p-5 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="flex-1 h-12 bg-slate-50 rounded-2xl border border-[#E2E8F0] animate-pulse" />
          <div className="h-12 w-12 rounded-2xl bg-slate-200 animate-pulse flex items-center justify-center">
            <Send className="h-4 w-4 text-slate-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
