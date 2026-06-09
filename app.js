import {
  createComment,
  getActiveDebate,
  getComments,
  getLatestSummary,
  getSupabaseConfig,
} from "./supabaseClient.js";

const ALIAS_KEY = "anonymous-debate-alias-v1";

const EMPTY_SUMMARY = {
  overall_summary: "아직 AI 요약이 없습니다.",
  pro_summary: "찬성 의견 요약이 아직 없습니다.",
  con_summary: "반대 의견 요약이 아직 없습니다.",
  key_issue: "가장 갈리는 쟁점이 아직 없습니다.",
};

let state = {
  alias: loadAlias(),
  comments: [],
  debate: null,
  errorMessage: "",
  filter: "all",
  isLoading: true,
  summary: null,
};
let selectedSide = null;
let activeReplyId = null;

const els = {
  debateTitle: document.querySelector("#debateTitle"),
  debateCopy: document.querySelector(".debate-copy"),
  supportFill: document.querySelector("#supportFill"),
  opposeFill: document.querySelector("#opposeFill"),
  ratioText: document.querySelector("#ratioText"),
  engagementLine: document.querySelector("#engagementLine"),
  stanceNotice: document.querySelector("#stanceNotice"),
  commentInput: document.querySelector("#commentInput"),
  charCount: document.querySelector("#charCount"),
  submitComment: document.querySelector("#submitComment"),
  summaryFlow: document.querySelector("#summaryFlow"),
  summarySupport: document.querySelector("#summarySupport"),
  summaryOppose: document.querySelector("#summaryOppose"),
  summaryIssue: document.querySelector("#summaryIssue"),
  visibleCount: document.querySelector("#visibleCount"),
  commentList: document.querySelector("#commentList"),
  toast: document.querySelector("#toast"),
};

function loadAlias() {
  try {
    const saved = localStorage.getItem(ALIAS_KEY);
    if (saved) return saved;
  } catch {
    // Keep anonymous alias generation working when storage is unavailable.
  }

  const alias = makeAlias();
  try {
    localStorage.setItem(ALIAS_KEY, alias);
  } catch {
    // Ignore storage failures; alias can remain session-only.
  }
  return alias;
}

function makeAlias() {
  return `무명 ${String(Math.floor(Math.random() * 900) + 100).padStart(3, "0")}`;
}

function setLoadError(message, error = null) {
  if (error) {
    console.error(error);
  } else {
    console.error(message);
  }

  state = {
    ...state,
    comments: [],
    debate: null,
    errorMessage: message,
    isLoading: false,
    summary: null,
  };
}

async function loadRemoteData() {
  const config = getSupabaseConfig();

  if (!config.isConfigured) {
    setLoadError("데이터를 불러오지 못했습니다. Supabase 설정을 확인해주세요.");
    render();
    return;
  }

  try {
    state = {
      ...state,
      errorMessage: "",
      isLoading: true,
    };
    render();

    const debate = await getActiveDebate();
    if (!debate) {
      state = {
        ...state,
        comments: [],
        debate: null,
        errorMessage: "현재 활성화된 논쟁이 없습니다.",
        isLoading: false,
        summary: null,
      };
      render();
      return;
    }

    const [comments, summary] = await Promise.all([
      getComments(debate.id),
      getLatestSummary(debate.id),
    ]);

    state = {
      ...state,
      comments,
      debate,
      errorMessage: "",
      isLoading: false,
      summary,
    };
    render();
  } catch (error) {
    setLoadError("데이터를 불러오지 못했습니다.", error);
    render();
  }
}

function topLevelComments() {
  return state.comments.filter((comment) => !comment.parent_id);
}

