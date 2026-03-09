"use client";

import { useEffect, useState } from "react";

type Lead = {
  id: string;
  clinic_id: string | null;
  clinic_name: string | null;
  contact_name: string | null;
  whatsapp: string | null;
  service: string | null;
  status: string;
  created_at: string;
};

const STATUS_OPTIONS = [
  { value: "new", label: "Novo" },
  { value: "contact", label: "Em contato" },
  { value: "proposal", label: "Proposta enviada" },
  { value: "closed", label: "Fechado" },
  { value: "lost", label: "Perdido" },
];

const SERVICE_LABELS: Record<string, string> = {
  site: "Site Profissional",
  redes: "Gestão de Redes Sociais",
  trafego: "Tráfego Pago",
};

function buildWhatsAppUrl(phone: string, lead: Lead): string {
  const num = phone.replace(/\D/g, "");
  const msg = encodeURIComponent(
    `Olá! Sou da clínica ${lead.clinic_name || "N/A"}. ` +
    `Entramos em contato sobre o serviço: ${SERVICE_LABELS[lead.service ?? ""] ?? lead.service ?? "Marketing"}.`
  );
  return `https://wa.me/55${num}?text=${msg}`;
}

export default function LeadsView() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchLeads = () => {
    setLoading(true);
    setError(null);
    fetch("/api/marketing/leads")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.message ?? "Erro ao carregar leads.");
          setLeads([]);
        } else {
          setLeads(data.leads ?? []);
        }
      })
      .catch(() => {
        setError("Erro ao carregar leads.");
        setLeads([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/marketing/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l)));
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const now = new Date();
  const thisMonth = now.getFullYear() * 100 + now.getMonth();
  const total = leads.length;
  const emContato = leads.filter((l) => l.status === "contact" || l.status === "proposal").length;
  const fechadosEsteMes = leads.filter((l) => {
    if (l.status !== "closed") return false;
    const d = new Date(l.created_at);
    return d.getFullYear() * 100 + d.getMonth() === thisMonth;
  }).length;

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        Carregando...
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Leads Marketing</h1>

      {/* Cards de resumo */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total de leads</p>
          <p className="text-2xl font-bold text-slate-900">{total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Em contato</p>
          <p className="text-2xl font-bold text-slate-900">{emContato}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Fechados este mês</p>
          <p className="text-2xl font-bold text-slate-900">{fechadosEsteMes}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">Clínica</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">Responsável</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">WhatsApp</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">Serviço</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">Data</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase text-slate-500">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                  Nenhum lead ainda.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-900">
                    {lead.clinic_name ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                    {lead.contact_name ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                    {lead.whatsapp ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                    {SERVICE_LABELS[lead.service ?? ""] ?? lead.service ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-slate-500">
                    {new Date(lead.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={lead.status}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                      disabled={updatingId === lead.id}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-800 disabled:opacity-50"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    {lead.whatsapp && (
                      <a
                        href={buildWhatsAppUrl(lead.whatsapp, lead)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                      >
                        WhatsApp
                      </a>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
