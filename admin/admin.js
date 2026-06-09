const ADMIN_SUPABASE_URL = "https://neeimhgjuqrmppfyzvus.supabase.co";
const ADMIN_SUPABASE_ANON_KEY = "sb_publishable_BpfBYADHKY4cEfFoOoztDA_V7rgTcGx";

const CONFIG_KEYS = {
  url: "SUPABASE_URL",
  anonKey: "SUPABASE_ANON_KEY",
};

const state = {
  admin: null,
  comments: [],
  debates: [],
  selectedDebateId: null,
  session: null,
  summary: null,
};

let supabaseClient = null;
let toastTimer = null;

const $ = (selector) => document.querySelector(selector);

const elements = {
  authMessage: $("#authMessage"),
  blockedPanel: $("#blockedPanel"),
  clearConfigButton: $("#clearConfigButton"),
  commentList: $("#commentList"),
  configAnonKey: $("#configAnonKey"),
  configForm: $("#configForm"),
  configPanel: $("#configPanel"),
  configUrl: $("#configUrl"),
  conSummary: $("#conSummary"),
  debateDescription: $("#debateDescription"),
  debateComputedStatus: $("#debateComputedStatus"),
  debateEndAt: $("#debateEndAt"),
  debateForm: $("#debateForm"),
  debateId: $("#debateId"),
  debateList: $("#debateList"),
  debatePaused: $("#debatePaused"),
  debateStartAt: $("#debateStartAt"),
  debateTitle: $("#debateTitle"),
  email: $("#email"),
  keyIssue: $("#keyIssue"),
  loginForm: $("#loginForm"),
  loginPanel: $("#loginPanel"),
  logoutButton: $("#logoutButton"),
  newDebateButton: $("#newDebateButton"),
  overallSummary: $("#overallSummary"),
  pauseToggleButton: $("#pauseToggleButton"),
  password: $("#password"),
  proSummary: $("#proSummary"),
  selectedDebateLabel: $("#selectedDebateLabel"),
  summaryForm: $("#summaryForm"),
  toast: $("#toast"),
  workspace: $("#adminWorkspace"),
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  fillConfigForm();
  renderDebateComputedStatus();

  if (!setupSupabaseClient()) {
    renderSignedOut("Supabase URL과 anon key를 먼저 설정해주세요.");
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    renderSignedOut(error.message);
    return;
  }

  await handleSession(data.session);

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    await handleSession(session);
  });
}

function bindEvents() {
  elements.configForm.addEventListener("submit", handleConfigSave);
  elements.clearConfigButton.addEventListener("click", handleConfigClear);
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.logoutButton.addEventListener("click", handleLogout);
  elements.newDebateButton.addEventListener("click", clearDebateForm);
  elements.debateForm.addEventListener("submit", handleDebateSave);
  elements.pauseToggleButton.addEventListener("click", handlePauseToggle);
  elements.debatePaused.addEventListener("change", renderDebateComputedStatus);
  elements.debateStartAt.addEventListener("input", renderDebateComputedStatus);
  elements.debateEndAt.addEventListener("input", renderDebateComputedStatus);
  elements.summaryForm.addEventListener("submit", handleSummarySave);
  elements.debateList.addEventListener("click", handleDebateListClick);
  elements.commentList.addEventListener("click", handleCommentListClick);
}

function getConfig() {
  const runtime = window.SUPABASE_CONFIG ?? window.__SUPABASE_CONFIG__ ?? {};

  return {
    url:
      ADMIN_SUPABASE_URL ||
      runtime.url ||
      window.localStorage?.getItem(CONFIG_KEYS.url) ||
      "",
    anonKey:
      ADMIN_SUPABASE_ANON_KEY ||
      runtime.anonKey ||
      window.localStorage?.getItem(CONFIG_KEYS.anonKey) ||
      "",
  };
}

function hasEmbeddedConfig() {
  return Boolean(ADMIN_SUPABASE_URL && ADMIN_SUPABASE_ANON_KEY);
}

function setupSupabaseClient() {
  const { url, anonKey } = getConfig();
  if (!url || !anonKey || !window.supabase) {
    supabaseClient = null;
    return false;
  }

  supabaseClient = window.supabase.createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  });

  return true;
}

function fillConfigForm() {
  const { url, anonKey } = getConfig();
  elements.configUrl.value = url;
  elements.configAnonKey.value = anonKey;
}

function parseDateValue(value) {
  return value ? new Date(value) : null;
}

