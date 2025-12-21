// app.js — 3파일( index.html / style.css / app.js ) + pikachu.mp3 로 동작
// ✅ 정답을 맞추면 ./pikachu.mp3 재생
// ✅ 1~251(2세대) 포켓몬 한국어 이름은 PokeAPI에서 로드하고 localStorage에 캐시
// ✅ 틀려도 글자 힌트 자동 공개 없음 / 별 0이면 자동 정답 공개 없음

// ---------- 설정 ----------
const GEN2_MAX_ID = 251;
const MAX_WRONG = 3;
const CHOICES_COUNT = 10;
const FILLERS = ["가","나","다","라","마","바","사","아","자","하","카","타","파","거","너","더","러","머","버","서","어"];

// (선택) 특정 포켓몬을 더 자주(앞쪽) 나오게 하고 싶으면 id를 넣어줘.
// 예: const PINNED_IDS = [4, 25, 150];
const PINNED_IDS = [];

// 캐시 키 (형식 바꾸면 v2, v3로 올리면 됨)
const CACHE_KEY = "pk_ko_1_251_v1";

// ✅ 정답 사운드 (같은 폴더에 pikachu.mp3를 두는 기준)
const correctSound = new Audio("./pikachu.mp3");
correctSound.preload = "auto";

// ---------- DOM ----------
const elImg = document.getElementById("pokeImg");
const elMasked = document.getElementById("masked");
const elKeyboard = document.getElementById("keyboard");
const elMsg = document.getElementById("msg");
const elStars = document.getElementById("stars");
const elLoaded = document.getElementById("loaded");

const elLoadingBox = document.getElementById("loadingBox");
const elLoadingText = document.getElementById("loadingText");
const elButtonsRow = document.getElementById("buttonsRow");

document.getElementById("nextBtn").onclick = nextQuestion;
document.getElementById("revealBtn").onclick = revealAll;

// ---------- 상태 ----------
let QUESTIONS = [];
let answer = "";
let revealed = [];
let wrong = 0;
let currentId = null;

// ---------- 유틸 ----------
function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function renderStars() {
  const left = Math.max(0, MAX_WRONG - wrong);
  elStars.textContent = "★".repeat(left) + "☆".repeat(MAX_WRONG - left);
}

function setImageBlur() {
  // 틀릴수록 선명
  const blurPx = [10, 6, 3, 0][Math.min(wrong, 3)];
  elImg.style.filter = `blur(${blurPx}px)`;
}

function renderMasked() {
  const chars = [...answer].map((ch, i) => (revealed[i] ? ch : "_"));
  elMasked.textContent = chars.join(" ");
}

function disableKeyboard() {
  [...elKeyboard.querySelectorAll("button")].forEach((b) => (b.disabled = true));
}

function buildChoices(name) {
  const unique = Array.from(new Set([...name]));
  let pool = [...unique];

  while (pool.length < CHOICES_COUNT) {
    const cand = FILLERS[Math.floor(Math.random() * FILLERS.length)];
    if (!pool.includes(cand)) pool.push(cand);
    if (pool.length > 50) break;
  }

  return shuffle(pool).slice(0, CHOICES_COUNT);
}

function buildKeyboard(choices) {
  elKeyboard.innerHTML = "";
  choices.forEach((ch) => {
    const btn = document.createElement("button");
    btn.textContent = ch;
    btn.onclick = () => pickChar(ch, btn);
    elKeyboard.appendChild(btn);
  });
}

// ---------- 게임 로직 ----------
function revealAll() {
  revealed = Array(answer.length).fill(true);
  renderMasked();
  elMsg.textContent = `정답은 "${answer}"!`;
  disableKeyboard();
  elImg.style.filter = "blur(0px)";
}

function playCorrectSound() {
  // 같은 소리를 연속으로 눌러도 재생되게
  try {
    correctSound.currentTime = 0;
    correctSound.play().catch(() => {});
  } catch (_) {}
}

