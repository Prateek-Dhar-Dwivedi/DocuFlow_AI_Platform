"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  User,
  Bot,
  FileText,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Database,
} from "lucide-react";
import { ChatMessage, SearchResultItem } from "../../lib/types";

const SUGGESTED_PROMPTS = [
  "Summarize the main documents extracted by the UiPath bot",
  "What are the key dates and deadlines mentioned in our documents?",
  "List any policy requirements or compliance rules found in the files",
];

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const toggleCitations = (messageId: string) => {
    setExpandedCitations((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  const handleSubmit = async (e?: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    const query = (customPrompt || input).trim();
    if (!query || isLoading) return;

    setInput("");

    const userMessage: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: "user",
      content: query,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const assistantMessageId = `msg_asst_${Date.now()}`;
    const initialAssistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      citations: [],
    };

    setMessages((prev) => [...prev, userMessage, initialAssistantMessage]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("No response body received from server");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulatedContent = "";
      let retrievedCitations: SearchResultItem[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const parts = chunk.split(/\r?\n\r?\n/);

        for (const part of parts) {
          const lines = part.split(/\r?\n/);
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const jsonStr = trimmed.slice(6).trim();

            if (jsonStr === "[DONE]") {
              break;
            }

            try {
              const data = JSON.parse(jsonStr);

              // 1. Process citations event
              if (data.type === "citations" && Array.isArray(data.citations)) {
                retrievedCitations = data.citations;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId ? { ...m, citations: retrievedCitations } : m
                  )
                );
              }

              // 2. Process text token event
              if (data.text) {
                accumulatedContent += data.text;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId ? { ...m, content: accumulatedContent } : m
                  )
                );
              }
            } catch {
              // Ignore non-JSON stream fragments
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat streaming error:", error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content:
                  "An error occurred while communicating with the RAG pipeline. Please check your network and API keys in `.env.local`.",
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleClear = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-1 flex-col h-[calc(100vh-65px)] max-w-5xl mx-auto w-full px-4 sm:px-6 py-4">
      {/* Top action bar */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-[#1D4ED8]" />
          <span className="text-xs font-medium text-slate-500">
            Vector Store: <strong className="text-[#0F172A] font-semibold">Pinecone Serverless (rag-documents)</strong>
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-[#0F172A] px-2.5 py-1 rounded-lg border border-[#E2E8F0] bg-white hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw className="h-3 w-3" />
            Clear Chat
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto py-6 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto space-y-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 border border-blue-200 shadow-sm">
              <Bot className="h-8 w-8 text-[#1D4ED8]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#0F172A] tracking-tight">Conversational Document Q&A</h2>
              <p className="mt-2 text-sm text-slate-600">
                Ask questions about any documents extracted by your UiPath bots or uploaded manually.
                Answers are grounded strictly in your Pinecone vector index.
              </p>
            </div>

            {/* Suggested Prompts */}
            <div className="w-full space-y-2 pt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Suggested Prompts
              </p>
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSubmit(undefined, prompt)}
                  className="w-full text-left p-3.5 rounded-xl border border-[#E2E8F0] bg-white hover:border-[#1D4ED8] hover:bg-blue-50/40 text-xs sm:text-sm text-slate-700 transition-all flex items-center justify-between group shadow-sm"
                >
                  <span>{prompt}</span>
                  <Sparkles className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#1D4ED8] transition-colors" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const isUser = message.role === "user";
            const isExpanded = expandedCitations[message.id];
            const hasCitations = message.citations && message.citations.length > 0;

            return (
              <div
                key={message.id}
                className={`flex gap-3 sm:gap-4 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 border border-blue-200 text-[#1D4ED8] shadow-sm">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div className={`flex flex-col space-y-2 max-w-[85%] sm:max-w-[75%]`}>
                  {/* Message Bubble */}
                  <div
                    className={`rounded-2xl p-4 text-sm leading-relaxed ${
                      isUser
                        ? "bg-[#1D4ED8] text-white rounded-tr-sm shadow-sm"
                        : "bg-white border border-[#E2E8F0] text-[#0F172A] rounded-tl-sm shadow-sm"
                    }`}
                  >
                    {message.content ? (
                      <div className="whitespace-pre-wrap font-sans">{message.content}</div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-500 text-xs py-1">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#1D4ED8]" />
                        <span>Searching vector index & synthesizing response...</span>
                      </div>
                    )}
                  </div>

                  {/* Citations and Grounding Panel */}
                  {!isUser && hasCitations && (
                    <div className="rounded-xl border border-[#E2E8F0] bg-slate-50/70 p-3 text-xs">
                      <button
                        onClick={() => toggleCitations(message.id)}
                        className="flex items-center justify-between w-full text-slate-600 hover:text-[#0F172A] font-medium transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-3.5 w-3.5 text-[#1D4ED8]" />
                          <span>
                            Grounded in {message.citations?.length} retrieved source chunk
                            {message.citations && message.citations.length > 1 ? "s" : ""}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-3 space-y-2 border-t border-[#E2E8F0] pt-2">
                          {message.citations?.map((chunk, idx) => (
                            <div
                              key={chunk.id || idx}
                              className="rounded-lg bg-white border border-[#E2E8F0] p-2.5 space-y-1 shadow-sm"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-[#1D4ED8] flex items-center gap-1.5 truncate max-w-[70%]">
                                  <FileText className="h-3 w-3 flex-shrink-0" />
                                  {chunk.title}
                                </span>
                                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-[#1D4ED8] border border-blue-200 font-medium">
                                  Score: {(chunk.score * 100).toFixed(0)}%
                                </span>
                              </div>
                              <p className="text-slate-600 line-clamp-3 text-[11px] leading-relaxed">
                                {chunk.content}
                              </p>
                              {Boolean(chunk.metadata?.source) && (
                                <p className="text-[10px] text-slate-400 italic">
                                  Source: {String(chunk.metadata?.source)}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <span className="text-[10px] text-slate-400 self-end px-1">
                    {message.createdAt}
                  </span>
                </div>

                {isUser && (
                  <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-[#1D4ED8] text-white shadow-sm">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input box */}
      <form onSubmit={handleSubmit} className="relative pt-2">
        <div className="relative flex items-end rounded-2xl border border-[#E2E8F0] bg-white shadow-sm focus-within:border-[#1D4ED8] focus-within:ring-2 focus-within:ring-blue-100 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your indexed documents... (Enter to send, Shift+Enter for newline)"
            rows={2}
            className="w-full resize-none bg-transparent px-4 py-3.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="m-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[#1D4ED8] text-white transition-all hover:bg-blue-800 disabled:opacity-40 disabled:hover:bg-[#1D4ED8] flex-shrink-0 shadow-sm"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-400">
          Powered by Pinecone Serverless & Google Gemini • Contextually filtered to prevent hallucinations
        </p>
      </form>
    </div>
  );
}
