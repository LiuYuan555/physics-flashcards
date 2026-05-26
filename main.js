/* =============================================
   PHYSICS FLASHCARDS — MAIN JS
   ============================================= */

import { grade } from '/match.js';

// --- State ---
let chapters = [];
let currentChapterIdx = -1;
let currentCardIdx = 0;
let shuffled = false;
let cardOrder = [];
let progress = {}; // { "ch-N": Set([0, 2, ...]), ... }
let mode = 'study'; // 'study' | 'test'

// --- DOM ---
const $ = (sel) => document.querySelector(sel);
const sidebar = $('#sidebar');
const chapterNav = $('#chapter-nav');
const landing = $('#landing');
const landingStats = $('#landing-stats');

// Study view
const flashcardView = $('#flashcard-view');
const chapterTitle = $('#chapter-title');
const cardIndex = $('#card-index');
const cardTotal = $('#card-total');
const cardTerm = $('#card-term');
const cardDef = $('#card-def');
const flashcard = $('#flashcard');
const prevBtn = $('#prev-btn');
const nextBtn = $('#next-btn');
const shuffleBtn = $('#shuffle-btn');
const markKnownBtn = $('#mark-known-btn');
const resetChapterBtn = $('#reset-chapter-btn');
const chapterProgressBar = $('#chapter-progress-bar');
const chapterProgressText = $('#chapter-progress-text');

// Test view
const testView = $('#test-view');
const testChapterTitle = $('#test-chapter-title');
const testCardIndex = $('#test-card-index');
const testCardTotal = $('#test-card-total');
const testTerm = $('#test-term');
const testInput = $('#test-input');
const testInputArea = $('#test-input-area');
const testSubmitBtn = $('#test-submit-btn');
const testResult = $('#test-result');
const testResultBadge = $('#test-result-badge');
const testMissingList = $('#test-missing-list');
const testRealDef = $('#test-real-def');
const testNoKeywords = $('#test-no-keywords');
const testPrevBtn = $('#test-prev-btn');
const testNextBtn = $('#test-next-btn');
const testResetBtn = $('#test-reset-btn');
const testChapterProgressBar = $('#test-chapter-progress-bar');
const testChapterProgressText = $('#test-chapter-progress-text');

// Mode toggle
const modeStudyBtn = $('#mode-study-btn');
const modeTestBtn = $('#mode-test-btn');

// Global
const globalProgressBar = $('#global-progress-bar');
const globalProgressText = $('#global-progress-text');
const menuToggle = $('#menu-toggle');
const sidebarOverlay = $('#sidebar-overlay');

// --- Init ---
async function init() {
    const res = await fetch('/definitions.json');
    chapters = await res.json();

    loadProgress();

    renderChapterNav();
    renderLandingStats();
    updateGlobalProgress();

    // Study view events
    flashcard.addEventListener('click', flipCard);
    prevBtn.addEventListener('click', goToPrev);
    nextBtn.addEventListener('click', goToNext);
    shuffleBtn.addEventListener('click', toggleShuffle);
    markKnownBtn.addEventListener('click', markKnown);
    resetChapterBtn.addEventListener('click', resetChapter);

    // Test view events
    testPrevBtn.addEventListener('click', goToPrev);
    testNextBtn.addEventListener('click', goToNext);
    testSubmitBtn.addEventListener('click', submitTestAnswer);
    testResetBtn.addEventListener('click', resetChapter);
    testInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitTestAnswer();
        }
    });

    // Mode toggle events
    modeStudyBtn.addEventListener('click', () => setMode('study'));
    modeTestBtn.addEventListener('click', () => setMode('test'));

    // Mobile menu
    menuToggle.addEventListener('click', toggleMobileMenu);
    sidebarOverlay.addEventListener('click', toggleMobileMenu);

    // Keyboard navigation
    document.addEventListener('keydown', handleKeyboard);

    // Touch swipe on study flashcard
    let touchStartX = 0;
    let touchStartY = 0;
    flashcard.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    flashcard.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].screenX - touchStartX;
        const dy = e.changedTouches[0].screenY - touchStartY;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) goToPrev();
            else goToNext();
        }
    }, { passive: true });
}

