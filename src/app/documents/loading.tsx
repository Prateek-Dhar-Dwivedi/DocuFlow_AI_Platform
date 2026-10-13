import React from "react";
import { Files, Database, Bot, RefreshCw } from "lucide-react";

export default function DocumentsLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in-50 duration-300">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-4 w-80 bg-slate-100 rounded-md animate-pulse" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-24 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-9 w-32 bg-blue-200 rounded-xl animate-pulse" />
        </div>
      </div>

      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Indexed Documents", icon: Files },
          { label: "Total Vector Chunks", icon: Database },
          { label: "Pinecone Vector DB", icon: Database },
          { label: "UiPath Webhook", icon: Bot },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{item.label}</span>
                <Icon className="h-4 w-4 text-slate-300" />
              </div>
              <div className="mt-3 h-7 w-20 bg-slate-100 rounded-lg animate-pulse" />
              <div className="mt-2 h-3 w-28 bg-slate-50 rounded animate-pulse" />
            </div>
          );
        })}
      </div>

      {/* Integration Banner Skeleton */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Bot className="h-4 w-4 text-[#1D4ED8]" />
          <div className="h-4 w-60 bg-blue-200/60 rounded animate-pulse" />
        </div>
        <div className="mt-2 h-3 w-96 bg-blue-100/60 rounded animate-pulse" />
      </div>

      {/* Table Skeleton */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#1D4ED8]" />
            <span className="text-sm font-semibold text-[#0F172A]">Loading Document Resources...</span>
          </div>
          <span className="text-xs text-slate-400">Connecting to Pinecone...</span>
        </div>
        <div className="divide-y divide-[#E2E8F0] p-6 space-y-4">
          <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-10 bg-slate-50 rounded-xl animate-pulse" />
          <div className="h-10 bg-slate-100/70 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
