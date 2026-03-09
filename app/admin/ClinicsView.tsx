"use client";

import { useEffect, useState } from "react";
import NewClinicWizard from "./NewClinicWizard";

type Clinic = {
  id: string;
  name: string;
  phone: string | null;
  status: string;
  plan: string;
  completion_score: number;
};

type ClinicDetails = {
  clinic: {
    id: string;
    name: string;
    email?: string | null;
    plan?: string;
    status?: string;
    completion_score: number;
  };
  checklist: {
    basic_data: boolean;
    phone: boolean;
    address: boolean;
    professionals: boolean;
    services: boolean;
    whatsapp: boolean;
    ai: boolean;
  };
  users?: { id: string; user_id: string; full_name: string | null; email: string | null; role: string; active: boolean }[];
  metrics?: { appointmentsTotal: number; patientsTotal: number; whatsappConnected: boolean };
};

function completionBadge(score: number) {
  if (score >= 100) return { label: "Completo", className: "bg-emerald-100 text-emerald-800" };
  if (score >= 60) return { label: "Incompleto", className: "bg-amber-100 text-amber-800" };
  return { label: "Pendente", className: "bg-rose-100 text-rose-800" };
}

export default function ClinicsView() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [detailsClinicId, setDetailsClinicId] = useState<string | null>(null);
  const [details, setDetails] = useState<ClinicDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [completingClinicId, setCompletingClinicId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "trial">("all");
  const [searchName, setSearchName] = useState("");

  const filteredClinics = clinics.filter((c) => {
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "trial" && c.plan === "trial") ||
      (statusFilter === "active" && c.status === "active") ||
      (statusFilter === "inactive" && c.status === "inactive");
    const matchName = !searchName.trim() || (c.name ?? "").toLowerCase().includes(searchName.trim().toLowerCase());
    return matchStatus && matchName;
  });

  const fetchClinics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/clinics");
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Erro ao carregar clínicas.");
        setClinics([]);
        return;
      }
      setClinics(data.clinics ?? []);
    } catch {
      setError("Erro ao carregar clínicas.");
      setClinics([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClinics();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Erro ao criar clínica.");
        return;
      }
      setShowModal(false);
      setName("");
      setPhone("");
      fetchClinics();
    } catch {
      setError("Erro ao criar clínica.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const next = currentStatus === "active" ? "inactive" : "active";
    try {
      const res = await fetch(`/api/admin/clinics?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        fetchClinics();
        if (detailsClinicId === id) openDetails(id);
      }
    } catch {
      // ignore
    }
  };

  const openDetails = async (id: string) => {
    setDetailsClinicId(id);
    setDetails(null);
    setDetailsLoading(true);
    try {
      const res = await fetch(`/api/admin/clinic-details?clinic_id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (res.ok && data.clinic) setDetails(data);
      else setDetails(null);
    } catch {
      setDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setDetailsClinicId(null);
    setDetails(null);
  };

  const handleCompletarCadastro = (id: string) => {
    setCompletingClinicId(id);
    closeDetails();
    setShowWizard(true);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Clínicas</h1>
        <button
          type="button"
          onClick={() => setShowWizard(true)}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Nova Clínica
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {(["all", "active", "trial", "inactive"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                statusFilter === f ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {f === "all" ? "Todas" : f === "active" ? "Ativas" : f === "trial" ? "Trial" : "Inativas"}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Buscar por nome"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-56 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Carregando...
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Telefone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Plano
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Cadastro
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-slate-500">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredClinics.map((c) => {
                const badge = completionBadge(c.completion_score ?? 20);
                return (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">
                      <button
                        type="button"
                        onClick={() => openDetails(c.id)}
                        className="text-left text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        {c.name}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                      {c.phone ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">{c.plan}</td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className={`inline rounded-full px-2 py-1 text-xs font-medium ${badge.className}`}>
                        {badge.label} ({(c.completion_score ?? 20)}%)
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline rounded-full px-2 py-1 text-xs font-medium ${
                          c.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {c.status === "active" ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm space-x-2">
                      <button
                        type="button"
                        onClick={() => openDetails(c.id)}
                        className="text-slate-600 hover:text-slate-900"
                      >
                        Detalhes
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof sessionStorage !== "undefined") {
                            sessionStorage.setItem("impersonate_clinic_id", c.id);
                            sessionStorage.setItem("impersonate_clinic_name", c.name);
                          }
                          window.location.href = "/owner";
                        }}
                        className="text-amber-600 hover:text-amber-800"
                      >
                        Entrar como dono
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(c.id, c.status)}
                        className="text-slate-600 hover:text-slate-900"
                      >
                        {c.status === "active" ? "Desativar" : "Ativar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showWizard && (
        <NewClinicWizard
          onClose={() => { setShowWizard(false); setCompletingClinicId(null); }}
          onSuccess={() => { fetchClinics(); setShowWizard(false); setCompletingClinicId(null); }}
        />
      )}

      {detailsClinicId && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-slate-900/50" onClick={closeDetails} aria-hidden />
          <div className="relative w-full max-w-md flex flex-col bg-white shadow-xl border-l border-slate-200 overflow-y-auto">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-slate-900">Detalhes da clínica</h2>
              <button type="button" onClick={closeDetails} className="text-slate-500 hover:text-slate-700">✕</button>
            </div>
            <div className="px-6 py-4 flex-1">
              {detailsLoading ? (
                <p className="text-sm text-slate-500">Carregando...</p>
              ) : details ? (
                <>
                  <p className="text-base font-medium text-slate-900 mb-1">{details.clinic.name}</p>
                  {details.clinic.email && (
                    <p className="text-sm text-slate-600 mb-2">{details.clinic.email}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      Plano: {details.clinic.plan ?? "trial"}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      details.clinic.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                    }`}>
                      {details.clinic.status === "active" ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                  {details.metrics && (
                    <div className="mb-4 text-sm text-slate-600">
                      <p>Agendamentos: {details.metrics.appointmentsTotal} · Pacientes: {details.metrics.patientsTotal}</p>
                      <p>WhatsApp: {details.metrics.whatsappConnected ? "Conectado" : "Desconectado"}</p>
                    </div>
                  )}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-slate-600 mb-1">
                      <span>Progresso do cadastro</span>
                      <span>{details.clinic.completion_score}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all"
                        style={{ width: `${Math.min(100, details.clinic.completion_score)}%` }}
                      />
                    </div>
                  </div>
                  {(details.users?.length ?? 0) > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-slate-900 mb-2">Usuários vinculados</h3>
                      <ul className="space-y-1 text-sm text-slate-700">
                        {details.users!.map((u) => (
                          <li key={u.id}>
                            {u.full_name || u.email || u.user_id} · {u.role}
                            {!u.active && <span className="text-rose-600 ml-1">(inativo)</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <ul className="space-y-2 text-sm mb-6">
                    <li className="flex items-center gap-2">
                      {details.checklist.basic_data ? <span className="text-emerald-600">✅</span> : <span className="text-slate-300">❌</span>}
                      Dados básicos
                    </li>
                    <li className="flex items-center gap-2">
                      {details.checklist.phone ? <span className="text-emerald-600">✅</span> : <span className="text-slate-300">❌</span>}
                      Telefone
                    </li>
                    <li className="flex items-center gap-2">
                      {details.checklist.address ? <span className="text-emerald-600">✅</span> : <span className="text-slate-300">❌</span>}
                      Endereço
                    </li>
                    <li className="flex items-center gap-2">
                      {details.checklist.professionals ? <span className="text-emerald-600">✅</span> : <span className="text-slate-300">❌</span>}
                      Profissionais
                    </li>
                    <li className="flex items-center gap-2">
                      {details.checklist.services ? <span className="text-emerald-600">✅</span> : <span className="text-slate-300">❌</span>}
                      Serviços
                    </li>
                    <li className="flex items-center gap-2">
                      {details.checklist.whatsapp ? <span className="text-emerald-600">✅</span> : <span className="text-slate-300">❌</span>}
                      WhatsApp
                    </li>
                    <li className="flex items-center gap-2">
                      {details.checklist.ai ? <span className="text-emerald-600">✅</span> : <span className="text-slate-300">❌</span>}
                      IA
                    </li>
                  </ul>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => detailsClinicId && handleCompletarCadastro(detailsClinicId)}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Editar / Completar cadastro
                    </button>
                    {details.clinic.status !== undefined && (
                      <button
                        type="button"
                        onClick={() => detailsClinicId && handleToggleStatus(detailsClinicId, details.clinic.status === "active" ? "active" : "inactive")}
                        className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
                      >
                        {details.clinic.status === "active" ? "Suspender" : "Ativar"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (detailsClinicId && typeof sessionStorage !== "undefined") {
                          sessionStorage.setItem("impersonate_clinic_id", detailsClinicId);
                          sessionStorage.setItem("impersonate_clinic_name", details.clinic.name);
                        }
                        window.location.href = "/owner";
                      }}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                      Entrar como dono
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">Não foi possível carregar os detalhes.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setShowModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Nova Clínica (rápido)</h2>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col gap-4 px-6 py-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Telefone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {submitting ? "Criando..." : "Criar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
