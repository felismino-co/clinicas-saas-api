import { createServerClient as createSupabaseServerClientFromSSR } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  "";

export type CookieStore = {
  getAll(): { name: string; value: string }[];
  setAll?(cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>): void;
};

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

/**
 * Cria um CookieStore para Route Handlers (app/api/*).
 * NextResponse.next() NÃO deve ser usado em route handlers.
 * Use createSupabaseServerClient(cookieStore) e ao retornar NextResponse.json()
 * chame store.appendCookiesToResponse(resposta) para aplicar os cookies de sessão.
 */
export function createCookieStoreForRouteHandler(request: NextRequest): CookieStore & {
  appendCookiesToResponse(response: NextResponse): void;
} {
  const _pending: CookieToSet[] = [];
  return {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet: CookieToSet[]) {
      _pending.push(...cookiesToSet);
    },
    appendCookiesToResponse(response: NextResponse) {
      _pending.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options ?? {});
      });
    },
  };
}

/**
 * Cria cliente Supabase para uso no servidor com cookieStore (ex: cookies() do next/headers).
 */
export function createSupabaseServerClient(cookieStore: CookieStore) {
  return createSupabaseServerClientFromSSR(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookieStore.setAll?.(cookiesToSet);
      },
    },
  });
}

/**
 * Cria cliente Supabase para Route Handlers e Middleware (request + response).
 */
export function createServerClient(
  request: NextRequest,
  response: NextResponse,
) {
  return createSupabaseServerClientFromSSR(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options ?? {});
        });
      },
    },
  });
}
