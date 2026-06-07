const STORAGE_KEY = "anonymous-debate-simple-state-v2";

const debate = {
  question: "AI 면접을 공공 채용에 확대해도 될까?",
  context: "채용의 공정성과 알고리즘 차별 우려가 맞서고 있습니다.",
  baseSupport: 1878,
  baseOppose: 1598,
  baseCommentCount: 1239,
};

const opinionSummary = {
  flow:
    "현재 의견은 공정성과 효율성을 기대하는 쪽과, 알고리즘 편향과 불투명성을 우려하는 쪽으로 나뉘고 있어요.",
  support:
    "찬성하는 사람들은 AI 면접이 면접관의 주관적 판단을 줄이고, 대규모 채용에서 더 빠르고 일관된 평가를 가능하게 한다고 보고 있어요. 특히 학벌, 성별, 지역 같은 요소에서 발생할 수 있는 편견을 줄일 수 있다는 기대가 많아요.",
  oppose:
    "반대하는 사람들은 AI가 지원자의 맥락과 태도, 성장 가능성 같은 인간적인 요소를 충분히 판단하기 어렵다고 우려하고 있어요. 또한 알고리즘의 기준이 공개되지 않으면 오히려 새로운 차별이 생길 수 있다는 의견이 많아요.",
  issue: "AI가 사람보다 더 공정하게 평가할 수 있는가",
};

const seedComments = [
  {
    id: "comment-1",
    stance: "support",
    alias: "무명 703",
    body: "AI 면접은 주관적 편견을 줄일 수 있어 공정성 향상에 도움이 됩니다.",
    likes: 128,
    baseReplies: 11,
    flagged: false,
    createdAt: minutesAgo(62),
  },
  {
    id: "comment-2",
    stance: "oppose",
    alias: "무명 921",
    body: "사람을 알고리즘으로 평가하는 것은 위험하다고 생각합니다.",
    likes: 97,
    baseReplies: 8,
    flagged: false,
    createdAt: minutesAgo(68),
  },
  {
    id: "comment-3",
    stance: "oppose",
    alias: "무명 118",
    body: "공공 채용이라면 탈락 이유를 설명할 수 있어야 합니다. 모델이 그렇게 판단했다는 말만으로는 부족합니다.",
    likes: 84,
    baseReplies: 5,
    flagged: false,
    createdAt: minutesAgo(83),
  },
  {
    id: "comment-4",
    stance: "support",
    alias: "무명 456",
    body: "완전히 맡기는 것이 아니라 1차 보조 도구로 쓰면 비용과 시간을 줄일 수 있습니다.",
    likes: 63,
    baseReplies: 3,
    flagged: false,
    createdAt: minutesAgo(101),
  },
  {
    id: "comment-5",
    stance: "support",
    alias: "무명 214",
    body: "사람 면접도 편견에서 자유롭지 않습니다. 오히려 기준과 로그를 공개하면 더 투명해질 수 있습니다.",
    likes: 52,
    baseReplies: 2,
    flagged: false,
    createdAt: minutesAgo(128),
  },
  {
    id: "comment-6",
    stance: "oppose",
    alias: "무명 587",
    body: "편향을 검증할 독립 기관과 이의제기 절차가 먼저 있어야 확대를 논의할 수 있습니다.",
    likes: 49,
    baseReplies: 2,
    flagged: false,
    createdAt: minutesAgo(144),
  },
];

const seedReplies = [
  {
    id: "reply-1",
    commentId: "comment-1",
    alias: "무명 032",
    body: "로그 공개가 실제로 강제된다면 찬성 쪽 논리가 더 설득력 있어 보여요.",
    createdAt: minutesAgo(34),
  },
  {
    id: "reply-2",
    commentId: "comment-2",
    alias: "무명 640",
    body: "최종 판단권을 사람이 갖는다는 조건이 있어도 위험할까요?",
    createdAt: minutesAgo(41),
  },
];

let state = loadState();
let selectedStance = null;
let activeReplyId = null;

const els = {
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

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function defaultState() {
  return {
    comments: seedComments,
    replies: seedReplies,
    filter: "all",
    alias: makeAlias(),
  };
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultState();
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.comments)) return defaultState();
    return {
      ...defaultState(),
      ...parsed,
      replies: Array.isArray(parsed.replies) ? parsed.replies : [],
    };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function makeAlias() {
  return `무명 ${String(Math.floor(Math.random() * 900) + 100).padStart(3, "0")}`;
}

function totals() {
  const support =
    debate.baseSupport +
    state.comments.filter((comment) => comment.stance === "support").length;
  const oppose =
    debate.baseOppose +
    state.comments.filter((comment) => comment.stance === "oppose").length;
  const total = Math.max(support + oppose, 1);

  return {
    support,
    oppose,
    supportPercent: Math.round((support / total) * 100),
    opposePercent: Math.round((oppose / total) * 100),
    commentCount: debate.baseCommentCount + state.comments.length,
  };
}

