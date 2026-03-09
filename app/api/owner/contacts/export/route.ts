import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../../lib/supabase";

const STATUS_VALUES = ["lead", "interested", "scheduled", "patient", "inactive"] as const;

function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

function escapeCsv(value: string): string {
  const s = String(value ?? "").replace(/"/g, '""');
  return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s}"` : s;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");
  const status = url.searchParams.get("status");

  if (!clinicId) return badRequest("clinic_id é obrigatório.");

  try {
    let query = supabase
      .from("contacts")
      .select("phone, full_name, status, tags, first_contact_at, last_contact_at")
      .eq("clinic_id", clinicId)
      .order("last_contact_at", { ascending: false });

    if (status && status !== "all" && STATUS_VALUES.includes(status as (typeof STATUS_VALUES)[number])) {
      query = query.eq("status", status);
    }

    const { data: rows, error } = await query.limit(10000);

    if (error) {
      return NextResponse.json({ error: "database_error", message: error.message }, { status: 500 });
    }

    const headers = ["Nome", "Telefone", "Status", "Tags", "Primeira vez", "Último contato"];
    const lines: string[] = [headers.map(escapeCsv).join(",")];

    for (const r of rows ?? []) {
      const row = r as { full_name?: string; phone?: string; status?: string; tags?: string[]; first_contact_at?: string; last_contact_at?: string };
      const tagsStr = Array.isArray(row.tags) ? row.tags.join("; ") : "";
      lines.push([
        escapeCsv(row.full_name ?? ""),
        escapeCsv(row.phone ?? ""),
        escapeCsv(row.status ?? ""),
        escapeCsv(tagsStr),
        escapeCsv(formatDate(row.first_contact_at ?? null)),
        escapeCsv(formatDate(row.last_contact_at ?? null)),
      ].join(","));
    }

    const csv = lines.join("\n");
    const filename = `contatos-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao exportar contatos." },
      { status: 500 },
    );
  }
}