function repliesFor(commentId) {
  return state.comments
    .filter((comment) => comment.parent_id === commentId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function totals() {
  const comments = topLevelComments();
  const supportCount = comments.filter((comment) => comment.side === "pro").length;
  const opposeCount = comments.filter((comment) => comment.side === "con").length;
  const support = supportCount;
  const oppose = opposeCount;
  const total = support + oppose;

  return {
    support,
    oppose,
    supportPercent: total ? Math.round((support / total) * 100) : 0,
    opposePercent: total ? Math.round((oppose / total) * 100) : 0,
    commentCount: state.comments.length,
  };
}

function commentsForView() {
  const comments = topLevelComments();
  const filteredComments =
    state.filter === "support" || state.filter === "oppose"
      ? comments.filter((comment) => comment.side === stanceToSide(state.filter))
      : [...comments];

  return filteredComments.sort((a, b) => {
    if (state.filter === "popular") {
      return (
        (b.like_count ?? 0) - (a.like_count ?? 0) ||
        new Date(b.created_at) - new Date(a.created_at)
      );
    }

    return new Date(b.created_at) - new Date(a.created_at);
  });
}

function render() {
  renderDebate();
  renderTotals();
  renderStance();
  renderSummary();
  renderFilters();
  renderComments();
}

function renderDebate() {
  if (state.isLoading) {
    els.debateTitle.textContent = "논쟁을 불러오는 중입니다.";
    els.debateCopy.textContent = "잠시만 기다려주세요.";
    return;
  }

  if (!state.debate) {
    els.debateTitle.textContent = state.errorMessage || "현재 활성화된 논쟁이 없습니다.";
    els.debateCopy.textContent = state.errorMessage
      ? "Supabase 데이터를 확인한 뒤 다시 시도해주세요."
      : "운영자가 active 논쟁을 설정하면 여기에 표시됩니다.";
    return;
  }

  els.debateTitle.textContent = state.debate.title;
  els.debateCopy.textContent = state.debate.description ?? "";
}

function renderTotals() {
  if (state.isLoading) {
    els.supportFill.style.width = "0%";
    els.opposeFill.style.width = "0%";
    els.ratioText.textContent = "비율을 불러오는 중입니다.";
    els.engagementLine.textContent = "참여 정보를 불러오는 중입니다.";
    return;
  }

  if (!state.debate) {
    els.supportFill.style.width = "0%";
    els.opposeFill.style.width = "0%";
    els.ratioText.textContent = state.errorMessage
      ? "데이터를 불러오지 못했습니다."
      : "참여 데이터가 없습니다.";
    els.engagementLine.textContent = state.errorMessage || "현재 활성 논쟁이 없습니다.";
    return;
  }

  const currentTotals = totals();

  els.supportFill.style.width = `${currentTotals.supportPercent}%`;
  els.opposeFill.style.width = `${currentTotals.opposePercent}%`;
  els.ratioText.textContent = `찬성 ${currentTotals.supportPercent}% / 반대 ${currentTotals.opposePercent}%`;
  els.engagementLine.textContent = `${formatNumber(
    currentTotals.support + currentTotals.oppose,
  )}명 참여 · ${formatNumber(currentTotals.commentCount)}개 댓글`;
}

function renderStance() {
  document.querySelectorAll("[data-stance]").forEach((button) => {
    button.classList.toggle("active", stanceToSide(button.dataset.stance) === selectedSide);
  });

  els.stanceNotice.classList.remove("support", "oppose");

  if (!selectedSide) {
    els.stanceNotice.textContent = "입장을 선택하면 댓글 입력창에 표시됩니다.";
    return;
  }

  const label = sideToLabel(selectedSide);
  els.stanceNotice.textContent = `${label} 입장으로 댓글을 남깁니다.`;
  els.stanceNotice.classList.add(sideToStance(selectedSide));
}

function renderFilters() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
  });
}

function renderSummary() {
  if (state.isLoading) {
    els.summaryFlow.textContent = "요약을 불러오는 중입니다.";
    els.summarySupport.textContent = "잠시만 기다려주세요.";
    els.summaryOppose.textContent = "잠시만 기다려주세요.";
    els.summaryIssue.textContent = "잠시만 기다려주세요.";
    return;
  }

  if (!state.debate && state.errorMessage) {
    els.summaryFlow.textContent = "데이터를 불러오지 못했습니다.";
    els.summarySupport.textContent = state.errorMessage;
    els.summaryOppose.textContent = state.errorMessage;
    els.summaryIssue.textContent = state.errorMessage;
    return;
  }

  const summary = state.summary ?? EMPTY_SUMMARY;
  els.summaryFlow.textContent = summary.overall_summary ?? EMPTY_SUMMARY.overall_summary;
  els.summarySupport.textContent = summary.pro_summary ?? EMPTY_SUMMARY.pro_summary;
  els.summaryOppose.textContent = summary.con_summary ?? EMPTY_SUMMARY.con_summary;
  els.summaryIssue.textContent = summary.key_issue ?? EMPTY_SUMMARY.key_issue;
}

function renderComments() {
  if (state.isLoading) {
    els.visibleCount.textContent = "불러오는 중";
    els.commentList.innerHTML = '<div class="empty-state">댓글을 불러오고 있습니다.</div>';
    return;
  }

  if (!state.debate) {
    els.visibleCount.textContent = state.errorMessage ? "오류" : "0개";
    els.commentList.innerHTML = `<div class="empty-state">${escapeHtml(
      state.errorMessage || "현재 활성화된 논쟁이 없습니다.",
    )}</div>`;
    return;
  }

  const comments = commentsForView();
  els.visibleCount.textContent = `${comments.length}개`;

  if (!comments.length) {
    els.commentList.innerHTML =
      '<div class="empty-state">아직 이 입장의 댓글이 없습니다.</div>';
    return;
  }

  els.commentList.innerHTML = comments.map(renderComment).join("");
}

