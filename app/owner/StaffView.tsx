"use client";

import { useEffect, useState } from "react";

type StaffMember = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  active: boolean;
  last_activity_at: string | null;
  created_at: string;
};

type StaffViewProps = {
  clinicId: string;
  showToast?: (message: string, type: "success" | "error" | "info") => void;
};

export default function StaffView({ clinicId, showToast }: StaffViewProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/owner/staff?clinic_id=${encodeURIComponent(clinicId)}`);
      const data = await res.json();
      if (res.ok) setStaff(data.staff ?? []);
      else showToast?.(data.message ?? "Erro ao carregar equipe.", "error");
    } catch {
      showToast?.("Erro ao carregar equipe.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clinicId) fetchStaff();
  }, [clinicId]);

  const handleCreate = async (payload: { full_name: string; email: string; password: string; role: string }) => {
    try {
      const res = await fetch("/api/owner/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinic_id: clinicId, ...payload }),
      });
      const data = await res.json();
      if (res.ok) {
        setStaff(data.staff ?? []);
        setShowNewModal(false);
        showToast?.("Funcionário criado.", "success");
      } else {
        showToast?.(data.message ?? "Erro ao criar.", "error");
      }
    } catch {
      showToast?.("Erro ao criar funcionário.", "error");
    }
  };

  const handleUpdate = async (id: string, payload: { full_name?: string; email?: string; password?: string; active?: boolean }) => {
    try {
      const res = await fetch(`/api/owner/staff/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.staff) setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, ...data.staff } : s)));
        setEditingId(null);
        showToast?.("Atualizado.", "success");
      } else {
        showToast?.(data.message ?? "Erro ao atualizar.", "error");
      }
    } catch {
      showToast?.("Erro ao atualizar.", "error");
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const res = await fetch(`/api/owner/staff/${id}`, { method: "DELETE" });
      if (res.ok) {
        setStaff((prev) => prev.filter((s) => s.id !== id));
        setRemovingId(null);
        showToast?.("Funcionário removido.", "success");
      } else {
        const data = await res.json();
        showToast?.(data.message ?? "Erro ao remover.", "error");
      }
    } catch {
      showToast?.("Erro ao remover.", "error");
    }
  };

  const roleLabel = (r: string) => (r === "receptionist" ? "Secretária" : r === "attendant" ? "Atendente" : r);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-800">Equipe</h2>
        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Novo Funcionário
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Carregando...</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Função</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Última atividade</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Nenhum funcionário. Clique em &quot;Novo Funcionário&quot; para adicionar.
                  </td>
                </tr>
              ) : (
                staff.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-slate-900">{s.full_name}</td>
                    <td className="px-4 py-3 text-slate-600">{s.email}</td>
                    <td className="px-4 py-3 text-slate-600">{roleLabel(s.role)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          s.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {s.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {s.last_activity_at
                        ? new Date(s.last_activity_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingId(s.id)}
                        className="mr-2 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemovingId(s.id)}
                        className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showNewModal && (
        <NewStaffModal
          onClose={() => setShowNewModal(false)}
          onSubmit={handleCreate}
        />
      )}
      {editingId && (
        <EditStaffModal
          staff={staff.find((s) => s.id === editingId)!}
          onClose={() => setEditingId(null)}
          onSave={(payload) => handleUpdate(editingId, payload)}
        />
      )}
      {removingId && (
        <ConfirmRemoveModal
          name={staff.find((s) => s.id === removingId)?.full_name ?? ""}
          onClose={() => setRemovingId(null)}
          onConfirm={() => handleRemove(removingId)}
        />
      )}
    </div>
  );
}

function NewStaffModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (p: { full_name: string; email: string; password: string; role: string }) => void;
}) {
  const [full_name, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("receptionist");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">Novo Funcionário</h3>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (full_name.trim() && email.trim() && password.trim()) {
              onSubmit({ full_name: full_name.trim(), email: email.trim(), password, role });
            }
          }}
        >
          <div>
            <label className="block text-xs font-medium text-slate-500">Nome completo</label>
            <input
              type="text"
              value={full_name}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Senha inicial</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Função</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="receptionist">Secretária</option>
              <option value="attendant">Atendente</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Criar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditStaffModal({
  staff,
  onClose,
  onSave,
}: {
  staff: StaffMember;
  onClose: () => void;
  onSave: (p: { full_name?: string; email?: string; password?: string; active?: boolean }) => void;
}) {
  const [full_name, setFullName] = useState(staff.full_name);
  const [email, setEmail] = useState(staff.email);
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(staff.active);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">Editar Funcionário</h3>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const payload: { full_name?: string; email?: string; password?: string; active?: boolean } = {
              full_name: full_name.trim(),
              email: email.trim(),
              active,
            };
            if (password.trim()) payload.password = password.trim();
            onSave(payload);
          }}
        >
          <div>
            <label className="block text-xs font-medium text-slate-500">Nome completo</label>
            <input
              type="text"
              value={full_name}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Nova senha (deixe em branco para manter)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              minLength={6}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="active" className="text-sm text-slate-700">Ativo</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmRemoveModal({ name, onClose, onConfirm }: { name: string; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">Remover funcionário</h3>
        <p className="mt-2 text-sm text-slate-600">
          Deseja remover <strong>{name}</strong> da equipe? O usuário não poderá mais acessar o painel desta clínica.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">
            Remover
          </button>
        </div>
      </div>
    </div>
  );
}