function isPausedDebate(debate) {
  return ["draft", "archived", "paused"].includes(debate?.status ?? "");
}

function getStoredDebateStatus(paused) {
  // Keep the current DB schema working without a migration:
  // treat archived as the persisted paused flag.
  return paused ? "archived" : "active";
}

function getDebateStatus(debate, now = new Date()) {
  if (!debate) return "scheduled";

  if (isPausedDebate(debate)) {
    return "paused";
  }

  const startAt = parseDateValue(debate.start_at);
  const endAt = parseDateValue(debate.end_at);

  if (!startAt || !endAt) {
    return "scheduled";
  }

  if (now < startAt) {
    return "scheduled";
  }

  if (now >= endAt) {
    return "expired";
  }

  return "active";
}

function isActiveDebate(debate, now = new Date()) {
  return getDebateStatus(debate, now) === "active";
}

function getDisplayStatusLabel(status) {
  if (status === "active") return "Active";
  if (status === "paused") return "Paused";
  if (status === "expired") return "Expired";
  return "Scheduled";
}

function hasOverlappingActivePeriod(nextDebate, existingDebates, now = new Date()) {
  const nextStart = parseDateValue(nextDebate.start_at);
  const nextEnd = parseDateValue(nextDebate.end_at);

  if (!nextStart || !nextEnd || isPausedDebate(nextDebate) || nextEnd <= now) {
    return false;
  }

  return existingDebates.some((existingDebate) => {
    if (existingDebate.id === nextDebate.id) return false;
    if (isPausedDebate(existingDebate)) return false;
    if (getDebateStatus(existingDebate, now) === "expired") return false;

    const existingStart = parseDateValue(existingDebate.start_at);
    const existingEnd = parseDateValue(existingDebate.end_at);

    if (!existingStart || !existingEnd) return false;
    if (existingEnd <= now) return false;

    return existingStart < nextEnd && nextStart < existingEnd;
  });
}

function getFormDebateSnapshot() {
  return {
    id: elements.debateId.value || null,
    status: getStoredDebateStatus(elements.debatePaused.checked),
    start_at: toIsoOrNull(elements.debateStartAt.value),
    end_at: toIsoOrNull(elements.debateEndAt.value),
  };
}

function renderDebateComputedStatus() {
  const computedStatus = getDebateStatus(getFormDebateSnapshot());
  elements.debateComputedStatus.className = `badge ${computedStatus}`;
  elements.debateComputedStatus.textContent = getDisplayStatusLabel(computedStatus);
  elements.pauseToggleButton.textContent = elements.debatePaused.checked ? "재개" : "일시중지";
}

async function handleConfigSave(event) {
  event.preventDefault();

  const url = elements.configUrl.value.trim();
  const anonKey = elements.configAnonKey.value.trim();

  if (!url || !anonKey) {
    showToast("Supabase URL과 anon key를 모두 입력해주세요.");
    return;
  }

  window.localStorage.setItem(CONFIG_KEYS.url, url);
  window.localStorage.setItem(CONFIG_KEYS.anonKey, anonKey);

  if (!setupSupabaseClient()) {
    renderSignedOut("Supabase 클라이언트를 만들 수 없습니다.");
    return;
  }

  showToast("Supabase 설정을 저장했습니다.");
  const { data } = await supabaseClient.auth.getSession();
  await handleSession(data.session);
}

async function handleConfigClear() {
  window.localStorage.removeItem(CONFIG_KEYS.url);
  window.localStorage.removeItem(CONFIG_KEYS.anonKey);
  fillConfigForm();
  state.session = null;
  state.admin = null;
  state.debates = [];
  state.comments = [];
  state.summary = null;
  state.selectedDebateId = null;
  supabaseClient = null;
  renderSignedOut("Supabase 설정을 지웠습니다.");
}

async function handleLogin(event) {
  event.preventDefault();
  setAuthMessage("");

  if (!supabaseClient && !setupSupabaseClient()) {
    renderSignedOut("Supabase URL과 anon key를 먼저 설정해주세요.");
    return;
  }

  const email = elements.email.value.trim();
  const password = elements.password.value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    renderSignedOut(`로그인 실패: ${error.message}`);
    return;
  }

  await handleSession(data.session);
}

async function handleLogout() {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }
  state.session = null;
  state.admin = null;
  renderSignedOut("로그아웃했습니다.");
}

async function handleSession(session) {
  state.session = session;

  if (!session?.user) {
    renderSignedOut("");
    return;
  }

  const admin = await fetchAdminUser(session.user.id);
  if (!admin) {
    state.admin = null;
    renderBlocked();
    return;
  }

  state.admin = admin;
  renderSignedIn();
  await loadDebates();
}

