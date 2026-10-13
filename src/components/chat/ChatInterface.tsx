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
} from "lucide-react";
import { ChatMessage, SearchResultItem } from "@/lib/types";

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
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.replace("data: ", "").trim();

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
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-medium text-slate-400">
            Vector Store: <strong className="text-slate-200">Pinecone Serverless (rag-documents)</strong>
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
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
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shadow-inner">
              <Bot className="h-8 w-8 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Conversational Document Q&A</h2>
              <p className="mt-2 text-sm text-slate-400">
                Ask questions about any documents extracted by your UiPath bots or uploaded manually.
                Answers are grounded strictly in your Azure vector index.
              </p>
            </div>

            {/* Suggested Prompts */}
            <div className="w-full space-y-2 pt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Suggested Prompts
              </p>
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSubmit(undefined, prompt)}
                  className="w-full text-left p-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 hover:border-indigo-500/30 text-xs sm:text-sm text-slate-300 transition-all flex items-center justify-between group"
                >
                  <span>{prompt}</span>
                  <Sparkles className="h-3.5 w-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
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
                  <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div className={`flex flex-col space-y-2 max-w-[85%] sm:max-w-[75%]`}>
                  {/* Message Bubble */}
                  <div
                    className={`rounded-2xl p-4 text-sm leading-relaxed ${
                      isUser
                        ? "bg-indigo-600 text-white rounded-tr-sm shadow-md"
                        : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-sm shadow-sm"
                    }`}
                  >
                    {message.content ? (
                      <div className="whitespace-pre-wrap font-sans">{message.content}</div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-400 text-xs py-1">
                        <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
                        <span>Searching vector index & synthesizing response...</span>
                      </div>
                    )}
                  </div>

                  {/* Citations and Grounding Panel */}
                  {!isUser && hasCitations && (
                    <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 text-xs">
                      <button
                        onClick={() => toggleCitations(message.id)}
                        className="flex items-center justify-between w-full text-slate-400 hover:text-slate-200 font-medium transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
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
                        <div className="mt-3 space-y-2 border-t border-slate-800/60 pt-2">
                          {message.citations?.map((chunk, idx) => (
                            <div
                              key={chunk.id || idx}
                              className="rounded-lg bg-slate-950/80 border border-slate-800 p-2.5 space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-indigo-300 flex items-center gap-1.5 truncate max-w-[70%]">
                                  <FileText className="h-3 w-3 flex-shrink-0" />
                                  {chunk.title}
                                </span>
                                <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-400 border border-indigo-500/20">
                                  Score: {(chunk.score * 100).toFixed(0)}%
                                </span>
                              </div>
                              <p className="text-slate-400 line-clamp-3 text-[11px] leading-relaxed">
                                {chunk.content}
                              </p>
                              {Boolean(chunk.metadata?.source) && (
                                <p className="text-[10px] text-slate-500 italic">
                                  Source: {String(chunk.metadata?.source)}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <span className="text-[10px] text-slate-500 self-end px-1">
                    {message.createdAt}
                  </span>
                </div>

                {isUser && (
                  <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
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
        <div className="relative flex items-end rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your indexed documents... (Enter to send, Shift+Enter for newline)"
            rows={2}
            className="w-full resize-none bg-transparent px-4 py-3.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="m-2 flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white transition-all hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 flex-shrink-0 shadow-md"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-500">
          Powered by Azure AI Search & OpenAI • Contextually filtered to prevent hallucinations
        </p>
      </form>
    </div>
  );
}
