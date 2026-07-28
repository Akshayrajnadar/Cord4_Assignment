"use client";

import { useState } from "react";

const SUGGESTED_QUESTIONS = [
  "What's the highest-ROI automation opportunity?",
  "Who has the highest repetitive-task share?",
  "Break repetitive work down by department.",
];

const INITIAL_MESSAGES = [
  {
    role: "assistant",
    content: "Ask me about time spent, costs, or automation priorities.",
  },
];

function renderInlineMarkdown(text) {
  const parts = String(text).split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-white/70 px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }

    return <span key={index}>{part}</span>;
  });
}

function MarkdownMessage({ content }) {
  const lines = String(content || "").split(/\r?\n/);
  const blocks = [];
  let listItems = [];

  function flushList() {
    if (!listItems.length) return;
    blocks.push({ type: "list", items: listItems });
    listItems = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }

    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      flushList();
      blocks.push({ type: "heading", text: heading[1] });
      continue;
    }

    const bullet = line.match(/^(?:[-*]|\d+\.)\s+(.+)$/);
    if (bullet) {
      listItems.push(bullet[1]);
      continue;
    }

    flushList();
    blocks.push({ type: "paragraph", text: line });
  }

  flushList();

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h3 key={index} className="pt-1 text-sm font-semibold text-gray-900">
              {renderInlineMarkdown(block.text)}
            </h3>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={index} className="ml-4 list-disc space-y-1">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          );
        }

        return <p key={index}>{renderInlineMarkdown(block.text)}</p>;
      })}
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-6 ${
          isUser ? "bg-[#315f72] text-white" : "bg-gray-100 text-gray-800"
        } ${message.error ? "border border-amber-300 bg-amber-50 text-amber-900" : ""}`}
      >
        {isUser ? message.content : <MarkdownMessage content={message.content} />}
      </div>
    </div>
  );
}

function LoadingBubble() {
  return (
    <div className="flex justify-start">
      <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600">
        Thinking<span className="animate-pulse">...</span>
      </div>
    </div>
  );
}

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage(event) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const nextMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong - try again");
      }

      setMessages((current) => [...current, { role: "assistant", content: data.reply || "No reply returned." }]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "Something went wrong - try again",
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Chat Assistant</h2>
          <p className="mt-1 text-xs text-gray-500">Grounded on the summarized dashboard dataset.</p>
        </div>
        <svg
          aria-hidden="true"
          className={`h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div className="border-t border-gray-200 p-5">
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => setInput(question)}
                className="rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                {question}
              </button>
            ))}
          </div>

          <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-lg border border-gray-100 bg-white p-3">
            {messages.map((message, index) => (
              <MessageBubble key={`${message.role}-${index}`} message={message} />
            ))}
            {loading ? <LoadingBubble /> : null}
          </div>

          <form onSubmit={sendMessage} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              className="min-h-11 flex-1 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-[#315f72]"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask a follow-up about time, cost, rankings, or employees"
            />
            <button
              className="min-h-11 rounded-md bg-[#315f72] px-5 text-sm font-semibold text-white disabled:opacity-60"
              disabled={loading || !input.trim()}
              type="submit"
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}