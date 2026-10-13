"use client";

import React, { useState, useEffect } from "react";
import {
  Files,
  Database,
  Bot,
  Plus,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
} from "lucide-react";
import { DocumentRecord } from "../../lib/types";
import { useLoading } from "../../context/LoadingContext";

export function DocumentDashboard() {
  const { setIsLoading: setGlobalLoading, setLoadingMessage } = useLoading();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [status, setStatus] = useState<{
    vectorProvider?: string;
    pineconeConnected?: boolean;
    pineconeIndex?: string;
    azureSearchConnected?: boolean;
    openAIConnected?: boolean;
    totalDocuments: number;
    totalChunks: number;
  }>({
    vectorProvider: "pinecone",
    pineconeConnected: true,
    pineconeIndex: "rag-documents",
    azureSearchConnected: false,
    openAIConnected: false,
    totalDocuments: 0,
    totalChunks: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [baseUrl, setBaseUrl] = useState("https://docflow-ai-platform.onrender.com");

  // Upload Form State
  const [uploadMode, setUploadMode] = useState<"text" | "file">("text");
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docSource, setDocSource] = useState("UiPath Bot Simulation");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      setGlobalLoading(true);
      setLoadingMessage("Fetching Document Resources...");
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
        if (data.status) setStatus(data.status);
      }
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setIsLoading(false);
      setGlobalLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    if (typeof window !== "undefined" && window.location.origin) {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(`Are you sure you want to delete this document and all its vector embeddings?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchDocuments();
      }
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const handleManualIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    setUploadMessage(null);

    try {
      let res: Response;

      if (uploadMode === "text") {
        res = await fetch("/api/ingest", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer dev-uipath-mkp-is-the-best-981060",
          },
          body: JSON.stringify({
            title: docTitle,
            content: docContent,
            source: docSource,
            metadata: { ingestionType: "manual_dashboard_test" },
          }),
        });
      } else {
        if (!selectedFile) {
          throw new Error("Please select a file to upload.");
        }
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("title", docTitle || selectedFile.name);
        formData.append("source", docSource);
        formData.append("metadata", JSON.stringify({ ingestionType: "manual_file_test" }));

        res = await fetch("/api/ingest", {
          method: "POST",
          headers: {
            Authorization: "Bearer dev-uipath-mkp-is-the-best-981060",
          },
          body: formData,
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to ingest document");
      }

      setUploadMessage({
        type: "success",
        text: `Success! Ingested into ${data.chunksCreated} vector chunks.`,
      });
      setDocTitle("");
      setDocContent("");
      setSelectedFile(null);
      fetchDocuments();
      setTimeout(() => setShowUploadModal(false), 1500);
    } catch (err) {
      setUploadMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Ingestion failed",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const curlCommand = `curl -X POST ${baseUrl}/api/ingest \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer dev-uipath-mkp-is-the-best-981060" \\
  -d '{
    "title": "Invoice_Q3_AcmeCorp.pdf",
    "source": "UiPath Bot - Finance Inbox",
    "content": "Invoice #4829 for Acme Corp. Total due: $14,250. Payment due by Nov 15.",
    "metadata": { "department": "Finance", "botId": "ROBOT-FIN-01" }
  }'`;

  const copyCurl = () => {
    navigator.clipboard.writeText(curlCommand);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8">
      {/* Header and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Document Registry & Vector Store</h1>
            {isLoading && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-[#1D4ED8] shadow-sm animate-pulse">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#1D4ED8]" />
                Loading Resources...
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Monitor documents ingested by UiPath Studio robots and manage vector embeddings in Pinecone Serverless.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDocuments}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#1D4ED8] ${isLoading ? "animate-spin" : ""}`} />
            <span>{isLoading ? "Refreshing..." : "Refresh"}</span>
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 rounded-xl bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Ingest Document
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Indexed Documents</span>
            <Files className="h-4 w-4 text-[#1D4ED8]" />
          </div>
          {isLoading ? (
            <div className="mt-3 h-8 w-16 bg-slate-100 rounded-lg animate-pulse" />
          ) : (
            <p className="mt-2 text-2xl font-bold text-[#0F172A]">{documents.length}</p>
          )}
          <p className="mt-1 text-[11px] text-slate-500">Active records in database</p>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Vector Chunks</span>
            <Database className="h-4 w-4 text-[#1D4ED8]" />
          </div>
          {isLoading ? (
            <div className="mt-3 h-8 w-20 bg-slate-100 rounded-lg animate-pulse" />
          ) : (
            <p className="mt-2 text-2xl font-bold text-[#0F172A]">
              {documents.reduce((acc, d) => acc + d.chunkCount, 0)}
            </p>
          )}
          <p className="mt-1 text-[11px] text-slate-500">1536-dimensional embeddings</p>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pinecone Vector DB</span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-[#1D4ED8] border border-blue-200">
              {status.pineconeConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
          {isLoading ? (
            <div className="mt-3 h-5 w-36 bg-slate-100 rounded animate-pulse" />
          ) : (
            <p className="mt-2 text-sm font-semibold text-[#0F172A]">
              {status.pineconeConnected ? `Connected (${status.pineconeIndex || "rag-documents"})` : "Local Dev Mode"}
            </p>
          )}
          <p className="mt-1 text-[11px] text-slate-500">
            {status.pineconeConnected ? "Serverless Index Live" : "Configure PINECONE_API_KEY"}
          </p>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">UiPath Webhook</span>
            <Bot className="h-4 w-4 text-[#1D4ED8]" />
          </div>
          <p className="mt-2 text-sm font-semibold text-[#0F172A]">/api/ingest</p>
          <p className="mt-1 text-[11px] text-[#1D4ED8] font-medium">Accepting POST payloads</p>
        </div>
      </div>

      {/* UiPath Bot Quick Integration Banner */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-[#1D4ED8]" />
              <h3 className="text-sm font-semibold text-[#0F172A]">UiPath Studio Bot Webhook Setup</h3>
            </div>
            <p className="text-xs text-slate-600 max-w-2xl">
              Configure your UiPath Studio <strong>HTTP Request</strong> activity to dispatch extracted text directly to{" "}
              <code className="rounded bg-blue-100/70 px-1.5 py-0.5 font-mono text-[11px] text-[#1D4ED8] border border-blue-200">
                {baseUrl}/api/ingest
              </code>
              . Low latency JSON payload is ready.
            </p>
          </div>
          <button
            onClick={copyCurl}
            className="flex items-center gap-2 self-start lg:self-auto rounded-xl border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            {copiedCurl ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
            {copiedCurl ? "Copied cURL!" : "Copy UiPath cURL Test"}
          </button>
        </div>
      </div>

      {/* Documents Table */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#1D4ED8]" />}
            <h2 className="text-sm font-semibold text-[#0F172A]">
              Indexed Documents {isLoading ? "(Loading...)" : `(${documents.length})`}
            </h2>
          </div>
          <span className="text-xs text-slate-500">Live Vector Index</span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center space-y-4">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-blue-50 border border-blue-200 shadow-sm">
              <RefreshCw className="h-6 w-6 text-[#1D4ED8] animate-spin" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#0F172A]">Loading Document Resources...</p>
              <p className="text-xs text-slate-500">Retrieving vector index records from Pinecone Serverless</p>
            </div>
            <div className="max-w-3xl mx-auto space-y-2.5 pt-4 px-6">
              <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
              <div className="h-10 bg-slate-50 rounded-xl animate-pulse" />
              <div className="h-10 bg-slate-100/70 rounded-xl animate-pulse" />
            </div>
          </div>
        ) : documents.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <FileText className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="text-sm text-slate-600">No documents ingested yet.</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Run your UiPath robot or click &ldquo;Ingest Document&rdquo; above to parse and vector-index your first document.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E2E8F0] bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-6 py-3 font-medium">Document Title</th>
                  <th className="px-6 py-3 font-medium">Source / Bot</th>
                  <th className="px-6 py-3 font-medium">Vector Chunks</th>
                  <th className="px-6 py-3 font-medium">Characters</th>
                  <th className="px-6 py-3 font-medium">Ingestion Date</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-slate-700">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-medium text-[#0F172A] flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#1D4ED8] flex-shrink-0" />
                      <span className="truncate max-w-xs">{doc.title}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-700 border border-[#E2E8F0]">
                        {doc.source}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-[#1D4ED8]">{doc.chunkCount}</span> chunks
                    </td>
                    <td className="px-6 py-4 text-slate-600">{doc.totalCharacters.toLocaleString()}</td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors"
                        title="Delete Document & Chunks"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Ingest Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="text-base font-semibold text-[#0F172A]">Manual Document Ingestion</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mode Selector */}
            <div className="flex rounded-xl bg-slate-100 p-1 border border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setUploadMode("text")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  uploadMode === "text" ? "bg-[#1D4ED8] text-white shadow-sm" : "text-slate-600 hover:text-[#0F172A]"
                }`}
              >
                Plain Text / JSON (UiPath Simulation)
              </button>
              <button
                type="button"
                onClick={() => setUploadMode("file")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  uploadMode === "file" ? "bg-[#1D4ED8] text-white shadow-sm" : "text-slate-600 hover:text-[#0F172A]"
                }`}
              >
                Upload File (PDF/Word/TXT)
              </button>
            </div>

            <form onSubmit={handleManualIngest} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Document Title</label>
                <input
                  type="text"
                  required
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. Employee_Handbook_2026.pdf"
                  className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A] placeholder:text-slate-400 focus:border-[#1D4ED8] focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Source / Origin</label>
                <input
                  type="text"
                  value={docSource}
                  onChange={(e) => setDocSource(e.target.value)}
                  placeholder="e.g. UiPath Bot #1 - HR Portal"
                  className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A] placeholder:text-slate-400 focus:border-[#1D4ED8] focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {uploadMode === "text" ? (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Document Text Content
                  </label>
                  <textarea
                    required
                    rows={6}
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    placeholder="Paste the extracted document content here to simulate what the UiPath robot sends..."
                    className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A] placeholder:text-slate-400 focus:border-[#1D4ED8] focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Select File</label>
                  <input
                    type="file"
                    required
                    accept=".pdf,.docx,.txt,.md,.json,.csv"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#1D4ED8] file:text-white hover:file:bg-blue-800 cursor-pointer"
                  />
                </div>
              )}

              {uploadMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    uploadMessage.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                >
                  {uploadMessage.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <span>{uploadMessage.text}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="rounded-xl border border-[#E2E8F0] px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="rounded-xl bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  {isUploading && <RefreshCw className="h-3 w-3 animate-spin" />}
                  {isUploading ? "Chunking & Indexing..." : "Index Now"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
