"use client";

import { useState } from "react";

export default function ChatAssistant() {
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function askAssistant(event) {
    event.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await response.json();
    setAnswer(data.answer || data.error || "No answer returned.");
    setLoading(false);
  }

  return (
    <section className="rounded-lg border border-[#d7d0c4] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[#1f2933]">Chat Assistant</h2>
      <form onSubmit={askAssistant} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          className="min-h-11 flex-1 rounded-md border border-[#cfc7bc] px-3 text-sm outline-none focus:border-[#2f7d6d]"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ask about anomalies, rankings, apps, or categories"
        />
        <button
          className="min-h-11 rounded-md bg-[#2f7d6d] px-5 text-sm font-semibold text-white disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading ? "Asking..." : "Ask"}
        </button>
      </form>
      {answer ? <p className="mt-4 rounded-md bg-[#eef5f2] p-3 text-sm text-[#1f4f45]">{answer}</p> : null}
    </section>
  );
}
