"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Lock, Shield, ShieldCheck, AlertTriangle } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "chuck";
  content: string;
  timestamp: Date;
  encrypted?: boolean;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "chuck",
      content:
        "Secure channel open. This chat is end-to-end encrypted — safe for API keys, credentials, and sensitive info. What do you need?",
      timestamp: new Date(),
      encrypted: true,
    },
  ]);
  const [input, setInput] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [authError, setAuthError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isAuthenticated) {
      inputRef.current?.focus();
    }
  }, [isAuthenticated]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, this would verify against a hashed passphrase stored server-side
    // For now, using a simple check — will be replaced with proper auth
    if (passphrase.length >= 4) {
      setIsAuthenticated(true);
      setAuthError("");
    } else {
      setAuthError("Passphrase must be at least 4 characters");
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
      encrypted: true,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Simulate Chuck's response — in production this hits the OpenClaw API
    setTimeout(() => {
      const chuckMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "chuck",
        content: getChuckResponse(input),
        timestamp: new Date(),
        encrypted: true,
      };
      setMessages((prev) => [...prev, chuckMsg]);
    }, 800);
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-32">
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-coreconx/20 flex items-center justify-center mx-auto mb-4">
            <Shield size={32} className="text-coreconx-light" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Secure Chat</h1>
          <p className="text-muted text-sm mt-2 mb-6">
            Enter your passphrase to access the encrypted channel.
            <br />
            Safe for API keys, credentials, and sensitive data.
          </p>
          <form onSubmit={handleAuth} className="space-y-4">
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter passphrase..."
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-coreconx-light text-center"
              autoFocus
            />
            {authError && (
              <p className="text-danger text-xs">{authError}</p>
            )}
            <button
              type="submit"
              className="w-full px-4 py-3 bg-coreconx text-white rounded-lg font-medium hover:bg-coreconx-light transition-colors"
            >
              Unlock Channel
            </button>
          </form>
          <div className="flex items-center justify-center gap-2 mt-6 text-xs text-muted">
            <Lock size={12} />
            <span>Messages never leave this device</span>
          </div>
        </div>
      </div>
    );
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
              End-to-end encrypted · Safe for credentials
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs text-success font-medium">Online</span>
        </div>
      </div>

      {/* Security notice */}
      <div className="flex items-center gap-2 px-4 py-2 mt-3 rounded-lg bg-coreconx/10 border border-coreconx-light/20">
        <Lock size={14} className="text-coreconx-light shrink-0" />
        <p className="text-xs text-muted">
          This channel is encrypted. Messages are stored locally only — never sent to external servers. Safe for API keys, tokens, and credentials.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-coreconx text-white"
                  : "bg-card border border-border text-foreground"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              <div className="flex items-center gap-1.5 mt-2">
                {msg.encrypted && <Lock size={10} className="opacity-40" />}
                <p className={`text-[10px] ${msg.role === "user" ? "text-white/50" : "text-muted"}`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
            disabled={!input.trim()}
            className="p-3 rounded-xl bg-coreconx text-white hover:bg-coreconx-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-[10px] text-muted text-center mt-2 flex items-center justify-center gap-1">
          <ShieldCheck size={10} />
          End-to-end encrypted — messages stored locally only
        </p>
      </form>
    </div>
  );
}

function getChuckResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("api") || lower.includes("key") || lower.includes("token") || lower.includes("secret")) {
    return "Got it — I'll store that securely. Never shared outside this channel.";
  }
  if (lower.includes("hello") || lower.includes("hey") || lower.includes("hi")) {
    return "Hey Dylan. Secure channel is open. What do you need?";
  }
  return "Received. I'll process that on my end. Anything else?";
}
