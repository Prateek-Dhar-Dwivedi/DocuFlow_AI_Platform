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
} from "lucide-react";
import { DocumentRecord } from "../../lib/types";

export function DocumentDashboard() {
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
    }
  };

  useEffect(() => {
    fetchDocuments();
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
            Authorization: "Bearer dev-uipath-secret-key-12345",
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
            Authorization: "Bearer dev-uipath-secret-key-12345",
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

  const curlCommand = `curl -X POST http://localhost:3000/api/ingest \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer dev-uipath-secret-key-12345" \\
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
          <h1 className="text-2xl font-bold tracking-tight text-white">Document Registry & Vector Store</h1>
          <p className="mt-1 text-sm text-slate-400">
            Monitor documents ingested by UiPath Studio robots and manage vector embeddings in Azure AI Search.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDocuments}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/20"
          >
            <Plus className="h-4 w-4" />
            Ingest Document
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Indexed Documents</span>
            <Files className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{documents.length}</p>
          <p className="mt-1 text-[11px] text-slate-500">Active records in database</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Vector Chunks</span>
            <Database className="h-4 w-4 text-cyan-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">
            {documents.reduce((acc, d) => acc + d.chunkCount, 0)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">1536-dimensional embeddings</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Pinecone Vector DB</span>
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                status.pineconeConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              }`}
            />
          </div>
          <p className="mt-2 text-sm font-semibold text-white">
            {status.pineconeConnected ? `Connected (${status.pineconeIndex || "rag-documents"})` : "Local Dev Mode"}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {status.pineconeConnected ? "Serverless Index Live" : "Configure PINECONE_API_KEY"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">UiPath Webhook</span>
            <Bot className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-sm font-semibold text-white">/api/ingest</p>
          <p className="mt-1 text-[11px] text-emerald-400">Accepting POST payloads</p>
        </div>
      </div>

      {/* UiPath Bot Quick Integration Banner */}
      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white">UiPath Studio Bot Webhook Setup</h3>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Configure your UiPath Studio <strong>HTTP Request</strong> activity to dispatch extracted text directly to this endpoint. Low latency JSON payload is ready.
            </p>
          </div>
          <button
            onClick={copyCurl}
            className="flex items-center gap-2 self-start lg:self-auto rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 transition-colors"
          >
            {copiedCurl ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
            {copiedCurl ? "Copied cURL!" : "Copy UiPath cURL Test"}
          </button>
        </div>
      </div>

      {/* Documents Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Indexed Documents ({documents.length})</h2>
          <span className="text-xs text-slate-500">Live Vector Index</span>
        </div>

        {documents.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <FileText className="h-10 w-10 text-slate-600 mx-auto" />
            <p className="text-sm text-slate-400">No documents ingested yet.</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Run your UiPath robot or click &ldquo;Ingest Document&rdquo; above to parse and vector-index your first document.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/40 text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 font-medium">Document Title</th>
                  <th className="px-6 py-3 font-medium">Source / Bot</th>
                  <th className="px-6 py-3 font-medium">Vector Chunks</th>
                  <th className="px-6 py-3 font-medium">Characters</th>
                  <th className="px-6 py-3 font-medium">Ingestion Date</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                      <FileText className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                      <span className="truncate max-w-xs">{doc.title}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      <span className="rounded-md bg-slate-800 px-2 py-1 text-[11px] text-slate-300 border border-slate-700/50">
                        {doc.source}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-indigo-300">{doc.chunkCount}</span> chunks
                    </td>
                    <td className="px-6 py-4 text-slate-400">{doc.totalCharacters.toLocaleString()}</td>
                    <td className="px-6 py-4 text-slate-400">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-white">Manual Document Ingestion</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Mode Selector */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setUploadMode("text")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  uploadMode === "text" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Plain Text / JSON (UiPath Simulation)
              </button>
              <button
                type="button"
                onClick={() => setUploadMode("file")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  uploadMode === "file" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Upload File (PDF/Word/TXT)
              </button>
            </div>

            <form onSubmit={handleManualIngest} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Document Title</label>
                <input
                  type="text"
                  required
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. Employee_Handbook_2026.pdf"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Source / Origin</label>
                <input
                  type="text"
                  value={docSource}
                  onChange={(e) => setDocSource(e.target.value)}
                  placeholder="e.g. UiPath Bot #1 - HR Portal"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {uploadMode === "text" ? (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Document Text Content
                  </label>
                  <textarea
                    required
                    rows={6}
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    placeholder="Paste the extracted document content here to simulate what the UiPath robot sends..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Select File</label>
                  <input
                    type="file"
                    required
                    accept=".pdf,.docx,.txt,.md,.json,.csv"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                  />
                </div>
              )}

              {uploadMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    uploadMessage.type === "success"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
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
                  className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-1.5"
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
