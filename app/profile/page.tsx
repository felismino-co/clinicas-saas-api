"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Toast, { type ToastType } from "../secretary/Toast";

const ROLE_LABELS: Record<string, string> = {
  admin_global: "Admin Global",
  admin: "Admin",
  clinic_owner: "Dono",
  owner: "Dono",
  receptionist: "Secretária",
  secretary: "Secretária",
};

const ROLE_BADGE_CLASS: Record<string, string> = {
  admin_global: "bg-violet-100 text-violet-800",
  admin: "bg-violet-100 text-violet-800",
  clinic_owner: "bg-amber-100 text-amber-800",
  owner: "bg-amber-100 text-amber-800",
  receptionist: "bg-sky-100 text-sky-800",
  secretary: "bg-sky-100 text-sky-800",
};

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília" },
  { value: "America/Manaus", label: "Manaus" },
  { value: "America/Rio_Branco", label: "Acre" },
  { value: "America/Noronha", label: "Fernando de Noronha" },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
  return name.slice(0, 2).toUpperCase() || "?";
}

function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 55%, 45%)`;
}

function passwordStrength(pwd: string): "weak" | "medium" | "strong" {
  if (!pwd.length) return "weak";
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return "weak";
  if (score <= 3) return "medium";
  return "strong";
}

export default function ProfilePage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [preferences, setPreferences] = useState({
    email_notifications: true,
    daily_summary: false,
    timezone: "America/Sao_Paulo",
  });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType) => setToast({ message, type });

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => {
        if (!res.ok) {
          router.replace("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user) {
          setFullName(data.user.full_name ?? "");
          setEmail(data.user.email ?? "");
          setPhone(data.user.phone ?? "");
          setRole(data.user.role ?? "secretary");
          setCreatedAt(data.user.created_at ?? null);
          if (data.user.preferences) {
            setPreferences({
              email_notifications: data.user.preferences.email_notifications !== false,
              daily_summary: data.user.preferences.daily_summary === true,
              timezone: data.user.preferences.timezone ?? "America/Sao_Paulo",
            });
          }
        }
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName.trim(), phone: phone.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast((data as { message?: string }).message ?? "Erro ao salvar.", "error");
        return;
      }
      showToast("Perfil atualizado.", "success");
    } catch {
      showToast("Erro ao salvar.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast("Nova senha e confirmação não conferem.", "error");
      return;
    }
    const reqs = { len: newPassword.length >= 8, upper: /[A-Z]/.test(newPassword), num: /[0-9]/.test(newPassword), special: /[^A-Za-z0-9]/.test(newPassword) };
    if (!reqs.len || !reqs.upper || !reqs.num || !reqs.special) {
      showToast("A senha deve atender a todos os requisitos.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast((data as { message?: string }).message ?? "Erro ao alterar senha.", "error");
        return;
      }
      showToast("Senha alterada.", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      showToast("Erro ao alterar senha.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast((data as { message?: string }).message ?? "Erro ao salvar preferências.", "error");
        return;
      }
      showToast("Preferências salvas.", "success");
    } catch {
      showToast("Erro ao salvar preferências.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const pwdStrength = useMemo(() => passwordStrength(newPassword), [newPassword]);
  const pwdReqs = useMemo(() => ({
    len: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    num: /[0-9]/.test(newPassword),
    special: /[^A-Za-z0-9]/.test(newPassword),
  }), [newPassword]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Carregando...</p>
      </div>
    );
  }

  const roleLabel = ROLE_LABELS[role] ?? role;
  const roleClass = ROLE_BADGE_CLASS[role] ?? "bg-slate-100 text-slate-700";
  const initials = getInitials(fullName || email || "U");
  const avatarColor = nameToColor(fullName || email || "U");

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold text-slate-900">Meu perfil</h1>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Coluna esquerda — info do perfil */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col items-center text-center">
                <div
                  className="flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold text-white"
                  style={{ backgroundColor: avatarColor }}
                >
                  {initials}
                </div>
                <button
                  type="button"
                  className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Alterar foto
                </button>
                <h2 className="mt-4 text-lg font-semibold text-slate-900">{fullName || "Sem nome"}</h2>
                <p className="mt-1 text-sm text-slate-600">{email}</p>
                <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-medium ${roleClass}`}>
                  {roleLabel}
                </span>
                {createdAt && (
                  <p className="mt-3 text-xs text-slate-500">
                    Conta criada em {new Date(createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Coluna direita — formulários */}
          <div className="space-y-6 lg:col-span-2">
            {/* Seção 1 — Dados pessoais */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Dados pessoais</h3>
              <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Nome completo</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    value={email}
                    readOnly
                    className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Telefone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Salvar dados
                </button>
              </form>
            </div>

            {/* Seção 2 — Segurança */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Segurança</h3>
              <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Senha atual</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Nova senha</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <div className="mt-1 flex gap-1">
                    <div className={`h-1 flex-1 rounded ${pwdStrength === "weak" ? "bg-rose-400" : "bg-slate-200"}`} />
                    <div className={`h-1 flex-1 rounded ${pwdStrength === "medium" || pwdStrength === "strong" ? "bg-amber-400" : "bg-slate-200"}`} />
                    <div className={`h-1 flex-1 rounded ${pwdStrength === "strong" ? "bg-emerald-500" : "bg-slate-200"}`} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {pwdStrength === "weak" && "Fraca"}
                    {pwdStrength === "medium" && "Média"}
                    {pwdStrength === "strong" && "Forte"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Confirmar nova senha</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <ul className="space-y-1 text-sm text-slate-600">
                  <li className={pwdReqs.len ? "text-emerald-600" : ""}>✓ 8+ caracteres</li>
                  <li className={pwdReqs.upper ? "text-emerald-600" : ""}>✓ Uma letra maiúscula</li>
                  <li className={pwdReqs.num ? "text-emerald-600" : ""}>✓ Um número</li>
                  <li className={pwdReqs.special ? "text-emerald-600" : ""}>✓ Um caractere especial</li>
                </ul>
                <button
                  type="submit"
                  disabled={submitting || !pwdReqs.len || !pwdReqs.upper || !pwdReqs.num || !pwdReqs.special || newPassword !== confirmPassword}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Alterar senha
                </button>
              </form>
            </div>

            {/* Seção 3 — Preferências */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Preferências</h3>
              <form onSubmit={handleSavePreferences} className="mt-4 space-y-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={preferences.email_notifications}
                    onChange={(e) => setPreferences((p) => ({ ...p, email_notifications: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  <span className="text-sm text-slate-700">Receber notificações por email</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={preferences.daily_summary}
                    onChange={(e) => setPreferences((p) => ({ ...p, daily_summary: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  <span className="text-sm text-slate-700">Receber resumo diário</span>
                </label>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Fuso horário</label>
                  <select
                    value={preferences.timezone}
                    onChange={(e) => setPreferences((p) => ({ ...p, timezone: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Salvar preferências
                </button>
              </form>
            </div>

            {/* Seção 4 — Sessões (visual) */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Sessões ativas</h3>
              <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900">Sessão atual</p>
                <p className="text-xs text-slate-500">Chrome · Windows · Agora</p>
              </div>
              <button
                type="button"
                className="mt-4 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Encerrar todas as outras sessões
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← Voltar
          </button>
        </div>
      </div>
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
