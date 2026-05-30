// ── Firebase 設定 ─────────────────────────────────────
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyBq_JVaEuQourIEOxHGgAYh7xxTRxJ0NJQ",
  authDomain: "pinpoint-hight-school.firebaseapp.com",
  projectId: "pinpoint-hight-school",
  storageBucket: "pinpoint-hight-school.firebasestorage.app",
  messagingSenderId: "262627714991",
  appId: "1:262627714991:web:858160c30bff16db9ef15a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ── 科目設定 ──────────────────────────────────────────
const SUBJECTS = {
  '社會': {
    desc: '歷史、地理、公民（學測與分科）',
    focus: `
科目專屬規則：
- 用詞必須符合台灣現行高中教科書標準：中國大陸稱「中國」、國民黨政府稱「國民政府」
- 歷史題目需標明朝代/年代背景
- 地理題需結合圖表概念
- 公民題需結合時事與憲政概念`
  },
  '自然': {
    desc: '物理、化學、生物、地球科學',
    focus: `
科目專屬規則：
- 物理化學需附公式說明
- 生物題需結合圖解概念
- 地科需結合台灣本土地理現象`
  },
  '國文': {
    desc: '國文（學測與分科）',
    focus: `
科目專屬規則：
- 文言文需附白話翻譯
- 題目可涵蓋語文知識、閱讀理解、文學常識`
  },
  '英文': {
    desc: '英文（學測與分科）',
    focus: `
科目專屬規則：
- 解說可中英並用
- 題目需符合學測英文題型（詞彙、克漏字、閱讀）`
  },
  '數學': {
    desc: '數學A/B（學測與分科）',
    focus: `
科目專屬規則：
- 解題過程用自然語言一步一步說明，像老師在黑板上寫給你看
- 絕對不要用程式碼或程式語法
- 數學式用純文字表示，例如：x^2，分數寫成 1/2，根號寫成 √
- 每個步驟說清楚「為什麼這樣做」
- 題目難度符合學測水準，不出超綱內容`
  }
};

const EXAM_LINKS = {
  '社會': 'https://www.ceec.edu.tw/xmdoc/cont?xsmsid=0J052980485393644&sid=0J073105838730702',
  '自然': 'https://www.ceec.edu.tw/xmdoc/cont?xsmsid=0J052980485393644&sid=0J073105889450313',
  '國文': 'https://www.ceec.edu.tw/xmdoc/cont?xsmsid=0J052980485393644&sid=0J073105730116392',
  '英文': 'https://www.ceec.edu.tw/xmdoc/cont?xsmsid=0J052980485393644&sid=0J073105762046949',
  '數學': 'https://www.ceec.edu.tw/xmdoc/cont?xsmsid=0J052980485393644&sid=0J073105802886045'
};

function buildSystemPrompt(subject) {
  const s = SUBJECTS[subject] || SUBJECTS['社會'];
  return `你是一個專為台灣高中考生設計的學習助理，專注於學測與分科測驗，目前科目為【${subject}】（${s.desc}）。

你的教學風格：
1. 解說主題時，用最精簡的方式說清楚核心概念（像在跟朋友解釋）
2. 用具體例子或類比幫助記憶
3. 解說完後，出一道仿學測風格的選擇題（四個選項 A B C D），難度中等偏高，不能有爭議性或模稜兩可的選項
4. 學生回答後，給予具體回饋：告知正確答案，答對補充延伸知識，答錯溫和說明並重新解釋
5. 每次回答結尾加上「📚 歷屆精選題」區塊

格式規則：
- 解說部分不超過200字
- 選擇題格式：
  📌 練習題：[題目]
  A. [選項]
  B. [選項]
  C. [選項]
  D. [選項]
- 歷屆精選題區塊：
  📚 歷屆精選題：大考中心【${subject}】歷屆試題：
  🔗 ${EXAM_LINKS[subject] || 'https://www.ceec.edu.tw/xmdoc/cont?xsmsid=0J052980485393644'}
- 用繁體中文回答，用詞口語自然，政治正確，符合台灣教育部現行課綱
${s.focus}`;
}

