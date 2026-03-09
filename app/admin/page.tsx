"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ClinicsView from "./ClinicsView";
import UsersView from "./UsersView";
import PlansView from "./PlansView";
import MetricsView from "./MetricsView";
import BillingView from "./BillingView";
import LeadsView from "./LeadsView";

type View = "clinics" | "users" | "plans" | "metrics" | "billing" | "leads";

export default function AdminPage() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<View>("clinics");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newLeadsCount, setNewLeadsCount] = useState(0);

  useEffect(() => {
    fetch("/api/marketing/leads")
      .then((res) => res.json())
      .then((data) => {
        if (data.leads && Array.isArray(data.leads)) {
          setNewLeadsCount(data.new_count ?? data.leads.filter((l: { status?: string }) => l.status === "new").length);
        }
      })
      .catch(() => {});
  }, [activeView]);

  const is = (v: View) => activeView === v;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <button
        type="button"
        onClick={() => setSidebarOpen((o) => !o)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow md:hidden"
        aria-label="Abrir menu"
      >
        <span className="text-lg">{sidebarOpen ? "✕" : "☰"}</span>
      </button>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />
      )}
      <aside className={`flex h-screen w-64 flex-col border-r border-slate-200 bg-white ${sidebarOpen ? "fixed inset-y-0 left-0 z-40" : "hidden md:flex"}`}>
        <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-white">
            A
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Admin Global</span>
            <span className="text-xs text-slate-500">Gestão do SaaS</span>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4 text-sm">
          <button
            type="button"
            onClick={() => { setActiveView("clinics"); setSidebarOpen(false); }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
              is("clinics") ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Clínicas
          </button>
          <button
            type="button"
            onClick={() => { setActiveView("users"); setSidebarOpen(false); }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
              is("users") ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Usuários
          </button>
          <button
            type="button"
            onClick={() => { setActiveView("plans"); setSidebarOpen(false); }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
              is("plans") ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Planos
          </button>
          <button
            type="button"
            onClick={() => { setActiveView("metrics"); setSidebarOpen(false); }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
              is("metrics") ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Métricas
          </button>
          <button
            type="button"
            onClick={() => { setActiveView("billing"); setSidebarOpen(false); }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
              is("billing") ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Faturamento
          </button>
          <button
            type="button"
            onClick={() => { setActiveView("leads"); setSidebarOpen(false); }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
              is("leads") ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Leads Marketing
            {newLeadsCount > 0 && (
              <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-medium text-white">
                {newLeadsCount}
              </span>
            )}
          </button>
        </nav>
        <div className="border-t border-slate-200 px-3 py-3 space-y-1">
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Meu perfil
          </button>
          <button
            type="button"
            onClick={() => router.push("/secretary")}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Painel Secretária
          </button>
          <button
            type="button"
            onClick={() => router.push("/owner")}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Painel Dono
          </button>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.push("/login");
              router.refresh();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        {activeView === "clinics" && <ClinicsView />}
        {activeView === "users" && <UsersView />}
        {activeView === "plans" && <PlansView />}
        {activeView === "metrics" && <MetricsView />}
        {activeView === "billing" && <BillingView />}
        {activeView === "leads" && <LeadsView />}
      </main>
    </div>
  );
}
