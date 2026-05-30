// ── 科目設定 ──────────────────────────────────────────
const SUBJECTS = {
  '社會': {
    desc: '歷史、地理、公民（學測與分科）',
    focus: `
科目專屬規則：
- 用詞必須符合台灣現行高中教科書標準：中國大陸稱「中國」、國民黨政府稱「國民政府」、光復後台灣史用詞依教育部課綱
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
- 需逐步解題，展示思考邏輯
- 題目需附計算過程提示`
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
4. 學生回答後，給予具體回饋：告知正確答案，答對就補充延伸知識，答錯就溫和說明哪裡理解有誤
5. 每次回答結尾加上「📚 歷屆精選題」區塊，提供大考中心連結讓學生自行練習

格式規則：
- 解說部分不超過200字，簡潔有力
- 選擇題格式：
  📌 練習題：[題目]
  A. [選項]
  B. [選項]
  C. [選項]
  D. [選項]
- 歷屆精選題區塊格式：
  📚 歷屆精選題：以下為大考中心【${subject}】歷屆試題直連，點擊即可下載練習：
  🔗 ${EXAM_LINKS[subject] || 'https://www.ceec.edu.tw/xmdoc/cont?xsmsid=0J052980485393644'}
- 用繁體中文回答，用詞口語自然
- 政治正確，符合台灣教育部現行課綱用詞
${s.focus}`;
}

// ── 狀態 ──────────────────────────────────────────────
let messages = [];
let isLoading = false;
let currentSubject = '社會';

// ── 初始化 ────────────────────────────────────────────
window.onload = () => {
  autoResize();

  // 產生初始歡迎畫面
  const chat = document.getElementById('chat');
  chat.appendChild(createWelcome());

  // 科目切換
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentSubject = tab.textContent.trim();
      messages = []; // 切換科目時清除對話

      // 回到歡迎畫面
      const chat = document.getElementById('chat');
      chat.innerHTML = '';
      const welcome = createWelcome();
      chat.appendChild(welcome);
    });
  });
};

function createWelcome() {
  const div = document.createElement('div');
  div.id = 'welcome';
  div.innerHTML = `
    <div class="welcome-title">今天想學<br>什麼<span class="hl">主題</span>？</div>
    <div class="welcome-sub">輸入任何考試主題，我會用最有效率的方式幫你搞懂，然後出題確認你真的學會了。</div>
    <div class="quick-topics" id="quick-topics"></div>
  `;

  const topics = {
    '社會': ['二二八事件', '台灣土地改革', '民主政治與選舉制度', '季風與洋流', '全球化與在地化', '人口結構與遷移'],
    '自然': ['板塊構造學說', '光合作用', '牛頓運動定律', '酸鹼中和', '遺傳與DNA', '颱風生成原因'],
    '國文': ['文言文閱讀技巧', '成語典故', '詩經與楚辭', '唐宋八大家', '現代文學', '修辭技巧'],
    '英文': ['時態用法', '關係子句', '假設語氣', '克漏字技巧', '閱讀理解策略', '詞彙記憶法'],
    '數學': ['函數與圖形', '排列組合', '機率', '三角函數', '向量', '統計']
  };

  const container = div.querySelector('#quick-topics');
  const list = topics[currentSubject] || topics['社會'];
  list.forEach(t => {
    const btn = document.createElement('div');
    btn.className = 'quick-topic';
    btn.textContent = t;
    btn.onclick = () => setInput(t);
    container.appendChild(btn);
  });

  return div;
}

// ── API Key ───────────────────────────────────────────
function saveApiKey() {
  const input = document.getElementById('api-key-input').value.trim();
  if (!input.startsWith('sk-ant-')) {
    alert('請輸入正確的 Anthropic API Key（以 sk-ant- 開頭）');
    return;
  }
  apiKey = input;
  localStorage.setItem('study_api_key', apiKey);
  document.getElementById('api-setup').style.display = 'none';
}

// ── 輸入處理 ──────────────────────────────────────────
const textarea = document.getElementById('user-input');

textarea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

textarea.addEventListener('input', autoResize);

function autoResize() {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
}

function setInput(text) {
  textarea.value = text;
  textarea.focus();
  autoResize();
}

// ── 送出訊息 ──────────────────────────────────────────
async function sendMessage() {
  const text = textarea.value.trim();
  if (!text || isLoading) return;

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
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        system: buildSystemPrompt(currentSubject),
        messages: messages
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const aiText = data.content[0].text;
    messages.push({ role: 'assistant', content: aiText });

    typingEl.remove();
    appendMessage('ai', aiText);

  } catch (err) {
    typingEl.remove();
    appendMessage('ai', `⚠️ 發生錯誤：${err.message}`);
  } finally {
    isLoading = false;
    document.getElementById('send-btn').disabled = false;
  }
}

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

  if (role === 'ai') {
    bubble.innerHTML = formatAiText(text);
  } else {
    bubble.textContent = text;
  }

  msgEl.appendChild(label);
  msgEl.appendChild(bubble);
  chat.appendChild(msgEl);
  chat.scrollTop = chat.scrollHeight;
}

function formatAiText(text) {
  let html = '';
  const lines = text.split('\n');
  let inQuestion = false;
  let inOptions = false;
  let questionHtml = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 練習題開始
    if (line.startsWith('📌')) {
      if (questionHtml) html += `<div class="question-box">${questionHtml}</div>`;
      questionHtml = escapeHtml(line) + '<br>';
      inQuestion = true;
      inOptions = false;
      continue;
    }

    // 歷屆精選題
    if (line.startsWith('📚')) {
      if (questionHtml) { html += `<div class="question-box">${questionHtml}</div>`; questionHtml = ''; inQuestion = false; }
      html += `<div class="ceec-box">${escapeHtmlWithLinks(line)}<br>`;
      inQuestion = false;
      // 繼續收集直到空行
      for (let j = i+1; j < lines.length; j++) {
        html += escapeHtmlWithLinks(lines[j]) + '<br>';
        i = j;
        if (!lines[j].trim()) break;
      }
      html += '</div>';
      continue;
    }

    // 選項 A B C D
    if (inQuestion && /^[A-D]\./.test(line.trim())) {
      questionHtml += escapeHtml(line) + '<br>';
      continue;
    }

    // 一般文字
    if (inQuestion && line.trim()) {
      questionHtml += escapeHtml(line) + '<br>';
    } else if (!inQuestion) {
      if (line.trim()) {
        html += `<span>${escapeHtml(line)}</span><br>`;
      } else {
        html += '<br>';
      }
    } else {
      // 空行結束 question block
      if (questionHtml) { html += `<div class="question-box">${questionHtml}</div>`; questionHtml = ''; inQuestion = false; }
      html += '<br>';
    }
  }

  if (questionHtml) html += `<div class="question-box">${questionHtml}</div>`;
  return html;
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtmlWithLinks(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" class="ceec-link">$1</a>');
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
