"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type Contact = {
  id: string;
  phone: string;
  full_name: string;
  status: string;
  tags: string[];
  first_contact_at: string | null;
  last_contact_at: string | null;
  is_first_time: boolean;
};

type ToastType = "success" | "error" | "info";
type Props = {
  clinicId: string;
  showToast?: (message: string, type: ToastType) => void;
};

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "lead", label: "Lead" },
  { value: "interested", label: "Interessado" },
  { value: "scheduled", label: "Agendou" },
  { value: "patient", label: "Paciente" },
  { value: "inactive", label: "Inativo" },
];

const PAGE_SIZE = 20;

function statusLabel(s: string): string {
  const o = STATUS_OPTIONS.find((x) => x.value === s);
  return o ? o.label : s;
}

function statusBadgeClass(s: string): string {
  switch (s) {
    case "lead":
      return "bg-slate-100 text-slate-700";
    case "interested":
      return "bg-blue-100 text-blue-700";
    case "scheduled":
      return "bg-green-100 text-green-700";
    case "patient":
      return "bg-emerald-100 text-emerald-700";
    case "inactive":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function ContactsView({ clinicId, showToast }: Props) {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        clinic_id: clinicId,
        page: String(page),
        status: statusFilter,
      });
      if (searchDebounced) params.set("q", searchDebounced);
      const res = await fetch(`/api/owner/contacts?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setContacts([]);
        setTotal(0);
        setTotalPages(0);
        showToast?.(data?.message ?? "Erro ao carregar contatos.", "error");
        return;
      }
      setContacts(data.contacts ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 0);
    } catch {
      setContacts([]);
      setTotal(0);
      setTotalPages(0);
      showToast?.("Erro ao carregar contatos.", "error");
    } finally {
      setLoading(false);
    }
  }, [clinicId, page, statusFilter, searchDebounced, showToast]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchDebounced]);

  const handleExport = () => {
    const params = new URLSearchParams({ clinic_id: clinicId });
    if (statusFilter !== "all") params.set("status", statusFilter);
    window.open(`/api/owner/contacts/export?${params.toString()}`, "_blank");
    showToast?.("Exportação iniciada.", "success");
  };

  const handleSendMessage = (phone: string) => {
    router.push("/secretary?open_inbox=1");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="search"
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={handleExport}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Carregando contatos...
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 font-medium text-slate-700">Nome</th>
                  <th className="px-4 py-3 font-medium text-slate-700">Telefone</th>
                  <th className="px-4 py-3 font-medium text-slate-700">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-700">Tags</th>
                  <th className="px-4 py-3 font-medium text-slate-700">Primeira vez</th>
                  <th className="px-4 py-3 font-medium text-slate-700">Último contato</th>
                  <th className="px-4 py-3 font-medium text-slate-700">Ações</th>
                </tr>
              </thead>
              <tbody>
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      Nenhum contato encontrado.
                    </td>
                  </tr>
                ) : (
                  contacts.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-800">{c.full_name || "—"}</span>
                        {c.is_first_time && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                            1ª vez
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{c.phone}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(c.status)}`}>
                          {statusLabel(c.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {Array.isArray(c.tags) && c.tags.length > 0 ? c.tags.join(", ") : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(c.first_contact_at)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(c.last_contact_at)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleSendMessage(c.phone)}
                          className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                        >
                          Enviar mensagem
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                {total} contato(s) • Página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50 hover:bg-slate-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50 hover:bg-slate-50"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