// --- Mode ---
function setMode(next) {
    mode = next;
    modeStudyBtn.classList.toggle('active', mode === 'study');
    modeTestBtn.classList.toggle('active', mode === 'test');
    localStorage.setItem('physcards-mode', mode);

    if (currentChapterIdx >= 0) {
        showCard();
    }
    closeMobileMenu();
}

// --- Progress persistence ---
function loadProgress() {
    try {
        const saved = localStorage.getItem('physcards-progress');
        if (saved) {
            const parsed = JSON.parse(saved);
            for (const key of Object.keys(parsed)) {
                progress[key] = new Set(parsed[key]);
            }
        }
    } catch { /* ignore */ }

    try {
        const savedMode = localStorage.getItem('physcards-mode');
        if (savedMode === 'study' || savedMode === 'test') {
            mode = savedMode;
            modeStudyBtn.classList.toggle('active', mode === 'study');
            modeTestBtn.classList.toggle('active', mode === 'test');
        }
    } catch { /* ignore */ }
}

function saveProgress() {
    const obj = {};
    for (const key of Object.keys(progress)) {
        obj[key] = [...progress[key]];
    }
    localStorage.setItem('physcards-progress', JSON.stringify(obj));
}

function getProgressKey(chapterIdx) {
    return `ch-${chapters[chapterIdx].chapter}`;
}

function getKnownSet(chapterIdx) {
    const key = getProgressKey(chapterIdx);
    if (!progress[key]) progress[key] = new Set();
    return progress[key];
}

// --- Render ---
function renderChapterNav() {
    chapterNav.innerHTML = '';
    chapters.forEach((ch, idx) => {
        const btn = document.createElement('button');
        btn.className = 'chapter-btn';
        btn.dataset.idx = idx;

        const known = getKnownSet(idx);
        const allKnown = known.size >= ch.terms.length && ch.terms.length > 0;

        btn.innerHTML = `
      <span class="chapter-num">${ch.chapter}</span>
      <span class="chapter-btn-label">${formatTitle(ch.title)}</span>
      ${allKnown ? '<span class="chapter-check">✓</span>' : `<span class="chapter-btn-count">${ch.terms.length}</span>`}
    `;
        btn.addEventListener('click', () => selectChapter(idx));
        chapterNav.appendChild(btn);
    });
}

function formatTitle(title) {
    return title
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase())
        .replace(/\bD\.c\./gi, 'D.C.')
        .replace(/\bIi?\b/gi, match => match.toUpperCase())
        .replace(/\bEmf\b/gi, 'EMF')
        .replace(/\bE\.m\.f\b/gi, 'E.M.F');
}

