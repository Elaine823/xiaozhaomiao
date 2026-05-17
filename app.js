// 小招喵 H5 Demo - 完整本地状态管理 + Coze 智能体 + 文本兜底解析
document.addEventListener('DOMContentLoaded', () => {
  "use strict";

  // ============ DOM ============
  const mascotImg = document.getElementById('mascotImg');
  const mascotStage = document.getElementById('mascotStage');
  const headerAvatar = document.getElementById('headerAvatar');
  const headerLevel = document.getElementById('headerLevel');
  const meowPowerVal = document.getElementById('meowPowerVal');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const chatArea = document.getElementById('chatArea');
  const todaySpentEl = document.getElementById('todaySpent');
  const weeklyLeftEl = document.getElementById('weeklyLeft');
  const goalNameEl = document.getElementById('goalName');
  const goalProgressEl = document.getElementById('goalProgress');
  const quickChips = document.getElementById('quickChips');

  // ============ 常量 ============
  const STORAGE_KEY = 'xiaozhaomiao_state';

  const chipPrompts = {
    '快速记账': '快告诉我今天的钱花在哪啦喵',
    '储蓄计划': '想攒点钱吗？告诉我目标金额和时间喵',
    '理财科普': '想了解什么理财小知识呀喵？',
    '风险咨询': '遇到可疑的兼职或理财信息了吗喵？发来我帮你看看'
  };

  // 消费关键词 → 类别
  const CATEGORY_MAP = [
    { kws: ['午饭','晚饭','早饭','早餐','中饭','食堂','外卖','面','米饭','聚餐','夜宵','饭','吃饭','饭钱','汉堡','烧烤'], cat: '餐饮' },
    { kws: ['奶茶','咖啡','饮料','果茶','茶','可乐','酸奶','喝的','奶昔'], cat: '饮品' },
    { kws: ['打车','地铁','公交','共享单车','车票','火车','高铁','机票','滴滴','网约车','加油'], cat: '交通' },
    { kws: ['资料','书','打印','课程','考试','文具','笔','本子','论文','网课','题库'], cat: '学习' },
    { kws: ['电影','游戏','会员','演唱会','KTV','剧本杀','桌游','演出','电玩'], cat: '娱乐' },
    { kws: ['衣服','鞋','包','护肤','化妆品','网购','淘宝','拼多多','衣','袜'], cat: '购物' },
    { kws: ['洗衣','快递','宿舍','水电','日用品','超市','水果','纸巾','日用','水'], cat: '生活' },
    { kws: ['礼物','请客','生日','聚会','送礼','份子钱'], cat: '社交' },
    { kws: ['医院','挂号','药','体检','口罩','感冒药'], cat: '医疗' }
  ];

  // ============ 状态管理 ============
  const defaultState = {
    meowPower: 135,
    todaySpent: 0,
    weeklySpent: 0,
    weeklyBudget: 300,
    dailyBudget: null,
    ledger: [],
    savingGoals: [],
    activeGoalId: null,
    lastDate: null
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...defaultState, ...JSON.parse(raw) };
    } catch (e) {}
    return { ...defaultState };
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function checkDayReset() {
    const today = new Date().toDateString();
    if (state.lastDate && state.lastDate !== today) {
      state.todaySpent = 0;
      if (new Date().getDay() === 1) state.weeklySpent = 0;
    }
    state.lastDate = today;
    saveState();
  }

  let state = loadState();
  checkDayReset();

  // ============ 小招喵成长 ============
  const stages = [
    { threshold: 0,   img: 'stage-1.png', level: 'Lv.1' },
    { threshold: 200, img: 'stage-2.png', level: 'Lv.2' },
    { threshold: 400, img: 'stage-3.png', level: 'Lv.3' },
    { threshold: 600, img: 'stage-4.png', level: 'Lv.Max' }
  ];

  function getStageIndex(power) {
    let idx = 0;
    for (let i = 0; i < stages.length; i++) {
      if (power >= stages[i].threshold) idx = i;
    }
    return idx;
  }

  let currentStageIndex = getStageIndex(state.meowPower);

  function applyMascotStage(idx, animate) {
    const img = stages[idx].img;
    const level = stages[idx].level;
    if (animate) {
      mascotImg.style.opacity = '0';
      mascotImg.style.transform = 'translateY(6px) scale(0.94)';
      setTimeout(() => {
        mascotImg.src = `./assets/stages/${img}`;
        // 顶部头像固定使用用户提供的新头像，不随成长阶段切换
        headerLevel.textContent = level;
        mascotImg.style.opacity = '1';
        mascotImg.style.transform = 'translateY(0) scale(1)';
        triggerMascotMood('proud', 1200);
      }, 240);
    } else {
      mascotImg.src = `./assets/stages/${img}`;
      headerLevel.textContent = level;
    }
  }

  // ============ UI 同步 ============
  function syncUI() {
    meowPowerVal.textContent = state.meowPower;
    todaySpentEl.textContent = state.todaySpent;
    const left = state.weeklyBudget - state.weeklySpent;
    weeklyLeftEl.textContent = left > 0 ? left : 0;

    const activeGoal = state.savingGoals.find(g => g.id === state.activeGoalId);
    if (activeGoal) {
      goalNameEl.textContent = activeGoal.name;
      const pct = activeGoal.target > 0
        ? Math.min(100, Math.round((activeGoal.saved / activeGoal.target) * 100))
        : 0;
      goalProgressEl.textContent = `进度 ${pct}%`;
    } else {
      goalNameEl.textContent = '暂无目标';
      goalProgressEl.textContent = '设置一个试试';
    }

    // 检查阶段
    const newIdx = getStageIndex(state.meowPower);
    if (newIdx !== currentStageIndex) {
      currentStageIndex = newIdx;
      applyMascotStage(currentStageIndex, true);
    }
  }

  // ============ 状态变更函数 ============
  function addPower(delta) {
    if (!delta || delta <= 0) return;
    state.meowPower += delta;
    saveState();
    syncUI();
  }

  function addSpending(amount) {
    if (!amount || amount <= 0) return;
    state.todaySpent += amount;
    state.weeklySpent += amount;
    saveState();
    syncUI();
  }

  function addLedger(items, total) {
    state.ledger.push({
      date: new Date().toISOString(),
      items: items || [],
      total: total || 0
    });
    if (state.ledger.length > 200) state.ledger = state.ledger.slice(-200);
    saveState();
  }

  function upsertSavingGoal(goalData) {
    const idx = state.savingGoals.findIndex(g => g.name === goalData.name);
    if (idx >= 0) {
      state.savingGoals[idx] = { ...state.savingGoals[idx], ...goalData };
    } else {
      goalData.id = `goal_${Date.now()}`;
      goalData.createdAt = new Date().toISOString();
      state.savingGoals.push(goalData);
    }
    const newGoal = state.savingGoals.find(g => g.name === goalData.name);
    state.activeGoalId = newGoal.id;
    if (newGoal.dailyBudget && newGoal.dailyBudget > 0) {
      state.dailyBudget = newGoal.dailyBudget;
    }
    saveState();
    syncUI();
  }

  // ============ 文本解析（兜底） ============
  function inferCategory(itemName) {
    if (!itemName) return '其他';
    for (const m of CATEGORY_MAP) {
      if (m.kws.some(k => itemName.includes(k))) return m.cat;
    }
    return '其他';
  }

  // 解析用户原始输入中的记账信息
  function parseUserExpense(userInput) {
    if (!userInput) return null;

    // 匹配模式：项目名+数字 / 数字+元/块/项目名
    // 例如: 午饭18  奶茶16  打车23元  花了76
    const items = [];
    // 中文名+数字
    const re1 = /([\u4e00-\u9fa5]{1,8})\s*(\d+(?:\.\d+)?)(?:\s*元|\s*块|\s*¥)?/g;
    let match;
    const seen = new Set();
    while ((match = re1.exec(userInput)) !== null) {
      const name = match[1].trim();
      const amount = parseFloat(match[2]);
      if (!name || isNaN(amount) || amount <= 0 || amount > 100000) continue;
      // 排除明显非消费名词
      if (['今天', '昨天', '前天', '我','你','这','花了','花','买了','买','收到','大约','大概','左右'].includes(name)) continue;
      const key = `${name}-${amount}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        name,
        amount,
        category: inferCategory(name)
      });
    }

    // 如果没匹配到带名字的消费，再试一次只有"花了 N"的兜底
    if (items.length === 0) {
      const re2 = /(?:花了?|消费|付了?)?\s*(\d+(?:\.\d+)?)\s*(?:元|块|¥)/g;
      while ((match = re2.exec(userInput)) !== null) {
        const amount = parseFloat(match[1]);
        if (isNaN(amount) || amount <= 0) continue;
        items.push({ name: '未分类消费', amount, category: '其他' });
        break; // 只取一笔
      }
    }

    if (items.length === 0) return null;

    const total = items.reduce((sum, i) => sum + i.amount, 0);
    return { items, total };
  }

  // 解析用户原始输入中的攒钱目标
  function parseUserSaving(userInput) {
    if (!userInput) return null;
    const hasIntent = /(攒|存)/.test(userInput) || /(想.*?(买|去))/.test(userInput);
    if (!hasIntent) return null;

    // 目标金额
    let targetAmount = null;
    const amtMatch = userInput.match(/(\d{2,6})\s*(?:元|块)?/);
    if (amtMatch) targetAmount = parseInt(amtMatch[1], 10);

    // 周期识别
    let durationDays = null;
    let durationStr = '';
    const dMap = [
      { re: /([一二三四五六七八九十两\d]+)\s*周/, base: 7 },
      { re: /([一二三四五六七八九十两\d]+)\s*个月/, base: 30 },
      { re: /([一二三四五六七八九十两\d]+)\s*月/, base: 30 },
      { re: /半年/, fixed: 180 },
      { re: /一年|1\s*年/, fixed: 365 }
    ];
    const zhNum = { '一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10 };

    for (const d of dMap) {
      const m = userInput.match(d.re);
      if (m) {
        if (d.fixed) {
          durationDays = d.fixed;
          durationStr = m[0];
        } else {
          let n = m[1];
          if (zhNum[n]) n = zhNum[n];
          n = parseInt(n, 10) || 1;
          durationDays = n * d.base;
          durationStr = m[0];
        }
        break;
      }
    }

    // 目标名称
    let goalName = '小目标基金';
    const nameMap = [
      { kw: '耳机', name: '耳机基金', reward: '耳机挂件' },
      { kw: '电脑', name: '电脑基金', reward: '数码工作台皮肤' },
      { kw: '手机', name: '手机基金', reward: '数码挂件' },
      { kw: '键盘', name: '键盘基金', reward: '键盘挂件' },
      { kw: '演唱会', name: '演唱会基金', reward: '应援灯牌挂件' },
      { kw: '旅行', name: '旅行基金', reward: '校园旅行地图' },
      { kw: '旅游', name: '旅行基金', reward: '校园旅行地图' },
      { kw: '考证', name: '考证基金', reward: '学习书桌装饰' },
      { kw: '应急', name: '应急金小窝', reward: '小金窝家具' }
    ];
    let reward = '小招喵专属挂件';
    for (const n of nameMap) {
      if (userInput.includes(n.kw)) {
        goalName = n.name;
        reward = n.reward;
        break;
      }
    }

    if (!targetAmount) return null;

    const durationWeeks = durationDays ? Math.ceil(durationDays / 7) : null;
    const dailyTask = durationDays ? Math.ceil(targetAmount / durationDays) : null;
    const weeklyTask = durationWeeks ? Math.ceil(targetAmount / durationWeeks) : null;

    return {
      name: goalName,
      target: targetAmount,
      saved: 0,
      duration: durationStr || '',
      dailyTask,
      weeklyTask,
      dailyBudget: null,
      reward,
      status: '初步计划'
    };
  }

  // 从回复文本中提取喵力值变化（如"喵力值+10"）
  function parsePowerDeltaFromReply(replyText) {
    if (!replyText) return 0;
    const m = replyText.match(/喵力值\s*[\+加]\s*(\d+)/);
    if (m) return parseInt(m[1], 10);
    return 0;
  }

  // 判断意图（基于用户输入和回复）
  function inferIntent(userInput, replyText) {
    const text = (userInput || '') + ' ' + (replyText || '');
    // 风险类关键词优先级最高
    if (/(返佣|刷单|高收益|保本|稳赚|校园贷|培训费|先交钱|验证码|身份证|银行卡出租|杀猪盘|荐股)/.test(text)) return 'risk';
    // 攒钱目标信号（"想买/想看/想要 + 金额"或明确说"攒钱/存钱/目标"）
    if (/(想看|想买|想要|想去|目标|攒|存钱|存到|存够|存够|生活费.*\d|每月.*\d)/.test(userInput || '')) return 'saving';
    // 理财科普关键词
    if (/(基金|定投|理财|风险等级|年化|货币基金|复利|指数基金|股票|债券)/.test(text)) return 'finance';
    // 明确的记账信号：必须包含"花/吃/买/付 + 金额 + (元/块/钱)" 或者就是"X 元 + 商品名"的简短记账格式
    if (/(花|吃|买|付|喝|打车|地铁|外卖|早饭|午饭|晚饭|奶茶|咖啡)[^。，,.]{0,8}\d+(\.\d+)?\s*(元|块|¥|￥)?/.test(userInput || '')) return 'expense';
    if (/^\s*(午饭|晚饭|早饭|奶茶|咖啡|外卖|打车|地铁|快递|零食|水果)\s*\d+(\.\d+)?\s*(元|块|¥|￥)?\s*$/.test(userInput || '')) return 'expense';
    return 'general';
  }

  // ============ 工具 ============
  function scrollToBottom() {
    requestAnimationFrame(() => { chatArea.scrollTop = chatArea.scrollHeight; });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"]/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m]));
  }

  function addBubble(text, side) {
    const b = document.createElement('div');
    b.className = `bubble bubble-${side}`;
    b.innerHTML = `<span class="bubble-text">${escapeHtml(text)}</span>`;
    chatArea.appendChild(b);
    if (side === 'left') {
      attachFeedback(b, text);
      triggerMascotMood(pickMascotMood(text), 1600);
    }
    scrollToBottom();
  }

  // 吉祥物生命感：根据回复内容切换表情/动作
  function pickMascotMood(text) {
    if (/(记好|成功|完成|加油|真好|升级|满阶|好嘞)/.test(text || '')) return 'proud';
    if (/(想|思考|等等|试试|看看|可以|了解)/.test(text || '')) return 'thinking';
    return 'speaking';
  }

  function triggerMascotMood(mood, duration = 1400) {
    if (!mascotStage) return;
    mascotStage.classList.remove('is-speaking', 'is-thinking', 'is-proud');
    mascotStage.classList.add(`is-${mood}`);
    clearTimeout(triggerMascotMood.timer);
    triggerMascotMood.timer = setTimeout(() => {
      mascotStage.classList.remove('is-speaking', 'is-thinking', 'is-proud');
    }, duration);
  }

  function mascotTap() {
    if (!mascotStage) return;
    mascotStage.classList.remove('is-clicking');
    // 强制重播动画
    void mascotStage.offsetWidth;
    mascotStage.classList.add('is-clicking');
    triggerMascotMood('proud', 1000);
    setTimeout(() => mascotStage.classList.remove('is-clicking'), 780);
  }

  // 反馈按钮（仅在小招喵气泡下方出现）
  function attachFeedback(bubbleEl, replyText) {
    const fb = document.createElement('div');
    fb.className = 'feedback-row';
    fb.innerHTML = `
      <button class="fb-btn fb-up" data-vote="up" aria-label="赞">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3z"/><path d="M7 11l4-7c.4-.7 1.1-1 1.8-.8.9.2 1.4 1 1.4 2v4h4.5c1.2 0 2.1 1 1.9 2.2l-1.2 7.4a2 2 0 0 1-2 1.7H7"/></svg>
      </button>
      <button class="fb-btn fb-down" data-vote="down" aria-label="踩">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 13V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-3z"/><path d="M17 13l-4 7c-.4.7-1.1 1-1.8.8-.9-.2-1.4-1-1.4-2v-4H5.3c-1.2 0-2.1-1-1.9-2.2l1.2-7.4a2 2 0 0 1 2-1.7H17"/></svg>
      </button>
    `;
    bubbleEl.appendChild(fb);

    fb.addEventListener('click', (e) => {
      const btn = e.target.closest('.fb-btn');
      if (!btn) return;
      const vote = btn.dataset.vote;
      // 互斥：点同一个 = 取消，点另一个 = 切换
      const already = btn.classList.contains('fb-active');
      fb.querySelectorAll('.fb-btn').forEach(b => b.classList.remove('fb-active'));
      if (!already) {
        btn.classList.add('fb-active');
        recordFeedback(vote, replyText);
      } else {
        recordFeedback('cancel', replyText);
      }
    });
  }

  // 反馈日志（本地 localStorage）
  function recordFeedback(vote, replyText) {
    try {
      const KEY = 'xiaozhaomiao_feedback';
      const log = JSON.parse(localStorage.getItem(KEY) || '[]');
      log.push({
        vote: vote,
        reply: replyText.slice(0, 200),
        ts: Date.now()
      });
      // 最多保留 500 条，避免无限增长
      if (log.length > 500) log.splice(0, log.length - 500);
      localStorage.setItem(KEY, JSON.stringify(log));
    } catch (e) {
      // 静默
    }
  }

  function addLoadingBubble() {
    triggerMascotMood('thinking', 2400);
    const b = document.createElement('div');
    b.className = 'bubble bubble-left bubble-loading';
    b.id = 'loadingBubble';
    b.innerHTML = '<span class="bubble-text">小招喵思考中...</span>';
    chatArea.appendChild(b);
    scrollToBottom();
  }

  function removeLoadingBubble() {
    const el = document.getElementById('loadingBubble');
    if (el) el.remove();
  }

  // ============ 卡片渲染 ============
  function renderExpenseCard(items, total) {
    const el = document.createElement('article');
    el.className = 'knowledge-card';
    el.innerHTML = `
      <div class="card-title">记账确认</div>
      <div class="card-inner">
        <h3>今日新增记账</h3>
        ${items.map(i => `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;color:#5A5A5E"><span>${escapeHtml(i.name)}</span><span>${i.amount}元 · ${escapeHtml(i.category)}</span></div>`).join('')}
        <div style="text-align:right;font-size:14px;font-weight:700;color:#D71920;margin-top:6px">合计 ${total} 元</div>
      </div>`;
    chatArea.appendChild(el);
    scrollToBottom();
  }

  function renderSavingGoalCard(goal) {
    const el = document.createElement('article');
    el.className = 'knowledge-card';
    el.innerHTML = `
      <div class="card-title">${goal.status === '初步计划' ? '初步攒钱计划' : '攒钱计划'}</div>
      <div class="card-inner">
        <h3>${escapeHtml(goal.name)}</h3>
        <div class="card-list">
          <span>目标：${goal.target} 元</span>
          ${goal.duration ? `<span>周期：${escapeHtml(goal.duration)}</span>` : ''}
          ${goal.dailyTask ? `<span>每天存：${goal.dailyTask} 元</span>` : ''}
          ${goal.weeklyTask ? `<span>每周存：${goal.weeklyTask} 元</span>` : ''}
          ${goal.dailyBudget && goal.dailyBudget > 0 ? `<span>每日可花：${goal.dailyBudget} 元</span>` : ''}
          ${goal.reward ? `<span>奖励：${escapeHtml(goal.reward)}</span>` : ''}
        </div>
      </div>`;
    chatArea.appendChild(el);
    scrollToBottom();
  }

  // 同时支持 Coze 返回的结构化 card
  function renderStructuredCard(card) {
    if (!card || !card.type) return;
    const el = document.createElement('article');
    switch (card.type) {
      case 'expense_card':
        return renderExpenseCard(card.items || [], card.total || 0);
      case 'saving_goal_card':
      case 'saving_goal_draft_card':
        return renderSavingGoalCard({
          name: card.title || '小目标',
          target: card.target_amount || 0,
          saved: card.current_saved || 0,
          duration: card.duration || '',
          dailyTask: card.daily_saving_task,
          weeklyTask: card.weekly_task,
          dailyBudget: card.daily_spending_budget,
          reward: card.reward,
          status: card.status || '进行中'
        });
      case 'knowledge_card':
        el.className = 'knowledge-card';
        el.innerHTML = `
          <div class="card-title">理财知识</div>
          <div class="card-inner">
            <h3>${escapeHtml(card.title || '')}</h3>
            <p style="font-size:12px;line-height:1.6;color:#5A5A5E;margin-top:6px">${escapeHtml(card.viewpoint || '')}</p>
          </div>`;
        chatArea.appendChild(el);
        scrollToBottom();
        return;
      case 'risk_card':
        el.className = 'knowledge-card';
        el.style.background = card.risk_level === 'high'
          ? 'linear-gradient(180deg, #FFF0F0 0%, #FFFFFF 100%)'
          : 'linear-gradient(180deg, #FFF8F0 0%, #FFFFFF 100%)';
        el.innerHTML = `
          <div class="card-title" style="color:${card.risk_level === 'high' ? '#C0392B' : '#C8860C'}">
            ${card.risk_level === 'high' ? '高风险提醒' : '风险提示'}
          </div>
          <div class="card-inner">
            <h3>${escapeHtml(card.title || '注意风险')}</h3>
            <p style="font-size:12px;line-height:1.6;color:#5A5A5E;margin-top:6px">${escapeHtml(card.viewpoint || '')}</p>
          </div>`;
        chatArea.appendChild(el);
        scrollToBottom();
        return;
    }
  }

  // ============ Coze 调用 ============
  let isSending = false;

  // 前端简易门票，与 Vercel 环境变量 DEMO_ACCESS_TOKEN 一致。
  // 浏览器 F12 可见，仅用于挡住非浏览器场景的脚本刷量；真正安全靠后端 Origin 校验与限流。
  const DEMO_TOKEN = 'xzm-demo-2026';

  // 会话 ID（放 sessionStorage，关闭标签页即重置；要持久化跨标签可改 localStorage）
  // 用 sessionStorage 的好处：用户重开页面 = 新对话，避免上下文越积越长拖慢响应
  const CONV_KEY = 'xiaozhaomiao_conv_id';
  function getConversationId() {
    try { return sessionStorage.getItem(CONV_KEY) || null; } catch (e) { return null; }
  }
  function setConversationId(id) {
    try { if (id) sessionStorage.setItem(CONV_KEY, id); } catch (e) {}
  }

  async function callAPI(userMessage) {
    const conv = getConversationId();
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-token': DEMO_TOKEN
      },
      body: JSON.stringify({
        user_message: userMessage,
        user_id: 'demo_user_001',
        conversation_id: conv  // 第一次为 null，之后保持同一会话
      })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const result = await resp.json();
    // 透传：把 Coze 返回的 conversation_id 持久化到 sessionStorage
    if (result && result.conversation_id) {
      setConversationId(result.conversation_id);
    }
    return result;
  }

  function parseReplyContent(result) {
    let reply = '';
    let structured = null;

    if (result.reply) reply = result.reply;
    else if (typeof result === 'string') reply = result;

    // 尝试解析 reply 是否本身就是 JSON
    if (reply && (reply.trim().startsWith('{') || reply.trim().startsWith('['))) {
      try {
        const parsed = JSON.parse(reply);
        if (parsed && typeof parsed === 'object') {
          structured = parsed;
          if (parsed.reply) reply = parsed.reply;
        }
      } catch (e) {}
    }

    // 合并 result 顶层结构化字段
    if (result.cards || result.card || result.state_update) {
      structured = structured || {};
      if (result.cards) structured.cards = result.cards;
      if (result.card) structured.card = result.card;
      if (result.state_update) structured.state_update = result.state_update;
    }

    reply = String(reply || '').trim();
    if (!reply) reply = '我在呢喵，有什么能帮你的吗喵';

    return { reply, structured };
  }

  // ============ 本地消费回顾拦截器 ============
  // 当用户问"花了多少 / 这周/今天 / 餐饮花了多少 / 哪笔最大 / 几顿外卖"等查询类问题时
  // 直接读 localStorage 账本回答，不走 Coze（更快、更准、不耗 token）
  // ============ 本地能力路由器 ============
  // 不需要 LLM 推理的所有能力全部在本地处理
  // 返回 { reply, card?, powerDelta? } 或 null（让 Coze 接管）
  function tryLocalQuery(input) {
    if (!input) return null;
    const text = input.replace(/\s+/g, '');

    // ---- 1. 问候 / 闲聊 / 自我介绍（高频开场白） ----
    if (/^(你好|您好|hi|hello|嗨|在吗|在不在|你叫什么|你是谁|介绍.{0,2}你)/i.test(text)) {
      return {
        reply: greetingReply(),
        powerDelta: 2
      };
    }

    // ---- 2. 帮助 / 能做什么 ----
    if (/(怎么用|能做什么|有什么功能|帮我啥|帮助|功能|说明|指南|教程)/.test(text)) {
      return {
        reply: '我可以帮你做四件事喵：① 一句话记账（比如说"午饭30"）② 攒钱目标（说"想买XX要XX元"）③ 理财科普（问"基金是什么"）④ 风险识别（粘贴可疑信息）。也能查回顾，比如问"我这周花了多少"喵',
        powerDelta: 1
      };
    }

    // ---- 3. 当前状态查询：剩多少能花 / 我攒了多少 / 喵力值多少 / 进化到哪了 ----
    if (/(还能花|还剩|预算剩|可花|本周.{0,2}剩|今天.{0,2}剩|余额)/.test(text)) {
      return localBudgetLeft();
    }
    if (/(我攒了|攒了多少|存了多少|目标进度|攒钱进度|储蓄进度)/.test(text)) {
      return localSavingProgress();
    }
    if (/(喵力值|我.{0,2}多少分|多少喵力|经验值|多少级|第几级|什么阶段)/.test(text)) {
      return localPowerStatus();
    }

    // ---- 4. 消费回顾（"花了多少 / 哪笔最大 / 几笔 / 平均"） ----
    if (/(花了|花.{0,3}多少|消费|开销|开支|账单|记录|哪.{0,3}最|几.{0,3}笔|总共.{0,2}花|一共.{0,2}花|平均)/.test(text)
        || /^(查|看|算|统计)/.test(text)) {
      return localConsumptionReview(text);
    }

    // ---- 5. 重置 / 清空（敏感操作，要二次确认） ----
    if (/^(重置|清空|清零|删除|抹掉|reset|clear)/i.test(text)) {
      return localResetGuide(text);
    }

    // ---- 5.5 换个话题 / 重置对话上下文（清 Coze 会话） ----
    if (/^(换个话题|换话题|重新开始|新对话|重置对话|清除上下文)/.test(text)) {
      try { sessionStorage.removeItem(CONV_KEY); } catch (e) {}
      return {
        reply: '好嘞喵，咱重新开始聊～你想说点什么？',
        powerDelta: 0
      };
    }

    // ---- 6. 设置预算（本周可花 / 周预算 / 月预算） ----
    const budgetMatch = text.match(/(?:本?周|每周|周)预算(?:设(?:成|为|置)?|改(?:成|为)?)?\s*(\d+)/);
    if (budgetMatch) {
      const v = parseInt(budgetMatch[1], 10);
      state.weeklyBudget = v;
      saveState();
      syncUI();
      return {
        reply: `好嘞喵，本周预算改成 ${v} 元啦，剩 ${Math.max(0, v - state.weeklySpent)} 元可以花喵`,
        powerDelta: 3
      };
    }

    // 把 Coze 留给真正需要 LLM 的：理财科普、风险判断、攒钱目标拆解、复杂记账
    return null;
  }

  // ---- 子函数：每次随机一句问候，避免单调 ----
  function greetingReply() {
    const opts = [
      '嗨，你来啦喵～今天想聊点什么？',
      '在的喵～最近钱花得怎么样？',
      '嗨呀，我是小招喵，可以陪你记账、攒钱、聊理财喵',
      '你好喵～今天有什么想问的吗？'
    ];
    return opts[Math.floor(Math.random() * opts.length)];
  }

  // ---- 子函数：本周/今日剩余预算 ----
  function localBudgetLeft() {
    const weeklyBudget = state.weeklyBudget || 0;
    const weeklyLeft = Math.max(0, weeklyBudget - state.weeklySpent);
    const todaySpent = state.todaySpent || 0;
    const dailyBudget = state.dailyBudget;

    const lines = [];
    lines.push(`本周预算 ${weeklyBudget} 元，已花 ${state.weeklySpent} 元，还能花 ${weeklyLeft} 元喵`);
    if (dailyBudget != null && dailyBudget > 0) {
      const todayLeft = Math.max(0, dailyBudget - todaySpent);
      lines.push(`今天预算 ${dailyBudget} 元，已花 ${todaySpent} 元，还剩 ${todayLeft} 元喵`);
    } else if (todaySpent > 0) {
      lines.push(`今天目前花了 ${todaySpent} 元`);
    }
    // 健康度提示
    if (weeklyBudget > 0) {
      const ratio = state.weeklySpent / weeklyBudget;
      if (ratio >= 1) lines.push('⚠️ 本周预算已经超啦，节制一下喵');
      else if (ratio >= 0.8) lines.push('快到周预算 80% 了，剩下几天悠着点喵');
    }
    return { reply: lines.join('，'), powerDelta: 1 };
  }

  // ---- 子函数：攒钱进度 ----
  function localSavingProgress() {
    const goals = state.savingGoals || [];
    if (goals.length === 0) {
      return {
        reply: '你还没设过攒钱目标呢喵，跟我说一声"想买XX要XX元"，我帮你算每天该存多少喵',
        powerDelta: 1
      };
    }
    if (goals.length === 1) {
      const g = goals[0];
      const pct = g.target > 0 ? Math.min(100, Math.round((g.saved || 0) / g.target * 100)) : 0;
      const left = Math.max(0, (g.target || 0) - (g.saved || 0));
      return {
        reply: `「${g.name}」攒到 ${g.saved || 0}/${g.target} 元啦喵（${pct}%），还差 ${left} 元，加油喵`,
        powerDelta: 2
      };
    }
    // 多目标
    const lines = goals.slice(0, 3).map(g => {
      const pct = g.target > 0 ? Math.round((g.saved || 0) / g.target * 100) : 0;
      return `${g.name} ${g.saved || 0}/${g.target} 元 (${pct}%)`;
    });
    return {
      reply: `你目前的攒钱目标喵：\n` + lines.join('\n'),
      powerDelta: 2
    };
  }

  // ---- 子函数：喵力值 / 阶段 ----
  function localPowerStatus() {
    const power = state.meowPower || 0;
    const idx = getStageIndex(power);
    const cur = stages[idx];
    const next = stages[idx + 1];
    if (!next) {
      return {
        reply: `喵力值 ${power}，已经是 ${cur.level} 满阶啦喵～你陪我成长得真好`,
        powerDelta: 0
      };
    }
    const need = next.threshold - power;
    return {
      reply: `当前喵力值 ${power}，处于 ${cur.level}，再攒 ${need} 喵力就能升到 ${next.level} 喵～继续记账、攒钱、学理财都能加分哦`,
      powerDelta: 0
    };
  }

  // ---- 子函数：消费回顾 ----
  function localConsumptionReview(text) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = today - now.getDay() * 86400000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let scope = 'week', scopeLabel = '本周';
    if (/今天|今日|当天/.test(text)) { scope = 'today'; scopeLabel = '今天'; }
    else if (/这周|本周|这礼拜|这星期/.test(text)) { scope = 'week'; scopeLabel = '本周'; }
    else if (/这个月|本月|这月/.test(text)) { scope = 'month'; scopeLabel = '本月'; }

    const minTs = scope === 'today' ? today : scope === 'week' ? weekStart : monthStart;

    const allItems = [];
    let totalAmount = 0;
    (state.ledger || []).forEach(entry => {
      const ts = new Date(entry.date).getTime();
      if (ts < minTs) return;
      (entry.items || []).forEach(it => {
        allItems.push({ ...it, ts });
        totalAmount += Number(it.amount) || 0;
      });
    });

    if (allItems.length === 0) {
      return {
        reply: `${scopeLabel}还没记账呢喵，要不先告诉我今天吃了点啥？比如"午饭25"喵`,
        powerDelta: 1
      };
    }

    const catMatch = ['餐饮','饮品','交通','学习','娱乐','购物','生活','社交','医疗']
      .find(c => text.includes(c));

    const byCat = {};
    allItems.forEach(it => {
      const c = it.category || '其他';
      byCat[c] = (byCat[c] || 0) + (Number(it.amount) || 0);
    });
    const catRanking = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

    // 平均
    if (/平均/.test(text)) {
      const avg = (totalAmount / allItems.length).toFixed(1);
      return {
        reply: `${scopeLabel}平均每笔 ${avg} 元喵，共 ${allItems.length} 笔，总计 ${totalAmount} 元`,
        card: { scope: scopeLabel, total: totalAmount, items: allItems.slice(-6).reverse(), catRanking },
        powerDelta: 2
      };
    }

    // 哪笔最大
    if (/哪.{0,3}最|最大|最贵|最多.{0,3}笔/.test(text)) {
      const top = [...allItems].sort((a, b) => (b.amount || 0) - (a.amount || 0))[0];
      return {
        reply: `${scopeLabel}最大一笔是${top.name} ${top.amount}元（${top.category || '其他'}）喵，要不要看看这类开销能不能控制一下？`,
        card: { scope: scopeLabel, total: totalAmount, items: allItems.slice(0, 8), catRanking },
        powerDelta: 2
      };
    }

    // 类别专项
    if (catMatch) {
      const catTotal = byCat[catMatch] || 0;
      const catItems = allItems.filter(it => it.category === catMatch);
      if (catTotal === 0) {
        return { reply: `${scopeLabel}${catMatch}还没记录哦喵`, powerDelta: 1 };
      }
      return {
        reply: `${scopeLabel}${catMatch}花了 ${catTotal} 元喵，共 ${catItems.length} 笔`,
        card: { scope: `${scopeLabel} · ${catMatch}`, total: catTotal, items: catItems.slice(0, 8), catRanking: [] },
        powerDelta: 2
      };
    }

    // 通用总览
    const topCat = catRanking[0];
    const replyParts = [`${scopeLabel}一共花了 ${totalAmount} 元喵，共 ${allItems.length} 笔`];
    if (topCat && catRanking.length > 1) {
      replyParts.push(`其中${topCat[0]}最多，${topCat[1]} 元`);
    }
    return {
      reply: replyParts.join('，') + '喵',
      card: { scope: scopeLabel, total: totalAmount, items: allItems.slice(-6).reverse(), catRanking },
      powerDelta: 2
    };
  }

  // ---- 子函数：重置引导 ----
  // 出于数据安全，重置只在用户明确说"确认重置"时才执行
  function localResetGuide(text) {
    // 二次确认指令
    if (/(确认|确定|是的|yes).{0,4}(重置|清空)/i.test(text) || /^(重置|清空|清零).{0,4}(确认|确定)$/i.test(text)) {
      // 仅清今日数据 vs 全部
      if (/全部|所有|清零所有/.test(text)) {
        state.todaySpent = 0;
        state.weeklySpent = 0;
        state.ledger = [];
        state.savingGoals = [];
        state.activeGoalId = null;
        state.meowPower = 0;
        saveState();
        syncUI();
        applyMascotStage(0, true);
        return { reply: '都已经清空啦喵～咱重新开始记吧', powerDelta: 0 };
      }
      // 默认清今日
      state.todaySpent = 0;
      // 同时把今天的 ledger 移除
      const today = new Date(); today.setHours(0,0,0,0);
      state.ledger = (state.ledger || []).filter(e => new Date(e.date).getTime() < today.getTime());
      saveState();
      syncUI();
      return { reply: '今天的记录已经清空啦喵', powerDelta: 0 };
    }
    // 询问类，给确认指引
    if (/全部|所有/.test(text)) {
      return {
        reply: '会清空账本、攒钱目标、喵力值——都没了哦喵。如果确定，请回复"确认重置全部"',
        powerDelta: 0
      };
    }
    return {
      reply: '默认只清今天的记录哦喵。回复"确认重置"清今日，或者"确认重置全部"清所有数据',
      powerDelta: 0
    };
  }


  // 渲染消费回顾卡片
  function renderConsumptionReviewCard(data) {
    const el = document.createElement('article');
    el.className = 'knowledge-card';
    const itemsHtml = (data.items || []).map(i =>
      `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;color:#5A5A5E"><span>${escapeHtml(i.name)}</span><span>${i.amount}元 · ${escapeHtml(i.category||'其他')}</span></div>`
    ).join('');
    const catHtml = (data.catRanking || []).slice(0, 4).map(([c, v]) =>
      `<span style="display:inline-block;background:#FFF5F5;color:#D71920;padding:2px 8px;border-radius:8px;font-size:11px;margin:2px 4px 0 0">${escapeHtml(c)} ${v}元</span>`
    ).join('');
    el.innerHTML = `
      <div class="card-title">消费回顾</div>
      <div class="card-inner">
        <h3>${escapeHtml(data.scope)}消费</h3>
        <div style="text-align:right;font-size:18px;font-weight:700;color:#D71920;margin-bottom:6px">合计 ${data.total} 元</div>
        ${itemsHtml}
        ${catHtml ? `<div style="margin-top:8px">${catHtml}</div>` : ''}
      </div>`;
    chatArea.appendChild(el);
    scrollToBottom();
  }

  // 核心：处理一次对话，驱动状态、卡片、UI 联动
  function processInteraction(userInput, result) {
    const { reply, structured } = parseReplyContent(result);

    // 1. 显示小招喵回复
    addBubble(reply, 'left');

    // 2. 渲染 Coze 返回的结构化卡片（如果有）
    let hadExpenseCard = false;
    let hadSavingCard = false;
    let stateUpdateApplied = false;

    if (structured) {
      const cards = structured.cards || (structured.card ? [structured.card] : []);
      cards.forEach((c, i) => {
        setTimeout(() => renderStructuredCard(c), 300 + i * 150);
        if (c.type === 'expense_card') hadExpenseCard = true;
        if (c.type === 'saving_goal_card' || c.type === 'saving_goal_draft_card') hadSavingCard = true;
      });

      // 应用结构化 state_update
      if (structured.state_update) {
        const su = structured.state_update;
        if (su.today_spent_delta > 0) addSpending(su.today_spent_delta);
        if (su.meow_power_delta > 0) addPower(su.meow_power_delta);
        if (su.daily_budget_set != null) {
          state.dailyBudget = su.daily_budget_set;
          saveState();
        }
        stateUpdateApplied = true;
      }

      // 处理结构化 expense_card
      cards.forEach(c => {
        if (c.type === 'expense_card' && c.items && c.total) {
          addLedger(c.items, c.total);
          // 如果没应用过 state_update，从卡片金额补
          if (!stateUpdateApplied) {
            addSpending(c.total);
          }
        }
        if ((c.type === 'saving_goal_card' || c.type === 'saving_goal_draft_card') && c.title) {
          upsertSavingGoal({
            name: c.title,
            target: c.target_amount || 0,
            saved: c.current_saved || 0,
            duration: c.duration || '',
            dailyTask: c.daily_saving_task,
            weeklyTask: c.weekly_task,
            dailyBudget: c.daily_spending_budget,
            reward: c.reward,
            status: c.status || '进行中'
          });
        }
      });
    }

    // 3. 文本兜底解析（Coze 没返回结构化字段时）
    const intent = inferIntent(userInput, reply);

    // 3.1 喵力值：先看 state_update，再看 reply 文本
    if (!stateUpdateApplied) {
      const powerFromReply = parsePowerDeltaFromReply(reply);
      if (powerFromReply > 0) {
        addPower(powerFromReply);
      } else {
        // 默认加分
        let bonus = 5;
        if (intent === 'expense') bonus = 10;
        else if (intent === 'finance') bonus = 8;
        else if (intent === 'risk') bonus = 8;
        else if (intent === 'saving') bonus = 10;
        addPower(bonus);
      }
    }

    // 3.2 记账：Coze 没返回 expense_card 时，从用户输入解析
    // ⚠️ 严格条件：必须 inferIntent 也判定为 expense（已加严正则），避免攒钱目标被误判
    if (!hadExpenseCard && intent === 'expense') {
      const parsed = parseUserExpense(userInput);
      if (parsed) {
        setTimeout(() => renderExpenseCard(parsed.items, parsed.total), 300);
        addLedger(parsed.items, parsed.total);
        if (!stateUpdateApplied) addSpending(parsed.total);
      }
    }

    // 3.3 攒钱：Coze 没返回 saving 卡时，从用户输入解析
    if (!hadSavingCard && intent === 'saving') {
      const parsed = parseUserSaving(userInput);
      if (parsed) {
        setTimeout(() => renderSavingGoalCard(parsed), 300);
        upsertSavingGoal(parsed);
      }
    }
  }

  async function handleSend(message) {
    const val = (message || chatInput.value).trim();
    if (!val || isSending) return;

    isSending = true;
    if (!message) chatInput.value = '';
    addBubble(val, 'right');

    // 🔍 本地能力路由：问候、状态查询、消费回顾、预算调整、重置等不耗 Coze
    const localAnswer = tryLocalQuery(val);
    if (localAnswer) {
      addLoadingBubble();
      await new Promise(r => setTimeout(r, 500));
      removeLoadingBubble();
      addBubble(localAnswer.reply, 'left');
      if (localAnswer.card) {
        setTimeout(() => renderConsumptionReviewCard(localAnswer.card), 300);
      }
      // 按子能力差异化加分
      const delta = typeof localAnswer.powerDelta === 'number' ? localAnswer.powerDelta : 1;
      if (delta > 0) addPower(delta);
      isSending = false;
      return;
    }

    addLoadingBubble();

    try {
      const result = await callAPI(val);
      removeLoadingBubble();
      processInteraction(val, result);
    } catch (err) {
      console.error('API error:', err);
      removeLoadingBubble();
      addBubble('刚刚有点没听清喵，你可以再说一遍吗喵', 'left');
    }

    isSending = false;
  }

  // ============ 快捷入口 ============
  quickChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const key = chip.dataset.prompt;
    const prompt = chipPrompts[key];
    if (prompt) addBubble(prompt, 'left');
  });

  // ============ 事件绑定 ============
  sendBtn.addEventListener('click', () => handleSend());
  chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleSend(); });
  if (mascotStage) {
    mascotStage.addEventListener('click', mascotTap);
  }

  // ============ 初始化 ============
  applyMascotStage(currentStageIndex, false);
  syncUI();
});
