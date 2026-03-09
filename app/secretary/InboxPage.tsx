"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import NewAppointmentModal from "./NewAppointmentModal";
import type { Provider, Service } from "./AgendaTable";

function getInitials(name: string | null, phone: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
    return name.slice(0, 2).toUpperCase();
  }
  if (phone && phone.length >= 2) return phone.slice(-2);
  return "?";
}

type Conversation = {
  id: string;
  patient_id: string | null;
  full_name: string | null;
  whatsapp_from: string;
  last_message: string | null;
  last_message_at: string | null;
  status: string;
  unread_count: number;
  needs_human: boolean;
};

type Message = {
  id: string;
  conversation_id: string;
  direction: string;
  content: string;
  created_at: string;
};

type ToastType = "success" | "error" | "info";
type Props = {
  clinicId: string;
  showToast?: (message: string, type: ToastType) => void;
};

export default function InboxPage({ clinicId, showToast }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [botTyping, setBotTyping] = useState(false);
  const [patchingIa, setPatchingIa] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0 && selectedId) {
      const last = messages[messages.length - 1];
      const selected = conversations.find((c) => c.id === selectedId);
      if (last?.direction === "inbound" && selected && !selected.needs_human) {
        setBotTyping(true);
        const t = setTimeout(() => setBotTyping(false), 4000);
        return () => clearTimeout(t);
      }
    }
  }, [messages, selectedId, conversations]);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch(`/api/inbox/conversations?clinic_id=${encodeURIComponent(clinicId)}`);
      const data = await res.json();
      if (res.ok) setConversations(data.conversations ?? []);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/inbox/messages?conversation_id=${encodeURIComponent(selectedId)}`);
      const data = await res.json();
      if (!cancelled && res.ok) setMessages(data.messages ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const fetchProvidersServices = useCallback(async () => {
    try {
      const res = await fetch(`/api/appointments?clinic_id=${encodeURIComponent(clinicId)}`);
      const data = await res.json();
      if (res.ok) {
        setProviders(data.providers ?? []);
        setServices(data.services ?? []);
      }
    } catch {
      // ignore
    }
  }, [clinicId]);

  const handleOpenAgendar = () => {
    fetchProvidersServices();
    setShowAppointmentModal(true);
  };

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || !selectedId || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/inbox/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: selectedId, content: text, direction: "outbound" }),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        setMessages((prev) => [...prev, data.message]);
        setInputText("");
      }
    } finally {
      setSending(false);
    }
  };

  const filtered = search.trim()
    ? conversations.filter(
        (c) =>
          (c.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (c.whatsapp_from ?? "").includes(search)
      )
    : conversations;

  const patchConversation = useCallback(
    async (conversationId: string, body: { status?: string; needs_human?: boolean }) => {
      setPatchingIa(true);
      try {
        const res = await fetch(`/api/inbox/conversations/${conversationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) fetchConversations();
      } finally {
        setPatchingIa(false);
      }
    },
    [fetchConversations],
  );

  const selected = selectedId ? conversations.find((c) => c.id === selectedId) : null;

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-white">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-slate-900">Caixa de Entrada</h1>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Lista de conversas */}
        <aside className="flex w-80 flex-col border-r border-slate-200 bg-slate-50">
          <div className="border-b border-slate-200 p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou telefone"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="divide-y divide-slate-200">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-200" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                      <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">Nenhuma conversa</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`flex w-full items-start gap-3 border-b border-slate-200 px-4 py-3 text-left hover:bg-slate-100 ${
                    selectedId === c.id ? "bg-emerald-50" : ""
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800">
                    {getInitials(c.full_name, c.whatsapp_from)}
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate font-medium text-slate-900">
                      {c.full_name || c.whatsapp_from || "Sem nome"}
                    </span>
                    {c.needs_human && (
                      <span className="shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white">
                        Aguarda atendimento
                      </span>
                    )}
                    {!c.needs_human && c.unread_count > 0 && (
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="truncate">{c.last_message || "—"}</span>
                    <span>
                      {c.last_message_at
                        ? new Date(c.last_message_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {c.status === "open" ? "Aberta" : c.status === "waiting" ? "Aguardando" : "Resolvida"}
                  </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Área da conversa */}
        <section className="flex flex-1 flex-col bg-white">
          {selected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-6 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-slate-900">
                      {selected.full_name || selected.whatsapp_from || "Conversa"}
                    </h2>
                    {selected.needs_human ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Atendimento humano
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        IA ativa
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">{selected.whatsapp_from}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selected.needs_human ? (
                    <button
                      type="button"
                      disabled={patchingIa}
                      onClick={() => patchConversation(selected.id, { needs_human: false })}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Ativar IA
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={patchingIa}
                      onClick={() => patchConversation(selected.id, { needs_human: true })}
                      className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                    >
                      Pausar IA
                    </button>
                  )}
                  {selected.needs_human && (
                    <>
                      <button
                        type="button"
                        onClick={() => patchConversation(selected.id, { status: "resolved" })}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Resolver
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={handleOpenAgendar}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Agendar
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && !botTyping ? (
                  <p className="text-center text-sm text-slate-500">Nenhuma mensagem ainda</p>
                ) : (
                  <>
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                            m.direction === "outbound"
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 text-slate-900"
                          }`}
                        >
                          {m.content}
                          <div className="mt-1 text-xs opacity-80">
                            {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                    {botTyping && (
                      <div className="flex justify-start">
                        <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-500">
                          Digitando...
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              <div className="flex gap-2 border-t border-slate-200 p-4">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={sending || !inputText.trim()}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {sending ? "..." : "Enviar"}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-slate-500">
              Selecione uma conversa
            </div>
          )}
        </section>
      </div>

      {showAppointmentModal && (
        <NewAppointmentModal
          clinicId={clinicId}
          providers={providers}
          services={services}
          onClose={() => setShowAppointmentModal(false)}
          onSuccess={() => {
            setShowAppointmentModal(false);
            showToast?.("Agendamento criado.", "success");
          }}
          showToast={showToast}
        />
      )}
    </main>
  );
}
