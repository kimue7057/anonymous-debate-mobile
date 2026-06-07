import {
  createComment,
  getActiveDebate,
  getComments,
  getLatestSummary,
  getSupabaseConfig,
} from './supabaseClient.js';

const ALIAS_KEY = 'anonymous-debate-alias-v1';

const fallbackDebate = {
  id: 'mock-debate',
  title: 'AI 면접을 공공 채용에 확대해도 될까?',
  description: '채용의 공정성과 알고리즘 차별 우려가 맞서고 있습니다.',
  baseSupport: 1878,
  baseOppose: 1598,
  baseCommentCount: 1239,
};

const fallbackSummary = {
  overall_summary:
    '현재 의견은 공정성과 효율성을 기대하는 쪽과, 알고리즘 편향과 불투명성을 우려하는 쪽으로 나뉘고 있어요.',
  pro_summary:
    '찬성하는 사람들은 AI 면접이 면접관의 주관적 판단을 줄이고, 대규모 채용에서 더 빠르고 일관된 평가를 가능하게 한다고 보고 있어요. 특히 학벌, 성별, 지역 같은 요소에서 발생할 수 있는 편견을 줄일 수 있다는 기대가 많아요.',
  con_summary:
    '반대하는 사람들은 AI가 지원자의 맥락과 태도, 성장 가능성 같은 인간적인 요소를 충분히 판단하기 어렵다고 우려하고 있어요. 또한 알고리즘의 기준이 공개되지 않으면 오히려 새로운 차별이 생길 수 있다는 의견이 많아요.',
  key_issue: 'AI가 사람보다 더 공정하게 평가할 수 있는가',
};

const fallbackComments = [
  {
    id: 'comment-1',
    debate_id: 'mock-debate',
    side: 'pro',
    nickname: '무명 703',
    content: 'AI 면접은 주관적 편견을 줄일 수 있어 공정성 향상에 도움이 됩니다.',
    parent_id: null,
    like_count: 128,
    report_count: 0,
    is_hidden: false,
    created_at: minutesAgo(62),
  },
  {
    id: 'comment-2',
    debate_id: 'mock-debate',
    side: 'con',
    nickname: '무명 921',
    content: '사람을 알고리즘으로 평가하는 것은 위험하다고 생각합니다.',
    parent_id: null,
    like_count: 97,
    report_count: 0,
    is_hidden: false,
    created_at: minutesAgo(68),
  },
  {
    id: 'comment-3',
    debate_id: 'mock-debate',
    side: 'con',
    nickname: '무명 118',
    content:
      '공공 채용이라면 탈락 이유를 설명할 수 있어야 합니다. 모델이 그렇게 판단했다는 말만으로는 부족합니다.',
    parent_id: null,
    like_count: 84,
    report_count: 0,
    is_hidden: false,
    created_at: minutesAgo(83),
  },
  {
    id: 'comment-4',
    debate_id: 'mock-debate',
    side: 'pro',
    nickname: '무명 456',
    content:
      '완전히 맡기는 것이 아니라 1차 보조 도구로 쓰면 비용과 시간을 줄일 수 있습니다.',
    parent_id: null,
    like_count: 63,
    report_count: 0,
    is_hidden: false,
    created_at: minutesAgo(101),
  },
  {
    id: 'comment-5',
    debate_id: 'mock-debate',
    side: 'pro',
    nickname: '무명 214',
    content:
      '사람 면접도 편견에서 자유롭지 않습니다. 오히려 기준과 로그를 공개하면 더 투명해질 수 있습니다.',
    parent_id: null,
    like_count: 52,
    report_count: 0,
    is_hidden: false,
    created_at: minutesAgo(128),
  },
  {
    id: 'comment-6',
    debate_id: 'mock-debate',
    side: 'con',
    nickname: '무명 587',
    content:
      '편향을 검증할 독립 기관과 이의제기 절차가 먼저 있어야 확대를 논의할 수 있습니다.',
    parent_id: null,
    like_count: 49,
    report_count: 0,
    is_hidden: false,
    created_at: minutesAgo(144),
  },
  {
    id: 'reply-1',
    debate_id: 'mock-debate',
    side: 'pro',
    nickname: '무명 032',
    content: '로그 공개가 실제로 강제된다면 찬성 쪽 논리가 더 설득력 있어 보여요.',
    parent_id: 'comment-1',
    like_count: 0,
    report_count: 0,
    is_hidden: false,
    created_at: minutesAgo(34),
  },
  {
    id: 'reply-2',
    debate_id: 'mock-debate',
    side: 'con',
    nickname: '무명 640',
    content: '최종 판단권을 사람이 갖는다는 조건이 있어도 위험할까요?',
    parent_id: 'comment-2',
    like_count: 0,
    report_count: 0,
    is_hidden: false,
    created_at: minutesAgo(41),
  },
];

