"use client";

import { useEffect, useState } from "react";

type User = {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  clinic_id: string | null;
  clinic_name: string | null;
  active: boolean;
};

function RoleBadge({ role }: { role: string }) {
  const r = role.toLowerCase();
  const styles: Record<string, string> = {
    admin_global: "bg-violet-100 text-violet-800",
    admin: "bg-violet-100 text-violet-800",
    clinic_owner: "bg-amber-100 text-amber-800",
    owner: "bg-amber-100 text-amber-800",
    receptionist: "bg-sky-100 text-sky-800",
    secretary: "bg-sky-100 text-sky-800",
  };
  const label = r === "admin_global" ? "Admin" : r === "clinic_owner" ? "Owner" : r === "receptionist" ? "Secretária" : role;
  const cn = styles[r] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cn}`}>
      {label}
    </span>
  );
}

export default function UsersView() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("secretary");
  const [clinicId, setClinicId] = useState("");
  const [clinics, setClinics] = useState<{ id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = roleFilter
        ? `/api/admin/users?role=${encodeURIComponent(roleFilter)}`
        : "/api/admin/users";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Erro ao carregar usuários.");
        setUsers([]);
        return;
      }
      setUsers(data.users ?? []);
    } catch {
      setError("Erro ao carregar usuários.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  useEffect(() => {
    fetch("/api/admin/clinics")
      .then((r) => r.json())
      .then((d) => setClinics(d.clinics ?? []))
      .catch(() => setClinics([]));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          role,
          clinic_id: clinicId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Erro ao criar usuário.");
        return;
      }
      setShowModal(false);
      setEmail("");
      setPassword("");
      setClinicId("");
      fetchUsers();
    } catch {
      setError("Erro ao criar usuário.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <p className="mb-4 text-sm text-slate-600">
        Usuários são criados automaticamente ao cadastrar uma clínica ou podem ser adicionados manualmente abaixo.
      </p>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">Usuários</h1>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Novo Usuário
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder="Buscar por nome ou email"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-64 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Filtro por role:
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 text-slate-900"
          >
            <option value="">Todos</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
            <option value="secretary">Secretary</option>
            <option value="admin_global">Admin Global</option>
            <option value="clinic_owner">Clinic Owner</option>
            <option value="receptionist">Receptionist</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Carregando...
        </div>
      ) : (() => {
        const q = searchQuery.trim().toLowerCase();
        const filtered = q
          ? users.filter(
              (u) =>
                (u.full_name ?? "").toLowerCase().includes(q) ||
                (u.email ?? "").toLowerCase().includes(q)
            )
          : users;
        if (filtered.length === 0) {
          return (
            <div className="rounded-xl border border-slate-200 bg-white p-8">
              {users.length === 0 ? (
                <div className="text-center text-slate-600 max-w-md mx-auto">
                  <p className="font-medium text-slate-900 mb-2">Nenhum usuário cadastrado</p>
                  <p className="text-sm mb-4">
                    Usuários são criados automaticamente quando uma clínica é cadastrada (dono e secretária).
                    Você também pode adicionar um novo usuário manualmente pelo botão acima.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Novo Usuário
                  </button>
                </div>
              ) : (
                <p className="text-center text-slate-500">Nenhum resultado para &quot;{searchQuery}&quot;</p>
              )}
            </div>
          );
        }
        return (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Nome / Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Clínica
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                    {(u.full_name || u.email) ?? u.user_id}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                    {u.clinic_id ? (u.clinic_name ?? "—") : "Admin Global"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                    {u.active ? "Ativo" : "Inativo"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        );
      })()}

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
              <h2 className="text-lg font-semibold text-slate-900">Novo Usuário</h2>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col gap-4 px-6 py-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                >
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                  <option value="secretary">Secretary</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Clínica</label>
                <select
                  value={clinicId}
                  onChange={(e) => setClinicId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                >
                  <option value="">—</option>
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
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