function commentsForView() {
  const comments =
    state.filter === "support" || state.filter === "oppose"
      ? state.comments.filter((comment) => comment.stance === state.filter)
      : [...state.comments];

  return comments.sort((a, b) => {
    if (state.filter === "popular") {
      return b.likes - a.likes || new Date(b.createdAt) - new Date(a.createdAt);
    }

    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function render() {
  const currentTotals = totals();

  els.supportFill.style.width = `${currentTotals.supportPercent}%`;
  els.opposeFill.style.width = `${currentTotals.opposePercent}%`;
  els.ratioText.textContent = `찬성 ${currentTotals.supportPercent}% / 반대 ${currentTotals.opposePercent}%`;
  els.engagementLine.textContent = `${formatNumber(
    currentTotals.support + currentTotals.oppose,
  )}명 참여 · ${formatNumber(currentTotals.commentCount)}개 댓글`;

  renderStance();
  renderSummary();
  renderFilters();
  renderComments();
}

function renderStance() {
  document.querySelectorAll("[data-stance]").forEach((button) => {
    button.classList.toggle("active", button.dataset.stance === selectedStance);
  });

  els.stanceNotice.classList.remove("support", "oppose");

  if (!selectedStance) {
    els.stanceNotice.textContent = "입장을 선택하면 댓글 입력창에 표시됩니다.";
    return;
  }

  const label = selectedStance === "support" ? "찬성" : "반대";
  els.stanceNotice.textContent = `${label} 입장으로 댓글을 남깁니다.`;
  els.stanceNotice.classList.add(selectedStance);
}

function renderFilters() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
  });
}

function renderSummary() {
  els.summaryFlow.textContent = opinionSummary.flow;
  els.summarySupport.textContent = opinionSummary.support;
  els.summaryOppose.textContent = opinionSummary.oppose;
  els.summaryIssue.textContent = opinionSummary.issue;
}

function renderComments() {
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
  const replies = state.replies.filter((reply) => reply.commentId === comment.id);
  const replyCount = comment.baseReplies + replies.length;
  const label = comment.stance === "support" ? "찬성" : "반대";
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
    <article class="comment-card${comment.flagged ? " flagged" : ""}">
      <div class="comment-meta">
        <span class="alias">${escapeHtml(comment.alias)}</span>
        <span>·</span>
        <span class="badge ${comment.stance}">${label}</span>
        <span>·</span>
        <span>${timeAgo(comment.createdAt)}</span>
      </div>
      <p class="comment-body">${escapeHtml(comment.body)}</p>
      <div class="comment-actions">
        <button type="button" data-like="${comment.id}">공감 ${comment.likes}</button>
        <span>·</span>
        <button type="button" data-reply="${comment.id}">답글 ${replyCount}</button>
        <span>·</span>
        <button type="button" data-flag="${comment.id}">${comment.flagged ? "신고됨" : "신고"}</button>
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
              <strong>${escapeHtml(reply.alias)} · ${timeAgo(reply.createdAt)}</strong>
              <p>${escapeHtml(reply.body)}</p>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function addComment() {
  const body = els.commentInput.value.trim();

  if (!selectedStance) {
    showToast("찬성 또는 반대를 먼저 선택해주세요.");
    return;
  }

  if (body.length < 5) {
    showToast("댓글을 조금 더 남겨주세요.");
    return;
  }

  state.comments.unshift({
    id: `comment-${crypto.randomUUID()}`,
    stance: selectedStance,
    alias: state.alias,
    body,
    likes: 0,
    baseReplies: 0,
    flagged: false,
    createdAt: new Date().toISOString(),
  });
  state.filter = "all";
  activeReplyId = null;
  els.commentInput.value = "";
  updateCharCount();
  saveState();
  render();
  showToast("익명 댓글이 등록됐습니다.");
}

function addReply(commentId) {
  const input = document.querySelector(`[data-reply-input="${commentId}"]`);
  const body = input?.value.trim() ?? "";

  if (body.length < 3) {
    showToast("답글을 조금 더 남겨주세요.");
    return;
  }

  state.replies.push({
    id: `reply-${crypto.randomUUID()}`,
    commentId,
    alias: state.alias,
    body,
    createdAt: new Date().toISOString(),
  });
  activeReplyId = null;
  saveState();
  render();
  showToast("답글이 등록됐습니다.");
}

function updateComment(id, updater) {
  state.comments = state.comments.map((comment) =>
    comment.id === id ? updater(comment) : comment,
  );
  saveState();
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
  return String(value)
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

document.addEventListener("click", (event) => {
  const stanceButton = event.target.closest("[data-stance]");
  if (stanceButton) {
    selectedStance = stanceButton.dataset.stance;
    renderStance();
    return;
  }

  const filterButton = event.target.closest("[data-filter]");
  if (filterButton) {
    state.filter = filterButton.dataset.filter;
    activeReplyId = null;
    saveState();
    render();
    return;
  }

  const likeButton = event.target.closest("[data-like]");
  if (likeButton) {
    updateComment(likeButton.dataset.like, (comment) => ({
      ...comment,
      likes: comment.likes + 1,
    }));
    return;
  }

  const flagButton = event.target.closest("[data-flag]");
  if (flagButton) {
    updateComment(flagButton.dataset.flag, (comment) => ({
      ...comment,
      flagged: !comment.flagged,
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

saveState();
updateCharCount();
render();