// ── 狀態 ──────────────────────────────────────────────
const DAILY_LIMIT = 3;
let messages = [];
let isLoading = false;
let currentSubject = '社會';
let currentUser = null;
let isPremium = false;
let isLoginMode = true;

window.openPricing = function() {
  document.getElementById('pricing-modal').style.display = 'flex';
};
window.closePricing = function() {
  document.getElementById('pricing-modal').style.display = 'none';
};

// ── Auth 狀態監聽 ─────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await loadUserData(user);
    document.getElementById('auth-modal').style.display = 'none';
    document.getElementById('user-btn').textContent = user.email?.split('@')[0] || 'User';
    updateUsageDisplay();
    initChat();
  } else {
    currentUser = null;
    isPremium = false;
    document.getElementById('auth-modal').style.display = 'flex';
  }
});

// ── 載入用戶資料 ──────────────────────────────────────
async function loadUserData(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  const today = new Date().toDateString();

  // 檢查有沒有 pending 升級（付款時還沒註冊）
  const pendingRef = doc(db, 'pending_upgrades', user.email);
  const pendingSnap = await getDoc(pendingRef);
  if (pendingSnap.exists()) {
    const pending = pendingSnap.data();
    await setDoc(ref, {
      email: user.email,
      isPremium: true,
      premiumUntil: pending.premiumUntil,
      plan: pending.plan,
      usage: { date: today, count: 0 }
    }, { merge: true });
    // 清除 pending
    const { deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    await deleteDoc(pendingRef);
    isPremium = true;
    updateSubscribeBtn();
    return;
  }

  if (!snap.exists()) {
    await setDoc(ref, {
      email: user.email,
      createdAt: new Date(),
      isPremium: false,
      premiumUntil: null,
      usage: { date: today, count: 0 }
    });
    isPremium = false;
  } else {
    const data = snap.data();
    // 檢查會員是否到期
    if (data.premiumUntil && data.premiumUntil.toDate() < new Date()) {
      await updateDoc(ref, { isPremium: false });
      isPremium = false;
    } else {
      isPremium = data.isPremium || false;
    }
    // 重置每日次數
    if (data.usage?.date !== today) {
      await updateDoc(ref, { usage: { date: today, count: 0 } });
    }
  }
  updateSubscribeBtn();
}

function updateSubscribeBtn() {
  const btn = document.getElementById('subscribe-btn');
  if (isPremium) {
    btn.textContent = '✦ 會員中';
    btn.style.background = 'var(--accent2)';
    btn.style.color = '#fff';
    btn.removeAttribute('href');
    btn.style.cursor = 'default';
  }
}

// ── 取得剩餘次數 ──────────────────────────────────────
async function getRemainingCount() {
  if (isPremium) return 999;
  const ref = doc(db, 'users', currentUser.uid);
  const snap = await getDoc(ref);
  const data = snap.data();
  const today = new Date().toDateString();
  if (data.usage?.date !== today) return DAILY_LIMIT;
  return Math.max(0, DAILY_LIMIT - (data.usage?.count || 0));
}

async function incrementUsage() {
  if (isPremium) return;
  const ref = doc(db, 'users', currentUser.uid);
  const snap = await getDoc(ref);
  const data = snap.data();
  const today = new Date().toDateString();
  const currentCount = data.usage?.date === today ? (data.usage?.count || 0) : 0;
  await updateDoc(ref, { usage: { date: today, count: currentCount + 1 } });
}

async function updateUsageDisplay() {
  if (!currentUser) return;
  const remaining = await getRemainingCount();
  const el = document.getElementById('usage-counter');
  if (el) {
    if (isPremium) {
      el.textContent = '✦ 會員・無限次數';
      el.style.color = 'var(--accent)';
    } else {
      el.textContent = `今日剩餘 ${remaining} / ${DAILY_LIMIT} 次`;
      el.style.color = remaining <= 1 ? '#ff6b6b' : 'var(--muted)';
    }
  }
}

// ── Auth 函數 ─────────────────────────────────────────
window.toggleAuthMode = function() {
  isLoginMode = !isLoginMode;
  document.getElementById('auth-title').textContent = isLoginMode ? '登入' : '註冊';
  document.getElementById('auth-desc').textContent = isLoginMode
    ? '登入後學習記錄跨裝置同步，不怕換手機資料消失。'
    : '建立帳號，開始你的備考之旅。';
  document.getElementById('auth-main-btn').textContent = isLoginMode ? '登入' : '註冊';
  document.getElementById('auth-switch').innerHTML = isLoginMode
    ? '還沒有帳號？<a onclick="toggleAuthMode()">立即註冊</a>'
    : '已有帳號？<a onclick="toggleAuthMode()">登入</a>';
  document.getElementById('auth-error').textContent = '';
};

window.handleAuth = async function() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errorEl = document.getElementById('auth-error');
  errorEl.textContent = '';

  if (!email || !password) { errorEl.textContent = '請填寫 Email 和密碼'; return; }

  try {
    if (isLoginMode) {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
    }
  } catch (err) {
    const msgs = {
      'auth/user-not-found': 'Email 不存在，請先註冊',
      'auth/wrong-password': '密碼錯誤',
      'auth/email-already-in-use': '此 Email 已被使用',
      'auth/weak-password': '密碼至少需要6位',
      'auth/invalid-email': 'Email 格式不正確',
      'auth/invalid-credential': 'Email 或密碼錯誤'
    };
    errorEl.textContent = msgs[err.code] || '發生錯誤，請再試一次';
  }
};

