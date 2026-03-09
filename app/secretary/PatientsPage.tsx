"use client";

// UX ST-008 — Lista de pacientes
// Layout:
// - Header no topo com título "Pacientes" e subtítulo com total de pacientes.
// - Barra de ações logo abaixo com: campo de busca (nome/telefone) à esquerda e botão "Novo Paciente" à direita.
// - Tabela central com colunas: Nome/Telefone, Email, Tags, Ações.
// - Rodapé com paginação simples: "Anterior", "Próximo" e texto "Página X de Y".
// - Empty state amigável quando não há registros e indicador de "Carregando..." enquanto busca.

import { useEffect, useMemo, useState } from "react";
import NewPatientModal from "./NewPatientModal";
import PatientDrawer from "./PatientDrawer";
import type { ToastType } from "./Toast";

type Patient = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  tags: string[] | string | null;
  appointments_count?: number;
  last_appointment_at?: string | null;
  computed_tags?: string[];
  blocked?: boolean;
};

type ApiResponse = {
  patients: Patient[];
  total: number;
  page: number;
  totalPages: number;
};

type Props = {
  clinicId: string;
  showToast?: (message: string, type: ToastType) => void;
};

export default function PatientsPage({ clinicId, showToast }: Props) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string>("");
  const [patchingBlock, setPatchingBlock] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 400);
    return () => clearTimeout(handle);
  }, [query]);

  const fetchPatients = async (search: string, pageNumber: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        clinic_id: clinicId,
        page: String(pageNumber),
      });
      if (search.trim()) {
        params.set("q", search.trim());
      }
      const res = await fetch(`/api/patients?${params.toString()}`);
      const data = (await res.json()) as ApiResponse;
      if (!res.ok) {
        setError((data as any)?.message ?? "Erro ao carregar pacientes.");
        setPatients([]);
        setTotal(0);
        setTotalPages(0);
        return;
      }
      setPatients(data.patients ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 0);
    } catch {
      setError("Erro ao carregar pacientes.");
      setPatients([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients(debouncedQuery, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, page, clinicId]);

  const tagsForDisplay = (p: Patient) => {
    const computed = p.computed_tags ?? [];
    const manual = !p.tags ? [] : Array.isArray(p.tags) ? p.tags : String(p.tags).split(",").map((t) => t.trim()).filter(Boolean);
    return [...new Set([...computed, ...manual])];
  };

  const handleBlock = async (patientId: string, blocked: boolean) => {
    setPatchingBlock(patientId);
    try {
      const res = await fetch(`/api/patients/${patientId}?clinic_id=${encodeURIComponent(clinicId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocked }),
      });
      if (res.ok) fetchPatients(debouncedQuery, page);
    } finally {
      setPatchingBlock(null);
    }
  };

  const filteredByTag = useMemo(() => {
    if (!tagFilter) return patients;
    return patients.filter((p) => (p.computed_tags ?? []).includes(tagFilter));
  }, [patients, tagFilter]);

  const subtitle = useMemo(() => {
    if (loading) return "Carregando pacientes...";
    if (total === 0) return "Nenhum paciente encontrado";
    if (total === 1) return "1 paciente encontrado";
    return `${total} pacientes encontrados`;
  }, [loading, total]);

  return (
    <main className="flex-1 overflow-y-auto">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Pacientes</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </header>

      <section className="px-8 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou telefone"
              className="max-w-md rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="">Todas as tags</option>
              <option value="novo">Novo</option>
              <option value="recorrente">Recorrente</option>
              <option value="vip">VIP</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => setShowNewPatientModal(true)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
          >
            Novo Paciente
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        {loading ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-2">Nome / Telefone</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Tags</th>
                  <th className="px-4 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><div className="h-4 w-40 animate-pulse rounded bg-slate-200" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-32 animate-pulse rounded bg-slate-200" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-slate-200" /></td>
                    <td className="px-4 py-3 text-right"><div className="ml-auto h-6 w-12 animate-pulse rounded bg-slate-200" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : patients.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            Nenhum paciente encontrado.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-2">Nome / Telefone</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Consultas</th>
                  <th className="px-4 py-2">Última consulta</th>
                  <th className="px-4 py-2">Tags</th>
                  <th className="px-4 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredByTag.map((p) => {
                  const tags = tagsForDisplay(p);
                  return (
                    <tr
                      key={p.id}
                      className="border-t border-slate-100 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">
                            {p.full_name || "Sem nome"}
                          </span>
                          {p.phone && (
                            <span className="text-xs text-slate-500">
                              {p.phone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-slate-700">
                        {p.email || "-"}
                      </td>
                      <td className="px-4 py-3 align-top text-slate-700">
                        {p.appointments_count ?? 0}
                      </td>
                      <td className="px-4 py-3 align-top text-slate-700">
                        {p.last_appointment_at
                          ? new Date(p.last_appointment_at).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })
                          : "-"}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {tags.length === 0 ? (
                          <span className="text-xs text-slate-400">-</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedPatientId(p.id)}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Ver
                          </button>
                          {p.blocked ? (
                            <button
                              type="button"
                              disabled={patchingBlock === p.id}
                              onClick={() => handleBlock(p.id, false)}
                              className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              Desbloquear
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={patchingBlock === p.id}
                              onClick={() => handleBlock(p.id, true)}
                              className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                            >
                              Bloquear
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
          <span>
            Página {totalPages === 0 ? 0 : page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() =>
                setPage((p) =>
                  totalPages === 0 ? p : Math.min(p + 1, totalPages),
                )
              }
              disabled={totalPages === 0 || page >= totalPages}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Próximo
            </button>
          </div>
        </div>
      </section>

      {showNewPatientModal && (
        <NewPatientModal
          clinicId={clinicId}
          onClose={() => setShowNewPatientModal(false)}
          onSuccess={() => {
            setShowNewPatientModal(false);
            fetchPatients(debouncedQuery, 1);
            setPage(1);
            showToast?.("Paciente criado.", "success");
          }}
          showToast={showToast}
        />
      )}
      {selectedPatientId && (
        <PatientDrawer
          patientId={selectedPatientId}
          clinicId={clinicId}
          onClose={() => setSelectedPatientId(null)}
        />
      )}
    </main>
  );
}

