import AgendaTable from "./AgendaTable";
import { supabase } from "@/lib/supabase";

const CLINIC_ID = "5b6be922-273f-436e-9eb0-515767ec7817";

async function fetchAppointments() {
  const today = new Date().toISOString().slice(0, 10);
  const startOfDay = `${today}T00:00:00.000Z`;
  const endOfDay = `${today}T23:59:59.999Z`;

  const { data, error } = await supabase
    .from("appointments")
    .select(`
      id, clinic_id, patient_id, provider_id, service_id,
      starts_at, ends_at, status, notes,
      patients (full_name, phone),
      providers (full_name),
      services (name)
    `)
    .eq("clinic_id", CLINIC_ID)
    .gte("starts_at", startOfDay)
    .lte("starts_at", endOfDay)
    .order("starts_at", { ascending: true });

  if (error) {
    console.error("Erro ao buscar agenda:", error);
    return { appointments: [], date: today };
  }

  return { appointments: data ?? [], date: today };
}


export default async function AgendaPage() {
  const { appointments, date } = await fetchAppointments();

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside className="flex h-screen w-64 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-200">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
            SC
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Painel da Secretária</span>
            <span className="text-xs text-slate-500">Clínica Multi-Atendimento</span>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4 text-sm">
          <button className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700 font-medium">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Agenda
          </button>
          <button className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100">
            <span className="inline-block h-2 w-2 rounded-full bg-slate-300" />
            Pacientes
          </button>
          <button className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100">
            <span className="inline-block h-2 w-2 rounded-full bg-slate-300" />
            Caixa de Entrada
          </button>
        </nav>
        <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
          v0.1 • MVP Atendimento
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Agenda do dia
            </h1>
            <p className="text-sm text-slate-500">
              {new Date(date).toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </p>
          </div>
        </header>

        <section className="px-8 py-6">
          <AgendaTable initialAppointments={appointments} clinicId={CLINIC_ID} />
        </section>
      </main>
    </div>
  );
}

