"use client";

import { useState, useMemo } from "react";
import { getContextTemplate, type ClinicType } from "../../lib/ai-templates";

type Professional = { full_name: string; specialty: string };
type Service = { name: string; duration_minutes: string; price: string };

const PLANS = [
  { value: "trial", label: "Trial (30 dias grátis)" },
  { value: "basico", label: "Básico R$197" },
  { value: "pro", label: "Pro R$397" },
  { value: "enterprise", label: "Enterprise R$797" },
];

const TONES = [
  { value: "humanizado", label: "Humanizado" },
  { value: "formal", label: "Formal" },
  { value: "descontraído", label: "Descontraído" },
];

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type Props = {
  onClose: () => void;
  onSuccess: () => void;
};

export default function NewClinicWizard({ onClose, onSuccess }: Props) {
  const [clinicName, setClinicName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [slug, setSlug] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [zapiInstanceId, setZapiInstanceId] = useState("");
  const [zapiToken, setZapiToken] = useState("");
  const [professionals, setProfessionals] = useState<Professional[]>([{ full_name: "", specialty: "" }]);
  const [services, setServices] = useState<Service[]>([{ name: "", duration_minutes: "30", price: "" }]);
  const [assistantName, setAssistantName] = useState("Ana");
  const [tone, setTone] = useState("humanizado");
  const [clinicType, setClinicType] = useState<ClinicType>("geral");
  const [context, setContext] = useState("");
  const [reminder48, setReminder48] = useState(true);
  const [reminder24, setReminder24] = useState(true);
  const [postConsultation, setPostConsultation] = useState(true);
  const [reactivation, setReactivation] = useState(true);
  const [plan, setPlan] = useState("trial");
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState("");
  const [progressStep, setProgressStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedStep, setFailedStep] = useState<number | null>(null);
  const [expressMode, setExpressMode] = useState(true);
  const [result, setResult] = useState<{
    booking_url: string;
    owner_email: string;
    owner_password: string;
    dashboard_url: string;
    clinic_slug: string;
  } | null>(null);
  const [testZapiLoading, setTestZapiLoading] = useState(false);
  const [testZapiResult, setTestZapiResult] = useState<string | null>(null);

  const derivedSlug = useMemo(() => (clinicName.trim() ? slugFromName(clinicName) : ""), [clinicName]);
  const displaySlug = slug.trim() || derivedSlug;

  const addProfessional = () => {
    if (professionals.length < 5) setProfessionals((p) => [...p, { full_name: "", specialty: "" }]);
  };
  const addService = () => {
    if (services.length < 5) setServices((s) => [...s, { name: "", duration_minutes: "30", price: "" }]);
  };
  const updateProfessional = (i: number, field: keyof Professional, value: string) => {
    setProfessionals((p) => p.map((x, j) => (j === i ? { ...x, [field]: value } : x)));
  };
  const updateService = (i: number, field: keyof Service, value: string) => {
    setServices((s) => s.map((x, j) => (j === i ? { ...x, [field]: value } : x)));
  };

  const loadTemplate = () => {
    setContext(getContextTemplate(clinicType));
  };

  const handleTestZapi = async () => {
    if (!zapiInstanceId.trim() || !zapiToken.trim()) return;
    setTestZapiLoading(true);
    setTestZapiResult(null);
    try {
      const res = await fetch(
        `/api/admin/test-zapi?instance_id=${encodeURIComponent(zapiInstanceId)}&token=${encodeURIComponent(zapiToken)}`,
      );
      const data = await res.json();
      if (data.connected) setTestZapiResult(`Conectado: ${data.phone ?? "OK"}`);
      else setTestZapiResult("Falha: " + (data.error ?? "Não conectado"));
    } catch {
      setTestZapiResult("Erro ao testar.");
    } finally {
      setTestZapiLoading(false);
    }
  };

  const STEPS = [
    "Criando clínica...",
    "Criando usuário...",
    "Vinculando à clínica...",
    "Profissionais",
    "Serviços",
    "Configuração IA",
    "WhatsApp",
  ];

  const buildBody = () => ({
    clinic: {
      name: clinicName.trim(),
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      email: ownerEmail.trim(),
      owner_password: ownerPassword,
      slug: displaySlug || undefined,
    },
    whatsapp:
      whatsappNumber.trim() || zapiInstanceId.trim() || zapiToken.trim()
        ? {
            whatsapp_number: whatsappNumber.trim() || undefined,
            zapi_instance_id: zapiInstanceId.trim() || undefined,
            zapi_token: zapiToken.trim() || undefined,
          }
        : undefined,
    professionals: professionals.filter((p) => p.full_name.trim()).map((p) => ({ full_name: p.full_name.trim(), specialty: p.specialty.trim() || undefined })),
    services: services
      .filter((s) => s.name.trim())
      .map((s) => ({
        name: s.name.trim(),
        duration_minutes: s.duration_minutes ? parseInt(s.duration_minutes, 10) : undefined,
        price: s.price ? parseFloat(s.price.replace(",", ".")) : undefined,
      })),
    ai: {
      assistant_name: assistantName.trim() || "Ana",
      tone,
      context: context.trim() || undefined,
      automations: { reminder_48h: reminder48, reminder_24h: reminder24, post_consultation: postConsultation, reactivation },
    },
    plan,
  });

  const handleSubmit = async () => {
    if (!clinicName.trim() || !ownerEmail.trim() || !ownerPassword.trim()) {
      setErrorMessage("Preencha nome da clínica, email e senha do dono.");
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    setFailedStep(null);
    setProgress("Criando clínica...");
    setProgressStep(1);

    const stepInterval = window.setInterval(() => {
      setProgressStep((s) => (s < 7 ? s + 1 : s));
    }, 700);

    try {
      const res = await fetch("/api/admin/setup-clinic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expressMode ? { clinic: { name: clinicName.trim(), email: ownerEmail.trim(), owner_password: ownerPassword } } : buildBody()),
      });
      const data = await res.json();
      clearInterval(stepInterval);
      setProgressStep(7);

      if (!res.ok) {
        const msg = data?.message ?? "Erro ao ativar clínica.";
        setErrorMessage(msg);
        setFailedStep(typeof data?.step === "number" ? data.step : null);
        setSubmitting(false);
        return;
      }

      setProgress("Concluído!");
      setResult({
        booking_url: data.booking_url ?? "",
        owner_email: data.owner_email ?? ownerEmail,
        owner_password: ownerPassword,
        dashboard_url: data.dashboard_url ?? "/owner",
        clinic_slug: data.clinic_slug ?? "",
      });
    } catch (err) {
      clearInterval(stepInterval);
      setErrorMessage(err instanceof Error ? err.message : "Erro de conexão. Tente novamente.");
      setFailedStep(null);
      setSubmitting(false);
      return;
    } finally {
      clearInterval(stepInterval);
      setSubmitting(false);
    }
  };

  const copyCredentials = () => {
    const text = [
      `Email: ${result?.owner_email ?? ""}`,
      `Senha: ${result?.owner_password ?? ""}`,
      ``,
      `Link de agendamento: ${result?.booking_url ?? ""}`,
      `Painel: ${result?.dashboard_url ?? ""}`,
    ].join("\n");
    void navigator.clipboard.writeText(text).then(() => alert("Credenciais copiadas!"));
  };

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
        <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-slate-900">Clínica criada com sucesso! 🎉</h2>
          <div className="mt-4 space-y-3 rounded-lg bg-slate-50 p-4 text-sm">
            <div className="rounded-md border-2 border-amber-200 bg-amber-50 p-3">
              <p className="font-semibold text-amber-900">Credenciais do dono</p>
              <p className="mt-1 text-slate-800"><strong>Email:</strong> {result.owner_email}</p>
              <p className="mt-0.5 text-slate-800"><strong>Senha:</strong> {result.owner_password}</p>
            </div>
            <p><strong>Link de agendamento:</strong> <a href={result.booking_url} className="text-indigo-600 underline" target="_blank" rel="noreferrer">{result.clinic_slug ? `/booking/${result.clinic_slug}` : result.booking_url}</a></p>
            <p><strong>Painel:</strong> <a href={result.dashboard_url} className="text-indigo-600 underline" target="_blank" rel="noreferrer">{result.dashboard_url}</a></p>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={copyCredentials} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Copiar credenciais
            </button>
            <a href="/owner" target="_blank" rel="noreferrer" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Abrir painel
            </a>
            <button type="button" onClick={() => { onSuccess(); onClose(); }} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
              Fechar
            </button>
          </div>
          {expressMode && (
            <p className="mt-4 text-center text-sm text-slate-500">
              Deseja configurar mais detalhes? Feche e edite a clínica pelo painel admin.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-100">
      <div className="min-h-screen py-8 px-4">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-slate-900">Nova clínica</h1>
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200">
              Cancelar
            </button>
          </div>

          {expressMode ? (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">Modo Express — apenas o essencial</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Nome da clínica *</label>
                  <input type="text" value={clinicName} onChange={(e) => setClinicName(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Ex: Clínica São Paulo" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Email do dono *</label>
                  <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="dono@email.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Senha inicial do dono *</label>
                  <input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Mínimo 6 caracteres" />
                </div>
              </div>
              <button type="button" onClick={() => setExpressMode(false)} className="mt-4 text-sm text-indigo-600 hover:underline">
                Configurar todos os detalhes (telefone, profissionais, WhatsApp, etc.)
              </button>
            </section>
          ) : (
            <>
          {/* Seção 1 — Dados da clínica (obrigatórios: nome, email dono, senha) */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase text-slate-500">1. Dados da clínica</h2>
              <button type="button" onClick={() => setExpressMode(true)} className="text-xs text-slate-500 hover:underline">Modo Express</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Nome da clínica *</label>
                <input type="text" value={clinicName} onChange={(e) => setClinicName(e.target.value)} required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Telefone <span className="text-slate-400 font-normal">(opcional)</span></label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Email do dono *</label>
                  <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Endereço <span className="text-slate-400 font-normal">(opcional)</span></label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Senha inicial do dono *</label>
                <input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Slug (URL) <span className="text-slate-400 font-normal">(opcional)</span></label>
                <input type="text" value={slug || derivedSlug} onChange={(e) => setSlug(e.target.value)} placeholder={derivedSlug} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>
          </section>

          {/* Seção 2 — WhatsApp (opcional) */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">2. WhatsApp <span className="text-slate-400 font-normal">(opcional)</span></h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Número WhatsApp</label>
                <input type="text" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="5511999999999" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Instância Z-API (instance_id)</label>
                <input type="text" value={zapiInstanceId} onChange={(e) => setZapiInstanceId(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Token Z-API</label>
                <input type="text" value={zapiToken} onChange={(e) => setZapiToken(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <button type="button" onClick={handleTestZapi} disabled={testZapiLoading || !zapiInstanceId.trim() || !zapiToken.trim()} className="rounded-lg border border-indigo-600 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">
                {testZapiLoading ? "Testando..." : "Testar conexão"}
              </button>
              {testZapiResult && <p className="text-sm text-slate-600">{testZapiResult}</p>}
            </div>
          </section>

          {/* Seção 3 — Profissionais (opcional) */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">3. Profissionais <span className="text-slate-400 font-normal">(opcional)</span></h2>
            {professionals.map((p, i) => (
              <div key={i} className="mb-3 flex gap-2">
                <input type="text" value={p.full_name} onChange={(e) => updateProfessional(i, "full_name", e.target.value)} placeholder="Nome" className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
                <input type="text" value={p.specialty} onChange={(e) => updateProfessional(i, "specialty", e.target.value)} placeholder="Especialidade" className="w-40 rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
            ))}
            <button type="button" onClick={addProfessional} disabled={professionals.length >= 5} className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">+ Adicionar</button>
          </section>

          {/* Seção 4 — Serviços (opcional) */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">4. Serviços <span className="text-slate-400 font-normal">(opcional)</span></h2>
            {services.map((s, i) => (
              <div key={i} className="mb-3 flex gap-2">
                <input type="text" value={s.name} onChange={(e) => updateService(i, "name", e.target.value)} placeholder="Nome" className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
                <input type="number" value={s.duration_minutes} onChange={(e) => updateService(i, "duration_minutes", e.target.value)} placeholder="Min" className="w-20 rounded-md border border-slate-300 px-3 py-2 text-sm" />
                <input type="text" value={s.price} onChange={(e) => updateService(i, "price", e.target.value)} placeholder="Preço" className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
            ))}
            <button type="button" onClick={addService} disabled={services.length >= 5} className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">+ Adicionar</button>
          </section>

          {/* Seção 5 — IA (opcional) */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">5. IA <span className="text-slate-400 font-normal">(opcional)</span></h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Nome do assistente</label>
                  <input type="text" value={assistantName} onChange={(e) => setAssistantName(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Tom</label>
                  <select value={tone} onChange={(e) => setTone(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                    {TONES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Tipo de clínica</label>
                <select value={clinicType} onChange={(e) => setClinicType(e.target.value as ClinicType)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  <option value="geral">Geral</option>
                  <option value="odontologia">Odontologia</option>
                  <option value="estetica">Estética</option>
                  <option value="cirurgia">Cirurgia</option>
                  <option value="nutricao">Nutrição</option>
                </select>
              </div>
              <div>
                <button type="button" onClick={loadTemplate} className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-50">Carregar template</button>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Contexto base</label>
                <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={5} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2"><input type="checkbox" checked={reminder48} onChange={(e) => setReminder48(e.target.checked)} /> Lembrete 48h</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={reminder24} onChange={(e) => setReminder24(e.target.checked)} /> Lembrete 24h</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={postConsultation} onChange={(e) => setPostConsultation(e.target.checked)} /> Pós-consulta</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={reactivation} onChange={(e) => setReactivation(e.target.checked)} /> Reativação</label>
              </div>
            </div>
          </section>

          {/* Seção 6 — Plano (opcional) */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">6. Plano <span className="text-slate-400 font-normal">(opcional)</span></h2>
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              {PLANS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </section>

          </>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {errorMessage && (
              <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                {failedStep != null && <p className="font-semibold">Erro na etapa {failedStep} de 7</p>}
                <p>{errorMessage}</p>
              </div>
            )}

            {submitting && (
              <div className="mb-4 space-y-2">
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${(progressStep / 7) * 100}%` }} />
                </div>
                <ul className="space-y-1 text-sm text-slate-600">
                  {STEPS.map((label, i) => {
                    const stepNum = i + 1;
                    const done = progressStep > stepNum;
                    const current = progressStep === stepNum;
                    const failed = failedStep === stepNum;
                    return (
                      <li key={stepNum} className="flex items-center gap-2">
                        {done && <span className="text-emerald-600">✓</span>}
                        {current && !failed && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />}
                        {failed && <span className="text-rose-600">✗</span>}
                        {!done && !current && !failed && <span className="text-slate-300">○</span>}
                        <span className={failed ? "text-rose-700 font-medium" : done ? "text-emerald-700" : ""}>{label}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4">
              {progress && !submitting && <p className="text-sm text-slate-600">{progress}</p>}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-6 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Criando... (etapa {progressStep} de 7)
                  </>
                ) : errorMessage ? (
                  "Tentar novamente"
                ) : expressMode ? (
                  "Criar clínica agora"
                ) : (
                  "Ativar clínica"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
