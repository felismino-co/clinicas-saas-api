"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Plan = { id: string; name: string; price_month: number; description?: string; max_providers?: number | null };

function planNameToKey(name: string): string {
  const n = (name ?? "").toLowerCase();
  if (n.includes("trial") || n.includes("grátis")) return "trial";
  if (n.includes("básico") || n === "basico") return "basico";
  if (n === "pro") return "pro";
  if (n.includes("enterprise")) return "enterprise";
  return n.replace(/\s+/g, "_");
}

export default function LandingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [yearly, setYearly] = useState(false);

  useEffect(() => {
    fetch("/api/admin/plans")
      .then((res) => res.json())
      .then((data) => setPlans(data.plans ?? []))
      .catch(() => setPlans([]));
  }, []);

  const priceByKey: Record<string, number> = {};
  plans.forEach((p) => {
    priceByKey[planNameToKey(p.name)] = Number(p.price_month) || 0;
  });
  const planPrice = (key: string): string => {
    if (key === "trial") return "Grátis 15 dias";
    const num = priceByKey[key];
    if (num == null || Number.isNaN(num)) return "—";
    const value = yearly ? Math.round(num * 0.8 * 12) / 12 : num;
    return `R$ ${value.toLocaleString("pt-BR")}/mês`;
  };

  const displayPlans = [
    { key: "trial", name: "Trial", features: ["15 dias grátis", "1 profissional", "Até 50 agendamentos/mês"] },
    { key: "pro", name: "Pro", popular: true, features: ["Até 5 profissionais", "Agendamentos ilimitados", "IA + Campanhas", "Relatórios avançados"] },
    { key: "enterprise", name: "Enterprise", features: ["Profissionais ilimitados", "Suporte dedicado", "IA personalizada"] },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-blue-800 px-4 py-12 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl text-center lg:text-left">
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Sua clínica atendendo 24h no WhatsApp
              </h1>
              <p className="mt-4 text-base text-emerald-100 sm:text-lg">
                IA que agenda, confirma e reativa pacientes automaticamente. Sem contratar mais funcionários.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Link
                  href="/onboarding"
                  className="inline-block rounded-lg bg-white px-6 py-3 text-center text-base font-semibold text-emerald-700 shadow-lg transition hover:bg-emerald-50 sm:px-8"
                >
                  Começar grátis por 15 dias
                </Link>
                <a
                  href="#features"
                  className="inline-block rounded-lg border-2 border-white px-6 py-3 text-center text-base font-semibold text-white transition hover:bg-white/10 sm:px-8"
                >
                  Ver demonstração
                </a>
              </div>
            </div>
            <div className="w-full max-w-md flex-shrink-0">
              <div className="rounded-xl border-2 border-white/20 bg-white/10 p-4 shadow-xl backdrop-blur sm:p-6">
                <div className="rounded-lg bg-slate-800/80 p-3 font-mono text-xs text-emerald-300">
                  Painel • Agenda do dia
                </div>
                <div className="mt-2 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-2 rounded bg-white/10 px-2 py-2">
                      <div className="h-8 w-8 rounded-full bg-emerald-400/30" />
                      <div className="flex-1">
                        <div className="h-2 w-3/4 rounded bg-white/30" />
                        <div className="mt-1 h-2 w-1/2 rounded bg-white/20" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Problema */}
      <section className="border-b border-slate-200 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Sua recepcionista não consegue atender todo mundo
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-left">
              <p className="font-medium text-slate-900">Pacientes esperando resposta por horas</p>
              <p className="mt-2 text-sm text-slate-600">WhatsApp lotado e ninguém consegue responder a tempo.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-left">
              <p className="font-medium text-slate-900">Consultas canceladas por falta de lembrete</p>
              <p className="mt-2 text-sm text-slate-600">Pacientes esquecem e não aparecem. Sua agenda sofre.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-left">
              <p className="font-medium text-slate-900">Pacientes que somem e nunca voltam</p>
              <p className="mt-2 text-sm text-slate-600">Sem reativação, você perde receita recorrente.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-b border-slate-200 bg-slate-50 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Uma IA que trabalha por você</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: "🤖", title: "Atendimento automático 24h", desc: "Respostas instantâneas a qualquer hora." },
              { icon: "📅", title: "Agendamento pelo WhatsApp", desc: "Paciente agenda sem ligar ou esperar." },
              { icon: "⏰", title: "Lembretes automáticos", desc: "Reduza no-show com lembretes na hora." },
              { icon: "🔄", title: "Reativação de pacientes inativos", desc: "Traga de volta quem sumiu." },
              { icon: "📊", title: "Dashboard em tempo real", desc: "Métricas e conversões na palma da mão." },
              { icon: "🔗", title: "Link de agendamento online", desc: "Paciente agenda pelo celular em segundos." },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="text-3xl">{f.icon}</span>
                <h3 className="mt-3 font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="border-b border-slate-200 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">Como funciona</h2>
          <div className="mt-10 flex flex-col gap-10 sm:flex-row sm:justify-between sm:gap-6">
            <div className="flex flex-1 flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">1</div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">Conecte seu WhatsApp</h3>
              <p className="mt-2 max-w-xs text-sm text-slate-600">Escaneie o QR code e sua IA começa a funcionar em minutos.</p>
            </div>
            <div className="hidden shrink-0 sm:block sm:w-12 sm:self-center">
              <div className="h-0.5 w-full bg-slate-200" aria-hidden />
            </div>
            <div className="flex flex-1 flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">2</div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">Configure sua clínica</h3>
              <p className="mt-2 max-w-xs text-sm text-slate-600">Adicione médicos, serviços e horários de atendimento.</p>
            </div>
            <div className="hidden shrink-0 sm:block sm:w-12 sm:self-center">
              <div className="h-0.5 w-full bg-slate-200" aria-hidden />
            </div>
            <div className="flex flex-1 flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">3</div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">Comece a atender</h3>
              <p className="mt-2 max-w-xs text-sm text-slate-600">A IA responde, agenda e confirma automaticamente.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Planos */}
      <section className="border-b border-slate-200 bg-slate-50 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Planos</h2>
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className={`text-sm font-medium ${!yearly ? "text-slate-900" : "text-slate-500"}`}>Mensal</span>
            <button
              type="button"
              role="switch"
              aria-checked={yearly}
              onClick={() => setYearly((v) => !v)}
              className="relative h-6 w-11 rounded-full bg-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 data-[state=checked]:bg-emerald-600"
              style={{ backgroundColor: yearly ? "rgb(5 150 105)" : "rgb(203 213 225)" }}
            >
              <span
                className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform"
                style={{ transform: yearly ? "translateX(20px)" : "translateX(0)" }}
              />
            </button>
            <span className={`text-sm font-medium ${yearly ? "text-slate-900" : "text-slate-500"}`}>Anual</span>
            {yearly && <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">20% off</span>}
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {displayPlans.map((p) => (
              <div
                key={p.key}
                className={`relative rounded-xl border-2 bg-white p-6 text-left ${
                  p.popular ? "border-emerald-500 shadow-lg" : "border-slate-200"
                }`}
              >
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-0.5 text-xs font-medium text-white">
                    Mais popular
                  </span>
                )}
                <h3 className="font-semibold text-slate-900">{p.name}</h3>
                <p className="mt-2 text-2xl font-bold text-slate-900">{planPrice(p.key)}</p>
                <ul className="mt-4 space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="text-sm text-slate-600">• {f}</li>
                  ))}
                </ul>
                <Link
                  href={p.key === "enterprise" ? "/owner" : "/onboarding"}
                  className={`mt-6 block rounded-lg py-2.5 text-center text-sm font-medium ${
                    p.popular
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {p.key === "enterprise" ? "Falar com consultor" : "Começar agora"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Felismino Company */}
      <section className="border-b border-slate-200 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-white shadow-xl sm:p-8">
            <h2 className="text-xl font-bold sm:text-2xl">Quer ir além? Nossa agência cuida do marketing da sua clínica</h2>
            <p className="mt-2 text-violet-100">Felismino Company — Site, Redes Sociais e Tráfego Pago.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-white/10 p-4 backdrop-blur">
                <p className="font-semibold">🌐 Site Profissional</p>
                <p className="mt-1 text-sm text-white/90">Presença digital que converte.</p>
              </div>
              <div className="rounded-lg bg-white/10 p-4 backdrop-blur">
                <p className="font-semibold">📱 Redes Sociais</p>
                <p className="mt-1 text-sm text-white/90">Gestão de Instagram e Facebook.</p>
              </div>
              <div className="rounded-lg bg-white/10 p-4 backdrop-blur">
                <p className="font-semibold">📈 Tráfego Pago</p>
                <p className="mt-1 text-sm text-white/90">Google e Meta Ads para mais pacientes.</p>
              </div>
            </div>
            <Link
              href="/owner"
              className="mt-6 inline-block rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-white/90"
            >
              Conhecer serviços
            </Link>
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section className="border-b border-slate-200 bg-slate-50 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Depoimentos</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              { initials: "AC", name: "Dra. Ana Costa", spec: "Dermatologia", text: "A IA atende tão bem que os pacientes nem percebem. Reduziu no-show em 40%." },
              { initials: "RM", name: "Dr. Ricardo Mendes", spec: "Ortopedia", text: "Configuramos em 10 minutos. A equipe adotou no primeiro dia. Recomendo." },
              { initials: "BE", name: "Clínica Bem Estar", spec: "Centro integrado", text: "Relatórios claros e agendamento online. Os pacientes amam poder agendar pelo celular." },
            ].map((d) => (
              <blockquote key={d.name} className="rounded-xl border border-slate-200 bg-white p-6 text-left">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-700">
                    {d.initials}
                  </div>
                  <div>
                    <cite className="font-medium not-italic text-slate-900">{d.name}</cite>
                    <p className="text-xs text-slate-500">{d.spec}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-600">&quot;{d.text}&quot;</p>
                <p className="mt-2 text-amber-500">★★★★★</p>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-gradient-to-br from-emerald-600 to-teal-700 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Comece hoje. Cancele quando quiser.</h2>
          <p className="mt-2 text-emerald-100">Sem cartão de crédito. Trial grátis por 15 dias.</p>
          <Link
            href="/onboarding"
            className="mt-6 inline-block rounded-lg bg-white px-8 py-4 text-lg font-semibold text-emerald-700 shadow-lg hover:bg-emerald-50"
          >
            Criar conta grátis
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            <div className="text-center sm:text-left">
              <p className="font-semibold text-slate-900">Clínica SaaS</p>
              <p className="mt-1 max-w-xs text-sm text-slate-500">Atendimento 24h no WhatsApp com IA.</p>
            </div>
            <nav className="flex flex-wrap justify-center gap-6 text-sm">
              <Link href="/" className="text-slate-600 hover:text-slate-900">Início</Link>
              <Link href="#features" className="text-slate-600 hover:text-slate-900">Funcionalidades</Link>
              <Link href="/#planos" className="text-slate-600 hover:text-slate-900">Planos</Link>
              <Link href="/login" className="text-slate-600 hover:text-slate-900">Login</Link>
            </nav>
          </div>
          <div className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-slate-200 pt-6 sm:flex-row">
            <p className="text-sm text-slate-500">Felismino Company © 2025</p>
            <div className="flex gap-4 text-slate-500">
              <span title="Instagram">📷</span>
              <span title="LinkedIn">💼</span>
              <span title="WhatsApp">📱</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
