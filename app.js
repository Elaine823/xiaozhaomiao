// 小招喵 H5 Demo - 完整本地状态管理 + Coze 智能体 + 文本兜底解析
document.addEventListener('DOMContentLoaded', () => {
  "use strict";

  // ============ DOM ============
  const mascotImg = document.getElementById('mascotImg');
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
        headerAvatar.src = `./assets/stages/${img}`;
        headerLevel.textContent = level;
        mascotImg.style.opacity = '1';
        mascotImg.style.transform = 'translateY(0) scale(1)';
      }, 240);
    } else {
      mascotImg.src = `./assets/stages/${img}`;
      headerAvatar.src = `./assets/stages/${img}`;
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
    if (/(返佣|刷单|高收益|保本|稳赚|校园贷|培训费|先交钱|验证码|身份证|银行卡)/.test(text)) return 'risk';
    if (/(攒|存|目标|基金|想买)/.test(text)) return 'saving';
    if (/(基金|定投|理财|风险等级|年化|货币|复利)/.test(text)) return 'finance';
    if (parseUserExpense(userInput)) return 'expense';
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
    scrollToBottom();
  }

  function addLoadingBubble() {
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

  async function callAPI(userMessage) {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-token': DEMO_TOKEN
      },
      body: JSON.stringify({ user_message: userMessage, user_id: 'demo_user_001' })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
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

  // ============ 初始化 ============
  applyMascotStage(currentStageIndex, false);
  syncUI();
});