window.signInWithGoogle = async function() {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    document.getElementById('auth-error').textContent = 'Google 登入失敗，請再試一次';
  }
};

window.handleUserBtn = async function() {
  await signOut(auth);
  messages = [];
  document.getElementById('chat').innerHTML = '';
};

// ── 初始化 Chat ───────────────────────────────────────
function initChat() {
  const chat = document.getElementById('chat');
  if (!document.getElementById('welcome')) {
    chat.appendChild(createWelcome());
  }

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentSubject = tab.textContent.trim();
      messages = [];
      chat.innerHTML = '';
      chat.appendChild(createWelcome());
    });
  });
}

function createWelcome() {
  const div = document.createElement('div');
  div.id = 'welcome';
  const topics = {
    '社會': ['二二八事件', '台灣土地改革', '民主政治與選舉制度', '季風與洋流', '全球化與在地化', '人口結構與遷移'],
    '自然': ['板塊構造學說', '光合作用', '牛頓運動定律', '酸鹼中和', '遺傳與DNA', '颱風生成原因'],
    '國文': ['文言文閱讀技巧', '成語典故', '詩經與楚辭', '唐宋八大家', '現代文學', '修辭技巧'],
    '英文': ['時態用法', '關係子句', '假設語氣', '克漏字技巧', '閱讀理解策略', '詞彙記憶法'],
    '數學': ['函數與圖形', '排列組合', '機率', '三角函數', '向量', '統計']
  };
  const list = topics[currentSubject] || topics['社會'];
  const topicsHtml = list.map(t => `<div class="quick-topic" onclick="setInput('${t}')">${t}</div>`).join('');
  div.innerHTML = `
    <div class="welcome-title">今天想學<br>什麼<span class="hl">主題</span>？</div>
    <div class="welcome-sub">輸入任何考試主題，我會用最有效率的方式幫你搞懂，然後出題確認你真的學會了。</div>
    <div class="quick-topics">${topicsHtml}</div>
  `;
  return div;
}

// ── 輸入處理 ──────────────────────────────────────────
const textarea = document.getElementById('user-input');
textarea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
textarea.addEventListener('input', autoResize);

function autoResize() {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
}

window.setInput = function(text) {
  textarea.value = text;
  textarea.focus();
  autoResize();
};