async function fetchAdminUser(userId) {
  const { data, error } = await supabaseClient
    .from("admin_users")
    .select("id,user_id,email,role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    setAuthMessage(`관리자 확인 실패: ${error.message}`);
    return null;
  }

  return data;
}

function renderSignedOut(message) {
  state.admin = null;
  elements.loginPanel.classList.remove("hidden");
  elements.configPanel.classList.toggle("hidden", hasEmbeddedConfig());
  elements.workspace.classList.add("hidden");
  elements.logoutButton.classList.add("hidden");
  elements.blockedPanel.classList.add("hidden");
  setAuthMessage(message);
}

function renderBlocked() {
  elements.loginPanel.classList.add("hidden");
  elements.workspace.classList.add("hidden");
  elements.logoutButton.classList.remove("hidden");
  elements.blockedPanel.classList.remove("hidden");
  elements.configPanel.classList.toggle("hidden", hasEmbeddedConfig());
  setAuthMessage("");
}

function renderSignedIn() {
  elements.loginPanel.classList.add("hidden");
  elements.blockedPanel.classList.add("hidden");
  elements.workspace.classList.remove("hidden");
  elements.logoutButton.classList.remove("hidden");
  elements.configPanel.classList.add("hidden");
  setAuthMessage("");
}

async function loadDebates() {
  const { data, error } = await supabaseClient
    .from("debates")
    .select("id,title,description,status,start_at,end_at,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    showToast(`논쟁 목록을 불러오지 못했습니다: ${error.message}`);
    return;
  }

  state.debates = data ?? [];
  renderDebateList();

  if (state.debates.length === 0) {
    clearDebateForm();
    clearSummaryForm();
    renderComments();
    return;
  }

  const selectedStillExists = state.debates.some(
    (debate) => debate.id === state.selectedDebateId,
  );
  const now = new Date();
  const nextDebate =
    (selectedStillExists &&
      state.debates.find((debate) => debate.id === state.selectedDebateId)) ||
    state.debates.find((debate) => isActiveDebate(debate, now)) ||
    state.debates.find((debate) => getDebateStatus(debate, now) === "scheduled") ||
    state.debates[0];

  await selectDebate(nextDebate.id);
}