let state = {
  alias: loadAlias(),
  comments: [],
  debate: null,
  filter: 'all',
  isLoading: true,
  summary: null,
  usingMock: false,
};
let selectedSide = null;
let activeReplyId = null;

const els = {
  debateTitle: document.querySelector('#debateTitle'),
  debateCopy: document.querySelector('.debate-copy'),
  supportFill: document.querySelector('#supportFill'),
  opposeFill: document.querySelector('#opposeFill'),
  ratioText: document.querySelector('#ratioText'),
  engagementLine: document.querySelector('#engagementLine'),
  stanceNotice: document.querySelector('#stanceNotice'),
  commentInput: document.querySelector('#commentInput'),
  charCount: document.querySelector('#charCount'),
  submitComment: document.querySelector('#submitComment'),
  summaryFlow: document.querySelector('#summaryFlow'),
  summarySupport: document.querySelector('#summarySupport'),
  summaryOppose: document.querySelector('#summaryOppose'),
  summaryIssue: document.querySelector('#summaryIssue'),
  visibleCount: document.querySelector('#visibleCount'),
  commentList: document.querySelector('#commentList'),
  toast: document.querySelector('#toast'),
};

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function loadAlias() {
  try {
    const saved = localStorage.getItem(ALIAS_KEY);
    if (saved) return saved;
  } catch {
  }

  const alias = makeAlias();
  try {
    localStorage.setItem(ALIAS_KEY, alias);
  } catch {
  }
  return alias;
}

function makeAlias() {
  return `무명 ${String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')}`;
}

function useFallbackData() {
  state = {
    ...state,
    comments: [...fallbackComments],
    debate: { ...fallbackDebate },
    isLoading: false,
    summary: { ...fallbackSummary },
    usingMock: true,
  };
}