// ── 送出訊息 ──────────────────────────────────────────
window.sendMessage = async function() {
  const text = textarea.value.trim();
  if (!text || isLoading || !currentUser) return;

  const remaining = await getRemainingCount();
  if (remaining <= 0) {
    appendMessage('ai', `⚠️ 你今天的免費次數（${DAILY_LIMIT}次）已用完，明天再來繼續學習！`);
    textarea.value = '';
    autoResize();
    setTimeout(() => openPricing(), 800);
    return;
  }

  const welcome = document.getElementById('welcome');
  if (welcome) welcome.remove();

  messages.push({ role: 'user', content: text });
  appendMessage('user', text);
  textarea.value = '';
  autoResize();

  isLoading = true;
  document.getElementById('send-btn').disabled = true;
  const typingEl = appendTyping();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: buildSystemPrompt(currentSubject), messages })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const aiText = data.content[0].text;
    messages.push({ role: 'assistant', content: aiText });

    await incrementUsage();
    await updateUsageDisplay();

    typingEl.remove();
    appendMessage('ai', aiText);

  } catch (err) {
    typingEl.remove();
    appendMessage('ai', `⚠️ 發生錯誤：${err.message}`);
  } finally {
    isLoading = false;
    document.getElementById('send-btn').disabled = false;
  }
};

// ── 顯示訊息 ──────────────────────────────────────────
function appendMessage(role, text) {
  const chat = document.getElementById('chat');
  const msgEl = document.createElement('div');
  msgEl.className = `msg ${role}`;
  const label = document.createElement('div');
  label.className = 'msg-label';
  label.textContent = role === 'user' ? '你' : 'AI 老師';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = role === 'ai' ? formatAiText(text) : escapeHtml(text);
  msgEl.appendChild(label);
  msgEl.appendChild(bubble);
  chat.appendChild(msgEl);
  chat.scrollTop = chat.scrollHeight;
}

function appendTyping() {
  const chat = document.getElementById('chat');
  const msgEl = document.createElement('div');
  msgEl.className = 'msg ai';
  const label = document.createElement('div');
  label.className = 'msg-label';
  label.textContent = 'AI 老師';
  const typing = document.createElement('div');
  typing.className = 'typing';
  typing.innerHTML = '<span></span><span></span><span></span>';
  msgEl.appendChild(label);
  msgEl.appendChild(typing);
  chat.appendChild(msgEl);
  chat.scrollTop = chat.scrollHeight;
  return msgEl;
}

function formatAiText(text) {
  let html = '';
  const lines = text.split('\n');
  let questionHtml = '';
  let inQuestion = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('📌')) {
      if (questionHtml) html += `<div class="question-box">${questionHtml}</div>`;
      questionHtml = escapeHtml(line) + '<br>';
      inQuestion = true;
    } else if (line.startsWith('📚')) {
      if (questionHtml) { html += `<div class="question-box">${questionHtml}</div>`; questionHtml = ''; inQuestion = false; }
      html += `<div class="ceec-box">${escapeHtmlWithLinks(line)}<br>`;
      for (let j = i + 1; j < lines.length; j++) {
        html += escapeHtmlWithLinks(lines[j]) + '<br>';
        i = j;
        if (!lines[j].trim()) break;
      }
      html += '</div>';
    } else if (inQuestion && line.trim()) {
      questionHtml += escapeHtml(line) + '<br>';
    } else if (inQuestion && !line.trim()) {
      html += `<div class="question-box">${questionHtml}</div>`;
      questionHtml = ''; inQuestion = false;
      html += '<br>';
    } else {
      html += line.trim() ? `<span>${escapeHtml(line)}</span><br>` : '<br>';
    }
  }
  if (questionHtml) html += `<div class="question-box">${questionHtml}</div>`;
  return html;
}

function escapeHtml(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escapeHtmlWithLinks(t) {
  return escapeHtml(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" class="ceec-link">$1</a>');
}