function renderLandingStats() {
    const totalTerms = chapters.reduce((s, c) => s + c.terms.length, 0);
    const totalKnown = chapters.reduce((s, _, i) => s + getKnownSet(i).size, 0);
    landingStats.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${chapters.length}</div>
      <div class="stat-label">Chapters</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${totalTerms}</div>
      <div class="stat-label">Definitions</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${totalKnown}</div>
      <div class="stat-label">Mastered</div>
    </div>
  `;
}

// --- Chapter selection ---
function selectChapter(idx) {
    currentChapterIdx = idx;
    currentCardIdx = 0;
    generateCardOrder();

    document.querySelectorAll('.chapter-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === idx);
    });

    landing.classList.add('hidden');

    showCard();
    closeMobileMenu();
}

function generateCardOrder() {
    const ch = chapters[currentChapterIdx];
    cardOrder = Array.from({ length: ch.terms.length }, (_, i) => i);
    if (shuffled) shuffleArray(cardOrder);
}

// --- Card display (branches on mode) ---
function showCard() {
    if (mode === 'study') {
        showStudyCard();
    } else {
        showTestCard();
    }
}

function showStudyCard() {
    const ch = chapters[currentChapterIdx];
    if (!ch || ch.terms.length === 0) return;

    flashcardView.classList.remove('hidden');
    testView.classList.add('hidden');

    const realIdx = cardOrder[currentCardIdx];
    const term = ch.terms[realIdx];

    flashcard.classList.remove('flipped');
    flashcard.classList.remove('card-animate');
    void flashcard.offsetWidth;
    flashcard.classList.add('card-animate');

    chapterTitle.textContent = `Ch ${ch.chapter}: ${formatTitle(ch.title)}`;
    cardTotal.textContent = ch.terms.length;
    cardTerm.textContent = term.term;
    cardDef.textContent = term.definition;
    cardIndex.textContent = currentCardIdx + 1;

    const known = getKnownSet(currentChapterIdx);
    if (known.has(realIdx)) {
        markKnownBtn.textContent = '✅ Known';
        markKnownBtn.style.opacity = '0.6';
    } else {
        markKnownBtn.textContent = '✅ Got it';
        markKnownBtn.style.opacity = '1';
    }

    updateChapterProgress();
}

function showTestCard() {
    const ch = chapters[currentChapterIdx];
    if (!ch || ch.terms.length === 0) return;

    flashcardView.classList.add('hidden');
    testView.classList.remove('hidden');

    const realIdx = cardOrder[currentCardIdx];
    const term = ch.terms[realIdx];

    testChapterTitle.textContent = `Ch ${ch.chapter}: ${formatTitle(ch.title)}`;
    testCardTotal.textContent = ch.terms.length;
    testCardIndex.textContent = currentCardIdx + 1;
    testTerm.textContent = term.term;

    // Reset input and result
    testInput.value = '';
    testResult.classList.add('hidden');
    testResult.classList.remove('pass', 'fail');
    testMissingList.classList.add('hidden');

    if (!term.keywords || term.keywords.length === 0) {
        testInputArea.classList.add('hidden');
        testNoKeywords.classList.remove('hidden');
    } else {
        testInputArea.classList.remove('hidden');
        testNoKeywords.classList.add('hidden');
        testInput.focus();
    }

    updateTestChapterProgress();
}

function flipCard() {
    flashcard.classList.toggle('flipped');
}

// --- Navigation ---
function goToPrev() {
    if (currentChapterIdx < 0) return;
    const ch = chapters[currentChapterIdx];
    currentCardIdx = (currentCardIdx - 1 + ch.terms.length) % ch.terms.length;
    showCard();
}

function goToNext() {
    if (currentChapterIdx < 0) return;
    const ch = chapters[currentChapterIdx];
    currentCardIdx = (currentCardIdx + 1) % ch.terms.length;
    showCard();
}

function handleKeyboard(e) {
    if (currentChapterIdx < 0) return;

    // Don't intercept arrow keys while user is typing in the test textarea
    const inTextarea = document.activeElement === testInput;

    switch (e.key) {
        case 'ArrowLeft':
            if (inTextarea) return;
            e.preventDefault();
            goToPrev();
            break;
        case 'ArrowRight':
            if (inTextarea) return;
            e.preventDefault();
            goToNext();
            break;
        case ' ':
            if (mode === 'study') {
                e.preventDefault();
                flipCard();
            }
            break;
        case 'Enter':
            if (mode === 'study') {
                e.preventDefault();
                markKnown();
            } else if (mode === 'test' && !inTextarea) {
                e.preventDefault();
                submitTestAnswer();
            }
            break;
    }
}

// --- Test answer submission ---
function submitTestAnswer() {
    if (currentChapterIdx < 0) return;
    const realIdx = cardOrder[currentCardIdx];
    const term = chapters[currentChapterIdx].terms[realIdx];

    if (!term.keywords || term.keywords.length === 0) return;

    const userText = testInput.value;
    const result = grade(userText, term.keywords);

    testRealDef.textContent = term.definition;
    testResult.classList.remove('hidden', 'pass', 'fail');

    if (result.ok) {
        testResult.classList.add('pass');
        testResultBadge.textContent = '✓ Correct — all keywords matched';
        testMissingList.classList.add('hidden');

        // Mark known and auto-advance (reuse existing logic)
        const known = getKnownSet(currentChapterIdx);
        if (!known.has(realIdx)) {
            known.add(realIdx);
            saveProgress();
            updateGlobalProgress();
            renderChapterNav();
            renderLandingStats();
        }
        updateTestChapterProgress();

        const ch = chapters[currentChapterIdx];
        if (currentCardIdx < ch.terms.length - 1) {
            setTimeout(() => goToNext(), 1200);
        }
    } else {
        testResult.classList.add('fail');
        testResultBadge.textContent = '✗ Missing keywords:';
        testMissingList.classList.remove('hidden');
        testMissingList.innerHTML = result.missing
            .map(k => `<li>${k}</li>`)
            .join('');
    }

    // Blur textarea so arrow keys navigate again after submitting
    testInput.blur();
}

// --- Shuffle ---
function toggleShuffle() {
    shuffled = !shuffled;
    shuffleBtn.textContent = shuffled ? '🔀 Shuffled' : '🔀 Shuffle';
    shuffleBtn.style.color = shuffled ? 'var(--accent-3)' : '';
    if (currentChapterIdx >= 0) {
        currentCardIdx = 0;
        generateCardOrder();
        showCard();
    }
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

// --- Progress ---
function markKnown() {
    if (currentChapterIdx < 0) return;
    const realIdx = cardOrder[currentCardIdx];
    const known = getKnownSet(currentChapterIdx);

    if (known.has(realIdx)) {
        known.delete(realIdx);
    } else {
        known.add(realIdx);
    }

    saveProgress();
    updateChapterProgress();
    updateGlobalProgress();
    renderChapterNav();
    renderLandingStats();
    showCard();

    const ch = chapters[currentChapterIdx];
    if (known.has(realIdx) && currentCardIdx < ch.terms.length - 1) {
        setTimeout(() => goToNext(), 350);
    }
}

function resetChapter() {
    if (currentChapterIdx < 0) return;
    const key = getProgressKey(currentChapterIdx);
    progress[key] = new Set();
    saveProgress();
    updateChapterProgress();
    updateTestChapterProgress();
    updateGlobalProgress();
    renderChapterNav();
    renderLandingStats();
    showCard();
}

function updateChapterProgress() {
    if (currentChapterIdx < 0) return;
    const ch = chapters[currentChapterIdx];
    const known = getKnownSet(currentChapterIdx);
    const pct = ch.terms.length > 0 ? (known.size / ch.terms.length) * 100 : 0;
    chapterProgressBar.style.width = `${pct}%`;
    chapterProgressText.textContent = `${known.size} / ${ch.terms.length} mastered`;
}

function updateTestChapterProgress() {
    if (currentChapterIdx < 0) return;
    const ch = chapters[currentChapterIdx];
    const known = getKnownSet(currentChapterIdx);
    const pct = ch.terms.length > 0 ? (known.size / ch.terms.length) * 100 : 0;
    testChapterProgressBar.style.width = `${pct}%`;
    testChapterProgressText.textContent = `${known.size} / ${ch.terms.length} mastered`;
}

function updateGlobalProgress() {
    const totalTerms = chapters.reduce((s, c) => s + c.terms.length, 0);
    const totalKnown = chapters.reduce((s, _, i) => s + getKnownSet(i).size, 0);
    const pct = totalTerms > 0 ? (totalKnown / totalTerms) * 100 : 0;
    globalProgressBar.style.width = `${pct}%`;
    globalProgressText.textContent = `${totalKnown} / ${totalTerms}`;
}

// --- Mobile ---
function toggleMobileMenu() {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('active');
}
function closeMobileMenu() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
}

// --- Start ---
init();