async function loadRemoteData() {
  const config = getSupabaseConfig();

  if (!config.isConfigured) {
    useFallbackData();
    render();
    return;
  }

  try {
    state.isLoading = true;
    render();

    const debate = await getActiveDebate();
    if (!debate) {
      useFallbackData();
      render();
      showToast('활성 논쟁이 없어 예시 데이터를 표시합니다.');
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
      isLoading: false,
      summary: summary ?? fallbackSummary,
      usingMock: false,
    };
    render();
  } catch (error) {
    useFallbackData();
    render();
    showToast('DB 연결에 실패해 예시 데이터를 표시합니다.');
    console.error(error);
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
  const supportCount = comments.filter((comment) => comment.side === 'pro').length;
  const opposeCount = comments.filter((comment) => comment.side === 'con').length;
  const support = (state.usingMock ? state.debate?.baseSupport ?? 0 : 0) + supportCount;
  const oppose = (state.usingMock ? state.debate?.baseOppose ?? 0 : 0) + opposeCount;
  const total = support + oppose;

  return {
    support,
    oppose,
    supportPercent: total ? Math.round((support / total) * 100) : 0,
    opposePercent: total ? Math.round((oppose / total) * 100) : 0,
    commentCount: (state.usingMock ? state.debate?.baseCommentCount ?? 0 : 0) + comments.length,
  };
}

function commentsForView() {
  const comments = topLevelComments();
  const filteredComments =
    state.filter === 'support' || state.filter === 'oppose'
      ? comments.filter((comment) => comment.side === stanceToSide(state.filter))
      : [...comments];

  return filteredComments.sort((a, b) => {
    if (state.filter === 'popular') {
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
  if (!state.debate) return;

  els.debateTitle.textContent = state.debate.title;
  els.debateCopy.textContent = state.debate.description ?? '';
}

function renderTotals() {
  const currentTotals = totals();

  els.supportFill.style.width = `${currentTotals.supportPercent}%`;
  els.opposeFill.style.width = `${currentTotals.opposePercent}%`;
  els.ratioText.textContent = `찬성 ${currentTotals.supportPercent}% / 반대 ${currentTotals.opposePercent}%`;
  els.engagementLine.textContent = `${formatNumber(
    currentTotals.support + currentTotals.oppose,
  )}명 참여 · ${formatNumber(currentTotals.commentCount)}개 댓글`;
}

function renderStance() {
  document.querySelectorAll('[data-stance]').forEach((button) => {
    button.classList.toggle('active', stanceToSide(button.dataset.stance) === selectedSide);
  });

  els.stanceNotice.classList.remove('support', 'oppose');

  if (!selectedSide) {
    els.stanceNotice.textContent = '입장을 선택하면 댓글 입력창에 표시됩니다.';
    return;
  }

  const label = sideToLabel(selectedSide);
  els.stanceNotice.textContent = `${label} 입장으로 댓글을 남깁니다.`;
  els.stanceNotice.classList.add(sideToStance(selectedSide));
}

function renderFilters() {
  document.querySelectorAll('[data-filter]').forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === state.filter);
  });
}

function renderSummary() {
  const summary = state.summary ?? fallbackSummary;
  els.summaryFlow.textContent = summary.overall_summary ?? fallbackSummary.overall_summary;
  els.summarySupport.textContent = summary.pro_summary ?? fallbackSummary.pro_summary;
  els.summaryOppose.textContent = summary.con_summary ?? fallbackSummary.con_summary;
  els.summaryIssue.textContent = summary.key_issue ?? fallbackSummary.key_issue;
}

function renderComments() {
  if (state.isLoading) {
    els.visibleCount.textContent = '불러오는 중';
    els.commentList.innerHTML = '<div class="empty-state">댓글을 불러오고 있습니다.</div>';
    return;
  }

  const comments = commentsForView();
  els.visibleCount.textContent = `${comments.length}개`;

  if (!comments.length) {
    els.commentList.innerHTML =
      '<div class="empty-state">아직 이 입장의 댓글이 없습니다.</div>';
    return;
  }

  els.commentList.innerHTML = comments.map(renderComment).join('');
}

function renderComment(comment) {
  const replies = repliesFor(comment.id);
  const replyBox =
    activeReplyId === comment.id
      ? `
        <div class='reply-box'>
          <textarea data-reply-input='${comment.id}' maxlength='160' placeholder='짧게 답글을 남겨주세요.'></textarea>
          <button class='primary-button' type='button' data-reply-submit='${comment.id}'>
            등록
          </button>
        </div>
      `
      : '';

  return `
    <article class='comment-card${comment.report_count > 0 ? ' flagged' : ''}'>
      <div class='comment-meta'>
        <span class='alias'>${escapeHtml(comment.nickname)}</span>
        <span>·</span>
        <span class='badge ${sideToStance(comment.side)}'>${sideToLabel(comment.side)}</span>
        <span>·</span>
        <span>${timeAgo(comment.created_at)}</span>
      </div>
      <p class='comment-body'>${escapeHtml(comment.content)}</p>
      <div class='comment-actions'>
        <button type='button' data-like='${comment.id}'>공감 ${comment.like_count ?? 0}</button>
        <span>·</span>
        <button type='button' data-reply='${comment.id}'>답글 ${replies.length}</button>
        <span>·</span>
        <button type='button' data-flag='${comment.id}'>${
          comment.report_count > 0 ? '신고됨' : '신고'
        }</button>
      </div>
      ${renderReplies(replies)}
      ${replyBox}
    </article>
  `;
}

function renderReplies(replies) {
  if (!replies.length) return '';

  return `
    <div class='reply-list'>
      ${replies
        .map(
          (reply) => `
            <div class='reply'>
              <strong>${escapeHtml(reply.nickname)} · ${timeAgo(reply.created_at)}</strong>
              <p>${escapeHtml(reply.content)}</p>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

async function addComment() {
  const content = els.commentInput.value.trim();

  if (!selectedSide) {
    showToast('찬성 또는 반대를 먼저 선택해주세요.');
    return;
  }

  if (content.length < 5) {
    showToast('댓글을 조금 더 남겨주세요.');
    return;
  }

  if (!state.debate) {
    showToast('활성 논쟁을 불러온 뒤 댓글을 남길 수 있습니다.');
    return;
  }

  try {
    els.submitComment.disabled = true;

    if (state.usingMock) {
      state.comments.unshift(makeLocalComment({ content, side: selectedSide }));
    } else {
      await createComment({
        content,
        debateId: state.debate.id,
        nickname: state.alias,
        side: selectedSide,
      });
      state.comments = await getComments(state.debate.id);
    }

    state.filter = 'all';
    activeReplyId = null;
    els.commentInput.value = '';
    updateCharCount();
    render();
    showToast('익명 댓글이 등록됐습니다.');
  } catch (error) {
    showToast('댓글 등록에 실패했습니다.');
    console.error(error);
  } finally {
    els.submitComment.disabled = false;
  }
}

async function addReply(commentId) {
  const parent = state.comments.find((comment) => comment.id === commentId);
  const input = document.querySelector(`[data-reply-input="${commentId}"]`);
  const content = input?.value.trim() ?? '';

  if (!parent) return;

  if (content.length < 3) {
    showToast('답글을 조금 더 남겨주세요.');
    return;
  }

  try {
    if (state.usingMock) {
      state.comments.push(
        makeLocalComment({
          content,
          parentId: commentId,
          side: parent.side,
        }),
      );
    } else {
      await createComment({
        content,
        debateId: state.debate.id,
        nickname: state.alias,
        parentId: commentId,
        side: parent.side,
      });
      state.comments = await getComments(state.debate.id);
    }

    activeReplyId = null;
    render();
    showToast('답글이 등록됐습니다.');
  } catch (error) {
    showToast('답글 등록에 실패했습니다.');
    console.error(error);
  }
}

function makeLocalComment({ content, side, parentId = null }) {
  return {
    id: `local-${crypto.randomUUID()}`,
    debate_id: state.debate.id,
    side,
    nickname: state.alias,
    content,
    parent_id: parentId,
    like_count: 0,
    report_count: 0,
    is_hidden: false,
    created_at: new Date().toISOString(),
  };
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
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    els.toast.classList.remove('show');
  }, 1700);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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
  return new Intl.NumberFormat('ko-KR').format(value);
}