function pickChar(ch, btn) {
  if (wrong >= MAX_WRONG) return;

  let hit = false;

  [...answer].forEach((a, i) => {
    if (a === ch) {
      revealed[i] = true;
      hit = true;
    }
  });

  btn.disabled = true;
  btn.className = hit ? "hit" : "miss";

  if (!hit) {
    wrong += 1;
    renderStars();
    setImageBlur();
    elMsg.textContent = "아쉽다! 다른 글자를 골라보자.";
  } else {
    elMsg.textContent = "맞았어!";
  }

  renderMasked();

  // ✅ 정답 완성
  if (revealed.every(Boolean)) {
    playCorrectSound(); // ✅ 첨부 파일(피카츄 사운드) 재생

    elMsg.textContent = "정답! 🎉 다음 문제를 눌러보자!";
    disableKeyboard();
    elImg.style.filter = "blur(0px)";
    return;
  }

  // ✅ B안: 별 0이어도 자동 정답 공개 X
  if (wrong >= MAX_WRONG) {
    elMsg.textContent = "기회가 끝났어! ‘정답 보기’를 눌러볼까?";
    disableKeyboard();
    elImg.style.filter = "blur(0px)";
  }
}

function startQuestion(q) {
  currentId = q.id;
  answer = q.name;

  revealed = Array(answer.length).fill(false); // 처음엔 전부 빈칸
  wrong = 0;

  elImg.src = q.image;
  elMsg.textContent = "";

  renderStars();
  setImageBlur();
  renderMasked();

  buildKeyboard(buildChoices(answer));
}

function nextQuestion() {
  if (!QUESTIONS.length) return;
  const idx = Math.floor(Math.random() * QUESTIONS.length);
  startQuestion(QUESTIONS[idx]);
}

// ---------- PokeAPI 로드 ----------
function officialArtworkUrl(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

async function mapWithConcurrency(items, limit, fn) {
  const results = [];
  let i = 0;

  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  const workers = Array.from({ length: limit }, () => worker());
  await Promise.all(workers);
  return results;
}

async function fetchKoreanNameById(id) {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}/`);
  if (!res.ok) throw new Error(`species ${id} fetch failed`);
  const data = await res.json();
  const ko = (data.names || []).find((n) => n.language?.name === "ko");
  return ko?.name || null;
}

async function buildQuestions1to251() {
  // 캐시 확인
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length >= 200) {
        return parsed;
      }
    } catch (_) {}
  }

  const ids = Array.from({ length: GEN2_MAX_ID }, (_, i) => i + 1);

  elLoadingText.textContent = "포켓몬 이름(한국어)을 불러오는 중...";

  // 동시성 제한
  const rows = await mapWithConcurrency(ids, 8, async (id, idx) => {
    if ((idx + 1) % 25 === 0) {
      elLoadingText.textContent = `포켓몬 데이터 불러오는 중... (${idx + 1}/${GEN2_MAX_ID})`;
    }
    const name = await fetchKoreanNameById(id);
    return { id, name };
  });

  const result = rows
    .filter((x) => x.name)
    .map((x) => ({
      id: x.id,
      name: x.name,
      image: officialArtworkUrl(x.id),
    }));

  localStorage.setItem(CACHE_KEY, JSON.stringify(result));
  return result;
}

function applyPinned(questions) {
  if (!PINNED_IDS.length) return questions;

  const byId = new Map(questions.map((q) => [q.id, q]));
  const pinned = PINNED_IDS
    .map((id) => byId.get(id))
    .filter(Boolean);

  const pinnedSet = new Set(pinned.map((q) => q.id));
  const rest = questions.filter((q) => !pinnedSet.has(q.id));
  return [...pinned, ...rest];
}

// ---------- UI ----------
function showGameUI() {
  elLoadingBox.classList.add("hidden");
  elImg.classList.remove("hidden");
  elMasked.classList.remove("hidden");
  elMsg.classList.remove("hidden");
  elKeyboard.classList.remove("hidden");
  elButtonsRow.classList.remove("hidden");
}

// ---------- 시작 ----------
async function init() {
  renderStars();
  elLoaded.textContent = "로딩 중...";

  try {
    const list = await buildQuestions1to251();
    QUESTIONS = applyPinned(list);

    elLoaded.textContent = `로드 완료: ${QUESTIONS.length}마리 (1~251)`;
    showGameUI();
    nextQuestion();
  } catch (e) {
    elLoaded.textContent = "로드 실패";
    elLoadingText.textContent = "데이터를 불러오지 못했어요. 인터넷 연결을 확인해줘.";
  }
}

init();
