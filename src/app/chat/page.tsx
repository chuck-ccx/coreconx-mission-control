"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Lock, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Message {
  from: string;
  message: string;
  timestamp: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadHistory();
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadHistory() {
    const history = await apiFetch<Message[]>("/api/chat/history");
    if (history) setMessages(history);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const text = input.trim();
    setInput("");
    setSending(true);

    // Optimistic update
    setMessages((prev) => [
      ...prev,
      { from: "dylan", message: text, timestamp: new Date().toISOString() },
    ]);

    const result = await apiFetch<{ ok: boolean }>("/api/chat/send", {
      method: "POST",
      body: JSON.stringify({ message: text }),
    });

    if (!result?.ok) {
      setMessages((prev) => [
        ...prev,
        {
          from: "system",
          message: "Failed to send — check your connection.",
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    setSending(false);
    inputRef.current?.focus();
  }

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-6rem)] md:h-[calc(100vh-3rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-coreconx flex items-center justify-center">
            <span className="text-white font-bold">C</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              Chuck — Secure Channel
              <ShieldCheck size={16} className="text-success" />
            </h1>
            <p className="text-xs text-muted">
              Messages stored locally on server — safe for credentials
            </p>
          </div>
        </div>
      </div>

      {/* Security notice */}
      <div className="flex items-center gap-2 px-4 py-2 mt-3 rounded-lg bg-coreconx/10 border border-coreconx-light/20">
        <Lock size={14} className="text-coreconx-light shrink-0" />
        <p className="text-xs text-muted">
          Messages are stored on your server only — never sent to external
          services. Safe for API keys, tokens, and credentials. Chuck receives
          messages via system events.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted text-sm mt-8">
            No messages yet. Send API keys, credentials, or sensitive info
            securely.
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.from === "dylan" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-xl px-4 py-3 ${
                msg.from === "dylan"
                  ? "bg-coreconx text-white"
                  : msg.from === "system"
                    ? "bg-danger/10 border border-danger/20 text-danger"
                    : "bg-card border border-border text-foreground"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-all">
                {msg.message}
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <Lock size={10} className="opacity-40" />
                <p
                  className={`text-[10px] ${msg.from === "dylan" ? "text-white/50" : "text-muted"}`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="pb-2 pt-3 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center bg-card border border-border rounded-xl px-4">
            <Lock size={14} className="text-muted shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a secure message..."
              className="flex-1 px-3 py-3 bg-transparent text-foreground placeholder:text-muted focus:outline-none text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="p-3 rounded-xl bg-coreconx text-white hover:bg-coreconx-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-[10px] text-muted text-center mt-2 flex items-center justify-center gap-1">
          <ShieldCheck size={10} />
          Stored on your server — Chuck receives via system event
        </p>
      </form>
    </div>
  );
}