function stanceToSide(stance) {
  if (stance === 'support') return 'pro';
  if (stance === 'oppose') return 'con';
  return stance;
}

function sideToStance(side) {
  return side === 'pro' ? 'support' : 'oppose';
}

function sideToLabel(side) {
  return side === 'pro' ? '찬성' : '반대';
}

document.addEventListener('click', (event) => {
  const stanceButton = event.target.closest('[data-stance]');
  if (stanceButton) {
    selectedSide = stanceToSide(stanceButton.dataset.stance);
    renderStance();
    return;
  }

  const filterButton = event.target.closest('[data-filter]');
  if (filterButton) {
    state.filter = filterButton.dataset.filter;
    activeReplyId = null;
    render();
    return;
  }

  const likeButton = event.target.closest('[data-like]');
  if (likeButton) {
    updateComment(likeButton.dataset.like, (comment) => ({
      ...comment,
      like_count: (comment.like_count ?? 0) + 1,
    }));
    return;
  }

  const flagButton = event.target.closest('[data-flag]');
  if (flagButton) {
    updateComment(flagButton.dataset.flag, (comment) => ({
      ...comment,
      report_count: comment.report_count > 0 ? 0 : 1,
    }));
    return;
  }

  const replyButton = event.target.closest('[data-reply]');
  if (replyButton) {
    activeReplyId =
      activeReplyId === replyButton.dataset.reply ? null : replyButton.dataset.reply;
    render();
    return;
  }

  const replySubmit = event.target.closest('[data-reply-submit]');
  if (replySubmit) {
    addReply(replySubmit.dataset.replySubmit);
  }
});

els.commentInput.addEventListener('input', updateCharCount);
els.submitComment.addEventListener('click', addComment);

updateCharCount();
useFallbackData();
render();
loadRemoteData();
