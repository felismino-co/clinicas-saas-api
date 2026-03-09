"use client";

import { useEffect, useState } from "react";
import ConfirmDialog from "../secretary/ConfirmDialog";

type Service = {
  id: string;
  clinic_id: string;
  name: string | null;
  price?: number | null;
  description?: string | null;
};

type ToastType = "success" | "error" | "info";
type Props = {
  clinicId: string;
  showToast?: (message: string, type: ToastType) => void;
};

export default function ServicesView({ clinicId, showToast }: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/owner/services?clinic_id=${encodeURIComponent(clinicId)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "Erro ao carregar.");
        setServices([]);
        return;
      }
      setServices(data.services ?? []);
    } catch {
      setError("Erro ao carregar.");
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [clinicId]);

  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const handleDelete = async (serviceId: string) => {
    setConfirmRemoveId(serviceId);
  };

  const handleConfirmRemove = async () => {
    const id = confirmRemoveId;
    setConfirmRemoveId(null);
    if (!id) return;
    setError(null);
    try {
      const res = await fetch(`/api/owner/services/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "Erro ao remover.");
        showToast?.(data?.message ?? "Erro ao remover.", "error");
        return;
      }
      fetchServices();
      showToast?.("Serviço removido.", "success");
    } catch {
      setError("Erro ao remover.");
      showToast?.("Erro ao remover.", "error");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_id: clinicId,
          name: newName.trim(),
          duration_minutes: newDuration.trim() ? parseInt(newDuration, 10) : null,
          price: newPrice.trim() ? parseFloat(newPrice.replace(",", ".")) : null,
          description: newDescription.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "Erro ao criar.");
        return;
      }
      setShowModal(false);
      setNewName("");
      setNewDuration("");
      setNewPrice("");
      setNewDescription("");
      fetchServices();
      showToast?.("Serviço criado.", "success");
    } catch {
      setError("Erro ao criar.");
      showToast?.("Erro ao criar.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Serviços</h2>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Novo Serviço
        </button>
      </div>
      {error && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : services.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum serviço cadastrado.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div>
                <p className="font-medium text-slate-900">{s.name || "Sem nome"}</p>
                <p className="text-xs text-slate-500">
                  {s.price != null
                    ? `R$ ${Number(s.price).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "Preço: —"}
                  {s.description ? ` · ${s.description}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(s.id)}
                className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
      {confirmRemoveId && (
        <ConfirmDialog
          message="Remover este serviço?"
          confirmLabel="Remover"
          variant="danger"
          onConfirm={handleConfirmRemove}
          onCancel={() => setConfirmRemoveId(null)}
        />
      )}
      {showModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/40"
            onClick={() => setShowModal(false)}
            aria-hidden
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              Novo Serviço
            </h3>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Nome
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Duração (minutos, opcional)
                </label>
                <input
                  type="number"
                  min={1}
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Preço R$ (opcional)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="0,00"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Descrição (opcional)
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {submitting ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