function renderComment(comment) {
  const replies = repliesFor(comment.id);
  const replyBox =
    activeReplyId === comment.id
      ? `
        <div class="reply-box">
          <textarea data-reply-input="${comment.id}" maxlength="160" placeholder="짧게 답글을 남겨주세요."></textarea>
          <button class="primary-button" type="button" data-reply-submit="${comment.id}">
            등록
          </button>
        </div>
      `
      : "";

  return `
    <article class="comment-card${comment.report_count > 0 ? " flagged" : ""}">
      <div class="comment-meta">
        <span class="alias">${escapeHtml(comment.nickname ?? "무명")}</span>
        <span>·</span>
        <span class="badge ${sideToStance(comment.side)}">${sideToLabel(comment.side)}</span>
        <span>·</span>
        <span>${timeAgo(comment.created_at)}</span>
      </div>
      <p class="comment-body">${escapeHtml(comment.content)}</p>
      <div class="comment-actions">
        <button type="button" data-like="${comment.id}">공감 ${comment.like_count ?? 0}</button>
        <span>·</span>
        <button type="button" data-reply="${comment.id}">답글 ${replies.length}</button>
        <span>·</span>
        <button type="button" data-flag="${comment.id}">${
          comment.report_count > 0 ? "신고됨" : "신고"
        }</button>
      </div>
      ${renderReplies(replies)}
      ${replyBox}
    </article>
  `;
}

function renderReplies(replies) {
  if (!replies.length) return "";

  return `
    <div class="reply-list">
      ${replies
        .map(
          (reply) => `
            <div class="reply">
              <strong>${escapeHtml(reply.nickname ?? "무명")} · ${timeAgo(reply.created_at)}</strong>
              <p>${escapeHtml(reply.content)}</p>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

async function addComment() {
  const content = els.commentInput.value.trim();

  if (!selectedSide) {
    showToast("찬성 또는 반대를 먼저 선택해주세요.");
    return;
  }

  if (content.length < 5) {
    showToast("댓글을 조금 더 남겨주세요.");
    return;
  }

  if (!state.debate) {
    showToast("활성 논쟁을 불러온 뒤 댓글을 남길 수 있습니다.");
    return;
  }

  try {
    els.submitComment.disabled = true;

    await createComment({
      content,
      debateId: state.debate.id,
      nickname: state.alias,
      side: selectedSide,
    });
    state.comments = await getComments(state.debate.id);

    state.filter = "all";
    activeReplyId = null;
    els.commentInput.value = "";
    updateCharCount();
    render();
    showToast("익명 댓글이 등록됐습니다.");
  } catch (error) {
    showToast("댓글 등록에 실패했습니다.");
    console.error(error);
  } finally {
    els.submitComment.disabled = false;
  }
}

async function addReply(commentId) {
  const parent = state.comments.find((comment) => comment.id === commentId);
  const input = document.querySelector(`[data-reply-input="${commentId}"]`);
  const content = input?.value.trim() ?? "";

  if (!parent) return;

  if (content.length < 3) {
    showToast("답글을 조금 더 남겨주세요.");
    return;
  }

  try {
    await createComment({
      content,
      debateId: state.debate.id,
      nickname: state.alias,
      parentId: commentId,
      side: parent.side,
    });
    state.comments = await getComments(state.debate.id);

    activeReplyId = null;
    render();
    showToast("답글이 등록됐습니다.");
  } catch (error) {
    showToast("답글 등록에 실패했습니다.");
    console.error(error);
  }
}

function updateComment(id, updater) {
  state.comments = state.comments.map((comment) =>
    comment.id === id ? updater(comment) : comment,
  );
  render();
}

function updateCharCount() {
  els.charCount.textContent = `${els.commentInput.value.length} / 300`;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    els.toast.classList.remove("show");
  }, 1700);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function timeAgo(value) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.round(hours / 24)}일 전`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function stanceToSide(stance) {
  if (stance === "support") return "pro";
  if (stance === "oppose") return "con";
  return stance;
}

function sideToStance(side) {
  return side === "pro" ? "support" : "oppose";
}

function sideToLabel(side) {
  return side === "pro" ? "찬성" : "반대";
}

document.addEventListener("click", (event) => {
  const stanceButton = event.target.closest("[data-stance]");
  if (stanceButton) {
    selectedSide = stanceToSide(stanceButton.dataset.stance);
    renderStance();
    return;
  }

  const filterButton = event.target.closest("[data-filter]");
  if (filterButton) {
    state.filter = filterButton.dataset.filter;
    activeReplyId = null;
    render();
    return;
  }

  const likeButton = event.target.closest("[data-like]");
  if (likeButton) {
    updateComment(likeButton.dataset.like, (comment) => ({
      ...comment,
      like_count: (comment.like_count ?? 0) + 1,
    }));
    return;
  }

  const flagButton = event.target.closest("[data-flag]");
  if (flagButton) {
    updateComment(flagButton.dataset.flag, (comment) => ({
      ...comment,
      report_count: comment.report_count > 0 ? 0 : 1,
    }));
    return;
  }

  const replyButton = event.target.closest("[data-reply]");
  if (replyButton) {
    activeReplyId =
      activeReplyId === replyButton.dataset.reply ? null : replyButton.dataset.reply;
    render();
    return;
  }

  const replySubmit = event.target.closest("[data-reply-submit]");
  if (replySubmit) {
    addReply(replySubmit.dataset.replySubmit);
  }
});

els.commentInput.addEventListener("input", updateCharCount);
els.submitComment.addEventListener("click", addComment);

updateCharCount();
render();
loadRemoteData();