function renderDebateList() {
  if (state.debates.length === 0) {
    elements.debateList.innerHTML =
      '<div class="list-item"><p class="item-title">등록된 논쟁이 없습니다.</p></div>';
    return;
  }

  elements.debateList.innerHTML = state.debates
    .map((debate) => {
      const selectedClass =
        debate.id === state.selectedDebateId ? " selected" : "";
      const computedStatus = getDebateStatus(debate);
      const statusLabel = getDisplayStatusLabel(computedStatus);
      const toggleLabel = isPausedDebate(debate) ? "재개" : "일시중지";

      return `
        <article class="list-item${selectedClass}">
          <div class="item-header">
            <div>
              <p class="item-title">${escapeHtml(debate.title)}</p>
              <div class="item-meta">
                <span class="badge ${computedStatus}">${statusLabel}</span>
                <span>${formatPeriod(debate.start_at, debate.end_at)}</span>
              </div>
            </div>
            <div class="item-actions">
              <button class="small-button" type="button" data-action="select-debate" data-id="${debate.id}">선택</button>
              <button class="small-button" type="button" data-action="toggle-pause" data-id="${debate.id}">${toggleLabel}</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

async function handleDebateListClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  if (button.dataset.action === "select-debate") {
    await selectDebate(id);
  }

  if (button.dataset.action === "toggle-pause") {
    const debate = state.debates.find((item) => item.id === id);
    if (!debate) return;
    await updateDebatePauseState(id, !isPausedDebate(debate));
  }
}

async function selectDebate(id) {
  const debate = state.debates.find((item) => item.id === id);
  if (!debate) return;

  state.selectedDebateId = id;
  fillDebateForm(debate);
  renderDebateList();
  await Promise.all([loadSummary(id), loadComments(id)]);
}

function fillDebateForm(debate) {
  elements.debateId.value = debate.id;
  elements.debateTitle.value = debate.title ?? "";
  elements.debateDescription.value = debate.description ?? "";
  elements.debatePaused.checked = isPausedDebate(debate);
  elements.debateStartAt.value = toDateTimeLocal(debate.start_at);
  elements.debateEndAt.value = toDateTimeLocal(debate.end_at);
  elements.selectedDebateLabel.textContent = `${debate.title} 요약을 수정 중입니다.`;
  renderDebateComputedStatus();
}

function clearDebateForm() {
  state.selectedDebateId = null;
  elements.debateId.value = "";
  elements.debateTitle.value = "";
  elements.debateDescription.value = "";
  elements.debatePaused.checked = false;
  elements.debateStartAt.value = "";
  elements.debateEndAt.value = "";
  elements.selectedDebateLabel.textContent =
    "논쟁을 선택하면 최신 요약을 수정할 수 있습니다.";
  clearSummaryForm();
  state.comments = [];
  renderDebateComputedStatus();
  renderDebateList();
  renderComments();
}

async function handleDebateSave(event) {
  event.preventDefault();

  const id = elements.debateId.value;
  const title = elements.debateTitle.value.trim();
  const startAt = toIsoOrNull(elements.debateStartAt.value);
  const endAt = toIsoOrNull(elements.debateEndAt.value);
  const paused = elements.debatePaused.checked;

  if (!title) {
    showToast("논쟁 제목을 입력해주세요.");
    return;
  }

  if (!startAt || !endAt) {
    showToast("시작일과 종료일을 모두 입력해주세요.");
    return;
  }

  if (new Date(endAt) <= new Date(startAt)) {
    showToast("종료일은 시작일보다 늦어야 합니다.");
    return;
  }

  const payload = {
    title,
    description: nullableText(elements.debateDescription.value),
    status: getStoredDebateStatus(paused),
    start_at: startAt,
    end_at: endAt,
  };

  const nextDebate = {
    id: id || null,
    ...payload,
  };

  if (hasOverlappingActivePeriod(nextDebate, state.debates)) {
    showToast("해당 기간에 이미 진행 예정인 논쟁이 있습니다.");
    return;
  }

  let savedDebate;

  if (id) {
    const { data, error } = await supabaseClient
      .from("debates")
      .update(payload)
      .eq("id", id)
      .select("id,title,description,status,start_at,end_at,created_at,updated_at")
      .single();

    if (error) {
      showToast(`논쟁 수정 실패: ${error.message}`);
      return;
    }
    savedDebate = data;
  } else {
    const { data, error } = await supabaseClient
      .from("debates")
      .insert(payload)
      .select("id,title,description,status,start_at,end_at,created_at,updated_at")
      .single();

    if (error) {
      showToast(`논쟁 등록 실패: ${error.message}`);
      return;
    }
    savedDebate = data;
  }

  state.selectedDebateId = savedDebate.id;
  showToast("논쟁을 저장했습니다.");
  await loadDebates();
}

async function handlePauseToggle() {
  if (!state.selectedDebateId) {
    showToast("논쟁을 먼저 선택해주세요.");
    return;
  }

  await updateDebatePauseState(state.selectedDebateId, !elements.debatePaused.checked);
}

async function updateDebatePauseState(debateId, paused) {
  const targetDebate = state.debates.find((debate) => debate.id === debateId);
  if (!targetDebate) return;

  const nextDebate = {
    ...targetDebate,
    status: getStoredDebateStatus(paused),
  };

  if (!paused && hasOverlappingActivePeriod(nextDebate, state.debates)) {
    showToast("해당 기간에 이미 진행 예정인 논쟁이 있습니다.");
    return;
  }

  const { error } = await supabaseClient
    .from("debates")
    .update({ status: getStoredDebateStatus(paused) })
    .eq("id", debateId);

  if (error) {
    showToast(`논쟁 상태 변경 실패: ${error.message}`);
    return;
  }

  state.selectedDebateId = debateId;
  showToast(paused ? "논쟁을 일시중지했습니다." : "논쟁을 재개했습니다.");
  await loadDebates();
}

async function loadComments(debateId) {
  const { data, error } = await supabaseClient
    .from("comments")
    .select(
      "id,debate_id,side,nickname,content,parent_id,like_count,report_count,is_hidden,created_at",
    )
    .eq("debate_id", debateId)
    .order("created_at", { ascending: false });

  if (error) {
    showToast(`댓글을 불러오지 못했습니다: ${error.message}`);
    return;
  }

  state.comments = data ?? [];
  renderComments();
}

function renderComments() {
  if (!state.selectedDebateId) {
    elements.commentList.innerHTML =
      '<div class="list-item"><p class="item-title">논쟁을 먼저 선택해주세요.</p></div>';
    return;
  }

  if (state.comments.length === 0) {
    elements.commentList.innerHTML =
      '<div class="list-item"><p class="item-title">등록된 댓글이 없습니다.</p></div>';
    return;
  }

  elements.commentList.innerHTML = state.comments
    .map((comment) => {
      const sideLabel = comment.side === "pro" ? "찬성" : "반대";
      const nextHidden = comment.is_hidden ? "false" : "true";
      const hiddenLabel = comment.is_hidden ? "숨김 해제" : "숨김 처리";

      return `
        <article class="list-item">
          <div class="item-header">
            <div>
              <div class="item-meta">
                <span>${escapeHtml(comment.nickname || "무명")}</span>
                <span class="badge ${comment.side}">${sideLabel}</span>
                ${
                  comment.is_hidden
                    ? '<span class="badge is-hidden">숨김</span>'
                    : ""
                }
                <span>${formatDate(comment.created_at)}</span>
              </div>
            </div>
            <button class="small-button" type="button" data-action="toggle-comment" data-id="${comment.id}" data-hidden="${nextHidden}">${hiddenLabel}</button>
          </div>
          <p class="comment-content">${escapeHtml(comment.content)}</p>
          <div class="item-meta">
            <span>공감 ${Number(comment.like_count ?? 0).toLocaleString("ko-KR")}</span>
            <span>신고 ${Number(comment.report_count ?? 0).toLocaleString("ko-KR")}</span>
            ${comment.parent_id ? "<span>답글</span>" : ""}
          </div>
        </article>
      `;
    })
    .join("");
}

async function handleCommentListClick(event) {
  const button = event.target.closest("[data-action='toggle-comment']");
  if (!button) return;

  const isHidden = button.dataset.hidden === "true";
  const { error } = await supabaseClient
    .from("comments")
    .update({ is_hidden: isHidden })
    .eq("id", button.dataset.id);

  if (error) {
    showToast(`댓글 상태 변경 실패: ${error.message}`);
    return;
  }

  showToast(isHidden ? "댓글을 숨김 처리했습니다." : "댓글 숨김을 해제했습니다.");
  await loadComments(state.selectedDebateId);
}

async function loadSummary(debateId) {
  const { data, error } = await supabaseClient
    .from("ai_summaries")
    .select("id,debate_id,overall_summary,pro_summary,con_summary,key_issue,generated_at")
    .eq("debate_id", debateId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    showToast(`AI 요약을 불러오지 못했습니다: ${error.message}`);
    return;
  }

  state.summary = data;
  fillSummaryForm(data);
}

function fillSummaryForm(summary) {
  elements.overallSummary.value = summary?.overall_summary ?? "";
  elements.proSummary.value = summary?.pro_summary ?? "";
  elements.conSummary.value = summary?.con_summary ?? "";
  elements.keyIssue.value = summary?.key_issue ?? "";
}

function clearSummaryForm() {
  state.summary = null;
  fillSummaryForm(null);
}

async function handleSummarySave(event) {
  event.preventDefault();

  if (!state.selectedDebateId) {
    showToast("논쟁을 먼저 선택해주세요.");
    return;
  }

  const payload = {
    debate_id: state.selectedDebateId,
    overall_summary: nullableText(elements.overallSummary.value),
    pro_summary: nullableText(elements.proSummary.value),
    con_summary: nullableText(elements.conSummary.value),
    key_issue: nullableText(elements.keyIssue.value),
  };

  if (state.summary?.id) {
    const { error } = await supabaseClient
      .from("ai_summaries")
      .update(payload)
      .eq("id", state.summary.id);

    if (error) {
      showToast(`AI 요약 수정 실패: ${error.message}`);
      return;
    }
  } else {
    const { data, error } = await supabaseClient
      .from("ai_summaries")
      .insert(payload)
      .select("id,debate_id,overall_summary,pro_summary,con_summary,key_issue,generated_at")
      .single();

    if (error) {
      showToast(`AI 요약 저장 실패: ${error.message}`);
      return;
    }

    state.summary = data;
  }

  showToast("AI 요약을 저장했습니다.");
  await loadSummary(state.selectedDebateId);
}

function setAuthMessage(message) {
  elements.authMessage.textContent = message || "";
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.add("hidden");
  }, 3200);
}

function nullableText(value) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toIsoOrNull(value) {
  return value ? new Date(value).toISOString() : null;
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPeriod(startAt, endAt) {
  if (!startAt && !endAt) return "기간 미설정";
  return `${formatDate(startAt)} - ${formatDate(endAt)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
