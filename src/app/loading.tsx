import React from "react";
import { Bot, RefreshCw } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-[#F8FAFC] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-sm text-center space-y-5">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 border border-blue-200 text-[#1D4ED8] shadow-sm">
          <Bot className="h-7 w-7 text-[#1D4ED8]" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-[#0F172A]">Loading DocuFlow AI Platform</h3>
          <p className="text-xs text-slate-500">Retrieving resources, vector indices, and workspace...</p>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs font-medium text-[#1D4ED8]">
          <RefreshCw className="h-4 w-4 animate-spin text-[#1D4ED8]" />
          <span>Synchronizing resources...</span>
        </div>
        <div className="space-y-2 pt-2">
          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full w-2/3 rounded-full bg-[#1D4ED8] animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
