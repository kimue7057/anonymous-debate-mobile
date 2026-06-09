const CONFIG_KEYS = {
  url: "SUPABASE_URL",
  anonKey: "SUPABASE_ANON_KEY",
};

function readRuntimeConfig() {
  const runtimeConfig =
    window.SUPABASE_CONFIG ?? window.__SUPABASE_CONFIG__ ?? {};

  return {
    url:
      runtimeConfig.url ??
      runtimeConfig.supabaseUrl ??
      window.localStorage?.getItem(CONFIG_KEYS.url) ??
      "",
    anonKey:
      runtimeConfig.anonKey ??
      runtimeConfig.supabaseAnonKey ??
      window.localStorage?.getItem(CONFIG_KEYS.anonKey) ??
      "",
  };
}

export function getSupabaseConfig() {
  const { url, anonKey } = readRuntimeConfig();
  return {
    anonKey: anonKey.trim(),
    isConfigured: Boolean(url.trim() && anonKey.trim()),
    url: url.trim().replace(/\/$/, ""),
  };
}

async function request(path, options = {}) {
  const config = getSupabaseConfig();

  if (!config.isConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Supabase request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function getActiveDebate() {
  const now = encodeURIComponent(new Date().toISOString());
  const rows = await request(
    `debates?select=*&status=not.in.(archived,draft,paused)&start_at=lte.${now}&end_at=gt.${now}&order=start_at.asc&limit=1`,
  );
  return rows[0] ?? null;
}

export async function getComments(debateId) {
  if (!debateId) return [];

  return request(
    `comments?select=*&debate_id=eq.${encodeURIComponent(
      debateId,
    )}&is_hidden=eq.false&order=created_at.desc`,
  );
}

export async function createComment({
  debateId,
  side,
  nickname,
  content,
  parentId = null,
}) {
  const rows = await request("comments?select=*", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: {
      debate_id: debateId,
      side,
      nickname,
      content,
      parent_id: parentId,
    },
  });

  return rows[0] ?? null;
}

export async function getLatestSummary(debateId) {
  if (!debateId) return null;

  const rows = await request(
    `ai_summaries?select=*&debate_id=eq.${encodeURIComponent(
      debateId,
    )}&order=generated_at.desc&limit=1`,
  );
  return rows[0] ?? null;
}
