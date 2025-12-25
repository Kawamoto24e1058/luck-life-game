// Luck Life Game - main logic

const STATS = [
  { key: 'wealth', label: '資産' },
  { key: 'beauty', label: '容姿' },
  { key: 'int', label: '知能' },
  { key: 'health', label: '健康' },
  { key: 'luck', label: '運' },
];

const RARITY_TABLE = [
  { key: 'UR', rate: 0.02, flavor: ['石油王の息子', '伝説の勇者', 'IQ300の天才'] },
  { key: 'SSR', rate: 0.12, flavor: ['大富豪の家系', '超絶美形', '運命の子'] },
  { key: 'R', rate: 0.41, flavor: ['平凡な人間', '普通の人間', '市民サラリーマン', 'OL', 'フリーター', '家事手伝い'] },
  { key: 'N', rate: 0.45, flavor: ['田舎の農民', '名前もなき村人A', 'どこにでもいる人', '薄幸の庶民', 'うだつの上がらぬ者', '平々凡々な人生'] },
];

// 特殊種族フレーバーテーブル（イベント変身用）
const SPECIAL_KIND_FLAVOR = {
  animal: ['野良犬', '野良猫', '野良鳥', '牧場の馬', '田舎の牛'],
  plant: ['庭の雑草', '公園の草', '野の草花', 'つる性植物', '一本のタンポポ'],
  object: ['路傍の石', '道端の岩', '川原の砂', 'ビンの蓋', '古い瓦'],
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const formatMoney = (val) => {
  const yen = Math.round(val * 1000000);
  if (Math.abs(yen) >= 100000000) return (yen / 100000000).toFixed(1) + '億円';
  if (Math.abs(yen) >= 10000) return (yen / 10000).toFixed(0) + '万円';
  return yen.toLocaleString() + '円';
};

function weightedPick(items, weightFn) {
  const weights = items.map(weightFn);
  const sum = weights.reduce((a, b) => a + Math.max(0, b), 0);
  if (sum <= 0) return null;
  let r = Math.random() * sum;
  for (let i = 0; i < items.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r <= 0) return items[i];
  }
  return items[items.length - 1] ?? null;
}

function rarityRoll() {
  const r = Math.random();
  let acc = 0;
  for (const row of RARITY_TABLE) {
    acc += row.rate;
    if (r < acc) return row;
  }
  return RARITY_TABLE[RARITY_TABLE.length - 1];
}

function allocateInitialStats(rarityKey) {
  // 各レアリティごとにベースと配分可能ポイントを変える
  const config = {
    UR: { base: 80, spread: 120 },
    SSR: { base: 60, spread: 90 },
    R: { base: 40, spread: 60 },
    N: { base: 20, spread: 40 },
  }[rarityKey];
  // 5ステにランダム分配(Dirichlet風) ※wealthは除外
  const weights = Array.from({ length: STATS.length - 1 }, () => Math.random() + 0.2);
  const sum = weights.reduce((a, b) => a + b, 0);
  const extra = weights.map((w) => Math.round((w / sum) * config.spread));
  const stats = {};
  // beautyから始まる4項目を配分
  ['beauty', 'int', 'health', 'luck'].forEach((key, i) => {
    stats[key] = clamp(config.base + extra[i], 1, 120);
  });
  // wealthは独立して設定：新生児なので低く、マイナスも可
  stats['wealth'] = rarityKey === 'UR' ? randInt(-5, 20) : rarityKey === 'SSR' ? randInt(-10, 10) : rarityKey === 'R' ? randInt(-20, 5) : randInt(-30, -5);
  return stats;
}

function computeLifespan(stats, kind) {
  let base = 75;
  let min = 50;
  let max = 100;
  
  // 種別ごとに寿命を調整
  if (kind === 'animal') {
    base = 15; // 動物は短命
    min = 8;
    max = 25;
  } else if (kind === 'plant') {
    base = 50; // 植物は中程度
    min = 20;
    max = 120;
  } else if (kind === 'object') {
    base = 100; // 物体は長命
    min = 50;
    max = 300;
  }
  
  const bonus = Math.floor(stats.luck * 0.15 + stats.health * 0.15);
  const noise = randInt(-8, 10);
  return clamp(base + bonus + noise, min, max);
}

function createBars(container, values) {
  // 既存のバーがあれば値を更新、なければ新規作成
  const existingBars = container.querySelectorAll('.bar');
  
  if (existingBars.length === STATS.length) {
    // 既存のバーを更新（アニメーションは既存値から新値へ滑らかに）
    for (let i = 0; i < STATS.length; i++) {
      const st = STATS[i];
      const bar = existingBars[i];
      const fill = bar.querySelector('.fill');
      const val = bar.querySelector('.value');
      
      // バーの幅を更新（transitionで滑らかに変化）
      const targetWidth = `${clamp(values[st.key] ?? 0, 0, 120) / 1.2}%`;
      fill.style.width = targetWidth;
      
      // 数値を更新
      let displayValue;
      if (st.key === 'wealth') {
        const yenValue = Math.round((values[st.key] ?? 0) * 50000);
        displayValue = `¥${yenValue.toLocaleString()}`;
      } else if (st.key === 'int') {
        const raw = values[st.key] ?? 0;
        if (typeof window !== 'undefined' && window.state?.kind === 'human') {
          const iq = clamp(Math.round(80 + raw * 0.2), 60, 140);
          displayValue = `IQ ${iq}`;
        } else {
          const pseudo = clamp(Math.round(10 + raw * 0.1), 5, 50);
          displayValue = `${pseudo}`;
        }
      } else {
        displayValue = String(Math.round(values[st.key] ?? 0));
      }
      val.textContent = displayValue;
    }
  } else {
    // 新規作成（初期表示時）
    container.innerHTML = '';
    for (const st of STATS) {
      const row = document.createElement('div');
      row.className = 'bar';
      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = st.label;
      const track = document.createElement('div');
      track.className = 'track';
      const fill = document.createElement('div');
      fill.className = 'fill';
      // 初期値を即座に設定（DOMに追加された後）
      const val = document.createElement('div');
      val.className = 'value';
      
      let displayValue;
      if (st.key === 'wealth') {
        const yenValue = Math.round((values[st.key] ?? 0) * 50000);
        displayValue = `¥${yenValue.toLocaleString()}`;
      } else if (st.key === 'int') {
        const raw = values[st.key] ?? 0;
        if (typeof window !== 'undefined' && window.state?.kind === 'human') {
          const iq = clamp(Math.round(80 + raw * 0.2), 60, 140);
          displayValue = `IQ ${iq}`;
        } else {
          const pseudo = clamp(Math.round(10 + raw * 0.1), 5, 50);
          displayValue = `${pseudo}`;
        }
      } else {
        displayValue = String(Math.round(values[st.key] ?? 0));
      }
      val.textContent = displayValue;
      
      track.appendChild(fill);
      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(val);
      container.appendChild(row);
      
      // 初期値を設定
      const targetWidth = `${clamp(values[st.key] ?? 0, 0, 120) / 1.2}%`;
      // 初期表示なのでtransitionなしで即座に設定
      fill.style.transition = 'none';
      fill.style.width = targetWidth;
      // transitionを有効に戻す（次の更新から使用）
      requestAnimationFrame(() => {
        fill.style.transition = 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
      });
    }
  }
}

// イベント定義
const Events = [];

function addEvent(e) { Events.push(e); }

// 共通ヘルパ
function gain(state, key, delta) { state.stats[key] = clamp((state.stats[key] ?? 0) + delta, -200, 200); }
function logEvent(state, text) {
  state.logs.unshift({ age: state.age, text });
  // デュエル中はシングルの履歴表示を汚さない
  if (!Duel.active) renderLog();
  const meta = state.currentEventMeta || {};
  const tone = meta.tone || (/[★⚡]/.test(text) ? 'rare' : 'common');
  const icon = meta.icon || (/[★⚡]/.test(text) ? '✨' : '📜');
  // デュエル中はホームのカットイン/大画面演出を出さない
  if (!Duel.active) {
    showCutIn({ title: meta.title || 'イベント', body: text, tone, icon });
    if (tone === 'rare' || tone === 'good' || tone === 'bad') {
      showEventScreen({ title: meta.title, tone, icon }, text);
    }
  }
  // 演出: レア/好調時にコンフェッティ
  if (tone === 'rare') confettiBurst(60);
  else if (tone === 'good') confettiBurst(30);
}
function setJob(state, job) { if (!state.job) { state.job = job; trackDex('jobs', job); } }
function die(state, cause) { if (state.alive) { state.alive = false; state.cause = cause; checkAchievements?.(state, { type: 'death', cause }); endGame(); } }
// コンフェッティ演出
function confettiBurst(count = 40) {
  const box = document.getElementById('fx-confetti');
  if (!box) return;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    const colorIndex = (Math.floor(Math.random() * 6) + 1);
    el.className = `confetti-piece c${colorIndex}`;
    el.style.left = Math.round(Math.random() * 100) + '%';
    const delay = Math.random() * 0.4;
    const fallDur = 3 + Math.random() * 1.8;
    const swayDur = 1.8 + Math.random() * 1.6;
    el.style.animationDuration = `${fallDur}s, ${swayDur}s`;
    el.style.animationDelay = `${delay}s, ${delay}s`;
    box.appendChild(el);
    setTimeout(() => { el.remove(); }, (fallDur + delay) * 1000 + 200);
  }
}

// 子どもイベント (0-12歳)
addEvent({
  id: 'first_words', name: '初めての言葉', icon: '👶',
  cond: (s) => s.age >= 1 && s.age <= 2 && !s.flags.firstWords,
  weight: () => 50,
  run: (s) => {
    s.flags.firstWords = true; gain(s, 'int', +2);
    logEvent(s, '初めての言葉を話した。家族が喜んでくれた。');
  },
});

addEvent({
  id: 'playground_friend', name: '公園で友達', icon: '🎈',
  cond: (s) => s.age >= 3 && s.age <= 6,
  weight: () => 30,
  run: (s) => {
    s.happiness = clamp(s.happiness + 8, 0, 100);
    logEvent(s, '公園で新しい友達ができた。一緒に遊ぶのが楽しい。');
  },
});

addEvent({
  id: 'scraped_knee', name: '転んで擦り傷', tone: 'bad', icon: '🩹',
  cond: (s) => s.age >= 2 && s.age <= 8,
  weight: () => 8,
  run: (s) => {
    gain(s, 'health', -2); s.happiness = clamp(s.happiness - 3, 0, 100);
    logEvent(s, '走って転んでしまった。痛くて泣いた。');
  },
});

addEvent({
  id: 'picture_book', name: '絵本が好き', icon: '📖',
  cond: (s) => s.age >= 3 && s.age <= 7,
  weight: (s) => s.stats.int - 30,
  run: (s) => {
    gain(s, 'int', +3); s.happiness = clamp(s.happiness + 5, 0, 100);
    logEvent(s, '絵本を読むのが大好きになった。想像の世界が広がる。');
  },
});

addEvent({
  id: 'first_school', name: '小学校入学', icon: '🎒',
  cond: (s) => s.age === 6 && !s.flags.enteredSchool,
  weight: () => 100,
  run: (s) => {
    s.flags.enteredSchool = true; gain(s, 'int', +3);
    logEvent(s, 'ピカピカのランドセルを背負って小学校に入学した。新しい世界が始まる。');
  },
});

addEvent({
  id: 'lost_tooth', name: '歯が抜けた', icon: '🦷',
  cond: (s) => s.age >= 6 && s.age <= 8,
  weight: () => 20,
  run: (s) => {
    s.happiness = clamp(s.happiness + 3, 0, 100);
    logEvent(s, '乳歯が抜けた。枕の下に置いておいた。');
  },
});

addEvent({
  id: 'homework_struggle', name: '宿題が大変', tone: 'bad', icon: '📝',
  cond: (s) => s.age >= 7 && s.age <= 12 && s.stats.int < 50,
  weight: () => 8,
  run: (s) => {
    s.happiness = clamp(s.happiness - 5, 0, 100);
    logEvent(s, '宿題が難しくて時間がかかった。遊ぶ時間が減ってしまった。');
  },
});

addEvent({
  id: 'good_grades', name: 'テストで良い点', icon: '💯',
  cond: (s) => s.age >= 7 && s.age <= 12 && s.stats.int >= 55,
  weight: (s) => s.stats.int - 40,
  run: (s) => {
    gain(s, 'int', +2); s.happiness = clamp(s.happiness + 6, 0, 100);
    logEvent(s, 'テストで良い点を取った。先生に褒められて嬉しかった。');
  },
});

addEvent({
  id: 'summer_vacation', name: '夏休みの思い出', icon: '🏖️',
  cond: (s) => s.age >= 6 && s.age <= 12,
  weight: () => 15,
  run: (s) => {
    s.happiness = clamp(s.happiness + 10, 0, 100);
    logEvent(s, '楽しい夏休みを過ごした。毎日が冒険だった。');
  },
});

addEvent({
  id: 'scared_dark', name: '暗闇が怖い', tone: 'bad', icon: '🌙',
  cond: (s) => s.age >= 4 && s.age <= 8,
  weight: () => 5,
  run: (s) => {
    s.happiness = clamp(s.happiness - 4, 0, 100);
    logEvent(s, '夜が怖くて一人で寝られなかった。');
  },
});

addEvent({
  id: 'pet_goldfish', name: '金魚を飼う', icon: '🐠',
  cond: (s) => s.age >= 5 && s.age <= 10 && !s.flags.petGoldfish,
  weight: () => 18,
  run: (s) => {
    s.flags.petGoldfish = true; s.happiness = clamp(s.happiness + 7, 0, 100);
    logEvent(s, 'お祭りで金魚すくい。家で飼うことにした。');
  },
});

addEvent({
  id: 'ride_bicycle', name: '自転車に乗れた', icon: '🚲',
  cond: (s) => s.age >= 5 && s.age <= 9 && !s.flags.bicycle,
  weight: () => 25,
  run: (s) => {
    s.flags.bicycle = true; gain(s, 'health', +2); s.happiness = clamp(s.happiness + 8, 0, 100);
    logEvent(s, '練習して自転車に乗れるようになった！世界が広がった。');
  },
});

// 青年期イベント (13-17歳)
addEvent({
  id: 'first_love', name: '初恋', tone: 'good', icon: '💕',
  cond: (s) => s.age >= 13 && s.age <= 16 && !s.flags.firstLove,
  weight: () => 30,
  run: (s) => {
    s.flags.firstLove = true; s.happiness = clamp(s.happiness + 12, 0, 100);
    logEvent(s, '誰かを特別に思う気持ちを知った。胸がドキドキする。');
  },
});

addEvent({
  id: 'rebellious_phase', name: '反抗期', tone: 'bad', icon: '😤',
  cond: (s) => s.age >= 13 && s.age <= 15,
  weight: () => 18,
  run: (s) => {
    s.happiness = clamp(s.happiness - 6, 0, 100);
    logEvent(s, '親とぶつかることが増えた。言いたいことが上手く伝わらない。');
  },
});

addEvent({
  id: 'club_activities', name: '部活動に熱中', tone: 'good', icon: '⚽',
  cond: (s) => s.age >= 13 && s.age <= 17,
  weight: (s) => Math.max(15, s.stats.health - 35),
  run: (s) => {
    gain(s, 'health', +3); s.happiness = clamp(s.happiness + 7, 0, 100);
    logEvent(s, '部活動に打ち込んだ。仲間と汗を流す日々が充実していた。');
  },
});

addEvent({
  id: 'exam_stress', name: '受験のプレッシャー', tone: 'bad', icon: '📚',
  cond: (s) => s.age >= 15 && s.age <= 17,
  weight: () => 22,
  run: (s) => {
    gain(s, 'health', -3); s.happiness = clamp(s.happiness - 8, 0, 100);
    logEvent(s, '受験勉強のストレスで押しつぶされそうだった。');
  },
});

// 小学生期の平凡イベント (7-12歳)
addEvent({
  id: 'school_lunch', name: '給食の時間', icon: '🍙',
  cond: (s) => s.age >= 6 && s.age <= 12,
  weight: () => 15,
  run: (s) => {
    s.happiness = clamp(s.happiness + 2, 0, 100);
    logEvent(s, '今日の給食は好きなメニューだった。');
  },
});

addEvent({
  id: 'school_cleaning', name: '当番で教室掃除', icon: '🧹',
  cond: (s) => s.age >= 7 && s.age <= 12,
  weight: () => 10,
  run: (s) => {
    logEvent(s, '教室の掃除当番。友達と協力して片付けた。');
  },
});

addEvent({
  id: 'school_assembly', name: '朝礼で立たされる', icon: '⚠️',
  cond: (s) => s.age >= 6 && s.age <= 11,
  weight: () => 12,
  run: (s) => {
    s.happiness = clamp(s.happiness - 1, 0, 100);
    logEvent(s, '朝礼で話を聞いている間、足が疲れた。');
  },
});

addEvent({
  id: 'playground_tag', name: '昼休みに鬼ごっこ', icon: '🏃',
  cond: (s) => s.age >= 6 && s.age <= 10,
  weight: () => 20,
  run: (s) => {
    s.happiness = clamp(s.happiness + 3, 0, 100);
    logEvent(s, '友達と昼休みに鬼ごっこをした。楽しかった。');
  },
});

addEvent({
  id: 'spelling_practice', name: '漢字テスト対策', icon: '✏️',
  cond: (s) => s.age >= 8 && s.age <= 12,
  weight: () => 8,
  run: (s) => {
    logEvent(s, '漢字テストに向けて練習中。覚えるのが大変。');
  },
});

addEvent({
  id: 'school_friend_fight', name: '友達と言い争い', icon: '😠',
  cond: (s) => s.age >= 7 && s.age <= 11,
  weight: () => 14,
  run: (s) => {
    s.happiness = clamp(s.happiness - 2, 0, 100);
    logEvent(s, '友達と意見が合わずに言い争ってしまった。');
  },
});

addEvent({
  id: 'school_trip_prep', name: '修学旅行の準備', icon: '🏫',
  cond: (s) => s.age >= 9 && s.age <= 12,
  weight: () => 18,
  run: (s) => {
    s.happiness = clamp(s.happiness + 5, 0, 100);
    logEvent(s, '修学旅行が近づいてきた。わくわくしている。');
  },
});

addEvent({
  id: 'sports_day', name: '運動会に出場', icon: '🏅',
  cond: (s) => s.age >= 6 && s.age <= 12,
  weight: () => 16,
  run: (s) => {
    s.happiness = clamp(s.happiness + 4, 0, 100);
    logEvent(s, '運動会で全力を尽くした。応援してくれた親に感謝。');
  },
});

addEvent({
  id: 'read_library_book', name: '図書室で本を借りる', icon: '📚',
  cond: (s) => s.age >= 7 && s.age <= 12,
  weight: () => 12,
  run: (s) => {
    gain(s, 'int', +1);
    logEvent(s, '図書室でおもしろい本を見つけた。');
  },
});

addEvent({
  id: 'lunch_money_lost', name: 'お小遣いをなくした', icon: '💸',
  cond: (s) => s.age >= 7 && s.age <= 11,
  weight: () => 10,
  run: (s) => {
    s.happiness = clamp(s.happiness - 2, 0, 100);
    logEvent(s, 'お小遣いをなくしてしまった。落ち込んだ。');
  },
});

addEvent({
  id: 'drawing_class', name: '図工の時間', icon: '🎨',
  cond: (s) => s.age >= 6 && s.age <= 10,
  weight: () => 11,
  run: (s) => {
    s.happiness = clamp(s.happiness + 2, 0, 100);
    logEvent(s, '図工で好きなものを描いた。');
  },
});

addEvent({
  id: 'music_class', name: '音楽の授業', icon: '🎵',
  cond: (s) => s.age >= 8 && s.age <= 12,
  weight: () => 10,
  run: (s) => {
    s.happiness = clamp(s.happiness + 2, 0, 100);
    logEvent(s, '好きな歌を歌った。友達と笑った。');
  },
});

addEvent({
  id: 'math_homework', name: '算数の宿題をやった', icon: '🔢',
  cond: (s) => s.age >= 8 && s.age <= 12,
  weight: () => 9,
  run: (s) => {
    logEvent(s, '計算問題を解いた。全部合ってた。');
  },
});

addEvent({
  id: 'sick_day', name: '学校を休んだ', icon: '🤒',
  cond: (s) => s.age >= 6 && s.age <= 12,
  weight: () => 6,
  run: (s) => {
    gain(s, 'health', -1);
    logEvent(s, '風邪で学校を休んだ。つまらなかった。');
  },
});

addEvent({
  id: 'make_new_friend', name: '新しい友達ができた', icon: '👫',
  cond: (s) => s.age >= 6 && s.age <= 12,
  weight: () => 14,
  run: (s) => {
    s.happiness = clamp(s.happiness + 5, 0, 100);
    logEvent(s, '学校で新しい友達ができた。楽しくなった。');
  },
});

addEvent({
  id: 'teacher_praise', name: '先生に褒められた', icon: '⭐',
  cond: (s) => s.age >= 6 && s.age <= 12,
  weight: () => 11,
  run: (s) => {
    s.happiness = clamp(s.happiness + 4, 0, 100);
    logEvent(s, '先生に褒められた。嬉しかった。');
  },
});

// 子ども時代の健康が増えるイベント
addEvent({
  id: 'play_outside', name: '外で元気いっぱい遊んだ', icon: '🌞',
  cond: (s) => s.age >= 3 && s.age <= 12,
  weight: () => 18,
  run: (s) => {
    gain(s, 'health', +2); s.happiness = clamp(s.happiness + 4, 0, 100);
    logEvent(s, '朝から晩まで外で遊んだ。疲れたけど楽しかった。');
  },
});

addEvent({
  id: 'sports_practice', name: 'スポーツで汗を流した', icon: '💪',
  cond: (s) => s.age >= 6 && s.age <= 12,
  weight: () => 14,
  run: (s) => {
    gain(s, 'health', +2); s.happiness = clamp(s.happiness + 3, 0, 100);
    logEvent(s, 'スポーツを頑張った。体が強くなった気がする。');
  },
});

addEvent({
  id: 'injury_healed', name: '怪我が治った', icon: '✨',
  cond: (s) => s.age >= 2 && s.age <= 12 && s.stats.health < 80,
  weight: () => 12,
  run: (s) => {
    gain(s, 'health', +3); s.happiness = clamp(s.happiness + 2, 0, 100);
    logEvent(s, '長く悩んでいた怪我がやっと治った。動きやすくなった。');
  },
});

addEvent({
  id: 'good_sleep', name: 'ぐっすり眠った', icon: '😴',
  cond: (s) => s.age >= 1 && s.age <= 12,
  weight: () => 13,
  run: (s) => {
    gain(s, 'health', +1); s.happiness = clamp(s.happiness + 2, 0, 100);
    logEvent(s, 'ぐっすり眠った。朝すっきり目覚めた。');
  },
});

addEvent({
  id: 'swimming', name: 'プール・水遊び', icon: '🏊',
  cond: (s) => s.age >= 3 && s.age <= 12,
  weight: () => 15,
  run: (s) => {
    gain(s, 'health', +2); s.happiness = clamp(s.happiness + 5, 0, 100);
    logEvent(s, 'プールで泳いだ。全身がぐったり疲れた。');
  },
});

addEvent({
  id: 'climbing_tree', name: '木に登った', icon: '🌳',
  cond: (s) => s.age >= 4 && s.age <= 10,
  weight: () => 11,
  run: (s) => {
    gain(s, 'health', +1); s.happiness = clamp(s.happiness + 3, 0, 100);
    logEvent(s, '大きな木によじ登った。世界が違って見えた。');
  },
});

// 健康回復イベントの追加バリエーション
addEvent({
  id: 'hot_spring_recovery', name: '温泉で療養', icon: '♨️',
  cond: (s) => s.age >= 18 && s.age <= 70 && Math.random() < 0.05,
  weight: () => 18,
  run: (s) => {
    gain(s, 'health', +6); s.happiness = clamp(s.happiness + 6, 0, 100);
    logEvent(s, '温泉でゆっくり体を癒やした。芯から温まって体力が戻った。');
  },
});

addEvent({
  id: 'rehab_training', name: 'リハビリに取り組む', icon: '🩺',
  cond: (s) => s.age >= 16 && s.age <= 80 && s.stats.health <= 70 && Math.random() < 0.04,
  weight: () => 16,
  run: (s) => {
    gain(s, 'health', +5); s.happiness = clamp(s.happiness + 2, 0, 100);
    logEvent(s, '地道なリハビリを続けた。少しずつ体が動くようになってきた。');
  },
});

addEvent({
  id: 'early_checkup', name: '定期健診で早期発見', icon: '🩻',
  cond: (s) => s.age >= 25 && s.age <= 70 && Math.random() < 0.03,
  weight: () => 15,
  run: (s) => {
    gain(s, 'health', +4); s.happiness = clamp(s.happiness + 3, 0, 100);
    logEvent(s, '定期健診で体の異変を早期発見。治療で元気を取り戻した。');
  },
});

// 中学生期の平凡イベント (13-17歳)
addEvent({
  id: 'school_lunch_middle', name: '弁当が冷めている', icon: '🍙',
  cond: (s) => s.age >= 13 && s.age <= 17,
  weight: () => 14,
  run: (s) => {
    logEvent(s, '今日のお弁当、学校についたら冷めていた。');
  },
});

addEvent({
  id: 'lunch_with_friends', name: '友達と昼食', icon: '🍜',
  cond: (s) => s.age >= 13 && s.age <= 17,
  weight: () => 18,
  run: (s) => {
    s.happiness = clamp(s.happiness + 3, 0, 100);
    logEvent(s, '友達と昼食を共にして、好きな話で盛り上がった。');
  },
});

addEvent({
  id: 'commute_train', name: '満員電車での通学', icon: '🚄',
  cond: (s) => s.age >= 13 && s.age <= 17,
  weight: () => 12,
  run: (s) => {
    s.happiness = clamp(s.happiness - 1, 0, 100);
    logEvent(s, '朝の満員電車での通学。疲れた。');
  },
});

addEvent({
  id: 'forgotten_homework', name: '宿題を忘れた', icon: '😅',
  cond: (s) => s.age >= 13 && s.age <= 16,
  weight: () => 15,
  run: (s) => {
    s.happiness = clamp(s.happiness - 3, 0, 100);
    logEvent(s, '宿題を提出し忘れた。先生に怒られた。');
  },
});

addEvent({
  id: 'good_test_mark', name: 'テストで好成績', icon: '📝',
  cond: (s) => s.age >= 13 && s.age <= 17 && s.stats.int >= 60,
  weight: () => 18,
  run: (s) => {
    gain(s, 'int', +1); s.happiness = clamp(s.happiness + 4, 0, 100);
    logEvent(s, 'テストで良い成績が取れた。自信が出た。');
  },
});

addEvent({
  id: 'school_festival', name: '学園祭の準備', icon: '🎪',
  cond: (s) => s.age >= 13 && s.age <= 17,
  weight: () => 22,
  run: (s) => {
    s.happiness = clamp(s.happiness + 5, 0, 100);
    logEvent(s, '学園祭に向けてクラスで準備をしている。');
  },
});

// 高校生期の平凡イベント (15-17歳) + 中学生へ拡張
addEvent({
  id: 'get_part_time_job', name: 'アルバイトを始めた', icon: '💼',
  cond: (s) => s.age >= 15 && s.age <= 17 && !s.flags.partTimeJob,
  weight: () => 24,
  run: (s) => {
    s.flags.partTimeJob = true;
    gain(s, 'wealth', +5); s.happiness = clamp(s.happiness + 3, 0, 100);
    logEvent(s, 'バイトを始めた。初給料で好きなものを買った。');
  },
});

addEvent({
  id: 'high_school_friend', name: '高校で友達ができた', icon: '👥',
  cond: (s) => s.age >= 15 && s.age <= 17,
  weight: () => 18,
  run: (s) => {
    s.happiness = clamp(s.happiness + 4, 0, 100);
    logEvent(s, '新しい環境で面白い友達ができた。');
  },
});

addEvent({
  id: 'teacher_guidance', name: '進路指導で相談', icon: '📋',
  cond: (s) => s.age >= 15 && s.age <= 17,
  weight: () => 16,
  run: (s) => {
    s.happiness = clamp(s.happiness + 2, 0, 100);
    logEvent(s, '進路について考えるきっかけになった。');
  },
});

addEvent({
  id: 'cultural_festival', name: '文化祭に出演', icon: '🎭',
  cond: (s) => s.age >= 15 && s.age <= 17,
  weight: () => 20,
  run: (s) => {
    s.happiness = clamp(s.happiness + 6, 0, 100);
    logEvent(s, '文化祭で自分たちの企画が大成功した。楽しかった。');
  },
});

addEvent({
  id: 'sleep_deprivation', name: '寝不足で疲れた', icon: '😵',
  cond: (s) => s.age >= 15 && s.age <= 17,
  weight: () => 14,
  run: (s) => {
    gain(s, 'health', -1); s.happiness = clamp(s.happiness - 2, 0, 100);
    logEvent(s, '受験勉強で夜更かし。朝からボーっとしてた。');
  },
});

addEvent({
  id: 'family_dinner', name: '家族で食事', icon: '🍽️',
  cond: (s) => s.age >= 13 && s.age <= 17,
  weight: () => 13,
  run: (s) => {
    s.happiness = clamp(s.happiness + 3, 0, 100);
    logEvent(s, '家族揃って食事をした。久しぶりに話した。');
  },
});

addEvent({
  id: 'cafe_hangout', name: 'カフェで友達と過ごす', icon: '☕',
  cond: (s) => s.age >= 15 && s.age <= 17,
  weight: () => 17,
  run: (s) => {
    s.happiness = clamp(s.happiness + 4, 0, 100);
    logEvent(s, 'カフェで友達と時間を忘れて話した。');
  },
});

// 13-17歳 追加の平凡イベント
addEvent({
  id: 'school_locker', name: 'ロッカーが壊れた', icon: '🗄️',
  cond: (s) => s.age >= 13 && s.age <= 17,
  weight: () => 11,
  run: (s) => {
    s.happiness = clamp(s.happiness - 1, 0, 100);
    logEvent(s, 'ロッカーの鍵が壊れて開かなくなった。不便だ。');
  },
});

addEvent({
  id: 'class_rep', name: 'クラス委員に選ばれた', icon: '🙋',
  cond: (s) => s.age >= 13 && s.age <= 17,
  weight: () => 13,
  run: (s) => {
    s.happiness = clamp(s.happiness + 2, 0, 100); gain(s, 'int', +1);
    logEvent(s, 'クラス委員に選ばれた。ちょっと責任感が出てきた。');
  },
});

addEvent({
  id: 'uniform_shopping', name: '制服が新しくなった', icon: '👔',
  cond: (s) => s.age >= 13 && s.age <= 17,
  weight: () => 10,
  run: (s) => {
    s.happiness = clamp(s.happiness + 3, 0, 100);
    logEvent(s, '制服がサイズアウトして、新しいものを買った。');
  },
});

addEvent({
  id: 'group_project', name: 'グループ発表', icon: '📊',
  cond: (s) => s.age >= 13 && s.age <= 17,
  weight: () => 15,
  run: (s) => {
    s.happiness = clamp(s.happiness + 2, 0, 100);
    logEvent(s, 'グループで課題発表をやった。準備は大変だったが達成感がある。');
  },
});

addEvent({
  id: 'rain_commute', name: '雨の日の通学', icon: '☔',
  cond: (s) => s.age >= 13 && s.age <= 17,
  weight: () => 14,
  run: (s) => {
    logEvent(s, '朝から雨が降っていて通学が億劫だった。');
  },
});

addEvent({
  id: 'sports_day_practice', name: '体育祭練習', icon: '🏃',
  cond: (s) => s.age >= 13 && s.age <= 17,
  weight: () => 16,
  run: (s) => {
    s.happiness = clamp(s.happiness + 1, 0, 100);
    logEvent(s, '体育祭に向けて練習をした。クラス全員で頑張った。');
  },
});

addEvent({
  id: 'late_night_study', name: '深夜まで勉強', icon: '📖',
  cond: (s) => s.age >= 13 && s.age <= 17,
  weight: () => 12,
  run: (s) => {
    gain(s, 'int', +1); s.happiness = clamp(s.happiness - 1, 0, 100);
    logEvent(s, '深夜まで勉強をした。眠いけど少し成長した気がする。');
  },
});

addEvent({
  id: 'morning_assembly', name: '朝礼で寝そうになった', icon: '😪',
  cond: (s) => s.age >= 13 && s.age <= 17,
  weight: () => 13,
  run: (s) => {
    logEvent(s, '朝礼が長くて眠くなってしまった。先生の話が頭に入らない。');
  },
});

addEvent({
  id: 'phone_confiscate', name: 'スマホ没収された', icon: '📵',
  cond: (s) => s.age >= 13 && s.age <= 17,
  weight: () => 10,
  run: (s) => {
    s.happiness = clamp(s.happiness - 3, 0, 100);
    logEvent(s, '授業中にスマホを触っていたのがバレて没収された。');
  },
});

addEvent({
  id: 'yearbook_photo', name: '卒業アルバム撮影', icon: '📷',
  cond: (s) => s.age >= 15 && s.age <= 17,
  weight: () => 12,
  run: (s) => {
    s.happiness = clamp(s.happiness + 3, 0, 100);
    logEvent(s, '卒業アルバムの写真撮影があった。友達とふざけながら撮った。');
  },
});

addEvent({
  id: 'school_trip_teen', name: '修学旅行', icon: '🚌',
  cond: (s) => s.age >= 14 && s.age <= 17,
  weight: () => 18,
  run: (s) => {
    s.happiness = clamp(s.happiness + 7, 0, 100);
    logEvent(s, '修学旅行に行った。友達とはしゃぎまくって最高の思い出になった。');
  },
});

addEvent({
  id: 'study_group', name: '友達と勉強会', icon: '📚',
  cond: (s) => s.age >= 13 && s.age <= 17,
  weight: () => 14,
  run: (s) => {
    gain(s, 'int', +1); s.happiness = clamp(s.happiness + 2, 0, 100);
    logEvent(s, '友達と勉強会をした。わからないところを教え合えてよかった。');
  },
});

addEvent({
  id: 'school_event', name: '学校行事の手伝い', icon: '🎈',
  cond: (s) => s.age >= 13 && s.age <= 17,
  weight: () => 12,
  run: (s) => {
    s.happiness = clamp(s.happiness + 2, 0, 100);
    logEvent(s, '学校行事の準備を手伝った。協力することの大切さを学んだ。');
  },
});

addEvent({
  id: 'crush_conversation', name: '好きな人と話した', icon: '💬',
  cond: (s) => s.age >= 13 && s.age <= 17,
  weight: () => 15,
  run: (s) => {
    s.happiness = clamp(s.happiness + 5, 0, 100);
    logEvent(s, '好きな人と偶然話せた。ドキドキが止まらない。');
  },
});

addEvent({
  id: 'school_rumor', name: '噂話が広まった', icon: '🗣️',
  cond: (s) => s.age >= 13 && s.age <= 17,
  weight: () => 11,
  run: (s) => {
    s.happiness = clamp(s.happiness - 2, 0, 100);
    logEvent(s, '学校で妙な噂が広まった。居心地が悪い。');
  },
});

addEvent({
  id: 'classroom_seat_change', name: '席替えがあった', icon: '💺',
  cond: (s) => s.age >= 13 && s.age <= 17,
  weight: () => 14,
  run: (s) => {
    s.happiness = clamp(s.happiness + 1, 0, 100);
    logEvent(s, '席替えで新しい隣の人になった。');
  },
});

// 既存イベント
addEvent({
  id: 'skip-grade', name: '飛び級', tone: 'good', icon: '🎓',
  cond: (s) => s.age >= 8 && s.age <= 16 && s.stats.int >= 70,
  weight: (s) => (s.stats.int - 60) * 1.2,
  run: (s) => {
    s.currentEventMeta = { title: '飛び級', tone: 'good', icon: '🎓', timestamp: Date.now() };
    gain(s, 'int', +6); gain(s, 'health', -2);
    logEvent(s, '知能の高さを認められ飛び級した年。学業は進んだが友人関係に苦労した。');
    s.flags.skipped = true;
  },
});

addEvent({
  id: 'learn-stocks', name: '株を覚える',
  cond: (s) => s.age >= 10 && s.age <= 12 && (s.stats.int >= 55 || s.stats.luck >= 60),
  weight: (s) => (s.stats.int + s.stats.luck) / 3,
  run: (s) => {
    s.currentEventMeta = { title: '株を覚えた', tone: 'good', icon: '📈', timestamp: Date.now() };
    s.flags.stocks = true; gain(s, 'int', +3);
    logEvent(s, '投資の本と出会い、経済の仕組みを学んだ一年。複利の力に魅了された。');
  },
});

addEvent({
  id: 'stocks-branch', name: '投資の分岐',
  cond: (s) => s.age >= 20 && s.age <= 30 && s.flags.stocks && !s.flags.stocksResolved,
  weight: (s) => 40,
  run: (s) => {
    s.currentEventMeta = { title: '投資の分岐', tone: 'rare', icon: '💹', timestamp: Date.now() };
    s.flags.stocksResolved = true;
    const good = Math.random() < (0.35 + s.stats.luck / 300);
    if (good) {
      const earn = randInt(50, 180);
      gain(s, 'wealth', +earn); gain(s, 'luck', +2);
      logEvent(s, `投資判断が的中した年。資産が大きく増えた。+${formatMoney(earn)}`);
    } else {
      const loss = randInt(30, 120);
      gain(s, 'wealth', -loss); gain(s, 'health', -3);
      logEvent(s, `投資で大損失を出した年。眠れない夜が続いた。-${formatMoney(loss)}`);
    }
  },
});

// ========== 職業初期決定イベント（12-15歳） ==========
// 勇者（URレアリティ向け）
addEvent({
  id: 'hero-calling', name: '勇者の呼び声',
  cond: (s) => s.age >= 8 && s.age <= 18 && s.rarity === 'UR' && !s.job,
  weight: (s) => (s.stats.int + s.stats.health) / 2 - 50,
  run: (s) => {
    setJob(s, '勇者'); gain(s, 'health', +8); gain(s, 'int', +5); gain(s, 'luck', +5);
    logEvent(s, '伝説の勇者として覚醒した。冒険者としての人生が始まった。');
  },
});

// 警察犬（動物向け）
addEvent({
  id: 'police-dog', name: '警察犬訓練所で選抜',
  cond: (s) => s.age >= 2 && s.age <= 8 && s.kind === 'animal' && /犬|警察/.test(s.flavor) && !s.job,
  weight: () => 20,
  run: (s) => {
    setJob(s, '警察犬'); gain(s, 'health', +4); gain(s, 'int', +3);
    logEvent(s, '警察犬として訓練を受けることになった。使命感が芽生えた。');
  },
});

// 盲導犬（動物向け）
addEvent({
  id: 'guide-dog', name: '盲導犬育成プログラムへ',
  cond: (s) => s.age >= 3 && s.age <= 8 && s.kind === 'animal' && /犬/.test(s.flavor) && !s.job && !s.flags.guideSelected,
  weight: () => 18,
  run: (s) => {
    s.flags.guideSelected = true;
    setJob(s, '盲導犬'); gain(s, 'health', +3); s.happiness = clamp(s.happiness + 10, 0, 100);
    logEvent(s, '盲導犬育成プログラムの候補に選ばれた。人を助ける喜びが待っている。');
  },
});

// ペット犬（平凡な飼い犬）
addEvent({
  id: 'pet-dog', name: '家族に迎えられた',
  cond: (s) => s.age >= 0 && s.age <= 5 && s.kind === 'animal' && /犬/.test(s.flavor) && !s.job,
  weight: () => 25,
  run: (s) => {
    setJob(s, 'ペット犬'); gain(s, 'health', +2); s.happiness = clamp(s.happiness + 15, 0, 100);
    logEvent(s, '温かい家族に迎えられた。毎日が安定して幸せだ。');
  },
});

// 野良猫（野良猫ライフ）
addEvent({
  id: 'stray-cat', name: '野良猫として独立',
  cond: (s) => s.age >= 1 && s.age <= 5 && s.kind === 'animal' && /猫/.test(s.flavor) && !s.job,
  weight: () => 22,
  run: (s) => {
    setJob(s, '野良猫'); gain(s, 'luck', +3); gain(s, 'health', +1);
    logEvent(s, '自由に街を闊歩する野良猫となった。気ままな人生が始まった。');
  },
});

// サーカス動物（エンターテイナー向け）
addEvent({
  id: 'circus-animal', name: 'サーカスに入団',
  cond: (s) => s.age >= 2 && s.age <= 10 && s.kind === 'animal' && !s.job && s.stats.luck >= 50,
  weight: () => 15,
  run: (s) => {
    setJob(s, 'サーカス動物'); gain(s, 'health', +3); s.happiness = clamp(s.happiness + 8, 0, 100);
    logEvent(s, 'サーカスに入団した。観客の喝采を浴びる喜びを知った。');
  },
});

// 人間の職業決定用ルーレット（16-18歳で発生）
addEvent({
  id: 'job-selection-human', name: '職業選択のとき',
  cond: (s) => s.age >= 16 && s.age <= 18 && s.kind === 'human' && !s.job,
  weight: () => 35,
  run: (s) => {
    startJobRouletteForState(s);
  },
});

addEvent({
  id: 'idol-path', name: 'スカウト',
  cond: (s) => s.age >= 14 && s.age <= 22 && s.stats.beauty >= 70 && !s.job,
  weight: (s) => s.stats.beauty - 50,
  run: (s) => {
    s.currentEventMeta = { title: 'スカウト', tone: 'good', icon: '🌟', timestamp: Date.now() };
    setJob(s, 'アイドル'); gain(s, 'wealth', +10); gain(s, 'health', -3);
    logEvent(s, '街でスカウトされアイドルデビューした年。華やかだが多忙な日々が始まった。');
  },
});

addEvent({
  id: 'college', name: '大学入学',
  cond: (s) => s.age >= 17 && s.age <= 20 && s.stats.int >= 55 && !s.flags.college,
  weight: (s) => s.stats.int,
  run: (s) => {
    s.flags.college = true;
    s.flags.collegeStartAge = s.age; // 大学入学年を記録
    gain(s, 'int', +8); gain(s, 'wealth', -10);
    logEvent(s, '大学に合格し新生活を始めた年。学問の奥深さに触れた。');
    if (!s.job) setJob(s, '学生');
  },
});

// 大学生活のイベント群
addEvent({
  id: 'college-exam-stress', name: '試験前の徹夜勉強',
  cond: (s) => s.flags.college && s.job === '学生' && s.stats.health >= 50 && !s.flags.collegeGraduated,
  weight: () => 12,
  run: (s) => {
    gain(s, 'health', -3); gain(s, 'int', +2);
    logEvent(s, '試験期間に徹夜で勉強した。試験は無事合格したが、体が疲れた。');
  },
});

addEvent({
  id: 'college-circle', name: 'サークル活動に夢中',
  cond: (s) => s.flags.college && s.job === '学生' && !s.flags.collegeGraduated,
  weight: () => 10,
  run: (s) => {
    gain(s, 'beauty', +2);
    logEvent(s, 'サークル活動を楽しんだ。新しい友達も増えて、充実した大学生活を送っている。');
  },
});

addEvent({
  id: 'college-part-time', name: 'アルバイトで生活費を稼ぐ',
  cond: (s) => s.flags.college && s.job === '学生' && !s.flags.collegeGraduated,
  weight: () => 11,
  run: (s) => {
    gain(s, 'wealth', +5);
    logEvent(s, 'アルバイトで頑張って生活費を稼いだ。社会勉強にもなった。');
  },
});

addEvent({
  id: 'college-love', name: '大学で運命の出会い',
  cond: (s) => s.flags.college && s.job === '学生' && !s.flags.collegeGraduated,
  weight: () => 8,
  run: (s) => {
    gain(s, 'beauty', +1);
    logEvent(s, '大学で素敵な人に出会った。ドキドキする毎日。');
  },
});

addEvent({
  id: 'college-research', name: '研究室配属',
  cond: (s) => s.flags.college && s.job === '学生' && s.age >= 19 && s.stats.int >= 60 && !s.flags.collegeGraduated,
  weight: () => 15,
  run: (s) => {
    gain(s, 'int', +4);
    logEvent(s, '研究室に配属された。本格的な研究の道へ進むことになった。');
  },
});

// 大学中退イベント（int低い、health低い、wealth不足など）
addEvent({
  id: 'college-dropout', name: '大学を中退する',
  cond: (s) => s.flags.college && s.job === '学生' && s.age >= 19 && (s.stats.int <= 40 || s.stats.health <= 35 || s.stats.wealth <= 5) && !s.flags.collegeGraduated,
  weight: (s) => {
    let w = 0;
    if (s.stats.int <= 40) w += 15;
    if (s.stats.health <= 35) w += 20;
    if (s.stats.wealth <= 5) w += 25;
    return w;
  },
  run: (s) => {
    s.flags.collegeGraduated = true;
    setJob(s, 'フリーター');
    gain(s, 'wealth', -5);
    logEvent(s, '経済的困窮と学業不適応に悩み、大学を中退することにした。人生は続く。');
  },
});

// 大学強制退学イベント（成績不振or不正行為）
addEvent({
  id: 'college-expulsion', name: '大学から除籍される',
  cond: (s) => s.flags.college && s.job === '学生' && s.age >= 19 && s.stats.int <= 30 && !s.flags.collegeGraduated,
  weight: () => 8,
  run: (s) => {
    s.flags.collegeGraduated = true;
    setJob(s, 'ニート');
    gain(s, 'wealth', -20); gain(s, 'beauty', -3);
    logEvent(s, '成績不振により大学から除籍された。学歴も失い、心が折れている。');
  },
});

// 大学卒業＆就職イベント（入学から4～7年後）
addEvent({
  id: 'college-graduation', name: '大学卒業と就職',
  cond: (s) => s.flags.college && s.flags.collegeStartAge && s.job === '学生' && (s.age - s.flags.collegeStartAge >= 4) && (s.age - s.flags.collegeStartAge <= 7),
  weight: () => 50,
  run: (s) => {
    s.flags.collegeGraduated = true;
    // 卒業後の職業を適性に合わせて決定
    const candidates = [];
    if (s.stats.int >= 70 && s.stats.wealth < 50) candidates.push('エンジニア', '研究者', '教師');
    if (s.stats.int >= 65) candidates.push('公務員', '弁護士');
    if (s.stats.beauty >= 70) candidates.push('モデル');
    candidates.push('サラリーマン', 'フリーター', '起業家');
    
    const newJob = pick(candidates);
    setJob(s, newJob);
    gain(s, 'int', +3); gain(s, 'wealth', +15);
    logEvent(s, `大学を卒業し、${newJob}として社会に出た。新しい人生の第一歩を踏み出した。`);
  },
});

addEvent({
  id: 'hire-office', name: '就職(サラリーマン)',
  cond: (s) => s.age >= 18 && s.age <= 26 && !s.job,
  weight: (s) => 50,
  run: (s) => {
    setJob(s, 'サラリーマン'); gain(s, 'wealth', +8);
    logEvent(s, '就職活動を経て社会人になった年。安定した収入を得られるようになった。');
  },
});

addEvent({
  id: 'athlete', name: 'アスリートの才能',
  cond: (s) => s.age >= 12 && s.age <= 22 && s.stats.health >= 75 && !s.job,
  weight: (s) => s.stats.health - 50,
  run: (s) => {
    setJob(s, 'アスリート'); gain(s, 'wealth', +12); gain(s, 'health', +4);
    logEvent(s, '身体能力を活かしアスリートの道へ進んだ年。厳しいトレーニングの日々。');
  },
});

// 追加職業系イベント
addEvent({
  id: 'learn_code', name: 'プログラミング入門',
  cond: (s) => s.age >= 10 && s.age <= 15 && s.stats.int >= 50 && !s.flags.code,
  weight: (s) => s.stats.int,
  run: (s) => {
    s.flags.code = true; gain(s, 'int', +4);
    logEvent(s, 'プログラミングに出会った年。コードを書く楽しさに目覚めた。');
  },
});

addEvent({
  id: 'hire_engineer', name: 'ソフトウェアエンジニア就職',
  cond: (s) => s.age >= 18 && s.age <= 30 && (s.flags.code || s.stats.int >= 65) && !s.job,
  weight: (s) => (s.stats.int - 45) + (s.flags.code ? 20 : 0),
  run: (s) => {
    setJob(s, 'エンジニア'); gain(s, 'wealth', +14); gain(s, 'int', +3);
    logEvent(s, 'エンジニアとして就職した年。技術で社会に貢献する日々が始まった。');
  },
});

addEvent({
  id: 'med_school', name: '医学部合格',
  cond: (s) => s.age >= 17 && s.age <= 22 && s.stats.int >= 70 && !s.flags.med,
  weight: (s) => s.stats.int - 50,
  run: (s) => {
    s.flags.med = true; gain(s, 'int', +6); gain(s, 'wealth', -12);
    logEvent(s, '医学部に合格した年。医師を目指す長い道のりが始まった。');
  },
});

addEvent({
  id: 'become_doctor', name: '医師免許取得',
  cond: (s) => s.age >= 24 && s.age <= 32 && s.flags.med && !s.job,
  weight: () => 60,
  run: (s) => {
    setJob(s, '医者'); gain(s, 'wealth', +20);
    logEvent(s, '医師免許を取得し白衣を纏った年。患者の命と向き合う責任ある立場に。');
  },
});

addEvent({
  id: 'law_school', name: '法学の道',
  cond: (s) => s.age >= 18 && s.age <= 26 && s.stats.int >= 65 && !s.flags.law,
  weight: (s) => s.stats.int - 48,
  run: (s) => {
    s.flags.law = true; gain(s, 'int', +4);
    logEvent(s, '法学に魅了された年。判例研究に没頭する日々を送った。');
  },
});

addEvent({
  id: 'become_lawyer', name: '弁護士登録',
  cond: (s) => s.age >= 23 && s.age <= 35 && s.flags.law && !s.job,
  weight: () => 40,
  run: (s) => {
    setJob(s, '弁護士'); gain(s, 'wealth', +18);
    logEvent(s, '司法試験に合格し弁護士登録した年。正義のために戦う日々が始まった。');
  },
});

addEvent({
  id: 'chef_apprentice', name: '料理人の修行',
  cond: (s) => s.age >= 16 && s.age <= 28 && s.stats.health >= 55 && !s.job,
  weight: (s) => s.stats.health - 40,
  run: (s) => {
    setJob(s, 'シェフ'); gain(s, 'wealth', +10);
    logEvent(s, '料理人として修行を始めた年。味で勝負する厳しい世界に足を踏み入れた。');
  },
});

addEvent({
  id: 'writer_debut', name: '小説家デビュー',
  cond: (s) => s.age >= 18 && s.age <= 45 && (s.stats.int + s.stats.luck >= 110) && !s.job,
  weight: (s) => (s.stats.int + s.stats.luck) / 2 - 40,
  run: (s) => {
    setJob(s, '作家'); gain(s, 'wealth', +8);
    logEvent(s, '作品が新人賞を受賞した年。作家としてのキャリアがスタートした。');
  },
});

addEvent({
  id: 'music_debut', name: '音楽家の道',
  cond: (s) => s.age >= 16 && s.age <= 30 && (s.stats.beauty >= 60 || s.stats.luck >= 65) && !s.job,
  weight: (s) => (s.stats.luck + s.stats.beauty) / 3,
  run: (s) => {
    setJob(s, '音楽家'); gain(s, 'wealth', +9);
    logEvent(s, '音楽活動が軌道に乗り始めた年。ライブの機会が増えファンも増えた。');
  },
});

addEvent({
  id: 'comedian', name: '芸人として舞台へ',
  cond: (s) => s.age >= 16 && s.age <= 30 && s.stats.luck >= 60 && !s.job,
  weight: (s) => s.stats.luck - 45,
  run: (s) => {
    setJob(s, '芸人'); gain(s, 'wealth', +7);
    logEvent(s, '芸人として舞台デビューした年。笑いを届ける喜びと厳しさを知った。');
  },
});

addEvent({
  id: 'streamer', name: '配信者として活動',
  cond: (s) => s.age >= 15 && s.age <= 40 && (s.stats.luck + s.stats.int >= 100) && !s.job,
  weight: (s) => (s.stats.luck + s.stats.int) / 2 - 30,
  run: (s) => {
    setJob(s, '配信者'); gain(s, 'wealth', +8);
    logEvent(s, '配信活動を本格化した年。視聴者とのつながりが生きがいになった。');
  },
});

addEvent({
  id: 'pro_gamer', name: 'プロゲーマー契約',
  cond: (s) => s.age >= 16 && s.age <= 28 && s.stats.int >= 60 && s.stats.luck >= 55 && !s.job,
  weight: (s) => s.stats.int + s.stats.luck - 90,
  run: (s) => {
    setJob(s, 'プロゲーマー'); gain(s, 'wealth', +12);
    logEvent(s, 'eスポーツチームとプロ契約した年。ゲームで生計を立てる夢が叶った。');
  },
});

addEvent({
  id: 'teacher_job', name: '教師として採用',
  cond: (s) => s.age >= 22 && s.age <= 35 && s.stats.int >= 60 && !s.job,
  weight: (s) => s.stats.int - 45,
  run: (s) => {
    setJob(s, '教師'); gain(s, 'wealth', +9);
    logEvent(s, '教師として教壇に立ち始めた年。生徒の成長を見守るやりがいを感じた。');
  },
});

addEvent({
  id: 'public_officer', name: '公務員試験合格',
  cond: (s) => s.age >= 20 && s.age <= 35 && s.stats.int >= 55 && !s.job,
  weight: (s) => s.stats.int - 42,
  run: (s) => {
    setJob(s, '公務員'); gain(s, 'wealth', +8);
    logEvent(s, '公務員試験に合格した年。地域社会に貢献する安定した職に就いた。');
  },
});

addEvent({
  id: 'farmer_life', name: '農家として生きる',
  cond: (s) => s.age >= 18 && s.age <= 40 && s.stats.health >= 65 && !s.job,
  weight: (s) => s.stats.health - 50,
  run: (s) => {
    setJob(s, '農家'); gain(s, 'health', +2);
    logEvent(s, '農業を始めた年。大地と共に生きる充実した日々が始まった。');
  },
});

addEvent({
  id: 'craftsman', name: '職人の道',
  cond: (s) => s.age >= 18 && s.age <= 40 && s.stats.health >= 55 && !s.job,
  weight: (s) => s.stats.health - 45,
  run: (s) => {
    setJob(s, '職人'); gain(s, 'wealth', +8);
    logEvent(s, '職人の道を選んだ年。技術を磨く地道な修行が始まった。');
  },
});

addEvent({
  id: 'astronaut', name: '宇宙飛行士選抜',
  cond: (s) => s.age >= 24 && s.age <= 38 && s.stats.int >= 80 && s.stats.health >= 80 && s.stats.luck >= 65 && !s.job,
  weight: (s) => Math.min(15, (s.stats.int + s.stats.health + s.stats.luck) / 6 - 30),
  run: (s) => {
    setJob(s, '宇宙飛行士'); gain(s, 'wealth', +25); gain(s, 'health', -2);
    logEvent(s, '宇宙飛行士に選抜された年。人類の夢を背負う重責を感じた。');
  },
});

// ここからハズレ寄りの職/状態
addEvent({
  id: 'no_offer_freeter', name: '内定ゼロでフリーター',
  cond: (s) => s.age >= 22 && s.age <= 28 && !s.job && s.stats.int < 50 && s.stats.luck < 55,
  weight: (s) => 50 - (s.stats.int + s.stats.luck) / 4,
  run: (s) => {
    setJob(s, 'フリーター'); gain(s, 'wealth', +2); s.happiness = clamp(s.happiness - 4, 0, 100);
    logEvent(s, '就職活動が実らなかった年。アルバイトで生計を立てることになった。');
  },
});

addEvent({
  id: 'night_convenience', name: 'コンビニ夜勤に入る',
  cond: (s) => s.age >= 18 && s.age <= 40 && !s.job && s.stats.int < 55 && s.stats.luck < 60,
  weight: () => 38,
  run: (s) => {
    setJob(s, 'コンビニ店員'); gain(s, 'health', -2); gain(s, 'wealth', +3);
    logEvent(s, 'コンビニで夜勤バイトを始めた年。不規則な生活で体調を崩しがちに。');
  },
});

addEvent({
  id: 'day_labor', name: '日雇いの現場へ',
  cond: (s) => s.age >= 18 && s.age <= 50 && !s.job && s.stats.wealth < 0 && s.stats.health >= 40,
  weight: (s) => 30 + Math.max(0, -s.stats.wealth) / 5,
  run: (s) => {
    setJob(s, '日雇い労働者'); gain(s, 'health', -3); gain(s, 'wealth', +4);
    logEvent(s, '日雇いの仕事で生活を繋いだ年。体力的に厳しい日々が続いた。');
  },
});

addEvent({
  id: 'burnout_unemployed', name: '燃え尽きて無職に',
  cond: (s) => s.age >= 20 && s.stats.health < 18 && s.job && !['無職','学生','石'].includes(s.job),
  weight: (s) => 25 + (18 - s.stats.health),
  run: (s) => {
    setJob(s, '無職'); gain(s, 'wealth', -5); s.happiness = clamp(s.happiness - 8, 0, 100);
    logEvent(s, '心身の限界で仕事を辞めた年。休養が必要だった。');
  },
});

// =========================
// 一発逆転・脳汁イベント群
// =========================

// 宝くじ1等: 超低確率で超高額当選
addEvent({
  id: 'lottery_jackpot', name: '宝くじ1等',
  cond: (s) => s.age >= 18 && Math.random() < (0.0008 + Math.max(0, s.stats.luck - 50) / 200000),
  weight: () => 120,
  run: (s) => {
    const prize = randInt(300, 1500);
    gain(s, 'wealth', +prize);
    s.happiness = clamp(s.happiness + 15, 0, 100);
    logEvent(s, `★ まさかの1等当選！ 資産+${prize}`);
  },
});

// 配信がバズって一攫千金(フリーター/配信者/無職の逆転口)
addEvent({
  id: 'stream_viral', name: '配信がバズった',
  cond: (s) => s.age >= 15 && s.age <= 50 && (s.job === '配信者' || s.job === 'フリーター' || s.job === '無職') && Math.random() < 0.02,
  weight: (s) => 20 + (s.stats.luck - 40) / 2,
  run: (s) => {
    const earn = randInt(60, 300);
    setJob(s, '配信者');
    gain(s, 'wealth', +earn);
    s.happiness = clamp(s.happiness + 12, 0, 100);
    logEvent(s, `⚡配信が大バズりした年。一気に有名配信者の仒間入り。${formatMoney(earn)}`);
  },
});

// 謎の遺産: 貧しいときに起こりやすい救済
addEvent({
  id: 'mysterious_inheritance', name: '謎の遺産相続',
  cond: (s) => s.age >= 20 && s.stats.wealth < 0 && Math.random() < 0.03,
  weight: (s) => 40 + Math.min(60, -s.stats.wealth / 2),
  run: (s) => {
    const amt = randInt(80, 400);
    gain(s, 'wealth', +amt);
    logEvent(s, `★遠縁の親族から遺産が入った年。思わぬ幸運に恵まれた。${formatMoney(amt)}`);
  },
});

// 特許でロイヤリティ収入
addEvent({
  id: 'eureka_patent', name: 'ひらめきが特許に',
  cond: (s) => s.age >= 20 && (s.job === 'エンジニア' || s.job === '研究者') && s.stats.int >= 75 && !s.flags.patent,
  weight: (s) => s.stats.int - 55,
  run: (s) => {
    s.flags.patent = true;
    const amt = randInt(50, 220);
    gain(s, 'wealth', +amt); gain(s, 'int', +4);
    logEvent(s, `★画期的な発明が特許化された年。ロイヤリティ収入を得るように。${formatMoney(amt)}`);
  },
});

// 暗号資産ムーン or 暴落(ハイリスク・ハイリターン)
addEvent({
  id: 'crypto_spin', name: '暗号資産オールイン',
  cond: (s) => s.age >= 18 && (s.flags.stocks || s.job === '投資家' || s.job === '起業家') && Math.random() < 0.04,
  weight: (s) => 35 + (s.stats.luck - 50) / 3,
  run: (s) => {
    const moon = Math.random() < (0.45 + s.stats.luck / 300);
    if (moon) {
      const gainAmt = randInt(80, 500);
      gain(s, 'wealth', +gainAmt); s.happiness = clamp(s.happiness + 10, 0, 100);
      logEvent(s, `⚡暗号資産が大暴騰した年。人生逆転のチャンスを掴んだ。${formatMoney(gainAmt)}`);
    } else {
      const lossAmt = randInt(40, 260);
      gain(s, 'wealth', -lossAmt); s.happiness = clamp(s.happiness - 6, 0, 100);
      logEvent(s, `▼暗号資産が大暴落した年。大きな損失を出してしまった。-${formatMoney(lossAmt)}`);
    }
  },
});

// 競技で優勝(アスリート向けの脳汁)
addEvent({
  id: 'champ_win', name: '大舞台で優勝',
  cond: (s) => s.job === 'アスリート' && s.stats.health >= 70 && Math.random() < 0.06,
  weight: (s) => (s.stats.health + s.stats.luck) / 2,
  run: (s) => {
    const bonus = randInt(40, 240);
    gain(s, 'wealth', +bonus); s.happiness = clamp(s.happiness + 14, 0, 100);
    logEvent(s, `★大試合で優勝した年。世界が注目し名声を得た。${formatMoney(bonus)}`);
  },
});

// 奇跡の回復: 健康絶望時の救済で寿命も延長
addEvent({
  id: 'miracle_cure', name: '奇跡の治療',
  cond: (s) => s.stats.health <= 10 && s.stats.luck >= 70 && Math.random() < 0.2,
  weight: (s) => 50 + (s.stats.luck - 70) * 2,
  run: (s) => {
    const heal = randInt(25, 50);
    gain(s, 'health', +heal);
    const plusLife = randInt(5, 15);
    s.lifespan = clamp(s.lifespan + plusLife, 30, 130);
    logEvent(s, `★ 最新医療が奏功！ 健康+${heal} 寿命+${plusLife}`);
  },
});

// エンジェル投資で会社が延命
addEvent({
  id: 'angel_invest', name: 'エンジェル投資家現る',
  cond: (s) => s.job === '起業家' && s.stats.wealth < 20 && Math.random() < 0.08,
  weight: () => 40,
  run: (s) => {
    const amt = randInt(80, 200);
    gain(s, 'wealth', +amt);
    logEvent(s, `★エンジェル投資家が現れた年。会社が息を吹き返した。${formatMoney(amt)}`);
  },
});

// Nレア救済: ゴールデンチケット
addEvent({
  id: 'golden_ticket', name: '黄金のチケット',
  cond: (s) => s.rarity === 'N' && s.age <= 15 && Math.random() < 0.02,
  weight: (s) => 30 + (s.stats.luck - 40) / 2,
  run: (s) => {
    const up = randInt(10, 25);
    gain(s, 'luck', +up); gain(s, 'int', +5);
    logEvent(s, `★不思議な黄金のチケットを得た年。運命が好転し始めた。運+${up}`);
  },
});

addEvent({
  id: 'startup', name: '起業',
  cond: (s) => s.age >= 22 && s.age <= 45 && (s.stats.int + s.stats.luck >= 110),
  weight: (s) => (s.stats.int + s.stats.luck) - 80,
  run: (s) => {
    const success = Math.random() < (0.28 + s.stats.luck / 250);
    if (success) {
      const earn = randInt(80, 220);
      gain(s, 'wealth', +earn); setJob(s, '起業家');
      logEvent(s, `起業した事業が軌道に乗った年。起業家としての人生が始まった。${formatMoney(earn)}`);
    } else {
      const loss = randInt(40, 150);
      gain(s, 'wealth', -loss); gain(s, 'health', -4);
      logEvent(s, `起業したが資金繰りに苦労した年。大きな損失を出してしまった。-${formatMoney(loss)}`);
    }
  },
});

addEvent({
  id: 'love', name: '恋愛',
  cond: (s) => s.age >= 14 && s.age <= 40,
  weight: (s) => 12 + (s.stats.beauty - 40) / 2,
  run: (s) => {
    const happy = Math.random() < 0.6;
    if (happy) { s.happiness = clamp(s.happiness + 8, 0, 100); logEvent(s, '運命の人と出会った年。恋愛が人生に彩りを添えた。'); }
    else { s.happiness = clamp(s.happiness - 6, 0, 100); logEvent(s, '別れが訪れた年。失恋の痛みを知った。'); }
  },
});

addEvent({
  id: 'illness', name: '大病',
  cond: (s) => s.age >= 30 && Math.random() < 0.08,
  weight: (s) => 20 - s.stats.health / 10,
  run: (s) => {
    const dmg = randInt(10, 30);
    gain(s, 'health', -dmg);
    logEvent(s, `大病を患った年。入院生活を余儀なくされた。健康-${dmg}`);
    if (s.stats.health <= 0) die(s, '病気で死亡');
  },
});

// 即死イベント(低確率): 隕石/事故
function suddenDeaths(state) {
  if (!state.alive) return;
  // 幼少期(〜11歳)は理不尽な即死イベントを発生させない
  if (state.age < 12) return;
  if (Math.random() < 0.0001) { // 0.01%
    state.currentEventMeta = { title: '隕石直撃', tone: 'rare', icon: '☄️', timestamp: Date.now() };
    logEvent(state, '空から隕石が直撃した。すべては運命。');
    die(state, '隕石直撃');
    return;
  }
  const accidentRate = 0.02 + (50 - state.stats.luck) / 2000; // 基本2% + 低運補正
  if (Math.random() < accidentRate) {
    const avoid = state.stats.health > 70 && Math.random() < 0.4;
    if (!avoid) {
      state.currentEventMeta = { title: '事故', tone: 'bad', icon: '💥', timestamp: Date.now() };
      logEvent(state, '不運な事故に遭った年。命を落としてしまった……');
      die(state, '事故死');
    } else {
      state.currentEventMeta = { title: '危機回避', tone: 'good', icon: '🛡️', timestamp: Date.now() };
      logEvent(state, '大きな事故を間一髪で回避した年。生きていることの大切さを実感した。');
      gain(state, 'health', -3);
    }
  }
}

// 借金取りイベント(資産が大幅マイナス時)
addEvent({
  id: 'debt-collector', name: '借金取り',
  cond: (s) => s.stats.wealth <= -80,
  weight: () => 80,
  run: (s) => {
    logEvent(s, '借金が膝まで膨らんだ年。取り立てに追われ人生が終わってしまった……');
    die(s, '借金取りにより終了');
  },
});

// ========== 新規イベント大量追加 ==========

addEvent({
  id: 'marathon', name: 'マラソン完走', tone: 'good', icon: '🏃',
  cond: (s) => s.age >= 18 && s.stats.health >= 55 && Math.random() < 0.1,
  weight: (s) => s.stats.health - 40,
  run: (s) => {
    gain(s, 'health', +3); s.happiness = clamp(s.happiness + 5, 0, 100);
    logEvent(s, 'フルマラソンを完走した年。達成感と自信を手に入れた。');
  },
});

addEvent({
  id: 'diet_success', name: 'ダイエット成功', tone: 'good', icon: '💪',
  cond: (s) => s.age >= 20 && s.stats.health < 60 && !s.flags.diet,
  weight: () => 25,
  run: (s) => {
    s.flags.diet = true; gain(s, 'health', +8); gain(s, 'beauty', +5);
    logEvent(s, 'ダイエットに成功した年。理想の体型を手に入れ自分に自信がついた。');
  },
});

addEvent({
  id: 'fashion_makeover', name: 'イメチェン成功', tone: 'good', icon: '✨',
  cond: (s) => s.age >= 16 && s.stats.beauty < 70,
  weight: (s) => 65 - s.stats.beauty,
  run: (s) => {
    gain(s, 'beauty', +6); s.happiness = clamp(s.happiness + 4, 0, 100);
    logEvent(s, '思い切って外見を変えた年。イメチェンが大成功し周囲の反応が変わった。');
  },
});

addEvent({
  id: 'volunteer', name: 'ボランティア活動', icon: '🤝',
  cond: (s) => s.age >= 15 && Math.random() < 0.08,
  weight: () => 20,
  run: (s) => {
    s.happiness = clamp(s.happiness + 6, 0, 100); gain(s, 'luck', +1);
    logEvent(s, 'ボランティア活動に参加した年。人の役に立つ充実感を味わった。');
  },
});

// 健康を取り戻す・維持するイベント（健康マイナスの緩和）
addEvent({
  id: 'morning_jog', name: '朝のジョギング習慣', tone: 'good', icon: '🏃',
  cond: (s) => s.age >= 15 && s.age <= 70,
  weight: () => 14,
  run: (s) => {
    gain(s, 'health', +3); s.happiness = clamp(s.happiness + 3, 0, 100);
    logEvent(s, '毎朝のジョギングで体が軽くなった。健康を実感。');
  },
});

addEvent({
  id: 'stretch_routine', name: 'ストレッチで体ほぐし', tone: 'good', icon: '🤸',
  cond: (s) => s.age >= 12 && s.age <= 80,
  weight: () => 13,
  run: (s) => {
    gain(s, 'health', +2); s.happiness = clamp(s.happiness + 2, 0, 100);
    logEvent(s, '毎日のストレッチで体が柔らかくなった。疲れにくくなった気がする。');
  },
});

addEvent({
  id: 'balanced_diet', name: '食生活を改善', tone: 'good', icon: '🥗',
  cond: (s) => s.age >= 18 && Math.random() < 0.08,
  weight: () => 16,
  run: (s) => {
    gain(s, 'health', +4); s.happiness = clamp(s.happiness + 2, 0, 100);
    logEvent(s, '野菜中心の食事に切り替えた。体調が安定し、肌の調子も良い。');
  },
});

addEvent({
  id: 'pet_adopt', name: 'ペットを飼う', tone: 'good', icon: '🐕',
  cond: (s) => s.age >= 18 && s.stats.wealth > 10 && !s.flags.pet,
  weight: () => 18,
  run: (s) => {
    s.flags.pet = true; s.happiness = clamp(s.happiness + 10, 0, 100); gain(s, 'wealth', -5);
    logEvent(s, 'ペットを家族に迎えた年。癒しの日々が始まり心が豊かになった。');
  },
});

addEvent({
  id: 'travel_abroad', name: '海外旅行', tone: 'good', icon: '✈️',
  cond: (s) => s.age >= 18 && s.stats.wealth > 30 && Math.random() < 0.06,
  weight: (s) => s.stats.wealth - 20,
  run: (s) => {
    gain(s, 'wealth', -15); s.happiness = clamp(s.happiness + 12, 0, 100); gain(s, 'int', +2);
    logEvent(s, '憧れの海外旅行をした年。異国の文化に触れ価値観が広がった。');
  },
});

addEvent({
  id: 'cooking_lesson', name: '料理教室', icon: '👨‍🍳',
  cond: (s) => s.age >= 16 && !s.flags.cooking,
  weight: () => 15,
  run: (s) => {
    s.flags.cooking = true; gain(s, 'health', +2); s.happiness = clamp(s.happiness + 3, 0, 100);
    logEvent(s, '料理教室に通い始めた。食生活が豊かになった。');
  },
});

addEvent({
  id: 'language_study', name: '外国語習得', icon: '🗣️',
  cond: (s) => s.age >= 12 && s.stats.int >= 55 && !s.flags.language,
  weight: (s) => s.stats.int - 40,
  run: (s) => {
    s.flags.language = true; gain(s, 'int', +5);
    logEvent(s, '外国語を習得！世界が広がった。');
  },
});

addEvent({
  id: 'music_instrument', name: '楽器を始める', icon: '🎸',
  cond: (s) => s.age >= 10 && !s.flags.instrument,
  weight: () => 20,
  run: (s) => {
    s.flags.instrument = true; s.happiness = clamp(s.happiness + 5, 0, 100); gain(s, 'int', +2);
    logEvent(s, '楽器を始めた。音楽が生活に彩りを添える。');
  },
});

addEvent({
  id: 'art_exhibition', name: '美術展を見る', icon: '🎨',
  cond: (s) => s.age >= 15 && Math.random() < 0.08,
  weight: () => 15,
  run: (s) => {
    s.happiness = clamp(s.happiness + 4, 0, 100); gain(s, 'int', +1);
    logEvent(s, '美術展で芸術に触れ、感性が磨かれた。');
  },
});

addEvent({
  id: 'sports_injury', name: 'スポーツで怪我', tone: 'bad', icon: '🤕',
  cond: (s) => s.age >= 12 && s.stats.health >= 50 && Math.random() < 0.06,
  weight: () => 25,
  run: (s) => {
    gain(s, 'health', -8); s.happiness = clamp(s.happiness - 3, 0, 100);
    logEvent(s, '無理をして怪我をしてしまった。回復に時間がかかる。');
  },
});

addEvent({
  id: 'insomnia', name: '不眠症', tone: 'bad', icon: '😴',
  cond: (s) => s.age >= 20 && s.stats.health < 50 && Math.random() < 0.08,
  weight: () => 20,
  run: (s) => {
    gain(s, 'health', -5); s.happiness = clamp(s.happiness - 4, 0, 100);
    logEvent(s, '眠れない夜が続く。体調が優れない。');
  },
});

addEvent({
  id: 'food_poisoning', name: '食中毒', tone: 'bad', icon: '🤢',
  cond: (s) => s.age >= 10 && Math.random() < 0.04,
  weight: () => 18,
  run: (s) => {
    gain(s, 'health', -6);
    logEvent(s, '食あたりで寝込んでしまった……');
  },
});

addEvent({
  id: 'theft', name: '盗難被害', tone: 'bad', icon: '🔓',
  cond: (s) => s.age >= 15 && s.stats.wealth > 20 && Math.random() < 0.03,
  weight: () => 15,
  run: (s) => {
    const loss = randInt(10, 40);
    gain(s, 'wealth', -loss); s.happiness = clamp(s.happiness - 5, 0, 100);
    logEvent(s, `盗難に遭った……資産-${formatMoney(loss)}`);
  },
});

addEvent({
  id: 'car_accident_minor', name: '軽い交通事故', tone: 'bad', icon: '🚗',
  cond: (s) => s.age >= 18 && Math.random() < 0.05,
  weight: () => 20,
  run: (s) => {
    gain(s, 'health', -4); gain(s, 'wealth', -8);
    logEvent(s, '交通事故に遭い、治療費がかさんだ。');
  },
});

addEvent({
  id: 'scam', name: '詐欺被害', tone: 'bad', icon: '⚠️',
  cond: (s) => s.age >= 20 && s.stats.wealth > 30 && s.stats.int < 60 && Math.random() < 0.03,
  weight: (s) => 60 - s.stats.int,
  run: (s) => {
    const loss = randInt(20, 80);
    gain(s, 'wealth', -loss); s.happiness = clamp(s.happiness - 8, 0, 100);
    logEvent(s, `詐欺に引っかかった……資産-${formatMoney(loss)}`);
  },
});

addEvent({
  id: 'find_money', name: '拾い物', tone: 'good', icon: '💴',
  cond: (s) => s.age >= 5 && Math.random() < 0.05,
  weight: (s) => s.stats.luck - 30,
  run: (s) => {
    const find = randInt(2, 10);
    gain(s, 'wealth', +find); s.happiness = clamp(s.happiness + 2, 0, 100);
    logEvent(s, `道端でお金を拾った！資産+${formatMoney(find)}`);
  },
});

addEvent({
  id: 'reunion', name: '同窓会', icon: '🎉',
  cond: (s) => s.age >= 22 && Math.random() < 0.06,
  weight: () => 18,
  run: (s) => {
    s.happiness = clamp(s.happiness + 6, 0, 100);
    logEvent(s, '懐かしい顔ぶれと再会。青春の思い出がよみがえる。');
  },
});

addEvent({
  id: 'online_friend', name: 'ネットで友達', icon: '💬',
  cond: (s) => s.age >= 11 && Math.random() < 0.08,
  weight: () => 16,
  run: (s) => {
    s.happiness = clamp(s.happiness + 4, 0, 100); gain(s, 'luck', +1);
    logEvent(s, 'オンラインで気の合う友達ができた。');
  },
});

addEvent({
  id: 'move_house', name: '引っ越し', icon: '📦',
  cond: (s) => s.age >= 18 && s.stats.wealth > 15 && Math.random() < 0.05,
  weight: () => 20,
  run: (s) => {
    gain(s, 'wealth', -12); s.happiness = clamp(s.happiness + 3, 0, 100);
    logEvent(s, '新しい住まいに引っ越した。新生活の始まり。');
  },
});

addEvent({
  id: 'furniture_broke', name: '家具が壊れた', tone: 'bad', icon: '🛋️',
  cond: (s) => s.age >= 18 && Math.random() < 0.05,
  weight: () => 15,
  run: (s) => {
    gain(s, 'wealth', -5); s.happiness = clamp(s.happiness - 2, 0, 100);
    logEvent(s, '家具が壊れて買い替えが必要に……');
  },
});

addEvent({
  id: 'phone_upgrade', name: 'スマホ新調', icon: '📱',
  cond: (s) => s.age >= 12 && s.stats.wealth > 10 && Math.random() < 0.06,
  weight: () => 18,
  run: (s) => {
    gain(s, 'wealth', -8); s.happiness = clamp(s.happiness + 3, 0, 100);
    logEvent(s, '最新スマホに買い替え。テンションが上がる。');
  },
});

addEvent({
  id: 'concert', name: 'ライブ参戦', tone: 'good', icon: '🎤',
  cond: (s) => s.age >= 12 && s.stats.wealth > 8 && Math.random() < 0.06,
  weight: () => 22,
  run: (s) => {
    gain(s, 'wealth', -6); s.happiness = clamp(s.happiness + 8, 0, 100);
    logEvent(s, '憧れのアーティストのライブに！最高の思い出。');
  },
});

addEvent({
  id: 'movie_marathon', name: '映画三昧', icon: '🎬',
  cond: (s) => s.age >= 10 && Math.random() < 0.07,
  weight: () => 17,
  run: (s) => {
    s.happiness = clamp(s.happiness + 4, 0, 100); gain(s, 'int', +1);
    logEvent(s, '週末は映画を見まくった。作品に感動。');
  },
});

addEvent({
  id: 'anime_otaku', name: 'アニメにハマる', icon: '📺',
  cond: (s) => s.age >= 10 && !s.flags.anime,
  weight: () => 24,
  run: (s) => {
    s.flags.anime = true; s.happiness = clamp(s.happiness + 6, 0, 100);
    logEvent(s, 'アニメ沼にハマった。推しができた。');
  },
});

addEvent({
  id: 'cosplay_debut', name: 'コスプレデビュー', icon: '🎭',
  cond: (s) => s.age >= 14 && s.flags.anime && !s.flags.cosplay,
  weight: () => 20,
  run: (s) => {
    s.flags.cosplay = true; s.happiness = clamp(s.happiness + 5, 0, 100); gain(s, 'beauty', +2);
    logEvent(s, 'コスプレイベントに参加！表現の楽しさを知った。');
  },
});

addEvent({
  id: 'camping', name: 'キャンプ体験', tone: 'good', icon: '🏕️',
  cond: (s) => s.age >= 14 && Math.random() < 0.06,
  weight: () => 20,
  run: (s) => {
    s.happiness = clamp(s.happiness + 7, 0, 100); gain(s, 'health', +2);
    logEvent(s, '大自然でキャンプ。星空の下で心が洗われた。');
  },
});

addEvent({
  id: 'fishing', name: '釣りで大物', tone: 'good', icon: '🎣',
  cond: (s) => s.age >= 12 && Math.random() < 0.04,
  weight: (s) => Math.max(12, s.stats.luck - 35),
  run: (s) => {
    s.happiness = clamp(s.happiness + 6, 0, 100); gain(s, 'luck', +1);
    logEvent(s, '釣りで大物ゲット！思わずガッツポーズ。');
  },
});

addEvent({
  id: 'photo_contest', name: '写真コンテスト入賞', tone: 'rare', icon: '📷',
  cond: (s) => s.age >= 14 && s.stats.int >= 60 && Math.random() < 0.02,
  weight: (s) => Math.max(8, s.stats.int - 45),
  run: (s) => {
    const prize = randInt(10, 40);
    gain(s, 'wealth', +prize); s.happiness = clamp(s.happiness + 10, 0, 100);
    logEvent(s, `★写真コンテストで入賞！賞金+${formatMoney(prize)}`);
  },
});

addEvent({
  id: 'sns_viral', name: 'SNSでバズる', tone: 'rare', icon: '📲',
  cond: (s) => s.age >= 12 && Math.random() < 0.03,
  weight: (s) => Math.max(10, s.stats.luck - 30),
  run: (s) => {
    s.happiness = clamp(s.happiness + 8, 0, 100); gain(s, 'luck', +2);
    logEvent(s, '★投稿がバズった！フォロワー急増。');
  },
});

addEvent({
  id: 'inheritance_small', name: '少額の遺産', icon: '💰',
  cond: (s) => s.age >= 25 && Math.random() < 0.04,
  weight: () => 15,
  run: (s) => {
    const amt = randInt(15, 60);
    gain(s, 'wealth', +amt);
    logEvent(s, `親戚から遺産が入った。資産+${formatMoney(amt)}`);
  },
});

addEvent({
  id: 'save_someone', name: '人助け', tone: 'good', icon: '🦸',
  cond: (s) => s.age >= 15 && s.stats.health >= 55 && Math.random() < 0.04,
  weight: (s) => s.stats.health - 40,
  run: (s) => {
    s.happiness = clamp(s.happiness + 10, 0, 100); gain(s, 'luck', +3);
    logEvent(s, '困っている人を助けた。感謝され心が温まる。');
  },
});

addEvent({
  id: 'bullied', name: 'いじめ被害', tone: 'bad', icon: '😢',
  cond: (s) => s.age >= 8 && s.age <= 18 && s.stats.beauty < 50 && Math.random() < 0.04,
  weight: () => 14,
  run: (s) => {
    s.happiness = clamp(s.happiness - 12, 0, 100); gain(s, 'health', -4);
    logEvent(s, 'いじめに遭い、辛い日々を過ごした……');
  },
});

addEvent({
  id: 'exam_fail', name: '試験失敗', tone: 'bad', icon: '📝',
  cond: (s) => s.age >= 12 && s.age <= 25 && s.stats.int < 60 && Math.random() < 0.06,
  weight: () => 16,
  run: (s) => {
    s.happiness = clamp(s.happiness - 5, 0, 100); gain(s, 'int', -2);
    logEvent(s, '重要な試験に落ちてしまった……自信を失った。');
  },
});

addEvent({
  id: 'scholarship', name: '奨学金獲得', tone: 'good', icon: '🎓',
  cond: (s) => s.age >= 15 && s.age <= 22 && s.stats.int >= 70 && !s.flags.scholarship,
  weight: (s) => Math.max(10, s.stats.int - 55),
  run: (s) => {
    s.flags.scholarship = true; gain(s, 'wealth', +25);
    logEvent(s, '奨学金を獲得！学費の心配が減った。');
  },
});

addEvent({
  id: 'club_captain', name: '部活キャプテン', tone: 'good', icon: '🏆',
  cond: (s) => s.age >= 14 && s.age <= 18 && s.stats.health >= 60 && !s.flags.captain,
  weight: (s) => Math.max(10, s.stats.health - 45),
  run: (s) => {
    s.flags.captain = true; s.happiness = clamp(s.happiness + 8, 0, 100); gain(s, 'health', +3);
    logEvent(s, '部活のキャプテンに選ばれた！責任感が芽生える。');
  },
});

addEvent({
  id: 'breakup', name: '失恋', tone: 'bad', icon: '💔',
  cond: (s) => s.age >= 14 && s.age <= 40 && Math.random() < 0.07,
  weight: () => 24,
  run: (s) => {
    s.happiness = clamp(s.happiness - 10, 0, 100); gain(s, 'health', -2);
    logEvent(s, '大切な人との別れ。心に深い傷が残った。');
  },
});

addEvent({
  id: 'marriage_proposal', name: 'プロポーズ', tone: 'rare', icon: '💍',
  cond: (s) => s.age >= 22 && s.age <= 45 && (s.stats.beauty >= 60 || s.stats.wealth >= 80) && !s.flags.married,
  weight: (s) => (s.stats.beauty + s.stats.wealth) / 2 - 40,
  run: (s) => {
    s.flags.married = true; s.happiness = clamp(s.happiness + 20, 0, 100); gain(s, 'wealth', +15);
    logEvent(s, '★運命の人との結婚！人生の新たな章が始まる。');
  },
});

addEvent({
  id: 'child_born', name: '子供誕生', tone: 'rare', icon: '👶',
  cond: (s) => s.flags.married && s.age >= 24 && s.age <= 50 && !s.flags.child,
  weight: () => 35,
  run: (s) => {
    s.flags.child = true;
    s.flags.childCount = (s.flags.childCount || 0) + 1;
    s.happiness = clamp(s.happiness + 18, 0, 100);
    gain(s, 'wealth', -20);
    logEvent(s, '★子供が生まれた年。新しい命に感動した。');
  },
});

addEvent({
  id: 'promotion', name: '昇進', tone: 'good', icon: '📈',
  cond: (s) => s.age >= 28 && s.job && !['無職','学生','石','フリーター'].includes(s.job),
  weight: (s) => (s.stats.int + s.stats.luck) / 2 - 35,
  run: (s) => {
    const bonus = randInt(20, 60);
    gain(s, 'wealth', +bonus); s.happiness = clamp(s.happiness + 8, 0, 100);
    logEvent(s, `昇進が決まった！給与アップ+${formatMoney(bonus)}`);
  },
});

// 退職イベント（60歳以降）
addEvent({
  id: 'retire', name: '退職', icon: '🛎️', tone: 'common',
  cond: (s) => s.age >= 60 && s.job && !['無職','学生','石','フリーター','パート'].includes(s.job) && !s.flags.retired,
  weight: (s) => 30 + (s.age - 60),
  run: (s) => {
    s.flags.retired = true;
    logEvent(s, '長年の勤めを終えた年。退職して新しい生活へ。');
  },
});

// シニア再雇用（パート）
addEvent({
  id: 'senior_rehire', name: 'シニア再雇用', icon: '🧓', tone: 'good',
  cond: (s) => s.flags.retired && s.age >= 62 && (s.stats.wealth < 120) && (!s.job || s.job === '無職'),
  weight: (s) => 40 - Math.max(0, s.stats.wealth - 60) / 3,
  run: (s) => {
    setJob(s, 'パート');
    gain(s, 'wealth', +4);
    logEvent(s, '地域でパート勤務を始めた年。ほどよい働き方で生活に張りが出た。');
  },
});

addEvent({
  id: 'demotion', name: '降格', tone: 'bad', icon: '📉',
  cond: (s) => s.age >= 30 && s.job && !['無職','学生','石'].includes(s.job) && s.stats.health < 40,
  weight: () => 15,
  run: (s) => {
    gain(s, 'wealth', -15); s.happiness = clamp(s.happiness - 10, 0, 100);
    logEvent(s, '成績不振で降格……自尊心が傷ついた。');
  },
});

addEvent({
  id: 'company_bankrupt', name: '会社倒産', tone: 'bad', icon: '🏢',
  cond: (s) => s.age >= 25 && s.job && !['無職','学生','石','起業家'].includes(s.job) && Math.random() < 0.02,
  weight: () => 18,
  run: (s) => {
    setJob(s, '無職'); gain(s, 'wealth', -20); s.happiness = clamp(s.happiness - 12, 0, 100);
    logEvent(s, '勤めていた会社が倒産……路頭に迷うことに。');
  },
});

addEvent({
  id: 'book_publish', name: '書籍出版', tone: 'rare', icon: '📚',
  cond: (s) => s.age >= 20 && (s.job === '作家' || s.stats.int >= 75) && !s.flags.published,
  weight: (s) => s.stats.int - 50,
  run: (s) => {
    s.flags.published = true;
    const earn = randInt(30, 120);
    gain(s, 'wealth', +earn); s.happiness = clamp(s.happiness + 12, 0, 100);
    logEvent(s, `★書籍を出版！印税収入+${formatMoney(earn)}`);
  },
});

// 教育費の発生（子どもがいる家庭）
addEvent({
  id: 'education_expense', name: '教育費', icon: '📖', tone: 'bad',
  cond: (s) => (s.flags.childCount || 0) > 0 && s.age >= 6 && Math.random() < 0.08,
  weight: (s) => 20 + (s.flags.childCount || 1) * 10,
  run: (s) => {
    const children = s.flags.childCount || 1;
    const cost = randInt(5, 10) * children;
    gain(s, 'wealth', -cost);
    s.happiness = clamp(s.happiness - 2, 0, 100);
    logEvent(s, `子どもの教育費がかさんだ年。出費-${formatMoney(cost)}`);
  },
});

addEvent({
  id: 'tv_appearance', name: 'テレビ出演', tone: 'rare', icon: '📺',
  cond: (s) => s.age >= 18 && (s.stats.beauty >= 70 || s.job === 'アイドル' || s.job === '芸人'),
  weight: (s) => s.stats.beauty - 50,
  run: (s) => {
    const fee = randInt(15, 50);
    gain(s, 'wealth', +fee); s.happiness = clamp(s.happiness + 10, 0, 100);
    logEvent(s, `★テレビに出演！出演料+${formatMoney(fee)}`);
  },
});

addEvent({
  id: 'award_ceremony', name: '表彰式', tone: 'rare', icon: '🏅',
  cond: (s) => s.age >= 20 && (s.stats.int >= 80 || s.stats.health >= 80) && Math.random() < 0.02,
  weight: (s) => (s.stats.int + s.stats.health) / 2 - 50,
  run: (s) => {
    const prize = randInt(20, 80);
    gain(s, 'wealth', +prize); s.happiness = clamp(s.happiness + 15, 0, 100); gain(s, 'luck', +2);
    logEvent(s, `★功績が認められ表彰された！賞金+${formatMoney(prize)}`);
  },
});

/* ============ 職業別イベント ============ */

// ========== 勇者向けイベント ==========
addEvent({
  id: 'hero_battle', name: '魔物との戦闘', job: '勇者', tone: 'good', icon: '⚔️',
  cond: (s) => s.age >= 10 && Math.random() < 0.035,
  weight: () => 16,
  run: (s) => {
    const damage = randInt(2, 8);
    gain(s, 'health', -damage); gain(s, 'wealth', +randInt(50, 200)); s.happiness = clamp(s.happiness + 12, 0, 100);
    logEvent(s, `魔物との戦闘に勝利した。経験値と報酬を得た。-${damage}体力`);
  },
});

addEvent({
  id: 'hero_legendary_encounter', name: '伝説の敵に遭遇', job: '勇者', tone: 'rare', icon: '👹',
  cond: (s) => s.age >= 15 && s.stats.health >= 70 && Math.random() < 0.015,
  weight: () => 20,
  run: (s) => {
    const dmg = randInt(10, 25);
    gain(s, 'health', -dmg); gain(s, 'wealth', +500); gain(s, 'luck', +3); s.happiness = clamp(s.happiness + 15, 0, 100);
    logEvent(s, `★伝説の魔王との戦闘！激戦の末に勝利した。-${dmg}体力、大金獲得`);
  },
});

addEvent({
  id: 'hero_training', name: '修行の日々', job: '勇者', tone: 'good', icon: '💪',
  cond: (s) => s.age >= 10 && s.age <= 30 && Math.random() < 0.03,
  weight: () => 14,
  run: (s) => {
    gain(s, 'health', +3); gain(s, 'int', +2); s.happiness = clamp(s.happiness + 4, 0, 100);
    logEvent(s, '過酷な修行を積んだ。体と心が一層鍛えられた。');
  },
});

addEvent({
  id: 'hero_artifact', name: '聖なる武器を手に入れた', job: '勇者', tone: 'rare', icon: '✨',
  cond: (s) => s.age >= 12 && !s.flags.hasArtifact && Math.random() < 0.02,
  weight: () => 18,
  run: (s) => {
    s.flags.hasArtifact = true;
    gain(s, 'health', +10); gain(s, 'int', +5); s.happiness = clamp(s.happiness + 20, 0, 100);
    logEvent(s, '★伝説の聖なる武器を手に入れた。勇者としての力が目覚めた。');
  },
});

// ========== 警察犬向けイベント ==========
addEvent({
  id: 'police-dog-work', name: '麻薬探知訓練', job: '警察犬', tone: 'good', icon: '👮',
  cond: (s) => s.age >= 3 && s.age <= 12 && Math.random() < 0.035,
  weight: () => 15,
  run: (s) => {
    gain(s, 'int', +2); gain(s, 'health', +1); s.happiness = clamp(s.happiness + 8, 0, 100);
    logEvent(s, '麻薬探知訓練で成功した。社会に貢献している実感がある。');
  },
});

addEvent({
  id: 'police-dog-chase', name: '容疑者追跡作戦', job: '警察犬', tone: 'good', icon: '🏃',
  cond: (s) => s.age >= 4 && s.age <= 13 && Math.random() < 0.02,
  weight: () => 13,
  run: (s) => {
    gain(s, 'health', -2); gain(s, 'wealth', +30); s.happiness = clamp(s.happiness + 12, 0, 100);
    logEvent(s, '容疑者の追跡に成功した。警察官から褒められた。');
  },
});

// ========== 盲導犬向けイベント ==========
addEvent({
  id: 'guide-dog-training', name: 'ペアリング訓練', job: '盲導犬', tone: 'good', icon: '👨‍🦯',
  cond: (s) => s.age >= 4 && s.age <= 9 && Math.random() < 0.032,
  weight: () => 14,
  run: (s) => {
    gain(s, 'health', +2); s.happiness = clamp(s.happiness + 10, 0, 100);
    logEvent(s, 'ユーザーとのペアリング訓練。信頼関係が深まった。');
  },
});

addEvent({
  id: 'guide-dog-assist', name: '視覚障害者の助け', job: '盲導犬', tone: 'good', icon: '💝',
  cond: (s) => s.age >= 8 && s.age <= 15 && Math.random() < 0.025,
  weight: () => 15,
  run: (s) => {
    s.happiness = clamp(s.happiness + 14, 0, 100);
    logEvent(s, 'ユーザーが無事に目的地に到着できた。自分の役割に誇りを感じた。');
  },
});

addEvent({
  id: 'guide-dog-retirement', name: 'セカンドキャリアへ', job: '盲導犬', tone: 'good', icon: '🏡',
  cond: (s) => s.age >= 12 && !s.flags.guideRetired && Math.random() < 0.015,
  weight: () => 20,
  run: (s) => {
    s.flags.guideRetired = true;
    gain(s, 'health', +3); s.happiness = clamp(s.happiness + 16, 0, 100);
    logEvent(s, 'セカンドキャリアのために家族へ迎えられた。充実した人生が待っている。');
  },
});

// ========== ペット犬向けイベント ==========
addEvent({
  id: 'pet-dog-play', name: '家族と遊ぶ', job: 'ペット犬', tone: 'good', icon: '🎾',
  cond: (s) => s.age >= 1 && s.age <= 15 && Math.random() < 0.04,
  weight: () => 16,
  run: (s) => {
    gain(s, 'health', +2); s.happiness = clamp(s.happiness + 12, 0, 100);
    logEvent(s, '家族と楽しく遊んだ。こんなに幸せなことはない。');
  },
});

addEvent({
  id: 'pet-dog-illness', name: '病気になった', job: 'ペット犬', tone: 'bad', icon: '🤒',
  cond: (s) => s.age >= 2 && s.age <= 14 && Math.random() < 0.015,
  weight: () => 10,
  run: (s) => {
    gain(s, 'health', -5); s.happiness = clamp(s.happiness - 6, 0, 100);
    logEvent(s, '病気になってしまった。獣医さんに世話になった。');
  },
});

// ========== 野良猫向けイベント ==========
addEvent({
  id: 'stray-cat-hunting', name: 'ネズミ狩り成功', job: '野良猫', tone: 'good', icon: '🐭',
  cond: (s) => s.age >= 2 && s.age <= 15 && Math.random() < 0.038,
  weight: () => 15,
  run: (s) => {
    gain(s, 'health', +2); s.happiness = clamp(s.happiness + 8, 0, 100);
    logEvent(s, 'ネズミを上手に狩った。今日の食べ物は困らない。');
  },
});

addEvent({
  id: 'stray-cat-fight', name: '野良猫とのけんか', job: '野良猫', tone: 'bad', icon: '😼',
  cond: (s) => s.age >= 2 && s.age <= 15 && Math.random() < 0.02,
  weight: () => 12,
  run: (s) => {
    const dmg = randInt(2, 6);
    gain(s, 'health', -dmg); s.happiness = clamp(s.happiness - 4, 0, 100);
    logEvent(s, `他の野良猫との縄張り争いに負けた。-${dmg}体力`);
  },
});

addEvent({
  id: 'stray-cat-adopted', name: '家族に拾われた', job: '野良猫', tone: 'good', icon: '🏡',
  cond: (s) => s.age >= 3 && s.age <= 12 && Math.random() < 0.015,
  weight: () => 16,
  run: (s) => {
    setJob(s, 'ペット猫');
    gain(s, 'health', +5); s.happiness = clamp(s.happiness + 20, 0, 100);
    logEvent(s, '温かい家族に拾われた。野良猫の人生が終わり、新たな人生が始まった。');
  },
});

// ========== サーカス動物向けイベント ==========
addEvent({
  id: 'circus-performance', name: 'サーカス公演', job: 'サーカス動物', tone: 'good', icon: '🎪',
  cond: (s) => s.age >= 3 && s.age <= 15 && Math.random() < 0.035,
  weight: () => 16,
  run: (s) => {
    const earn = randInt(10, 40);
    gain(s, 'wealth', +earn); s.happiness = clamp(s.happiness + 14, 0, 100);
    logEvent(s, `大勢の観客の前で公演した。観客の喝采に包まれた。+${formatMoney(earn)}`);
  },
});

addEvent({
  id: 'circus-training-hard', name: '芸の訓練がきつい', job: 'サーカス動物', tone: 'bad', icon: '😰',
  cond: (s) => s.age >= 3 && s.age <= 14 && Math.random() < 0.025,
  weight: () => 12,
  run: (s) => {
    gain(s, 'health', -3); s.happiness = clamp(s.happiness - 6, 0, 100);
    logEvent(s, 'サーカスの訓練が非常に厳しかった。けれど少しずつ上達している。');
  },
});

// シェフ向け（専用イベント追加）
addEvent({
  id: 'chef_first_dish', name: '初めての一皿が完成した', job: 'シェフ', tone: 'good', icon: '🍽️',
  cond: (s) => s.age >= 16 && s.age <= 22 && Math.random() < 0.025,
  weight: () => 11,
  run: (s) => {
    s.happiness = clamp(s.happiness + 8, 0, 100);
    logEvent(s, '自分のオリジナル料理が完成した。客の笑顔が報酬だ。');
  },
});

addEvent({
  id: 'chef_criticism', name: '客からクレームをもらった', job: 'シェフ', tone: 'bad', icon: '😠',
  cond: (s) => s.age >= 16 && s.age <= 28 && Math.random() < 0.02,
  weight: () => 10,
  run: (s) => {
    s.happiness = clamp(s.happiness - 6, 0, 100);
    logEvent(s, '提供した料理にクレームが来た。プロとしてのプライドが傷つく。');
  },
});

addEvent({
  id: 'chef_michelin', name: 'ミシュラン獲得', job: 'シェフ', tone: 'rare', icon: '⭐',
  cond: (s) => s.age >= 28 && s.stats.int >= 70 && Math.random() < 0.015,
  weight: (s) => (s.stats.int - 60) * 0.2,
  run: (s) => {
    gain(s, 'wealth', +50); s.happiness = clamp(s.happiness + 22, 0, 100); gain(s, 'luck', +2);
    logEvent(s, '★ミシュランガイドに掲載された。一流シェフの仲間入りを果たした。');
  },
});

// プロゲーマー向け（専用イベント追加）
addEvent({
  id: 'pro_gamer_tournament', name: '大会に出場', job: 'プロゲーマー', tone: 'good', icon: '🎮',
  cond: (s) => s.age >= 16 && s.age <= 24 && Math.random() < 0.025,
  weight: () => 12,
  run: (s) => {
    gain(s, 'int', +1); s.happiness = clamp(s.happiness + 7, 0, 100);
    logEvent(s, '大会に出場した。全国の強豪と競い合う興奮を味わった。');
  },
});

addEvent({
  id: 'pro_gamer_loss', name: '重要な試合に負けた', job: 'プロゲーマー', tone: 'bad', icon: '💔',
  cond: (s) => s.age >= 16 && s.age <= 30 && Math.random() < 0.02,
  weight: () => 10,
  run: (s) => {
    s.happiness = clamp(s.happiness - 8, 0, 100);
    logEvent(s, '重要な試合で敗北した。悔しさで眠れない夜が続く。');
  },
});

addEvent({
  id: 'pro_gamer_champion', name: 'チャンピオンに輝いた', job: 'プロゲーマー', tone: 'rare', icon: '🏆',
  cond: (s) => s.age >= 20 && s.stats.int >= 75 && s.stats.luck >= 60 && Math.random() < 0.015,
  weight: () => 15,
  run: (s) => {
    gain(s, 'wealth', +40); s.happiness = clamp(s.happiness + 20, 0, 100); gain(s, 'luck', +2);
    logEvent(s, '★eスポーツの大会でチャンピオンに輝いた！賞金+40万円。');
  },
});

// 職業ごとの固有イベント（全職カバー）
addEvent({
  id: 'office_breakthrough', name: '大口案件を決めた', job: 'サラリーマン', tone: 'good', icon: '💼',
  cond: () => true, weight: () => 12,
  run: (s) => { gain(s, 'wealth', +8); logEvent(s, '担当案件が成功し、評価とボーナスを得た。'); },
});
addEvent({
  id: 'office_burnout', name: '残業続きで疲弊', job: 'サラリーマン', tone: 'bad', icon: '🥱',
  cond: () => true, weight: () => 10,
  run: (s) => { gain(s, 'health', -4); s.happiness = clamp(s.happiness - 8, 0, 100); logEvent(s, '残業が続き体力も気力もすり減った。'); },
});

addEvent({
  id: 'freeter_shift_up', name: 'シフトが増えた', job: 'フリーター', tone: 'good', icon: '🧾',
  cond: () => true, weight: () => 11,
  run: (s) => { gain(s, 'wealth', +5); logEvent(s, 'シフトが増え、少し余裕ができた。'); },
});
addEvent({
  id: 'freeter_contract_end', name: '契約が切られた', job: 'フリーター', tone: 'bad', icon: '⚠️',
  cond: () => true, weight: () => 9,
  run: (s) => { gain(s, 'wealth', -6); s.happiness = clamp(s.happiness - 6, 0, 100); logEvent(s, '突然契約終了。次の仕事を探さねばならない。'); },
});

addEvent({
  id: 'teacher_praise_students', name: '生徒に慕われる', job: '教師', tone: 'good', icon: '📚',
  cond: () => true, weight: () => 12,
  run: (s) => { gain(s, 'int', +2); s.happiness = clamp(s.happiness + 6, 0, 100); logEvent(s, '授業が好評で、生徒たちに慕われた。'); },
});
addEvent({
  id: 'teacher_class_trouble', name: '学級運営が難航', job: '教師', tone: 'bad', icon: '😖',
  cond: () => true, weight: () => 9,
  run: (s) => { gain(s, 'health', -3); s.happiness = clamp(s.happiness - 7, 0, 100); logEvent(s, 'トラブル対応に追われ、消耗した。'); },
});

addEvent({
  id: 'engineer_refactor', name: '大規模リファクタ成功', job: 'エンジニア', tone: 'good', icon: '🛠️',
  cond: () => true, weight: () => 12,
  run: (s) => { gain(s, 'int', +3); gain(s, 'wealth', +4); logEvent(s, 'リファクタが成功し、プロダクトが安定した。'); },
});
addEvent({
  id: 'engineer_incident', name: '重大障害の対応', job: 'エンジニア', tone: 'bad', icon: '🚨',
  cond: () => true, weight: () => 10,
  run: (s) => { gain(s, 'health', -4); gain(s, 'wealth', -2); logEvent(s, '障害対応で徹夜。疲労がたまった。'); },
});

addEvent({
  id: 'farmer_harvest', name: '大豊作の年', job: '農家', tone: 'good', icon: '🌾',
  cond: () => true, weight: () => 11,
  run: (s) => { gain(s, 'wealth', +9); logEvent(s, '天候に恵まれ大豊作。収入が増えた。'); },
});
addEvent({
  id: 'farmer_bad_weather', name: '不作で厳しい', job: '農家', tone: 'bad', icon: '⛈️',
  cond: () => true, weight: () => 9,
  run: (s) => { gain(s, 'wealth', -8); s.happiness = clamp(s.happiness - 4, 0, 100); logEvent(s, '天候不良で収穫が振るわず、家計が厳しい。'); },
});

addEvent({
  id: 'public_officer_support', name: '住民対応が好評', job: '公務員', tone: 'good', icon: '🏛️',
  cond: () => true, weight: () => 11,
  run: (s) => { gain(s, 'int', +2); s.happiness = clamp(s.happiness + 4, 0, 100); logEvent(s, '丁寧な対応が評価され、住民から感謝された。'); },
});
addEvent({
  id: 'public_officer_budget', name: '予算削減の余波', job: '公務員', tone: 'bad', icon: '📉',
  cond: () => true, weight: () => 9,
  run: (s) => { gain(s, 'wealth', -4); s.happiness = clamp(s.happiness - 3, 0, 100); logEvent(s, '予算縮小で仕事が増え、手当も減った。'); },
});

addEvent({
  id: 'streamer_viral', name: '配信がバズった', job: '配信者', tone: 'good', icon: '📺',
  cond: () => true, weight: () => 12,
  run: (s) => { gain(s, 'wealth', +12); s.happiness = clamp(s.happiness + 6, 0, 100); logEvent(s, '配信が大バズりし、スパチャと登録者が激増した。'); },
});
addEvent({
  id: 'streamer_scandal', name: '炎上騒動', job: '配信者', tone: 'bad', icon: '🔥',
  cond: () => true, weight: () => 8,
  run: (s) => { s.happiness = clamp(s.happiness - 12, 0, 100); gain(s, 'wealth', -6); logEvent(s, '発言が炎上し、スポンサーも離れた。'); },
});

addEvent({
  id: 'writer_bestseller', name: 'ベストセラーを執筆', job: '作家', tone: 'good', icon: '📖',
  cond: () => true, weight: () => 11,
  run: (s) => { gain(s, 'wealth', +14); logEvent(s, '新作がベストセラーになり、一躍売れっ子に。'); },
});
addEvent({
  id: 'writer_slump', name: 'スランプに陥る', job: '作家', tone: 'bad', icon: '🌀',
  cond: () => true, weight: () => 9,
  run: (s) => { s.happiness = clamp(s.happiness - 10, 0, 100); logEvent(s, 'アイデアが枯れ、筆が進まない日々。'); },
});

addEvent({
  id: 'researcher_paper', name: '論文が採択された', job: '研究者', tone: 'good', icon: '🔬',
  cond: () => true, weight: () => 12,
  run: (s) => { gain(s, 'int', +5); gain(s, 'wealth', +4); logEvent(s, '研究成果が国際学会で採択された。評価が高まる。'); },
});
addEvent({
  id: 'researcher_experiment_fail', name: '実験が大失敗', job: '研究者', tone: 'bad', icon: '💥',
  cond: () => true, weight: () => 9,
  run: (s) => { gain(s, 'health', -3); s.happiness = clamp(s.happiness - 6, 0, 100); logEvent(s, '実験が失敗し、時間も資材も失った。'); },
});

addEvent({
  id: 'idol_world_stage', name: '海外フェス出演', job: 'アイドル', tone: 'good', icon: '🎤',
  cond: () => true, weight: () => 12,
  run: (s) => { gain(s, 'beauty', +3); gain(s, 'wealth', +8); logEvent(s, '海外フェスで熱狂的な歓声を浴びた。'); },
});
addEvent({
  id: 'idol_scandal', name: 'スキャンダル報道', job: 'アイドル', tone: 'bad', icon: '🗞️',
  cond: () => true, weight: () => 8,
  run: (s) => { s.happiness = clamp(s.happiness - 12, 0, 100); gain(s, 'beauty', -2); logEvent(s, 'スキャンダルでイメージダウン。活動自粛を余儀なくされた。'); },
});

addEvent({
  id: 'musician_tour', name: 'ツアーが大成功', job: '音楽家', tone: 'good', icon: '🎵',
  cond: () => true, weight: () => 11,
  run: (s) => { gain(s, 'wealth', +9); s.happiness = clamp(s.happiness + 5, 0, 100); logEvent(s, '全国ツアーが満員御礼で大成功。'); },
});
addEvent({
  id: 'musician_voice', name: '声帯疲労で休養', job: '音楽家', tone: 'bad', icon: '🤐',
  cond: () => true, weight: () => 9,
  run: (s) => { gain(s, 'health', -4); logEvent(s, '連日のステージで声帯を痛め、休養に入った。'); },
});

addEvent({
  id: 'founder_funding', name: '資金調達に成功', job: '起業家', tone: 'good', icon: '💰',
  cond: () => true, weight: () => 11,
  run: (s) => { gain(s, 'wealth', +15); logEvent(s, '投資家から大型の資金調達に成功した。'); },
});
addEvent({
  id: 'founder_product_fail', name: 'プロダクトが失敗', job: '起業家', tone: 'bad', icon: '🧊',
  cond: () => true, weight: () => 9,
  run: (s) => { gain(s, 'wealth', -12); s.happiness = clamp(s.happiness - 6, 0, 100); logEvent(s, 'プロダクトが市場に刺さらず、資金が大きく減った。'); },
});

addEvent({
  id: 'lawyer_win', name: '裁判で勝訴', job: '弁護士', tone: 'good', icon: '⚖️',
  cond: () => true, weight: () => 11,
  run: (s) => { gain(s, 'wealth', +10); s.happiness = clamp(s.happiness + 4, 0, 100); logEvent(s, '重要案件で勝訴し、名声と報酬を得た。'); },
});
addEvent({
  id: 'lawyer_long_case', name: '長期訴訟で疲弊', job: '弁護士', tone: 'bad', icon: '📑',
  cond: () => true, weight: () => 9,
  run: (s) => { gain(s, 'health', -4); s.happiness = clamp(s.happiness - 5, 0, 100); logEvent(s, '終わりの見えない訴訟で心身ともに疲弊。'); },
});

addEvent({
  id: 'doctor_save', name: '難症例を救った', job: '医者', tone: 'good', icon: '🩺',
  cond: () => true, weight: () => 11,
  run: (s) => { gain(s, 'int', +3); gain(s, 'wealth', +8); logEvent(s, '難しい症例を救い、信頼と評価を得た。'); },
});
addEvent({
  id: 'doctor_night_shift', name: '当直続きで疲労', job: '医者', tone: 'bad', icon: '🌙',
  cond: () => true, weight: () => 9,
  run: (s) => { gain(s, 'health', -6); s.happiness = clamp(s.happiness - 5, 0, 100); logEvent(s, '連日の当直で眠れず、体力が削られた。'); },
});

addEvent({
  id: 'investor_boom', name: '投資が大当たり', job: '投資家', tone: 'good', icon: '📈',
  cond: () => true, weight: () => 10,
  run: (s) => { gain(s, 'wealth', +20); logEvent(s, '仕込んだ銘柄が高騰し、大きな利益を得た。'); },
});
addEvent({
  id: 'investor_crash', name: '市場急落で損失', job: '投資家', tone: 'bad', icon: '📉',
  cond: () => true, weight: () => 9,
  run: (s) => { gain(s, 'wealth', -15); s.happiness = clamp(s.happiness - 6, 0, 100); logEvent(s, '市場急落で含み益が吹き飛んだ。'); },
});

addEvent({
  id: 'comedian_tv', name: 'テレビ出演でウケた', job: '芸人', tone: 'good', icon: '😂',
  cond: () => true, weight: () => 11,
  run: (s) => { gain(s, 'wealth', +6); s.happiness = clamp(s.happiness + 8, 0, 100); logEvent(s, '番組で大ウケして一気に人気が上がった。'); },
});
addEvent({
  id: 'comedian_bomb', name: '舞台でスベった', job: '芸人', tone: 'bad', icon: '😶',
  cond: () => true, weight: () => 9,
  run: (s) => { s.happiness = clamp(s.happiness - 10, 0, 100); logEvent(s, 'ネタが刺さらず、客席が静まり返った。'); },
});

addEvent({
  id: 'model_show', name: 'ファッションショー登壇', job: 'モデル', tone: 'good', icon: '👠',
  cond: () => true, weight: () => 11,
  run: (s) => { gain(s, 'beauty', +3); gain(s, 'wealth', +7); logEvent(s, '大型ショーに出演し、評価が高まった。'); },
});
addEvent({
  id: 'model_diet', name: '過度な減量で体調不良', job: 'モデル', tone: 'bad', icon: '⚖️',
  cond: () => true, weight: () => 9,
  run: (s) => { gain(s, 'health', -4); s.happiness = clamp(s.happiness - 4, 0, 100); logEvent(s, '無理な減量で体調を崩した。'); },
});

addEvent({
  id: 'craftsman_masterpiece', name: '渾身の一作を完成', job: '職人', tone: 'good', icon: '🪚',
  cond: () => true, weight: () => 11,
  run: (s) => { gain(s, 'int', +3); gain(s, 'wealth', +5); logEvent(s, '技を磨き上げた逸品を仕上げた。'); },
});
addEvent({
  id: 'craftsman_injury', name: '作業中に大けが', job: '職人', tone: 'bad', icon: '⛑️',
  cond: () => true, weight: () => 8,
  run: (s) => { gain(s, 'health', -8); logEvent(s, '作業中の事故で大けがを負った。'); },
});

addEvent({
  id: 'noble_gala', name: '豪華な晩餐会', job: '貴族', tone: 'good', icon: '🥂',
  cond: () => true, weight: () => 10,
  run: (s) => { gain(s, 'wealth', +6); s.happiness = clamp(s.happiness + 6, 0, 100); logEvent(s, '華やかな晩餐会を主催し、社交界での地位を保った。'); },
});
addEvent({
  id: 'noble_finance', name: '財政が逼迫', job: '貴族', tone: 'bad', icon: '💸',
  cond: () => true, weight: () => 8,
  run: (s) => { gain(s, 'wealth', -10); s.happiness = clamp(s.happiness - 4, 0, 100); logEvent(s, '領地の収入が落ち込み、財政が苦しくなった。'); },
});

addEvent({
  id: 'knight_mission', name: '任務を完遂', job: '騎士', tone: 'good', icon: '🛡️',
  cond: () => true, weight: () => 11,
  run: (s) => { gain(s, 'health', +3); gain(s, 'wealth', +3); logEvent(s, '護衛任務を成功させ、褒賞を受けた。'); },
});
addEvent({
  id: 'knight_wound', name: '戦いで負傷', job: '騎士', tone: 'bad', icon: '🩸',
  cond: () => true, weight: () => 9,
  run: (s) => { gain(s, 'health', -6); logEvent(s, '激しい戦闘で深手を負った。'); },
});

addEvent({
  id: 'adventurer_dungeon', name: 'ダンジョンを攻略', job: '冒険者', tone: 'good', icon: '🗺️',
  cond: () => true, weight: () => 11,
  run: (s) => { gain(s, 'wealth', +7); gain(s, 'health', +2); logEvent(s, '危険なダンジョンを制覇し、宝を手に入れた。'); },
});
addEvent({
  id: 'adventurer_trap', name: '罠にかかって負傷', job: '冒険者', tone: 'bad', icon: '🕳️',
  cond: () => true, weight: () => 9,
  run: (s) => { gain(s, 'health', -7); logEvent(s, '罠にかかり大きな傷を負った。'); },
});

addEvent({
  id: 'mage_new_spell', name: '新しい呪文を習得', job: '魔法使い', tone: 'good', icon: '✨',
  cond: () => true, weight: () => 11,
  run: (s) => { gain(s, 'int', +4); s.happiness = clamp(s.happiness + 4, 0, 100); logEvent(s, '新たな魔法を習得し、力が高まった。'); },
});
addEvent({
  id: 'mage_mana_burst', name: '魔力暴走', job: '魔法使い', tone: 'bad', icon: '⚡',
  cond: () => true, weight: () => 8,
  run: (s) => { gain(s, 'health', -6); logEvent(s, '魔力の制御に失敗し、反動でダメージを受けた。'); },
});

// 音楽家向け（専用イベント追加）
addEvent({
  id: 'musician_first_show', name: '初めてのライブ演奏', job: '音楽家', tone: 'good', icon: '🎵',
  cond: (s) => s.age >= 16 && s.age <= 22 && Math.random() < 0.028,
  weight: () => 12,
  run: (s) => {
    s.happiness = clamp(s.happiness + 9, 0, 100);
    logEvent(s, 'ライブで自分の音楽を演奏した。観客の反応に心が高鳴った。');
  },
});

addEvent({
  id: 'musician_practice_grind', name: '練習に明け暮れた', job: '音楽家', tone: 'bad', icon: '🎼',
  cond: (s) => s.age >= 16 && s.age <= 26 && Math.random() < 0.022,
  weight: () => 10,
  run: (s) => {
    gain(s, 'health', -1); s.happiness = clamp(s.happiness - 3, 0, 100);
    logEvent(s, '完璧な演奏を目指して毎日練習している。指が痛い。');
  },
});

addEvent({
  id: 'musician_album_release', name: 'アルバムを発売した', job: '音楽家', tone: 'good', icon: '💿',
  cond: (s) => s.age >= 20 && s.age <= 35 && Math.random() < 0.025,
  weight: () => 13,
  run: (s) => {
    const earn = randInt(20, 50);
    gain(s, 'wealth', +earn); s.happiness = clamp(s.happiness + 14, 0, 100);
    logEvent(s, `自分のアルバムを発売した。ファンからの反応が嬉しい。+${formatMoney(earn)}`);
  },
});

// 医者向け
addEvent({
  id: 'doctor_surgery', name: '難しい手術', job: '医者', tone: 'good', icon: '⚕️',
  cond: (s) => s.age >= 28 && Math.random() < 0.035,
  weight: (s) => s.stats.int - 50,
  run: (s) => {
    const success = Math.random() < (0.7 + s.stats.int / 200);
    if (success) {
      gain(s, 'wealth', +8); gain(s, 'int', +2); s.happiness = clamp(s.happiness + 12, 0, 100);
      logEvent(s, '患者の命を救う手術に成功した。医者冥利に尽きた。');
    } else {
      s.happiness = clamp(s.happiness - 15, 0, 100); gain(s, 'health', -3);
      logEvent(s, '手術が失敗に終わってしまった。大きな後悔と自責の念に苛まれた。');
    }
  },
});

// 医者初期イベント（24-27歳）
addEvent({
  id: 'doctor_intern_hard', name: '医者の研修は地獄', job: '医者', tone: 'bad', icon: '🏥',
  cond: (s) => s.age >= 24 && s.age <= 27 && Math.random() < 0.028,
  weight: () => 12,
  run: (s) => {
    gain(s, 'health', -3); s.happiness = clamp(s.happiness - 6, 0, 100);
    logEvent(s, '医者としての研修が非常に厳しかった。やり甲斐と疲労が混ざり合う。');
  },
});

addEvent({
  id: 'doctor_first_patient_care', name: '初めて患者を見送る', job: '医者', tone: 'common', icon: '💔',
  cond: (s) => s.age >= 24 && s.age <= 28 && Math.random() < 0.02,
  weight: () => 11,
  run: (s) => {
    s.happiness = clamp(s.happiness - 8, 0, 100); gain(s, 'health', -1);
    logEvent(s, '自分が治療した患者が亡くなった。医者としての現実の重さを知った。');
  },
});

addEvent({
  id: 'doctor_burnout', name: '医者の過労', job: '医者', tone: 'bad', icon: '😰',
  cond: (s) => s.age >= 30 && Math.random() < 0.025,
  weight: () => 15,
  run: (s) => {
    gain(s, 'health', -6); s.happiness = clamp(s.happiness - 8, 0, 100);
    logEvent(s, '長時間労働で心身ともに疲弊した。患者に向き合う余裕がなくなりかけている。');
  },
});

addEvent({
  id: 'doctor_miracle', name: '困難な患者を救う', job: '医者', tone: 'rare', icon: '✨',
  cond: (s) => s.age >= 32 && s.stats.int >= 75 && Math.random() < 0.015,
  weight: (s) => s.stats.int - 55,
  run: (s) => {
    s.happiness = clamp(s.happiness + 20, 0, 100); gain(s, 'wealth', +10); gain(s, 'luck', +2);
    logEvent(s, '★絶望的だった患者が奇跡的に回復した。医療の奥深さを感じた。');
  },
});

// 弁護士向け
// 弁護士初期イベント（23-25歳）
addEvent({
  id: 'lawyer_first_case', name: '初めての法廷', job: '弁護士', tone: 'common', icon: '📚',
  cond: (s) => s.age >= 23 && s.age <= 25 && Math.random() < 0.025,
  weight: () => 11,
  run: (s) => {
    s.happiness = clamp(s.happiness + 4, 0, 100); gain(s, 'int', +1);
    logEvent(s, '初めて法廷に立った。緊張で手が震えたが、やり甲斐を感じた。');
  },
});

addEvent({
  id: 'lawyer_study_grind', name: '判例研究の日々', job: '弁護士', tone: 'bad', icon: '📖',
  cond: (s) => s.age >= 23 && s.age <= 27 && Math.random() < 0.02,
  weight: () => 10,
  run: (s) => {
    gain(s, 'int', +2); gain(s, 'health', -2); s.happiness = clamp(s.happiness - 3, 0, 100);
    logEvent(s, '判例研究に没頭する日々。目は疲れ、体は痛いが知識が増える。');
  },
});

addEvent({
  id: 'lawyer_win', name: '裁判に勝つ', job: '弁護士', tone: 'good', icon: '⚖️',
  cond: (s) => s.age >= 26 && Math.random() < 0.035,
  weight: (s) => s.stats.int - 50,
  run: (s) => {
    const bonus = randInt(15, 50);
    gain(s, 'wealth', +bonus); s.happiness = clamp(s.happiness + 14, 0, 100);
    logEvent(s, `重要な裁判に勝利した！正義が勝つことの喜びを感じた。報酬+${formatMoney(bonus)}`);
  },
});

addEvent({
  id: 'lawyer_defeat', name: '裁判に負ける', job: '弁護士', tone: 'bad', icon: '⚖️',
  cond: (s) => s.age >= 26 && Math.random() < 0.02,
  weight: () => 12,
  run: (s) => {
    s.happiness = clamp(s.happiness - 12, 0, 100); gain(s, 'health', -2);
    logEvent(s, '裁判に敗れてしまった。依頼人に申し訳ない。');
  },
});

addEvent({
  id: 'lawyer_mentoring', name: '若手弁護士を指導', job: '弁護士', tone: 'good', icon: '👨‍🏫',
  cond: (s) => s.age >= 35 && Math.random() < 0.025,
  weight: () => 14,
  run: (s) => {
    gain(s, 'int', +2); s.happiness = clamp(s.happiness + 10, 0, 100);
    logEvent(s, '後進を育てることの喜びを感じた。自分の知識が次世代に受け継がれていく。');
  },
});

// エンジニア向け
addEvent({
  id: 'engineer_sprint', name: 'デリバリースプリント', job: 'エンジニア', tone: 'bad', icon: '💻',
  cond: (s) => s.age >= 25 && Math.random() < 0.04,
  weight: () => 18,
  run: (s) => {
    gain(s, 'health', -5); s.happiness = clamp(s.happiness - 8, 0, 100);
    logEvent(s, 'スプリント期間は地獄だ。睡眠不足で頭がぼんやりしている。');
  },
});

addEvent({
  id: 'engineer_debug', name: 'バグの大量修正', job: 'エンジニア', tone: 'good', icon: '🐛',
  cond: (s) => s.age >= 24 && Math.random() < 0.035,
  weight: (s) => s.stats.int - 45,
  run: (s) => {
    gain(s, 'wealth', +6); gain(s, 'int', +3); s.happiness = clamp(s.happiness + 8, 0, 100);
    logEvent(s, '複雑なバグを見つけて修正した。深い達成感。');
  },
});

addEvent({
  id: 'engineer_new_tech', name: '新技術習得', job: 'エンジニア', tone: 'good', icon: '📚',
  cond: (s) => s.age >= 22 && Math.random() < 0.03,
  weight: (s) => s.stats.int - 40,
  run: (s) => {
    gain(s, 'int', +4); s.happiness = clamp(s.happiness + 6, 0, 100);
    logEvent(s, '最新の技術を習得した。スキルが一つ増えた。');
  },
});

// エンジニア初期イベント（18-21歳）
addEvent({
  id: 'engineer_first_project', name: '初めてのプロジェクト配属', job: 'エンジニア', tone: 'good', icon: '💻',
  cond: (s) => s.age >= 18 && s.age <= 21 && Math.random() < 0.03,
  weight: () => 13,
  run: (s) => {
    gain(s, 'int', +2); s.happiness = clamp(s.happiness + 6, 0, 100);
    logEvent(s, '初めてのプロジェクトに配属された。実践的なコードを書き始めた。');
  },
});

addEvent({
  id: 'engineer_code_review', name: 'コードレビューで指摘', job: 'エンジニア', tone: 'common', icon: '📝',
  cond: (s) => s.age >= 18 && s.age <= 22 && Math.random() < 0.025,
  weight: () => 12,
  run: (s) => {
    gain(s, 'int', +1); s.happiness = clamp(s.happiness - 2, 0, 100);
    logEvent(s, 'コードレビューで厳しい指摘を受けた。ショックだけど勉強になる。');
  },
});

addEvent({
  id: 'engineer_promotion_lead', name: 'テックリード昇進', job: 'エンジニア', tone: 'rare', icon: '🚀',
  cond: (s) => s.age >= 32 && s.stats.int >= 75 && Math.random() < 0.02,
  weight: (s) => s.stats.int - 60,
  run: (s) => {
    gain(s, 'wealth', +12); gain(s, 'int', +3); s.happiness = clamp(s.happiness + 12, 0, 100);
    logEvent(s, '★テックリードに抜擢された。技術的リーダーシップを発揮する日々。');
  },
});

// 教師向け
// 教師初期イベント（22-23歳）
addEvent({
  id: 'teacher_first_class', name: '初めてのクラス担任', job: '教師', tone: 'good', icon: '🍎',
  cond: (s) => s.age >= 22 && s.age <= 23 && Math.random() < 0.03,
  weight: () => 12,
  run: (s) => {
    s.happiness = clamp(s.happiness + 8, 0, 100); gain(s, 'int', +1);
    logEvent(s, '初めてクラス担任になった。生徒の成長を見守ることへの喜びを感じた。');
  },
});

addEvent({
  id: 'teacher_lesson_prep', name: '授業準備に明け暮れた', job: '教師', tone: 'bad', icon: '⏰',
  cond: (s) => s.age >= 22 && s.age <= 25 && Math.random() < 0.025,
  weight: () => 11,
  run: (s) => {
    gain(s, 'health', -2); s.happiness = clamp(s.happiness - 4, 0, 100);
    logEvent(s, '毎日の授業準備で疲弊している。定時で帰られない。');
  },
});

addEvent({
  id: 'teacher_difficult_class', name: '問題クラス担当', job: '教師', tone: 'bad', icon: '🎓',
  cond: (s) => s.age >= 25 && Math.random() < 0.03,
  weight: () => 14,
  run: (s) => {
    gain(s, 'health', -4); s.happiness = clamp(s.happiness - 10, 0, 100);
    logEvent(s, '荒れたクラスの担任になった。毎日が戦場だ。');
  },
});

addEvent({
  id: 'teacher_student_success', name: '生徒の成功', job: '教師', tone: 'good', icon: '🌟',
  cond: (s) => s.age >= 24 && Math.random() < 0.035,
  weight: () => 16,
  run: (s) => {
    s.happiness = clamp(s.happiness + 14, 0, 100); gain(s, 'int', +2);
    logEvent(s, '教えた生徒が大きな成功を収めた。教師冥利に尽きた。');
  },
});

addEvent({
  id: 'teacher_grading_pile', name: '採点地獄', job: '教師', tone: 'bad', icon: '📝',
  cond: (s) => s.age >= 25 && Math.random() < 0.04,
  weight: () => 16,
  run: (s) => {
    gain(s, 'health', -3); s.happiness = clamp(s.happiness - 6, 0, 100);
    logEvent(s, 'テストの採点が山積みだ。手が疲れて動かない。');
  },
});

// アイドル向け
addEvent({
  id: 'idol_fan_meet', name: 'ファンミーティング', job: 'アイドル', tone: 'good', icon: '🎤',
  cond: (s) => s.age >= 16 && Math.random() < 0.035,
  weight: () => 15,
  run: (s) => {
    s.happiness = clamp(s.happiness + 16, 0, 100); gain(s, 'wealth', +5);
    logEvent(s, 'ファンとの直接対面。応援の声が心に染みた。');
  },
});

addEvent({
  id: 'idol_scandal', name: 'スキャンダル', job: 'アイドル', tone: 'bad', icon: '📸',
  cond: (s) => s.age >= 16 && Math.random() < 0.02,
  weight: () => 12,
  run: (s) => {
    s.happiness = clamp(s.happiness - 16, 0, 100); gain(s, 'beauty', -3);
    logEvent(s, 'プライベートがメディアに報道された。信頼が損なわれた。');
  },
});

addEvent({
  id: 'idol_gradation', name: 'アイドル卒業', job: 'アイドル', tone: 'good', icon: '✨',
  cond: (s) => s.age >= 22 && s.age <= 32 && !s.flags.idolGraduation && Math.random() < 0.025,
  weight: () => 13,
  run: (s) => {
    s.flags.idolGraduation = true; gain(s, 'wealth', +20); s.happiness = clamp(s.happiness + 10, 0, 100);
    logEvent(s, '区切りをつけてアイドルを卒業した。新しい人生への扉が開かれた。');
  },
});

// 15-17歳のアイドル向けイベント（デビュー期）
addEvent({
  id: 'idol_debut_pressure', name: 'デビュー直後の不安', job: 'アイドル', tone: 'bad', icon: '😰',
  cond: (s) => s.age >= 15 && s.age <= 17 && Math.random() < 0.028,
  weight: () => 13,
  run: (s) => {
    s.happiness = clamp(s.happiness - 8, 0, 100); gain(s, 'health', -2);
    logEvent(s, 'アイドル生活が始まった。想像と現実のギャップに押しつぶされそう。');
  },
});

addEvent({
  id: 'idol_fan_letter', name: 'ファンレター受け取り', job: 'アイドル', tone: 'good', icon: '💌',
  cond: (s) => s.age >= 15 && s.age <= 17 && Math.random() < 0.032,
  weight: () => 14,
  run: (s) => {
    s.happiness = clamp(s.happiness + 12, 0, 100);
    logEvent(s, '初めてファンからの手紙をもらった。こんなに応援してくれる人がいるんだ。');
  },
});

addEvent({
  id: 'idol_dance_lesson', name: 'ダンスレッスン', job: 'アイドル', tone: 'good', icon: '💃',
  cond: (s) => s.age >= 15 && s.age <= 17 && Math.random() < 0.025,
  weight: () => 12,
  run: (s) => {
    gain(s, 'health', +3); gain(s, 'beauty', +2); s.happiness = clamp(s.happiness + 3, 0, 100);
    logEvent(s, '厳しいダンスレッスンを頑張った。体が引き締まっていく感覚がある。');
  },
});

addEvent({
  id: 'idol_competing_member', name: '同期ライバルとの競争', job: 'アイドル', tone: 'common', icon: '🎯',
  cond: (s) => s.age >= 15 && s.age <= 17 && Math.random() < 0.03,
  weight: () => 13,
  run: (s) => {
    s.happiness = clamp(s.happiness - 2, 0, 100); gain(s, 'int', +1);
    logEvent(s, '同じデビュー期の他のメンバーとの競争が激しくなってきた。負けられない。');
  },
});

// アスリート向け（初期～中期）
addEvent({
  id: 'athlete_debut', name: 'スポーツで才能を開花', job: 'アスリート', tone: 'good', icon: '⭐',
  cond: (s) => s.age >= 12 && s.age <= 17 && Math.random() < 0.028,
  weight: () => 13,
  run: (s) => {
    gain(s, 'health', +2); s.happiness = clamp(s.happiness + 8, 0, 100);
    logEvent(s, '部活動で自分の才能が開花した。全国大会を目指す決心がついた。');
  },
});

addEvent({
  id: 'athlete_training', name: '厳しい練習', job: 'アスリート', tone: 'bad', icon: '💨',
  cond: (s) => s.age >= 12 && s.age <= 20 && Math.random() < 0.025,
  weight: () => 11,
  run: (s) => {
    gain(s, 'health', +1); gain(s, 'health', -3); s.happiness = clamp(s.happiness - 4, 0, 100);
    logEvent(s, 'トレーニングが非常に厳しかった。体は鍛えられるが心が折れそう。');
  },
});

addEvent({
  id: 'athlete_injury', name: 'スポーツ外傷', job: 'アスリート', tone: 'bad', icon: '⚡',
  cond: (s) => s.age >= 18 && Math.random() < 0.03,
  weight: () => 16,
  run: (s) => {
    const damage = randInt(6, 12);
    gain(s, 'health', -damage); s.happiness = clamp(s.happiness - 12, 0, 100);
    logEvent(s, `重大な外傷を負った。選手生命が危ぶまれる。-${damage}健康`);
  },
});

addEvent({
  id: 'athlete_record', name: '記録更新', job: 'アスリート', tone: 'rare', icon: '🏆',
  cond: (s) => s.age >= 20 && s.stats.health >= 80 && Math.random() < 0.025,
  weight: (s) => (s.stats.health - 70) * 0.3,
  run: (s) => {
    const bonus = randInt(30, 120);
    gain(s, 'wealth', +bonus); s.happiness = clamp(s.happiness + 18, 0, 100); gain(s, 'luck', +2);
    logEvent(s, `★自分の記録を更新した！世界記録も射程圏内。賞金+${formatMoney(bonus)}`);
  },
});

addEvent({
  id: 'athlete_retirement', name: 'アスリート引退', job: 'アスリート', tone: 'good', icon: '🛎️',
  cond: (s) => s.age >= 35 && !s.flags.athleteRetirement,
  weight: () => 30 + (s.age - 35),
  run: (s) => {
    s.flags.athleteRetirement = true; gain(s, 'wealth', +30);
    logEvent(s, '長年のアスリート人生に幕を下ろした。次のキャリアへの道を探り始める。');
  },
});

// 作家向け
// 作家初期イベント（18-24歳）
addEvent({
  id: 'writer_debut_attempt', name: '処女作を執筆中', job: '作家', tone: 'common', icon: '✒️',
  cond: (s) => s.age >= 18 && s.age <= 24 && Math.random() < 0.025,
  weight: () => 11,
  run: (s) => {
    gain(s, 'int', +2); s.happiness = clamp(s.happiness + 2, 0, 100);
    logEvent(s, '初めての執筆作に取り組んでいる。完成の道は遠い。');
  },
});

addEvent({
  id: 'writer_rejection', name: '原稿が返された', job: '作家', tone: 'bad', icon: '📮',
  cond: (s) => s.age >= 18 && s.age <= 26 && Math.random() < 0.02,
  weight: () => 10,
  run: (s) => {
    s.happiness = clamp(s.happiness - 6, 0, 100);
    logEvent(s, '出版社に投稿した原稿が返ってきた。修正を重ねなければ。');
  },
});

addEvent({
  id: 'writer_bestseller', name: 'ベストセラー', job: '作家', tone: 'rare', icon: '📖',
  cond: (s) => s.age >= 25 && s.stats.int >= 70 && Math.random() < 0.02,
  weight: (s) => s.stats.int - 55,
  run: (s) => {
    const earn = randInt(50, 200);
    gain(s, 'wealth', +earn); s.happiness = clamp(s.happiness + 16, 0, 100); gain(s, 'luck', +2);
    logEvent(s, `★著作がベストセラーになった！印税収入が大幅増。+${formatMoney(earn)}`);
  },
});

addEvent({
  id: 'writer_slump', name: 'スランプ', job: '作家', tone: 'bad', icon: '😔',
  cond: (s) => s.age >= 25 && Math.random() < 0.025,
  weight: () => 14,
  run: (s) => {
    s.happiness = clamp(s.happiness - 12, 0, 100); gain(s, 'health', -2);
    logEvent(s, '創作の鬼門に陥った。何も書けず、心が荒れ果てている。');
  },
});

addEvent({
  id: 'writer_award', name: '文学賞受賞', job: '作家', tone: 'rare', icon: '🏅',
  cond: (s) => s.age >= 28 && !s.flags.literaryAward && Math.random() < 0.015,
  weight: (s) => s.stats.int - 50,
  run: (s) => {
    s.flags.literaryAward = true;
    const prize = randInt(30, 80);
    gain(s, 'wealth', +prize); s.happiness = clamp(s.happiness + 20, 0, 100); gain(s, 'luck', +2);
    logEvent(s, `★文学賞を受賞した！創作人生が一変した。賞金+${formatMoney(prize)}`);
  },
});

// 芸人向け
// 芸人初期イベント（16-17歳）
addEvent({
  id: 'comedian_first_stage', name: 'お笑い初舞台', job: '芸人', tone: 'common', icon: '🎤',
  cond: (s) => s.age >= 16 && s.age <= 17 && Math.random() < 0.025,
  weight: () => 10,
  run: (s) => {
    s.happiness = clamp(s.happiness + 5, 0, 100);
    logEvent(s, '人生初のお笑いステージに立った。客の笑いは格別だ。');
  },
});

addEvent({
  id: 'comedian_bomb', name: 'ライブがスベった', job: '芸人', tone: 'bad', icon: '😅',
  cond: (s) => s.age >= 18 && Math.random() < 0.04,
  weight: () => 18,
  run: (s) => {
    s.happiness = clamp(s.happiness - 14, 0, 100); gain(s, 'health', -2);
    logEvent(s, 'ネタが完全にスベってしまった。ステージ上での静寂は苦しい。');
  },
});

addEvent({
  id: 'comedian_viral', name: 'ネタが流行る', job: '芸人', tone: 'good', icon: '😄',
  cond: (s) => s.age >= 18 && Math.random() < 0.03,
  weight: () => 16,
  run: (s) => {
    gain(s, 'wealth', +8); s.happiness = clamp(s.happiness + 14, 0, 100);
    logEvent(s, 'ネタが流行った！街で声をかけられるようになった。');
  },
});

addEvent({
  id: 'comedian_bigstage', name: '大舞台出演', job: '芸人', tone: 'good', icon: '🎭',
  cond: (s) => s.age >= 25 && s.stats.luck >= 65 && Math.random() < 0.02,
  weight: (s) => s.stats.luck - 50,
  run: (s) => {
    const fee = randInt(20, 60);
    gain(s, 'wealth', +fee); s.happiness = clamp(s.happiness + 15, 0, 100);
    logEvent(s, `★大型音楽番組に出演！出演料+${formatMoney(fee)}`);
  },
});

// 配信者向け
// 配信者初期イベント（15歳）
addEvent({
  id: 'streamer_first_stream', name: '初配信スタート', job: '配信者', tone: 'good', icon: '🎮',
  cond: (s) => s.age >= 15 && s.age <= 16 && Math.random() < 0.028,
  weight: () => 11,
  run: (s) => {
    s.happiness = clamp(s.happiness + 6, 0, 100);
    logEvent(s, '初配信をした！視聴者からのコメントに心躍った。');
  },
});

addEvent({
  id: 'streamer_audience_grow', name: 'チャンネル成長', job: '配信者', tone: 'good', icon: '📈',
  cond: (s) => s.age >= 16 && Math.random() < 0.035,
  weight: (s) => s.stats.luck - 35,
  run: (s) => {
    const earn = randInt(5, 20);
    gain(s, 'wealth', +earn); s.happiness = clamp(s.happiness + 12, 0, 100);
    logEvent(s, `チャンネル登録者が増えた！広告収入も増加。+${formatMoney(earn)}`);
  },
});

addEvent({
  id: 'streamer_drama', name: '配信炎上', job: '配信者', tone: 'bad', icon: '🔥',
  cond: (s) => s.age >= 16 && Math.random() < 0.025,
  weight: () => 13,
  run: (s) => {
    s.happiness = clamp(s.happiness - 14, 0, 100); gain(s, 'wealth', -10);
    logEvent(s, '言動がSNSで炎上してしまった。視聴者の信頼が失われた。');
  },
});

addEvent({
  id: 'streamer_collab', name: 'コラボ配信成功', job: '配信者', tone: 'good', icon: '🤝',
  cond: (s) => s.age >= 18 && Math.random() < 0.03,
  weight: () => 15,
  run: (s) => {
    const earn = randInt(15, 40);
    gain(s, 'wealth', +earn); s.happiness = clamp(s.happiness + 11, 0, 100);
    logEvent(s, `他の配信者とのコラボが大成功。新しいファンも増えた。+${formatMoney(earn)}`);
  },
});

// 公務員向け
addEvent({
  id: 'public_officer_policy', name: '提案が通る', job: '公務員', tone: 'good', icon: '📋',
  cond: (s) => s.age >= 28 && s.stats.int >= 60 && Math.random() < 0.025,
  weight: (s) => s.stats.int - 50,
  run: (s) => {
    s.happiness = clamp(s.happiness + 12, 0, 100); gain(s, 'int', +2);
    logEvent(s, '自分の提案が採用された。地域社会に貢献している実感を得た。');
  },
});

addEvent({
  id: 'public_officer_bureaucracy', name: '役所の手続き地獄', job: '公務員', tone: 'bad', icon: '📑',
  cond: (s) => s.age >= 25 && Math.random() < 0.035,
  weight: () => 14,
  run: (s) => {
    gain(s, 'health', -2); s.happiness = clamp(s.happiness - 8, 0, 100);
    logEvent(s, '書類の山に埋もれた。やりがいを感じられない日々。');
  },
});

// 農家向け
addEvent({
  id: 'farmer_harvest', name: '豊作', job: '農家', tone: 'good', icon: '🌾',
  cond: (s) => s.age >= 20 && Math.random() < 0.04,
  weight: () => 18,
  run: (s) => {
    const earn = randInt(15, 40);
    gain(s, 'wealth', +earn); s.happiness = clamp(s.happiness + 12, 0, 100);
    logEvent(s, `今年も豊作だった！大地の恵みに感謝。+${formatMoney(earn)}`);
  },
});

addEvent({
  id: 'farmer_disaster', name: '自然災害', job: '農家', tone: 'bad', icon: '🌪️',
  cond: (s) => s.age >= 20 && Math.random() < 0.025,
  weight: () => 12,
  run: (s) => {
    gain(s, 'wealth', -25); s.happiness = clamp(s.happiness - 14, 0, 100);
    logEvent(s, '台風で畑が壊滅した。一年の苦労が水の泡だ。');
  },
});

addEvent({
  id: 'farmer_organic', name: '有機栽培成功', job: '農家', tone: 'good', icon: '🥬',
  cond: (s) => s.age >= 25 && s.stats.int >= 55 && !s.flags.organicFarm && Math.random() < 0.02,
  weight: (s) => s.stats.int - 40,
  run: (s) => {
    s.flags.organicFarm = true;
    const earn = randInt(20, 50);
    gain(s, 'wealth', +earn); s.happiness = clamp(s.happiness + 13, 0, 100);
    logEvent(s, `有機栽培の野菜が高値で売れた！新しい道を切り開いた。+${formatMoney(earn)}`);
  },
});

// シェフ向け
addEvent({
  id: 'chef_michelin', name: 'ミシュラン獲得', job: 'シェフ', tone: 'rare', icon: '⭐',
  cond: (s) => s.age >= 28 && s.stats.health >= 70 && !s.flags.michelin && Math.random() < 0.015,
  weight: (s) => s.stats.health - 50,
  run: (s) => {
    s.flags.michelin = true;
    gain(s, 'wealth', +30); s.happiness = clamp(s.happiness + 20, 0, 100);
    logEvent(s, '★ミシュラン星を獲得した！世界的シェフとして認められた。');
  },
});

addEvent({
  id: 'chef_menu_creation', name: '新メニュー開発', job: 'シェフ', tone: 'good', icon: '🍽️',
  cond: (s) => s.age >= 24 && Math.random() < 0.035,
  weight: (s) => s.stats.health - 45,
  run: (s) => {
    gain(s, 'wealth', +6); s.happiness = clamp(s.happiness + 10, 0, 100);
    logEvent(s, '新しいメニューが大好評。お客さんの笑顔が報酬だ。');
  },
});

// 音楽家向け
addEvent({
  id: 'musician_concert_success', name: 'コンサート大成功', job: '音楽家', tone: 'good', icon: '🎵',
  cond: (s) => s.age >= 20 && Math.random() < 0.035,
  weight: (s) => s.stats.luck - 35,
  run: (s) => {
    const earn = randInt(20, 60);
    gain(s, 'wealth', +earn); s.happiness = clamp(s.happiness + 14, 0, 100);
    logEvent(s, `コンサートが大成功。観客の拍手が身に染みた。+${formatMoney(earn)}`);
  },
});

addEvent({
  id: 'musician_collaboration', name: 'グラミー賞ノミネート', job: '音楽家', tone: 'rare', icon: '🏆',
  cond: (s) => s.age >= 28 && s.stats.int >= 65 && !s.flags.grammy && Math.random() < 0.01,
  weight: (s) => s.stats.int - 50,
  run: (s) => {
    s.flags.grammy = true;
    const earn = randInt(40, 150);
    gain(s, 'wealth', +earn); s.happiness = clamp(s.happiness + 18, 0, 100); gain(s, 'luck', +2);
    logEvent(s, `★グラミー賞にノミネートされた！国際的アーティストとして認識された。+${formatMoney(earn)}`);
  },
});

// 職人向け
addEvent({
  id: 'craftsman_masterpiece', name: '傑作完成', job: '職人', tone: 'rare', icon: '🎨',
  cond: (s) => s.age >= 28 && !s.flags.masterpiece && Math.random() < 0.02,
  weight: () => 12,
  run: (s) => {
    s.flags.masterpiece = true;
    const earn = randInt(30, 100);
    gain(s, 'wealth', +earn); s.happiness = clamp(s.happiness + 18, 0, 100);
    logEvent(s, `★一生の傑作が完成した！多くの人がそれを愛でるだろう。+${formatMoney(earn)}`);
  },
});

addEvent({
  id: 'craftsman_apprentice', name: '弟子を育成', job: '職人', tone: 'good', icon: '👨‍🏫',
  cond: (s) => s.age >= 35 && Math.random() < 0.03,
  weight: () => 13,
  run: (s) => {
    gain(s, 'int', +2); s.happiness = clamp(s.happiness + 11, 0, 100);
    logEvent(s, '技術を継承する喜びを感じた。自分の人生がここまでで終わりではない。');
  },
});

// 起業家向け
addEvent({
  id: 'entrepreneur_expansion', name: '事業拡大', job: '起業家', tone: 'good', icon: '📊',
  cond: (s) => s.age >= 26 && s.stats.wealth >= 50 && Math.random() < 0.03,
  weight: (s) => s.stats.wealth - 40,
  run: (s) => {
    const earn = randInt(25, 70);
    gain(s, 'wealth', +earn); s.happiness = clamp(s.happiness + 12, 0, 100);
    logEvent(s, `事業が急成長！新しい支店をオープンできた。+${formatMoney(earn)}`);
  },
});

addEvent({
  id: 'entrepreneur_crisis', name: '経営危機', job: '起業家', tone: 'bad', icon: '💥',
  cond: (s) => s.age >= 25 && Math.random() < 0.025,
  weight: () => 12,
  run: (s) => {
    gain(s, 'wealth', -40); s.happiness = clamp(s.happiness - 16, 0, 100);
    logEvent(s, '事業が危機的状況に陥った。夜も眠れない日々が続く。');
  },
});

addEvent({
  id: 'entrepreneur_ipo', name: 'IPO上場', job: '起業家', tone: 'rare', icon: '📈',
  cond: (s) => s.age >= 32 && s.stats.wealth >= 150 && !s.flags.ipo && Math.random() < 0.015,
  weight: (s) => (s.stats.wealth - 100) / 2,
  run: (s) => {
    s.flags.ipo = true;
    gain(s, 'wealth', +200); s.happiness = clamp(s.happiness + 25, 0, 100); gain(s, 'luck', +3);
    logEvent(s, '★会社がIPO上場した！長年の努力が報われた瞬間。');
  },
});

// プロゲーマー向け
addEvent({
  id: 'progamer_tournament', name: '大会優勝', job: 'プロゲーマー', tone: 'rare', icon: '🎮',
  cond: (s) => s.age >= 18 && Math.random() < 0.025,
  weight: (s) => s.stats.int + s.stats.luck - 90,
  run: (s) => {
    const prize = randInt(30, 100);
    gain(s, 'wealth', +prize); s.happiness = clamp(s.happiness + 18, 0, 100); gain(s, 'luck', +2);
    logEvent(s, `★国際大会で優勝した！世界のトップゲーマーとして認識された。賞金+${formatMoney(prize)}`);
  },
});

addEvent({
  id: 'progamer_decline', name: 'ゲーム技量の低下', job: 'プロゲーマー', tone: 'bad', icon: '📉',
  cond: (s) => s.age >= 28 && Math.random() < 0.03,
  weight: () => 14,
  run: (s) => {
    s.happiness = clamp(s.happiness - 12, 0, 100); gain(s, 'health', -2);
    logEvent(s, '反応速度が低下してきた。若手に抜かれる恐怖を感じている。');
  },
});

// 研究者向け
addEvent({
  id: 'researcher_breakthrough', name: '大発見', job: '研究者', tone: 'rare', icon: '🔬',
  cond: (s) => s.age >= 30 && s.stats.int >= 80 && !s.flags.breakthrough && Math.random() < 0.015,
  weight: (s) => (s.stats.int - 75) * 0.5,
  run: (s) => {
    s.flags.breakthrough = true;
    gain(s, 'wealth', +50); s.happiness = clamp(s.happiness + 25, 0, 100); gain(s, 'luck', +3);
    logEvent(s, '★世紀の大発見をした！論文は世界に広がり、ノーベル賞候補に。');
  },
});

addEvent({
  id: 'researcher_grant', name: '研究費獲得', job: '研究者', tone: 'good', icon: '💰',
  cond: (s) => s.age >= 28 && s.stats.int >= 70 && Math.random() < 0.03,
  weight: (s) => s.stats.int - 60,
  run: (s) => {
    const grant = randInt(30, 80);
    gain(s, 'wealth', +grant); s.happiness = clamp(s.happiness + 10, 0, 100);
    logEvent(s, `大型研究費グラントを獲得！研究室の設備が一新された。+${formatMoney(grant)}`);
  },
});

// モデル向け
addEvent({
  id: 'model_runway', name: 'ファッションウィーク', job: 'モデル', tone: 'good', icon: '👗',
  cond: (s) => s.age >= 18 && s.stats.beauty >= 75 && Math.random() < 0.035,
  weight: (s) => s.stats.beauty - 60,
  run: (s) => {
    const earn = randInt(25, 75);
    gain(s, 'wealth', +earn); s.happiness = clamp(s.happiness + 13, 0, 100);
    logEvent(s, `有名デザイナーのランウェイに出演！ファッション界で注目を集めた。+${formatMoney(earn)}`);
  },
});

addEvent({
  id: 'model_aging', name: 'モデルとしての賞味期限', job: 'モデル', tone: 'bad', icon: '⏳',
  cond: (s) => s.age >= 30 && Math.random() < 0.04,
  weight: () => 15,
  run: (s) => {
    gain(s, 'beauty', -2); s.happiness = clamp(s.happiness - 10, 0, 100);
    logEvent(s, 'オファーが減り始めた。年齢がキャリアに影響し始めている。');
  },
});

/* ============ 動物イベント ============ */
addEvent({
  id: 'herd_join', name: '群れへ合流', kind: 'animal', tone: 'good', icon: '🦁',
  cond: (s) => s.age >= 3 && s.age <= 20 && Math.random() < 0.05,
  weight: (s) => 15 + (s.stats.luck - 50) * 0.1,
  run: (s) => {
    gain(s, 'health', +4); gain(s, 'luck', +2); s.happiness = clamp(s.happiness + 12, 0, 100);
    logEvent(s, '大きな群れに出会い、一緒に暮らすことになった。安心感と温かさを感じた。');
  },
});

addEvent({
  id: 'predator_escape', name: '捕食者からの逃走', kind: 'animal', tone: 'bad', icon: '🐺',
  cond: (s) => s.age >= 5 && Math.random() < 0.04,
  weight: (s) => 20,
  run: (s) => {
    gain(s, 'health', -5); gain(s, 'luck', -2); s.happiness = clamp(s.happiness - 8, 0, 100);
    logEvent(s, '鋭い爪を持つ捕食者に襲われた！必死で逃げ切ったが傷を負った。');
  },
});

addEvent({
  id: 'successful_hunt', name: '狩りの大成功', kind: 'animal', tone: 'rare', icon: '🎯',
  cond: (s) => s.age >= 8 && s.stats.health >= 70 && Math.random() < 0.03,
  weight: (s) => (s.stats.health - 50) * 0.2 + 10,
  run: (s) => {
    gain(s, 'wealth', +8); gain(s, 'health', +3); gain(s, 'luck', +3); s.happiness = clamp(s.happiness + 20, 0, 100);
    logEvent(s, '★見事に獲物を仕留めた！大きな食料を得て、大満足の一年。');
  },
});

addEvent({
  id: 'territory_battle', name: '縄張り争い', kind: 'animal', tone: 'bad', icon: '⚔️',
  cond: (s) => s.age >= 10 && s.age <= 35 && Math.random() < 0.03,
  weight: (s) => 15,
  run: (s) => {
    const damage = randInt(3, 8);
    gain(s, 'health', -damage); s.happiness = clamp(s.happiness - 10, 0, 100);
    logEvent(s, `同じ種の激しい敵と縄張り争いになった。勝ったが、大けがを負った。-${damage}健康`);
  },
});

addEvent({
  id: 'animal_mating', name: '新しい季節', kind: 'animal', tone: 'good', icon: '💕',
  cond: (s) => s.age >= 6 && s.age <= 30 && !s.flags.animalMated,
  weight: (s) => 10 + (s.stats.health + s.stats.luck) / 10,
  run: (s) => {
    s.flags.animalMated = true; gain(s, 'health', +2); s.happiness = clamp(s.happiness + 18, 0, 100);
    logEvent(s, '新しい仲間が現れ、一緒に過ごす日々が始まった。幸せに満ちた季節。');
  },
});

/* ============ 植物イベント ============ */
addEvent({
  id: 'blooming_season', name: '開花の年', kind: 'plant', tone: 'rare', icon: '🌸',
  cond: (s) => s.age >= 5 && s.age <= 50 && Math.random() < 0.04,
  weight: (s) => 25 + (s.stats.luck - 50) * 0.15,
  run: (s) => {
    gain(s, 'wealth', +5); s.happiness = clamp(s.happiness + 25, 0, 100); gain(s, 'luck', +2);
    logEvent(s, '★美しく花を咲かせた年。蜂や蝶が訪れ、世界が輝いて見えた。');
  },
});

addEvent({
  id: 'pest_invasion', name: '虫害', kind: 'plant', tone: 'bad', icon: '🐛',
  cond: (s) => s.age >= 3 && Math.random() < 0.03,
  weight: (s) => 15,
  run: (s) => {
    const damage = randInt(2, 6);
    gain(s, 'health', -damage); s.happiness = clamp(s.happiness - 12, 0, 100);
    logEvent(s, `無数の虫に葉を食い尽くされた。回復するまで辛い日々が続いた。-${damage}健康`);
  },
});

addEvent({
  id: 'seed_dispersal', name: '種の旅立ち', kind: 'plant', tone: 'good', icon: '🌾',
  cond: (s) => s.age >= 8 && s.age <= 40 && !s.flags.seedDispersed,
  weight: (s) => 12,
  run: (s) => {
    s.flags.seedDispersed = true; s.happiness = clamp(s.happiness + 15, 0, 100); gain(s, 'luck', +1);
    logEvent(s, '風に乗った種が遠くまで旅立った。遠い地で新しい命が育つかもしれない。');
  },
});

addEvent({
  id: 'drought_survival', name: '干ばつ危機', kind: 'plant', tone: 'bad', icon: '🏜️',
  cond: (s) => s.age >= 10 && Math.random() < 0.02,
  weight: (s) => 12,
  run: (s) => {
    gain(s, 'health', -6); s.happiness = clamp(s.happiness - 15, 0, 100);
    logEvent(s, '長い干ばつが続き、根からは水が得られなくなった。枯れ始めた。');
  },
});

addEvent({
  id: 'plant_symbiosis', name: '共生の始まり', kind: 'plant', tone: 'good', icon: '🍄',
  cond: (s) => s.age >= 6 && Math.random() < 0.03,
  weight: (s) => 14,
  run: (s) => {
    gain(s, 'health', +3); gain(s, 'wealth', +3); s.happiness = clamp(s.happiness + 10, 0, 100);
    logEvent(s, '根に共生菌が宿り、より多くの栄養が得られるようになった。');
  },
});

/* ============ 物体イベント ============ */
addEvent({
  id: 'lightning_strike', name: '落雷', kind: 'object', tone: 'bad', icon: '⚡',
  cond: (s) => s.age >= 5 && Math.random() < 0.02,
  weight: (s) => 10,
  run: (s) => {
    const damage = randInt(5, 12);
    gain(s, 'health', -damage); s.happiness = clamp(s.happiness - 8, 0, 100);
    logEvent(s, `激しい雷が直撃した。表面が焦げ、一部が欠けた。-${damage}健康`);
  },
});

addEvent({
  id: 'river_journey', name: '川の旅', kind: 'object', tone: 'rare', icon: '🌊',
  cond: (s) => s.age >= 10 && !s.flags.riverJourney && Math.random() < 0.02,
  weight: (s) => 8,
  run: (s) => {
    s.flags.riverJourney = true; s.happiness = clamp(s.happiness + 20, 0, 100); gain(s, 'luck', +2);
    logEvent(s, '★豪雨で流されて、遠く別の大陸へ辿り着いた。信じられない冒険。');
  },
});

addEvent({
  id: 'being_collected', name: 'コレクターに拾われる', kind: 'object', tone: 'good', icon: '👜',
  cond: (s) => s.age >= 8 && Math.random() < 0.03,
  weight: (s) => 12,
  run: (s) => {
    gain(s, 'wealth', +4); s.happiness = clamp(s.happiness + 12, 0, 100);
    logEvent(s, '誰かに拾われ、大切に保管されるようになった。やっと自分の価値が認められた気がした。');
  },
});

addEvent({
  id: 'polishing', name: '研磨される', kind: 'object', tone: 'good', icon: '✨',
  cond: (s) => s.age >= 15 && Math.random() < 0.02,
  weight: (s) => 10,
  run: (s) => {
    gain(s, 'wealth', +6); gain(s, 'beauty', +8); s.happiness = clamp(s.happiness + 15, 0, 100);
    logEvent(s, '職人の手で丹念に研磨された。表面が輝き始め、本来の美しさが蘇った。');
  },
});

addEvent({
  id: 'object_break', name: '割れる', kind: 'object', tone: 'bad', icon: '💔',
  cond: (s) => s.age >= 5 && Math.random() < 0.03,
  weight: (s) => 14,
  run: (s) => {
    const damage = randInt(4, 10);
    gain(s, 'health', -damage); s.happiness = clamp(s.happiness - 20, 0, 100);
    logEvent(s, `衝撃で一部が割れてしまった。修復は難しく、その傷跡は二度と消えない。-${damage}健康`);
  },
});

/* ============ 動物イベント追加 ============ */
addEvent({
  id: 'animal_winter', name: '冬の寒さ', kind: 'animal', tone: 'bad', icon: '❄️',
  cond: (s) => s.age >= 3 && Math.random() < 0.04,
  weight: (s) => 18,
  run: (s) => {
    gain(s, 'health', -4); s.happiness = clamp(s.happiness - 10, 0, 100);
    logEvent(s, '厳しい冬が到来した。食べ物も少なく、寒さに耐えるのが辛い日々。');
  },
});

addEvent({
  id: 'animal_spring', name: '春の目覚め', kind: 'animal', tone: 'good', icon: '🌱',
  cond: (s) => s.age >= 2 && Math.random() < 0.05,
  weight: (s) => 20,
  run: (s) => {
    gain(s, 'health', +5); gain(s, 'wealth', +3); s.happiness = clamp(s.happiness + 15, 0, 100);
    logEvent(s, '長い冬が終わり、草木が芽吹く季節がやってきた。食べ物も増え、生きる喜びを感じた。');
  },
});

addEvent({
  id: 'animal_shelter', name: 'よい寝床を見つける', kind: 'animal', tone: 'good', icon: '🏠',
  cond: (s) => s.age >= 4 && !s.flags.goodShelter && Math.random() < 0.03,
  weight: (s) => 12,
  run: (s) => {
    s.flags.goodShelter = true; gain(s, 'health', +3); s.happiness = clamp(s.happiness + 12, 0, 100);
    logEvent(s, '温かく安全な寝床を見つけた。これからはここが安息の場所だ。');
  },
});

addEvent({
  id: 'animal_illness', name: '病気', kind: 'animal', tone: 'bad', icon: '🤒',
  cond: (s) => s.age >= 5 && Math.random() < 0.035,
  weight: (s) => 16,
  run: (s) => {
    const sickness = randInt(6, 10);
    gain(s, 'health', -sickness); s.happiness = clamp(s.happiness - 15, 0, 100);
    logEvent(s, `謎の病気にかかってしまった。食欲も失い、弱々しく動く日々。-${sickness}健康`);
  },
});

addEvent({
  id: 'animal_migration', name: '大移動', kind: 'animal', tone: 'good', icon: '🗺️',
  cond: (s) => s.age >= 12 && !s.flags.migrated && Math.random() < 0.02,
  weight: (s) => 8,
  run: (s) => {
    s.flags.migrated = true; gain(s, 'wealth', +5); gain(s, 'luck', +1); s.happiness = clamp(s.happiness + 14, 0, 100);
    logEvent(s, '群れに従い未知の大陸へ移動した。新しい世界は危険だが、豊富な食べ物に満ちていた。');
  },
});

addEvent({
  id: 'animal_rival', name: 'ライバル現る', kind: 'animal', tone: 'bad', icon: '🤬',
  cond: (s) => s.age >= 8 && s.age <= 40 && Math.random() < 0.025,
  weight: (s) => 11,
  run: (s) => {
    gain(s, 'health', -3); s.happiness = clamp(s.happiness - 12, 0, 100);
    logEvent(s, '自分より強いライバルが現れた。常に緊張感が続く日々。');
  },
});

addEvent({
  id: 'animal_abundance', name: '食料豊富の季節', kind: 'animal', tone: 'good', icon: '🍖',
  cond: (s) => s.age >= 3 && Math.random() < 0.04,
  weight: (s) => 17,
  run: (s) => {
    gain(s, 'wealth', +6); gain(s, 'health', +2); s.happiness = clamp(s.happiness + 10, 0, 100);
    logEvent(s, '周りには美味しい食べ物が溢れている。思う存分食べられる幸せ。');
  },
});

addEvent({
  id: 'animal_pack_harmony', name: '群れの絆', kind: 'animal', tone: 'rare', icon: '🐾',
  cond: (s) => s.age >= 10 && s.age <= 45 && Math.random() < 0.015,
  weight: (s) => 9,
  run: (s) => {
    s.happiness = clamp(s.happiness + 22, 0, 100); gain(s, 'health', +4); gain(s, 'luck', +2);
    logEvent(s, '★群れ全体が一体となり、どんな困難も乗り越えられる絆を感じた。本当の家族のように。');
  },
});

addEvent({
  id: 'animal_parasite', name: '寄生虫感染', kind: 'animal', tone: 'bad', icon: '🦠',
  cond: (s) => s.age >= 4 && Math.random() < 0.03,
  weight: (s) => 14,
  run: (s) => {
    const damage = randInt(5, 9);
    gain(s, 'health', -damage); s.happiness = clamp(s.happiness - 10, 0, 100);
    logEvent(s, `寄生虫が体に宿った。体力が奪われ、常に倦怠感が付きまとう。-${damage}健康`);
  },
});

addEvent({
  id: 'animal_offspring', name: '子どもの誕生', kind: 'animal', tone: 'rare', icon: '👶',
  cond: (s) => s.age >= 8 && s.age <= 30 && !s.flags.animalOffspring && Math.random() < 0.02,
  weight: (s) => 10,
  run: (s) => {
    s.flags.animalOffspring = true; s.happiness = clamp(s.happiness + 26, 0, 100); gain(s, 'luck', +2);
    logEvent(s, '★新しい命が生まれた。小さな子どもたちを守る責任と喜びが同時に訪れた。');
  },
});

// 動物の妖怪化（低確率で寿命突破）
addEvent({
  id: 'animal_yokai_awaken', name: '妖怪へ覚醒', kind: 'animal', tone: 'rare', icon: '👻',
  cond: (s) => s.age >= 12 && s.stats.health >= 40 && !s.flags.yokai && Math.random() < 0.01,
  weight: (s) => 12,
  run: (s) => {
    s.flags.yokai = true;
    const bonusLife = randInt(40, 80);
    s.lifespan += bonusLife; // 寿命を突破して延命
    gain(s, 'health', +6); gain(s, 'luck', +6);
    logEvent(s, `★長い年月を経て妖怪へと変じた。寿命が大きく伸びた（+${bonusLife}年）。`);
  },
});

addEvent({
  id: 'yokai_night_walk', name: '夜行で人を驚かす', kind: 'animal', tone: 'good', icon: '🌙',
  cond: (s) => s.flags.yokai && Math.random() < 0.04,
  weight: (s) => 12,
  run: (s) => {
    gain(s, 'wealth', +4); gain(s, 'luck', +3); s.happiness = clamp(s.happiness + 10, 0, 100);
    logEvent(s, '妖怪として夜の町を練り歩き、噂とともに力を増した。');
  },
});

addEvent({
  id: 'yokai_guardian', name: '里の守り神となる', kind: 'animal', tone: 'rare', icon: '🛕',
  cond: (s) => s.flags.yokai && Math.random() < 0.02,
  weight: (s) => 10,
  run: (s) => {
    gain(s, 'health', +5); s.happiness = clamp(s.happiness + 12, 0, 100); gain(s, 'luck', +4);
    logEvent(s, '★人々に祀られ、守り神として崇められた。永い時を生きる存在となった。');
  },
});

addEvent({
  id: 'yokai_hunters', name: '妖怪退治に遭う', kind: 'animal', tone: 'bad', icon: '⚔️',
  cond: (s) => s.flags.yokai && Math.random() < 0.015,
  weight: (s) => 11,
  run: (s) => {
    const dmg = randInt(5, 12);
    gain(s, 'health', -dmg); s.happiness = clamp(s.happiness - 10, 0, 100);
    logEvent(s, `妖怪退治に遭い、傷を負った。力は衰えないが油断は禁物。-${dmg}健康`);
  },
});

addEvent({
  id: 'animal_injury_heal', name: '傷の治癒', kind: 'animal', tone: 'good', icon: '🩹',
  cond: (s) => s.age >= 5 && Math.random() < 0.04,
  weight: (s) => 16,
  run: (s) => {
    gain(s, 'health', +4); s.happiness = clamp(s.happiness + 8, 0, 100);
    logEvent(s, '古い傷が綺麗に治った。本来の身軽さが戻り、走るのが楽になった。');
  },
});

addEvent({
  id: 'animal_territory_expansion', name: '新しい領土開拓', kind: 'animal', tone: 'good', icon: '🗺️',
  cond: (s) => s.age >= 12 && Math.random() < 0.025,
  weight: (s) => 12,
  run: (s) => {
    gain(s, 'wealth', +7); gain(s, 'luck', +1); s.happiness = clamp(s.happiness + 13, 0, 100);
    logEvent(s, '更に広い領土を支配下に置いた。食べ物も増え、王様のような気分。');
  },
});

addEvent({
  id: 'animal_apex_encounter', name: '頂点捕食者との遭遇', kind: 'animal', tone: 'bad', icon: '🐯',
  cond: (s) => s.age >= 15 && Math.random() < 0.02,
  weight: (s) => 8,
  run: (s) => {
    const damage = randInt(7, 12);
    gain(s, 'health', -damage); s.happiness = clamp(s.happiness - 18, 0, 100);
    logEvent(s, `頂点捕食者に出会ってしまった。辛くも逃げ切ったが、トラウマが残った。-${damage}健康`);
  },
});

addEvent({
  id: 'animal_cooperative_hunt', name: '協力狩り成功', kind: 'animal', tone: 'rare', icon: '🎯',
  cond: (s) => s.age >= 12 && s.age <= 40 && Math.random() < 0.015,
  weight: (s) => 8,
  run: (s) => {
    gain(s, 'wealth', +12); gain(s, 'health', +3); s.happiness = clamp(s.happiness + 20, 0, 100);
    logEvent(s, '★群れ全員で大型の獲物を狩ることに成功した。これ以上の喜びはない。');
  },
});

addEvent({
  id: 'animal_longevity', name: '老化の兆し', kind: 'animal', tone: 'bad', icon: '🧓',
  cond: (s) => s.age >= 40 && Math.random() < 0.05,
  weight: (s) => 20,
  run: (s) => {
    gain(s, 'health', -4); s.happiness = clamp(s.happiness - 8, 0, 100);
    logEvent(s, '体が思うように動かなくなった。若い頃のような元気がない。');
  },
});

/* ============ 植物イベント追加 ============ */
addEvent({
  id: 'plant_pruning', name: '剪定される', kind: 'plant', tone: 'good', icon: '✂️',
  cond: (s) => s.age >= 5 && Math.random() < 0.04,
  weight: (s) => 13,
  run: (s) => {
    gain(s, 'health', +4); gain(s, 'beauty', +6); s.happiness = clamp(s.happiness + 8, 0, 100);
    logEvent(s, '庭師が丁寧に手入れをしてくれた。不要な枝が取れ、見違えるほど美しくなった。');
  },
});

addEvent({
  id: 'plant_repotting', name: '鉢から地面へ', kind: 'plant', tone: 'good', icon: '🌳',
  cond: (s) => s.age >= 3 && s.age <= 40 && !s.flags.groundPlanted && Math.random() < 0.02,
  weight: (s) => 11,
  run: (s) => {
    s.flags.groundPlanted = true; gain(s, 'wealth', +5); gain(s, 'health', +6); s.happiness = clamp(s.happiness + 18, 0, 100);
    logEvent(s, '★狭い鉢から、広い大地に植え替えられた！根を伸ばし放題の自由を得た。');
  },
});

addEvent({
  id: 'plant_rain', name: '恵みの雨', kind: 'plant', tone: 'good', icon: '🌧️',
  cond: (s) => s.age >= 2 && Math.random() < 0.05,
  weight: (s) => 22,
  run: (s) => {
    gain(s, 'health', +4); gain(s, 'wealth', +3); s.happiness = clamp(s.happiness + 10, 0, 100);
    logEvent(s, '長く待った雨がついに降った。吸収する水の喜び。全身が潤った。');
  },
});

addEvent({
  id: 'plant_frost', name: '晩霜の被害', kind: 'plant', tone: 'bad', icon: '❄️',
  cond: (s) => s.age >= 5 && Math.random() < 0.03,
  weight: (s) => 14,
  run: (s) => {
    const damage = randInt(4, 7);
    gain(s, 'health', -damage); s.happiness = clamp(s.happiness - 12, 0, 100);
    logEvent(s, `思いがけない遅霜が新芽を傷つけた。一年の成長が無駄になった。-${damage}健康`);
  },
});

addEvent({
  id: 'plant_sunburn', name: '日焼け', kind: 'plant', tone: 'bad', icon: '☀️',
  cond: (s) => s.age >= 4 && Math.random() < 0.025,
  weight: (s) => 10,
  run: (s) => {
    gain(s, 'health', -3); gain(s, 'beauty', -4); s.happiness = clamp(s.happiness - 8, 0, 100);
    logEvent(s, '炎天下で日焼けしてしまった。葉が茶色く焦げて醜くなった。');
  },
});

addEvent({
  id: 'plant_pollination', name: '受粉の喜び', kind: 'plant', tone: 'rare', icon: '🐝',
  cond: (s) => s.age >= 4 && s.age <= 50 && !s.flags.pollinated && Math.random() < 0.025,
  weight: (s) => 10,
  run: (s) => {
    s.flags.pollinated = true; s.happiness = clamp(s.happiness + 24, 0, 100); gain(s, 'wealth', +8);
    logEvent(s, '★蜜蜂が訪れ、念願の受粉が成功した。やがて実がなり、命が次へ繋がる。');
  },
});

addEvent({
  id: 'plant_nutrient_rich', name: '肥沃な土壌', kind: 'plant', tone: 'good', icon: '🌾',
  cond: (s) => s.age >= 6 && Math.random() < 0.035,
  weight: (s) => 15,
  run: (s) => {
    gain(s, 'health', +5); gain(s, 'wealth', +4); s.happiness = clamp(s.happiness + 12, 0, 100);
    logEvent(s, '土壌が栄養豊富になった。根から吸収される養分が増え、ぐんぐん成長した。');
  },
});

addEvent({
  id: 'plant_tree_life', name: '樹齢を重ねる', kind: 'plant', tone: 'good', icon: '🌳',
  cond: (s) => s.age >= 25 && Math.random() < 0.03,
  weight: (s) => 12,
  run: (s) => {
    gain(s, 'health', +3); gain(s, 'wealth', +5); gain(s, 'luck', +1);
    logEvent(s, '長い年月を生き続け、太く堂々とした姿に成長した。風にもびくともしない。');
  },
});

addEvent({
  id: 'plant_root_rot', name: '根腐れ', kind: 'plant', tone: 'bad', icon: '💀',
  cond: (s) => s.age >= 8 && Math.random() < 0.025,
  weight: (s) => 11,
  run: (s) => {
    const damage = randInt(6, 10);
    gain(s, 'health', -damage); s.happiness = clamp(s.happiness - 16, 0, 100);
    logEvent(s, `根が腐り始めた。吸収できる水が減り、全身が衰え始めた。-${damage}健康`);
  },
});

addEvent({
  id: 'plant_shading', name: '大木に覆われる', kind: 'plant', tone: 'bad', icon: '🌲',
  cond: (s) => s.age >= 10 && Math.random() < 0.03,
  weight: (s) => 13,
  run: (s) => {
    gain(s, 'health', -5); s.happiness = clamp(s.happiness - 12, 0, 100);
    logEvent(s, '周囲の大きな樹木に光を遮られた。光合成ができず、衰弱していく。');
  },
});

addEvent({
  id: 'plant_harvest', name: '豊作の年', kind: 'plant', tone: 'good', icon: '🌽',
  cond: (s) => s.age >= 6 && Math.random() < 0.035,
  weight: (s) => 16,
  run: (s) => {
    gain(s, 'wealth', +10); gain(s, 'health', +3); s.happiness = clamp(s.happiness + 14, 0, 100);
    logEvent(s, '思いがけない豊作。実をたくさん実らせ、世界に栄養をもたらした。');
  },
});

addEvent({
  id: 'plant_bird_nest', name: '野鳥が営巣する', kind: 'plant', tone: 'good', icon: '🐦',
  cond: (s) => s.age >= 8 && !s.flags.birdNest && Math.random() < 0.025,
  weight: (s) => 10,
  run: (s) => {
    s.flags.birdNest = true; s.happiness = clamp(s.happiness + 15, 0, 100); gain(s, 'luck', +1);
    logEvent(s, '野鳥が巣を作るために選ばれた。小さな命が育つのを見守る喜び。');
  },
});

addEvent({
  id: 'plant_sap_loss', name: '樹液流出', kind: 'plant', tone: 'bad', icon: '🩸',
  cond: (s) => s.age >= 10 && Math.random() < 0.02,
  weight: (s) => 9,
  run: (s) => {
    gain(s, 'health', -4); gain(s, 'wealth', -3); s.happiness = clamp(s.happiness - 10, 0, 100);
    logEvent(s, '幹から樹液が流出してしまった。大切な養分が失われ、回復に時間がかかる。');
  },
});

addEvent({
  id: 'plant_over_pruning', name: '過度な剪定', kind: 'plant', tone: 'bad', icon: '✂️',
  cond: (s) => s.age >= 6 && Math.random() < 0.025,
  weight: (s) => 10,
  run: (s) => {
    gain(s, 'health', -5); gain(s, 'beauty', -8); s.happiness = clamp(s.happiness - 14, 0, 100);
    logEvent(s, '庭師が切りすぎてしまった。本来の美しさが失われ、元の姿に戻るまでに長年かかる。');
  },
});

addEvent({
  id: 'plant_wildness', name: '野生化', kind: 'plant', tone: 'good', icon: '🌿',
  cond: (s) => s.age >= 12 && !s.flags.wildGrowth && Math.random() < 0.02,
  weight: (s) => 11,
  run: (s) => {
    s.flags.wildGrowth = true; gain(s, 'health', +6); s.happiness = clamp(s.happiness + 16, 0, 100);
    logEvent(s, '人間の手から解放され、自由に野生化した。枝が伸び放題で、これ以上なく充実している。');
  },
});

addEvent({
  id: 'plant_century_life', name: '樹齢100年達成', kind: 'plant', tone: 'rare', icon: '👴',
  cond: (s) => s.age >= 100 && !s.flags.centuryReached,
  weight: (s) => 2,
  run: (s) => {
    s.flags.centuryReached = true; s.happiness = clamp(s.happiness + 30, 0, 100); gain(s, 'wealth', +15); gain(s, 'luck', +3);
    logEvent(s, '★100年の歳月を生き抜いた。生い茂った根と枝は時代の証人。');
  },
});

/* ============ 物体イベント追加 ============ */
addEvent({
  id: 'object_rust', name: '錆が進む', kind: 'object', tone: 'bad', icon: '🔴',
  cond: (s) => s.age >= 10 && Math.random() < 0.03,
  weight: (s) => 13,
  run: (s) => {
    const damage = randInt(3, 6);
    gain(s, 'health', -damage); gain(s, 'beauty', -5); s.happiness = clamp(s.happiness - 10, 0, 100);
    logEvent(s, `錆が広がり始めた。赤茶色に変色し、表面がぼろぼろになってきた。-${damage}健康`);
  },
});

addEvent({
  id: 'object_reborn', name: '修復される', kind: 'object', tone: 'good', icon: '🔧',
  cond: (s) => s.age >= 12 && Math.random() < 0.02,
  weight: (s) => 9,
  run: (s) => {
    gain(s, 'health', +7); gain(s, 'beauty', +8); s.happiness = clamp(s.happiness + 16, 0, 100);
    logEvent(s, '修理職人が元通りに修復してくれた。新しい輝きが戻り、第二の人生が始まった。');
  },
});

addEvent({
  id: 'object_museum', name: '博物館に展示される', kind: 'object', tone: 'rare', icon: '🏛️',
  cond: (s) => s.age >= 20 && !s.flags.museumDisplayed && Math.random() < 0.01,
  weight: (s) => 5,
  run: (s) => {
    s.flags.museumDisplayed = true; s.happiness = clamp(s.happiness + 28, 0, 100); gain(s, 'wealth', +20); gain(s, 'luck', +3);
    logEvent(s, '★歴史的価値を認められ、博物館に永遠に展示されることになった。人類の遺産として。');
  },
});

addEvent({
  id: 'object_lost', name: '失われる', kind: 'object', tone: 'bad', icon: '🚨',
  cond: (s) => s.age >= 5 && !s.flags.lostForever && Math.random() < 0.015,
  weight: (s) => 6,
  run: (s) => {
    s.flags.lostForever = true; gain(s, 'wealth', -15); s.happiness = clamp(s.happiness - 25, 0, 100);
    logEvent(s, 'どこへ失われたか、誰も分からない。世界から消えてしまった。');
  },
});

addEvent({
  id: 'object_crafted_care', name: '職人の入念な手入れ', kind: 'object', tone: 'good', icon: '👨‍🏭',
  cond: (s) => s.age >= 8 && Math.random() < 0.03,
  weight: (s) => 11,
  run: (s) => {
    gain(s, 'health', +4); gain(s, 'beauty', +7); s.happiness = clamp(s.happiness + 14, 0, 100);
    logEvent(s, '職人の細かい手入れを受けた。小さな傷も丁寧に修復され、輝きが戻った。');
  },
});

addEvent({
  id: 'object_antique_value', name: '骨董品の価値', kind: 'object', tone: 'rare', icon: '💎',
  cond: (s) => s.age >= 30 && Math.random() < 0.02,
  weight: (s) => 8,
  run: (s) => {
    gain(s, 'wealth', +12); gain(s, 'luck', +2); s.happiness = clamp(s.happiness + 18, 0, 100);
    logEvent(s, '★古い年代物だからこそ、骨董品としての価値が認められた。時が経つほど貴重になる運命。');
  },
});

addEvent({
  id: 'object_neglect', name: '放置される', kind: 'object', tone: 'bad', icon: '🗑️',
  cond: (s) => s.age >= 5 && Math.random() < 0.035,
  weight: (s) => 15,
  run: (s) => {
    gain(s, 'health', -4); gain(s, 'beauty', -6); s.happiness = clamp(s.happiness - 14, 0, 100);
    logEvent(s, '誰にも構われず、暗い片隅に放置されたままだ。塵も積もり、くすむばかり。');
  },
});

addEvent({
  id: 'object_adventure', name: '冒険者の相棒に', kind: 'object', tone: 'good', icon: '⚔️',
  cond: (s) => s.age >= 10 && !s.flags.adventurePartner && Math.random() < 0.02,
  weight: (s) => 10,
  run: (s) => {
    s.flags.adventurePartner = true; gain(s, 'wealth', +8); s.happiness = clamp(s.happiness + 20, 0, 100);
    logEvent(s, '冒険者の大切な相棒として、世界中を回ることになった。毎日が新しい刺激。');
  },
});

addEvent({
  id: 'object_theft_escape', name: '盗まれそうになる', kind: 'object', tone: 'bad', icon: '🚨',
  cond: (s) => s.age >= 8 && Math.random() < 0.02,
  weight: (s) => 9,
  run: (s) => {
    gain(s, 'wealth', -5); s.happiness = clamp(s.happiness - 16, 0, 100);
    logEvent(s, 'あやうく盗まれるところだった。心臓が高鳴り、恐怖が残った。');
  },
});

addEvent({
  id: 'object_art_donation', name: '美術館に寄贈', kind: 'object', tone: 'rare', icon: '🎨',
  cond: (s) => s.age >= 25 && !s.flags.artDonation && Math.random() < 0.01,
  weight: (s) => 6,
  run: (s) => {
    s.flags.artDonation = true; s.happiness = clamp(s.happiness + 30, 0, 100); gain(s, 'wealth', +25); gain(s, 'luck', +3);
    logEvent(s, '★美術館に寄贈されることになった。末永く芸術作品として保護される栄光。');
  },
});

addEvent({
  id: 'object_burned', name: '火に焼かれる', kind: 'object', tone: 'bad', icon: '🔥',
  cond: (s) => s.age >= 5 && !s.flags.burned && Math.random() < 0.015,
  weight: (s) => 6,
  run: (s) => {
    s.flags.burned = true;
    const damage = randInt(8, 15);
    gain(s, 'health', -damage); gain(s, 'beauty', -10); s.happiness = clamp(s.happiness - 20, 0, 100);
    logEvent(s, `大火に襲われた。表面は焦げ、大きく損傷してしまった。-${damage}健康`);
  },
});

addEvent({
  id: 'object_modification', name: '改造される', kind: 'object', tone: 'good', icon: '🔨',
  cond: (s) => s.age >= 12 && Math.random() < 0.025,
  weight: (s) => 11,
  run: (s) => {
    gain(s, 'health', +5); gain(s, 'beauty', +6); gain(s, 'wealth', +5); s.happiness = clamp(s.happiness + 14, 0, 100);
    logEvent(s, '職人によって改造されて新しい機能を獲得した。第二の人生に向けて、さらに輝いている。');
  },
});

addEvent({
  id: 'object_celebrity_owner', name: '有名人に所有される', kind: 'object', tone: 'rare', icon: '⭐',
  cond: (s) => s.age >= 15 && Math.random() < 0.015,
  weight: (s) => 8,
  run: (s) => {
    gain(s, 'wealth', +18); s.happiness = clamp(s.happiness + 25, 0, 100); gain(s, 'luck', +2);
    logEvent(s, '★有名人に買われてしまった。一躍セレブリティの所有物として世界中で話題に。');
  },
});

addEvent({
  id: 'object_shipwreck', name: '沈没する', kind: 'object', tone: 'bad', icon: '⛵',
  cond: (s) => s.age >= 10 && !s.flags.sunken && Math.random() < 0.01,
  weight: (s) => 5,
  run: (s) => {
    s.flags.sunken = true;
    gain(s, 'health', -12); gain(s, 'wealth', -20); s.happiness = clamp(s.happiness - 25, 0, 100);
    logEvent(s, '大嵐で海に沈んでしまった。深い闇の中で、誰にも見つかることはない。');
  },
});

addEvent({
  id: 'object_treasure_hunt', name: '秘宝として探される', kind: 'object', tone: 'rare', icon: '💎',
  cond: (s) => s.age >= 20 && !s.flags.treasureHunt && Math.random() < 0.012,
  weight: (s) => 7,
  run: (s) => {
    s.flags.treasureHunt = true; s.happiness = clamp(s.happiness + 28, 0, 100); gain(s, 'wealth', +30); gain(s, 'luck', +4);
    logEvent(s, '★冒険者たちに秘宝として探される存在になった。伝説の遺物として讃えられている。');
  },
});

addEvent({
  id: 'object_monument', name: '記念碑化', kind: 'object', tone: 'good', icon: '🗿',
  cond: (s) => s.age >= 30 && !s.flags.monument && Math.random() < 0.015,
  weight: (s) => 8,
  run: (s) => {
    s.flags.monument = true; gain(s, 'wealth', +14); s.happiness = clamp(s.happiness + 18, 0, 100); gain(s, 'luck', +1);
    logEvent(s, '歴史的出来事を記念して、石碑として立てられた。不朽の栄光を獲得した。');
  },
});

// 年次の自然変動
function yearlyDrift(state) {
  // 年をとるごとに少し健康が下がる(高運だと軽減) + 年齢劣化 + 個体差
  const baseDecay = 1.2 - (state.stats.luck - 50) / 120;
  const ageWear = Math.max(0, (state.age - 50) / 30);
  const variance = rand(0, 0.3);
  const healthDrop = Math.max(0.3, baseDecay) + ageWear + variance;
  gain(state, 'health', -healthDrop);
  // 年次収支: 収入 − 生活費 − 資産税(富裕層向け)
  const baseIncome = state.job ? jobIncome(state.job) : 0.6; // 単位=「年あたりの資産ポイント」(1Pt=100万円)
  const ageFactor = ageIncomeFactor(state.age);
  const luckFactor = 1 + (state.stats.luck - 50) / 400; // 運補正は控えめ
  const living = (state.job ? costOfLiving(state.job) : 0.8) + familyCost(state.flags);
  const wealthTax = Math.max(0, state.stats.wealth - 150) * 0.004; // 150Pt超の資産に年0.4%相当
  const net = baseIncome * ageFactor * luckFactor - living - wealthTax;
  gain(state, 'wealth', net);
  // 幸福度は健康とイベントの影響を受ける
  state.happiness = clamp(state.happiness + (state.stats.health > 60 ? 0.4 : -0.2), 0, 100);
}

function jobIncome(job) {
  const map = {
    // 1Pt ≒ 100万円/年の目安 (運で微調整)
    '医者': 4.5,
    '弁護士': 4.0,
    '宇宙飛行士': 4.6,
    '投資家': 4.2,
    '起業家': 3.6,
    '研究者': 2.6,
    'エンジニア': 3.0,
    'プロゲーマー': 2.8,
    'モデル': 2.2,
    'アイドル': 2.6,
    '音楽家': 2.4,
    '作家': 2.0,
    '教師': 2.0,
    '公務員': 2.1,
    'シェフ': 1.8,
    '職人': 1.7,
    '農家': 1.6,
    'サラリーマン': 1.9,
    '配信者': 1.8,
    '学生': 0.4,
    'フリーター': 1.0,
    'コンビニ店員': 0.9,
    '日雇い労働者': 0.9,
    'パート': 0.6,
    '無職': 0.2,
    '石': 0.0,
  };
  return map[job] ?? 2.0;
}

function costOfLiving(job) {
  const map = {
    '医者': 3.0,
    '弁護士': 2.6,
    '宇宙飛行士': 2.8,
    '投資家': 3.2,
    '起業家': 2.4,
    '研究者': 1.6,
    'エンジニア': 1.8,
    'プロゲーマー': 1.7,
    'モデル': 2.0,
    'アイドル': 2.2,
    '音楽家': 1.9,
    '作家': 1.5,
    '教師': 1.4,
    '公務員': 1.5,
    'シェフ': 1.4,
    '職人': 1.3,
    '農家': 1.2,
    'サラリーマン': 1.5,
    '配信者': 1.6,
    '学生': 0.8,
    'フリーター': 1.0,
    'コンビニ店員': 0.9,
    '日雇い労働者': 0.9,
    'パート': 1.1,
    '無職': 0.8,
    '石': 0.0,
  };
  return map[job] ?? 1.4;
}

function ageIncomeFactor(age) {
  if (age < 25) return 0.6;
  if (age < 35) return 0.9;
  if (age < 50) return 1.0; // ピーク帯
  if (age < 60) return 0.9;
  if (age < 70) return 0.7;
  return 0.5; // リタイア後は緩やかに
}

function familyCost(flags) {
  let add = 0;
  if (flags?.married) add += 0.3; // 住居/生活拡張
  if (flags?.childCount) add += 0.25 * flags.childCount; // 子ども数に比例
  else if (flags?.child) add += 0.25;
  return add;
}

// 図鑑
function loadDex() {
  return {
    jobs: new Set(JSON.parse(localStorage.getItem('dex.jobs') || '[]')),
    deaths: new Set(JSON.parse(localStorage.getItem('dex.deaths') || '[]')),
  };
}
const DEX = loadDex();
function saveDex() {
  localStorage.setItem('dex.jobs', JSON.stringify(Array.from(DEX.jobs)));
  localStorage.setItem('dex.deaths', JSON.stringify(Array.from(DEX.deaths)));
}
function trackDex(kind, entry) { if (!entry) return; DEX[kind].add(entry); saveDex(); renderDex(); }

// 実績システム
const ACH_STORE_KEY = 'achievements';
function loadAchievements() { return new Set(JSON.parse(localStorage.getItem(ACH_STORE_KEY) || '[]')); }
const ACH = loadAchievements();
function saveAchievements() { localStorage.setItem(ACH_STORE_KEY, JSON.stringify(Array.from(ACH))); }
const ACH_DEF = [
  { id: 'birth_ur', name: '伝説の誕生', desc: 'URで転生した', test: (s, ctx) => ctx?.type==='init' && s.rarity==='UR' },
  { id: 'hundred', name: '大往生', desc: '100歳まで生きた', test: (s, ctx) => (ctx?.type==='tick' || ctx?.type==='end') && s.age >= 100 },
  { id: 'millionaire', name: '億り人', desc: '資産が500に到達', test: (s) => s.stats.wealth >= 500 },
  { id: 'jackpot', name: '運命の一等', desc: '宝くじ1等を当てた', test: (s, ctx) => ctx?.type==='event' && ctx.id==='lottery_jackpot' },
  { id: 'miracle', name: '奇跡の生還', desc: '奇跡の治療を受けた', test: (s, ctx) => ctx?.type==='event' && ctx.id==='miracle_cure' },
  { id: 'meteor', name: '星に願いを', desc: '隕石で死亡', test: (s, ctx) => ctx?.type==='death' && (ctx.cause||'').includes('隕石') },
  { id: 'debt_end', name: '借金地獄', desc: '借金取りで終了', test: (s, ctx) => ctx?.type==='death' && (ctx.cause||'').includes('借金取り') },
  { id: 'idol_star', name: 'トップアイドル', desc: 'アイドルで資産100達成', test: (s) => s.job==='アイドル' && s.stats.wealth>=100 },
  { id: 'n_to_star', name: '石からの成り上がり', desc: 'Nレアで資産300達成', test: (s) => s.rarity==='N' && s.stats.wealth>=300 },
  { id: 'jobs_10', name: '多才', desc: '職業図鑑を10種集めた', test: () => DEX.jobs.size >= 10 },
];
function unlockAchievement(id) {
  if (ACH.has(id)) return;
  ACH.add(id); saveAchievements(); renderDex(); showToast(`実績解除: ${ACH_DEF.find(a=>a.id===id)?.name || id}`);
}
function checkAchievements(state, ctx) {
  for (const a of ACH_DEF) {
    try { if (!ACH.has(a.id) && a.test(state, ctx)) unlockAchievement(a.id); } catch {}
  }
}
function showToast(text) {
  const wrap = document.getElementById('toasts'); if (!wrap) return;
  const div = document.createElement('div'); div.className = 'toast'; div.textContent = text;
  wrap.appendChild(div);
  setTimeout(() => { div.remove(); }, 2600);
}

function showCutIn({ title, body, tone = 'common', icon = '📜' }) {
  const wrap = document.getElementById('cutins'); if (!wrap) return;
  const item = document.createElement('div');
  item.className = `cutin ${tone}`.trim();
  item.innerHTML = `
    <div class="icon">${icon}</div>
    <div>
      <div class="title">${title}</div>
      <div class="body">${body}</div>
    </div>
  `;
  wrap.appendChild(item);
  setTimeout(() => item.remove(), 2200);
}

// ゲームステート
let state = null;
let timer = null;
let baseTickMs = 1600; // 少しゆっくり目
let tickMs = baseTickMs;

// UI要素
const el = {
  rarity: document.getElementById('rarity-badge'),
  gachaResult: document.getElementById('gacha-result'),
  gachaFlavor: document.getElementById('gacha-flavor'),
  initStats: document.getElementById('init-stats'),
  startAuto: document.getElementById('start-auto'),
  startDuel: document.getElementById('start-duel'),
  controlsSection: document.getElementById('controls-section'),
  duelSection: document.getElementById('duel-section'),
  duelA: document.getElementById('duel-a'),
  duelB: document.getElementById('duel-b'),
  duelStop: document.getElementById('duel-stop'),
  duelBack: document.getElementById('duel-back'),
  duelResult: document.getElementById('duel-result'),
  speed: document.getElementById('speed'),
  pauseResume: document.getElementById('pause-resume'),
  skip10: document.getElementById('skip-10'),
  reset: document.getElementById('reset'),
  age: document.getElementById('age'),
  job: document.getElementById('job'),
  jobTag: document.getElementById('job-tag'),
  lifespan: document.getElementById('lifespan'),
  bars: document.getElementById('bars'),
  logSection: document.getElementById('log-section'),
  log: document.getElementById('log'),
  endingSection: document.getElementById('ending-section'),
  endingSummary: document.getElementById('ending-summary'),
  copyResult: document.getElementById('copy-result'),
  reincarnate: document.getElementById('reincarnate'),
  gachaSection: document.getElementById('gacha-section'),
  openDex: document.getElementById('open-dex'),
  closeDex: document.getElementById('close-dex'),
  dexDialog: document.getElementById('dex-dialog'),
  dexJobs: document.getElementById('dex-jobs'),
  dexDeaths: document.getElementById('dex-deaths'),
  dexAchievements: document.getElementById('dex-achievements'),
  sceneSection: document.getElementById('scene-section'),
  sceneIcon: document.getElementById('scene-icon'),
  sceneTitle: document.getElementById('scene-title'),
  sceneBody: document.getElementById('scene-body'),
  eventScreen: document.getElementById('event-screen'),
  eventImage: document.getElementById('event-image'),
  eventScreenTitle: document.getElementById('event-screen-title'),
  eventScreenBody: document.getElementById('event-screen-body'),
  jobRoulette: document.getElementById('job-roulette'),
  rouletteResult: document.getElementById('roulette-result'),
  rouletteConfirm: document.getElementById('roulette-confirm'),
};

function showEventScreen(meta, text) {
  if (!el.eventScreen) return;
  el.eventScreen.className = 'event-screen';
  if (meta?.tone) el.eventScreen.classList.add(meta.tone);
  el.eventImage.textContent = meta?.icon || '📜';
  el.eventScreenTitle.textContent = meta?.title || 'イベント';
  el.eventScreenBody.textContent = text || '—';
  el.eventScreen.classList.remove('hidden');
  setTimeout(() => {
    el.eventScreen.classList.add('hidden');
  }, 3500);
}

function renderDex() {
  el.dexJobs.innerHTML = '';
  Array.from(DEX.jobs).sort().forEach(j => {
    const li = document.createElement('li');
    li.className = 'chip'; li.textContent = j; el.dexJobs.appendChild(li);
  });
  el.dexDeaths.innerHTML = '';
  Array.from(DEX.deaths).sort().forEach(d => {
    const li = document.createElement('li');
    li.className = 'chip'; li.textContent = d; el.dexDeaths.appendChild(li);
  });
  if (el.dexAchievements) {
    el.dexAchievements.innerHTML = '';
    for (const a of ACH_DEF) {
      const unlocked = ACH.has(a.id);
      const li = document.createElement('li');
      li.className = `badge ${unlocked ? '' : 'locked'}`.trim();
      li.innerHTML = `<span class="dot"></span><span>${a.name}</span>`;
      li.title = a.desc;
      el.dexAchievements.appendChild(li);
    }
  }
}

function renderLog() {
  if (!state) return;
  el.log.innerHTML = state.logs.map(l => {
    const rare = /[★⚡]/.test(l.text);
    return `
    <div class="log-item ${rare ? 'rare' : ''}"><span class="age">${l.age}歳</span><span class="text">${l.text}</span></div>
    `;
  }).join('');
}

function renderStats() {
  if (!state) return;
  el.age.textContent = String(state.age);
  el.job.textContent = state.job ?? '—';
  el.lifespan.textContent = String(state.lifespan);
  createBars(el.bars, state.stats);
  if (el.jobTag) {
    if (state.job) {
      el.jobTag.classList.remove('hidden');
      el.jobTag.textContent = `職業: ${state.job}`;
    } else {
      el.jobTag.classList.add('hidden');
    }
  }
}

function renderScene(meta, text) {
  if (!el.sceneSection) return;
  el.sceneSection.classList.remove('hidden', 'good', 'bad', 'rare');
  if (meta?.tone) el.sceneSection.classList.add(meta.tone);
  el.sceneIcon.textContent = meta?.icon || '📜';
  el.sceneTitle.textContent = meta?.title || 'イベント';
  el.sceneBody.textContent = text || '—';
}

function renderGacha(rarityRow, stats, flavor) {
  el.gachaResult.classList.remove('hidden');
  const key = rarityRow.key.toLowerCase();
  el.rarity.className = `rarity ${key}`;
  el.rarity.textContent = rarityRow.key;
  el.gachaFlavor.textContent = flavor;
  if (rarityRow.key === 'UR' || rarityRow.key === 'SSR') {
    el.rarity.classList.add('rare-anim');
  } else {
    el.rarity.classList.remove('rare-anim');
  }
  // 初期ステ表示
  const list = document.createElement('div');
  list.className = 'bars';
  createBars(list, stats);
  el.initStats.innerHTML = '';
  el.initStats.appendChild(list);
}

function flash() {
  const fx = document.getElementById('fx-flash');
  if (!fx) return;
  fx.classList.add('show');
  setTimeout(() => fx.classList.remove('show'), 200);
}

function startNewRun() {
  console.log('startNewRun called');
  // シングル開始時にデュエルを完全に隠す・停止する
  stopDuel?.();
  if (el?.duelSection) {
    el.duelSection.classList.add('hidden');
    // デュエル結果の残骸を掃除
    el.duelSection.querySelectorAll('[data-duel-result]').forEach(n => n.remove());
  }
  const rarity = rarityRoll();
  const stats = allocateInitialStats(rarity.key);
  const chosenFlavor = pick(rarity.flavor);
  console.log('Rarity:', rarity.key, 'Flavor:', chosenFlavor);
  function inferKindFromFlavor(f) {
    if (!f) return 'human';
    if (/犬|猫|鳥|馬|牛|豚|猿|魚|羊|動物/.test(f)) return 'animal';
    if (/草|花|木|樹|雑草|植物/.test(f)) return 'plant';
    if (/石|岩|砂|道端|岩石|鉱物|物/.test(f)) return 'object';
    return 'human';
  }
  // 名前と誕生年を取得
  const nameInput = document.getElementById('player-name');
  const yearInput = document.getElementById('birth-year');
  const playerName = nameInput?.value.trim() || '';
  const birthYear = yearInput?.value ? parseInt(yearInput.value) : null;
  const kind = inferKindFromFlavor(chosenFlavor);
  // 状態初期化
  state = {
    rarity: rarity.key,
    stats: { ...stats },
    age: 0,
    happiness: 50,
    flags: {},
    job: null,  // 全員ジョブレス開始。職業は後から決定される
    alive: true,
    logs: [],
    cause: null,
    lifespan: computeLifespan(stats, kind),
    currentEventMeta: null,
    playerName: playerName,
    birthYear: birthYear,
    kind: kind,
    flavor: chosenFlavor,
    majorEvents: [], // 主要イベントを記録
  };
  // 実績チェックと演出
  renderGacha(rarity, stats, chosenFlavor);
  checkAchievements?.(state, { type: 'init' });
  if (rarity.key === 'UR') showToast('レア転生: UR！');
  flash();

  // UI切替
  el.gachaSection.classList.add('hidden');
  el.sceneSection?.classList.remove('hidden');
  el.controlsSection.classList.remove('hidden');
  el.logSection.classList.remove('hidden');
  renderStats();
  renderScene({ title: '誕生', tone: 'good', icon: '🌱' }, `レア: ${rarity.key} / ${chosenFlavor}`);
  startLoop();
}

function startLoop() {
  if (timer) clearInterval(timer);
  timer = setInterval(tick, tickMs);
}

function stopLoop() { if (timer) { clearInterval(timer); timer = null; } }

// デュエルモード
let duelTimer = null;
const duelTickMs = 800; // 対戦モードは早めに設定
const Duel = {
  active: false,
  a: null,
  b: null,
  el: null,
};

function computeTotalScore(s) {
  return Math.round((s.stats.wealth ?? 0) * 1.5 + (s.happiness ?? 0) * 1.8 + (s.age ?? 0) * 1.2 + (s.stats.int ?? 0) * 0.5);
}

function initRunState(kind = 'human') {
  const rarity = rarityRoll();
  const stats = allocateInitialStats(rarity.key);
  const flavor = pick(rarity.flavor);
  const s = {
    rarity: rarity.key,
    stats: { ...stats },
    age: 0,
    happiness: 50,
    flags: {},
    job: null,
    alive: true,
    logs: [],
    cause: null,
    lifespan: computeLifespan(stats, kind),
    currentEventMeta: null,
    playerName: '',
    birthYear: null,
    kind,
    flavor,
    majorEvents: [],
  };
  return s;
}

function createDuelUI() {
  Duel.el = { wrap: el.duelSection, pa: el.duelA, pb: el.duelB };
}

function renderDuelPanel(panel, s) {
  const nameEl = panel.querySelector('.player-name');
  const bars = panel.querySelector('.bars');
  const ageEl = panel.querySelector('.age');
  const lifeEl = panel.querySelector('.life');
  const jobEl = panel.querySelector('.job');
  const scoreEl = panel.querySelector('.score');
  
  // プレイヤー名の表示
  if (nameEl && s.playerName) {
    nameEl.textContent = s.playerName;
  }
  
  createBars(bars, s.stats);
  ageEl.textContent = String(s.age);
  lifeEl.textContent = String(s.lifespan);
  jobEl.textContent = s.job ?? '—';
  scoreEl.textContent = String(computeTotalScore(s));
  
  // 最新イベントを簡潔に表示（対戦モード用）
  let eventDiv = panel.querySelector('.duel-event');
  if (!eventDiv) {
    eventDiv = document.createElement('div');
    eventDiv.className = 'duel-event muted';
    eventDiv.style.fontSize = '12px';
    eventDiv.style.marginTop = '8px';
    eventDiv.style.overflow = 'hidden';
    eventDiv.style.textOverflow = 'ellipsis';
    eventDiv.style.whiteSpace = 'nowrap';
    panel.appendChild(eventDiv);
  }
  
  if (s.logs && s.logs[0]) {
    const latestLog = s.logs[0];
    eventDiv.textContent = `${latestLog.age}歳: ${latestLog.text}`;
  } else {
    eventDiv.textContent = '—';
  }
}

function startDuel(nameA = 'プレイヤー A', nameB = 'プレイヤー B') {
  stopLoop(); // シングル進行は停止
  Duel.active = true;
  Duel.nameA = nameA;
  Duel.nameB = nameB;
  // デュエルモード開始時に前回の結果をリセット（比較表示を出さないようにする）
  window.lastHumanResult = null;
  Duel.a = initRunState('human');
  Duel.b = initRunState('human');
  Duel.a.playerName = nameA;
  Duel.b.playerName = nameB;
  // デュエル用フラグ（職業ルーレットをスキップ）
  Duel.a.flags.duel = true;
  Duel.b.flags.duel = true;
  createDuelUI();
  renderDuelPanel(Duel.el.pa, Duel.a);
  renderDuelPanel(Duel.el.pb, Duel.b);
  // 画面切替
  el.gachaSection.classList.add('hidden');
  el.controlsSection.classList.add('hidden');
  el.logSection.classList.add('hidden');
  el.sceneSection?.classList.add('hidden');
  el.endingSection.classList.add('hidden');
  el.duelSection.classList.remove('hidden');
  if (duelTimer) clearInterval(duelTimer);
  duelTimer = setInterval(tickDuel, duelTickMs);
}

function stopDuel() { if (duelTimer) { clearInterval(duelTimer); duelTimer = null; } Duel.active = false; Duel.speedBoosted = false; }

function tickDuel() {
  const list = [Duel.a, Duel.b];
  
  // 片方が終了したら残りを高速化（インターバル短縮）
  const aAlive = Duel.a?.alive;
  const bAlive = Duel.b?.alive;
  if (!aAlive && bAlive && !Duel.speedBoosted) {
    // A終了、B継続中 → 速度アップ
    Duel.speedBoosted = true;
    clearInterval(duelTimer);
    duelTimer = setInterval(tickDuel, 100); // 800ms→100msに超高速化
  } else if (aAlive && !bAlive && !Duel.speedBoosted) {
    // B終了、A継続中 → 速度アップ
    Duel.speedBoosted = true;
    clearInterval(duelTimer);
    duelTimer = setInterval(tickDuel, 100); // 800ms→100msに超高速化
  }
  
  for (const s of list) {
    if (!s?.alive) continue;
    if (s.currentEventMeta && s.currentEventMeta.timestamp) {
      const elapsed = Date.now() - s.currentEventMeta.timestamp;
      if (elapsed > 1200) s.currentEventMeta = null;
    }
    if (s.currentEventMeta === null) applyYear(s);
  }
  renderDuelPanel(Duel.el.pa, Duel.a);
  renderDuelPanel(Duel.el.pb, Duel.b);
  // 勝敗判定（両方終了）
  if (!Duel.a.alive && !Duel.b.alive) {
    stopDuel();
    const sa = computeTotalScore(Duel.a);
    const sb = computeTotalScore(Duel.b);
    const res = document.createElement('div');
    res.dataset.duelResult = '1';
    res.style.gridColumn = 'span 2';
    res.style.padding = '16px';
    res.style.border = '2px solid var(--accent)';
    res.style.borderRadius = '8px';
    res.style.backgroundColor = 'var(--card-2)';
    res.style.fontWeight = '600';
    res.innerHTML = `<strong>🏆 デュエル結果:</strong><br>${Duel.nameA} = ${sa}点 / ${Duel.nameB} = ${sb}点<br><span style="font-size:20px; color:var(--accent);">${sa >= sb ? Duel.nameA + ' の勝ち！' : Duel.nameB + ' の勝ち！'}</span>`;
    Duel.el.wrap.appendChild(res);
  }
}

function titleFromRun(s) {
  const parts = [];
  if (s.age >= 100) parts.push('100歳まで生きた');
  if (s.age <= 5 && s.rarity === 'UR') parts.push('3歳で破産した石油王');
  if ((s.job === '石' || s.kind === 'object') && s.age >= 50) parts.push('石の忍耐');
  if (s.job === 'アイドル') parts.push('眩しきステージの');
  if (s.cause?.includes('事故')) parts.push('不運な');
  if (!parts.length) parts.push('ささやかな');
  const subject = s.kind === 'human' ? (s.job || '人') : (s.flavor || (s.kind === 'animal' ? '動物' : s.kind === 'plant' ? '植物' : '石'));
  return `${parts.join(' ')}${subject}`;
}

function endGame() {
  stopLoop();
  el.controlsSection.classList.add('hidden');
  el.logSection.classList.remove('hidden');
  el.endingSection.classList.remove('hidden');
  trackDex('deaths', state.cause || '老衰');
  checkAchievements(state, { type: 'end' });
  const totalScore = Math.round((state.stats.wealth ?? 0) * 1.5 + (state.happiness ?? 0) * 1.8 + (state.age ?? 0) * 1.2 + (state.stats.int ?? 0) * 0.5);
  const title = titleFromRun(state);
  const nameDisplay = state.playerName ? `<div>名前: <strong>${state.playerName}</strong></div>` : '';
  const yearDisplay = state.birthYear ? `<div>誕生年: <strong>${state.birthYear}年</strong> (没年: ${state.birthYear + state.age}年)</div>` : '';
  
  // 人生のハイライト生成
  let lifeHighlights = '';
  if (state.majorEvents && state.majorEvents.length > 0) {
    const highlights = state.majorEvents.map(e => `<li>${e.icon} <span class="muted">${e.age}歳</span> ${e.name}</li>`).join('');
    lifeHighlights = `
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);">
        <h4 style="margin: 0 0 8px 0; font-size: 14px; color: var(--accent);">🌟 人生のハイライト</h4>
        <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.8;">${highlights}</ul>
      </div>
    `;
  }
  
  // 人生の総評
  let lifeSummary = '';
  if (state.kind === 'human') {
    if (state.age >= 80 && state.stats.wealth > 100) lifeSummary = '豊かで長い人生を全うした。';
    else if (state.age >= 80) lifeSummary = '長寿を全うした人生だった。';
    else if (state.stats.wealth > 150) lifeSummary = '富を築いた華やかな人生。';
    else if (state.happiness > 80) lifeSummary = '幸せに満ちた人生だった。';
    else if (state.age < 30) lifeSummary = '短くも濃密な人生だった。';
    else lifeSummary = 'ささやかながら、確かに生きた。';
  } else if (state.kind === 'animal') {
    if (state.age >= 20) lifeSummary = '動物としては長寿を全うした。';
    else if (state.happiness > 70) lifeSummary = '自由に駆け回った幸せな生涯。';
    else lifeSummary = '野生の中で精一杯生きた。';
  } else if (state.kind === 'plant') {
    if (state.age >= 100) lifeSummary = '樹齢100年を超える大樹となった。';
    else if (state.age >= 50) lifeSummary = '長い年月を大地に根を張って生きた。';
    else lifeSummary = '静かに季節を感じながら生きた。';
  } else if (state.kind === 'object') {
    if (state.age >= 200) lifeSummary = '歴史の証人として時代を見守った。';
    else if (state.age >= 100) lifeSummary = '長い年月を経て風格を増した。';
    else lifeSummary = 'ただそこに在り続けた。';
  }
  
  el.endingSummary.innerHTML = `
    <div class="title">二つ名: ${title}</div>
    ${nameDisplay}
    ${yearDisplay}
    <div>最終年齢: <strong>${state.age}歳</strong> (${state.cause || '老衰'})</div>
    <div>最終資産: <strong>${formatMoney(state.stats.wealth)}</strong></div>
    <div>幸福度: <strong>${Math.round(state.happiness)}</strong></div>
    <div>職業: <strong>${state.job ?? '—'}</strong></div>
    <div>総合点: <strong>${totalScore}</strong></div>
    <div style="margin-top: 12px; padding: 12px; background: var(--card-2); border-radius: 8px; font-size: 14px; font-style: italic;">${lifeSummary}</div>
    ${lifeHighlights}
  `;

  // 最終グラフの表示（最終ステータスバー）
  const finalBars = document.createElement('div');
  finalBars.className = 'bars';
  createBars(finalBars, state.stats);
  el.endingSection.appendChild(finalBars);

  // 簡易対戦形式（人間のみ）: 前回結果と比較
  if (state.kind === 'human') {
    const prev = window.lastHumanResult;
    const snapshot = { score: totalScore, age: state.age, wealth: state.stats.wealth, happiness: state.happiness, title };
    if (prev) {
      const cmp = document.createElement('div');
      cmp.style.marginTop = '16px';
      cmp.style.padding = '12px';
      cmp.style.border = '1px solid var(--border)';
      cmp.style.borderRadius = '8px';
      const prevMoney = formatMoney(prev.wealth ?? 0);
      const currMoney = formatMoney(snapshot.wealth ?? 0);
      const winner = snapshot.score >= prev.score ? '今回の勝ち' : '前回の勝ち';
      cmp.innerHTML = `
        <h4 style="margin:0 0 8px 0;">対戦結果</h4>
        <div style="display:flex; gap:12px; font-size:13px;">
          <div style="flex:1">
            <div class="muted">前回</div>
            <div>二つ名: ${prev.title}</div>
            <div>年齢: ${prev.age} / 資産: ${prevMoney} / 幸福: ${Math.round(prev.happiness ?? 0)}</div>
            <div>総合点: <strong>${prev.score}</strong></div>
          </div>
          <div style="flex:1">
            <div class="muted">今回</div>
            <div>二つ名: ${snapshot.title}</div>
            <div>年齢: ${snapshot.age} / 資産: ${currMoney} / 幸福: ${Math.round(snapshot.happiness ?? 0)}</div>
            <div>総合点: <strong>${snapshot.score}</strong></div>
          </div>
        </div>
        <div style="margin-top:8px; font-weight:600;">${winner}</div>
      `;
      el.endingSection.appendChild(cmp);
    }
    window.lastHumanResult = snapshot;
  }
}

function shareText() {
  const s = state;
  const nameLine = s.playerName ? `名前:${s.playerName} ` : '';
  return [
    `【Luck Life】 ${titleFromRun(s)}`,
    `${nameLine}年齢:${s.age} 資産:${formatMoney(s.stats.wealth)} 幸福:${Math.round(s.happiness)}`,
    `死因:${s.cause || '老衰'} 職業:${s.job ?? '—'} レア:${s.rarity}`,
    `#LuckLifeGame`
  ].join('\n');
}

// リール式職業ルーレット実装
let rouletteInProgress = false;
let selectedJobFromRoulette = null;
let rouletteAnimationId = null;

function showJobRoulette(candidates) {
  if (!el.jobRoulette || rouletteInProgress) return;
  
  rouletteInProgress = true;
  selectedJobFromRoulette = null;
  el.rouletteResult.textContent = '';
  el.jobRoulette.classList.remove('hidden');
  
  // 候補をシャッフル
  const shuffled = shuffle(Array.from(new Set(candidates)));
  const reel1 = document.getElementById('reel-1');
  
  // リール内容を生成（大量に繰り返して長距離スピンを実現）
  const repeatCount = 20; // 長く回すための繰り返し回数
  const jobs = Array.from({ length: repeatCount }).flatMap(() => shuffled);
  reel1.innerHTML = jobs.map(j => `<div class="reel-item">${j}</div>`).join('');
  
  // スピンボタンの状態を初期化
  const spinBtn = document.getElementById('roulette-spin');
  const confirmBtn = document.getElementById('roulette-confirm');
  spinBtn.style.display = '';
  confirmBtn.style.display = 'none';
  spinBtn.disabled = false;
  spinBtn.textContent = '🎰 スピン!';
  
  // スピンボタンのクリックハンドラ
  const handleSpin = () => {
    spinBtn.disabled = true;
    spinBtn.textContent = '回転中...';
    
    const itemHeight = 140;
    const loops = randInt(6, 12); // 何周も回す
    const targetIndex = randInt(0, shuffled.length - 1);
    const finalIndex = loops * shuffled.length + targetIndex;
    const targetOffset = -finalIndex * itemHeight;
    
    // リール回転アニメーション（高速で多回転 → 減速で停止）
    reel1.style.transition = 'transform 2.4s cubic-bezier(0.15, 0.65, 0.12, 1)';
    reel1.style.transform = `translateY(${targetOffset}px)`;
    
    // 回転完了後に確定ボタンを表示
    rouletteAnimationId = setTimeout(() => {
      selectedJobFromRoulette = shuffled[targetIndex];
      el.rouletteResult.textContent = `✨ ${selectedJobFromRoulette} に決定！`;
      spinBtn.style.display = 'none';
      confirmBtn.style.display = '';
      confirmBtn.disabled = false;
      rouletteAnimationId = null;
    }, 2500);
  };
  
  spinBtn.onclick = handleSpin;
  
  // 確定ボタンのハンドラ
  confirmBtn.onclick = () => {
    if (selectedJobFromRoulette) {
      setJob(state, selectedJobFromRoulette);
      state.flags.jobRouletteShown = true;
      console.log(`[JOB ROULETTE] Job confirmed: ${selectedJobFromRoulette}`);
      selectedJobFromRoulette = null;
    }
    hideJobRoulette();
    startLoop();
  };
}

function hideJobRoulette() {
  if (el.jobRoulette) {
    el.jobRoulette.classList.add('hidden');
  }
  const reel1 = document.getElementById('reel-1');
  if (reel1) {
    reel1.style.transform = 'translateY(0)';
    reel1.style.transition = 'none';
  }
  if (rouletteAnimationId) {
    clearTimeout(rouletteAnimationId);
    rouletteAnimationId = null;
  }
  rouletteInProgress = false;
}

function getJobRouletteCandidates(s) {
  const basePool = ['サラリーマン','フリーター','教師','エンジニア','農家','公務員','配信者','作家','シェフ','研究者','アイドル','音楽家','起業家','弁護士','医者','投資家','芸人','モデル','プロゲーマー','職人','勇者','貴族','騎士','冒険者','魔法使い'];
  const candidates = [
    { need: s.stats.int >= 85 && s.stats.health >= 75 && s.stats.luck >= 65, name: '宇宙飛行士' },
    { need: s.stats.int >= 80, name: '研究者' },
    { need: s.stats.int >= 72, name: 'エンジニア' },
    { need: s.stats.int >= 70 && s.flags?.med, name: '医者' },
    { need: s.stats.int >= 68 && s.flags?.law, name: '弁護士' },
    { need: s.stats.beauty >= 80, name: 'モデル' },
    { need: s.stats.health >= 78, name: 'アスリート' },
    { need: s.stats.wealth >= 100, name: '投資家' },
    { need: s.stats.int >= 65, name: '教師' },
    { need: s.stats.int >= 55, name: '公務員' },
    { need: s.stats.luck >= 75, name: '配信者' },
    { need: s.stats.health >= 70, name: '農家' },
    { need: s.stats.health >= 60, name: '職人' },
    // 特殊職の解禁条件
    { need: (s.rarity === 'UR' || s.stats.luck >= 90) && s.kind === 'human', name: '勇者' },
    { need: (s.stats.wealth >= 120 || (s.rarity === 'UR' && s.stats.wealth >= 80)) && s.kind === 'human', name: '貴族' },
    { need: s.stats.health >= 70 && s.stats.int >= 60 && s.kind === 'human', name: '騎士' },
    { need: s.stats.int >= 75 && s.stats.luck >= 70 && s.kind === 'human', name: '魔法使い' },
    { need: s.stats.health >= 65 && s.stats.luck >= 65 && s.kind === 'human', name: '冒険者' },
  ];
  const qualifiedJobs = candidates.filter(c => c.need).map(c => c.name);
  let rouletteCandidates = qualifiedJobs.length ? qualifiedJobs : [];
  const filler = shuffle(basePool).slice(0, Math.max(4, 8 - rouletteCandidates.length));
  rouletteCandidates = Array.from(new Set([...rouletteCandidates, ...filler]));
  if (rouletteCandidates.length < 4) {
    rouletteCandidates.push('サラリーマン', 'フリーター', 'アルバイト');
    rouletteCandidates = Array.from(new Set(rouletteCandidates));
  }
  return rouletteCandidates;
}

function startJobRouletteForState(s) {
  // デュエルモードでは絶対にルーレットを表示しない
  if (s.flags?.duel) {
    console.log(`[JOB ROULETTE] Skipping roulette in duel mode`);
    return;
  }
  
  const rouletteCandidates = getJobRouletteCandidates(s);
  console.log(`[JOB ROULETTE] Candidates: ${rouletteCandidates.length}`);
  if (!rouletteCandidates || rouletteCandidates.length === 0) {
    console.log(`[JOB ROULETTE] No candidates, auto-assigning job`);
    return;
  }
  console.log(`[JOB ROULETTE] Showing roulette at age ${s.age}`);
  stopLoop();
  showJobRoulette(rouletteCandidates);
}

function maybeAssignDefaultJob(s) {
  if (s.job) return;
  if (s.kind && s.kind !== 'human') return; // 非人間は職業割り当てなし
  if (s.flags.jobRouletteShown) return; // 既にルーレットを表示済みなら実行しない
  
  // デュエルモードでは18歳で自動割り当て（ルーレット不使用）
  if (s.flags?.duel && s.age >= 18) {
    const autoJobs = ['サラリーマン', 'フリーター', '教師', 'エンジニア', '農家', '公務員', '配信者', '作家'];
    if (!s.job) {
      s.job = pick(autoJobs);
      DEX?.jobs?.add?.(s.job);
      console.log(`[JOB] Duel mode: auto-assigned ${s.job} at age ${s.age}`);
      s.flags.jobRouletteShown = true;
    }
    return;
  }
  
  // 通常モードは19歳以上のみ
  if (s.age < 19) return;
  
  console.log(`[JOB] Age ${s.age}, checking job assignment`);
  
  // 19歳以上で職業未定なら必ずルーレット表示
  if (s.age >= 19) {
    startJobRouletteForState(s);
  }
}

function applyYear(state) {
  state.age += 1;
  console.log(`[AGE ${state.age}] Starting year`);
  yearlyDrift(state);
  // イベント抽選（種別フィルタ + 職業フィルタ）
  const pool = Events.filter(e => 
    (((e.kind ?? 'human') === (state.kind ?? 'human')) || e.kind === 'any') && 
    (e.job === undefined || e.job === state.job) &&  // 職業: 未指定なら全職共通、指定なら完全一致
    e.cond(state)
  );
  if (pool.length && Math.random() < 0.9) { // 9割で何か起こる
    const chosen = weightedPick(pool, (e) => Math.max(1, e.weight?.(state) ?? 10));
    if (chosen) {
      console.log(`[AGE ${state.age}] Event triggered: ${chosen.name}`);
      state.currentEventMeta = { title: chosen.name, tone: chosen.tone || 'common', icon: chosen.icon || '📜', timestamp: Date.now() };
      // レアイベントまたは人生の転機となるイベントを記録
      if (chosen.tone === 'rare' || chosen.tone === 'good' || chosen.name.includes('決定') || chosen.name.includes('成功') || chosen.name.includes('結婚') || chosen.name.includes('誕生')) {
        state.majorEvents = state.majorEvents || [];
        state.majorEvents.push({ age: state.age, name: chosen.name, icon: chosen.icon || '📜' });
        // 最大10件まで記録
        if (state.majorEvents.length > 10) state.majorEvents.shift();
      }
      chosen.run(state);
      checkAchievements(state, { type: 'event', id: chosen.id });
    }
  } else {
    // 平凡イベント抽選（種別ごと）
    const kind = state.kind ?? 'human';
    const mundaneEvents = kind === 'animal' ? [
      { icon: '🐾', title: '縄張りチェック', text: '自分の縄張りを歩き回り、匂いで世界を確認した。' },
      { icon: '🍖', title: 'ごちそう', text: '骨や餌を見つけて満足した。' },
      { icon: '😴', title: '昼寝', text: 'ひなたで丸くなって気持ちよく眠った。' },
      { icon: '🏃', title: '走る', text: '原っぱを駆け回り、風を感じた。' },
      { icon: '🌧️', title: '雨宿り', text: '木陰で雨をやり過ごした。' },
    ] : kind === 'plant' ? [
      { icon: '🌞', title: '光合成', text: '太陽の光を浴び、静かに養分を蓄えた。' },
      { icon: '💧', title: '朝露', text: '葉に宿る露で潤いを得た。' },
      { icon: '🍂', title: '季節の移ろい', text: '風に揺られ、季節の変化を感じた。' },
      { icon: '🌬️', title: 'そよ風', text: 'やさしい風に身を任せた。' },
      { icon: '🪴', title: '芽吹き', text: '新芽が少し伸びた。' },
    ] : kind === 'object' ? [
      { icon: '🪨', title: '静けさ', text: '何もせず、ただそこに在り続けた。' },
      { icon: '🌧️', title: '雨に打たれる', text: '雨粒が表面を冷たく叩いた。' },
      { icon: '🌿', title: '苔が生える', text: '少しだけ苔が増えた気がした。' },
      { icon: '☀️', title: '日差し', text: '日光を浴びて温まった。' },
      { icon: '👣', title: '踏まれる', text: '誰かに踏まれたが、気にしない。' },
    ] : [
      { icon: '☕', title: 'いつもの日常', text: 'カフェでコーヒーを飲み、ゆったりした時間を過ごした。' },
      { icon: '📺', title: 'テレビの夜', text: 'お気に入りの番組を見て、穏やかな夜を過ごした。' },
      { icon: '🚶', title: '散歩', text: '近所を散歩して、気持ちをリフレッシュした。' },
      { icon: '📚', title: '読書の時間', text: '図書館で本を借りて、静かな週末を楽しんだ。' },
      { icon: '🍜', title: '外食', text: '近所のラーメン屋で美味しい一杯を堪能した。' },
      { icon: '🎮', title: 'ゲームの夜', text: 'ゲームをして、友人とオンラインで盛り上がった。' },
      { icon: '🌤️', title: '晴れた日曜', text: '天気の良い日、公園のベンチでのんびり過ごした。' },
      { icon: '🛒', title: '買い物', text: 'スーパーで食材を買い、夕飯の準備をした。' },
      { icon: '💤', title: '休息', text: '疲れた体を休めるため、ぐっすり眠った。' },
      { icon: '🎵', title: '音楽鑑賞', text: '好きな音楽を聴いて、リラックスした時間を過ごした。' },
    ];
    const chosen = pick(mundaneEvents);
    state.currentEventMeta = { title: chosen.title, tone: 'common', icon: chosen.icon, timestamp: Date.now() };
    logEvent(state, chosen.text);
  }
  // 突発死
  suddenDeaths(state);
  // 寿命チェック
  if (state.alive && state.age >= state.lifespan) {
    logEvent(state, '寿命を迎えた。長い人生だった。');
    die(state, '老衰');
  }
  // 健康死
  if (state.alive && state.stats.health <= 0) {
    logEvent(state, '体が限界を迎えた。最期までよく頑張った。');
    die(state, '健康ゼロ');
  }
  // 職業が未決なら適当に割り当て
  maybeAssignDefaultJob(state);
  // 年次の進行系実績
  checkAchievements(state, { type: 'tick' });
}

function tick() {
  if (!state?.alive) return stopLoop();
  
  // イベント表示の自動クリア（2秒後）
  if (state.currentEventMeta) {
    // timestampがない場合は即座にクリア（フェールセーフ）
    if (!state.currentEventMeta.timestamp) {
      console.warn(`[AGE ${state.age}] Event meta without timestamp detected: ${state.currentEventMeta.title}, clearing immediately`);
      state.currentEventMeta = null;
    } else {
      const elapsed = Date.now() - state.currentEventMeta.timestamp;
      if (elapsed > 2000) {
        console.log(`[AGE ${state.age}] Event cleared after ${elapsed}ms`);
        state.currentEventMeta = null;
      }
    }
  }
  
  // イベント表示中（カットイン中）はイベント進行を止める
  if (state.currentEventMeta === null) {
    applyYear(state);
  } else {
    console.log(`[AGE ${state.age}] Waiting for event to clear: ${state.currentEventMeta.title}`);
  }
  renderStats();
}

// イベント結び付け
function bindUI() {
  el.startAuto.addEventListener('click', startNewRun);
  
  // 対戦モード: 名前入力画面を表示
  if (el.startDuel) {
    el.startDuel.addEventListener('click', () => {
      el.gachaSection.classList.add('hidden');
      document.getElementById('duel-name-section').classList.remove('hidden');
    });
  }
  
  // 対戦モード: 名前入力確定ボタン
  const duelStartConfirm = document.getElementById('duel-start-confirm');
  if (duelStartConfirm) {
    duelStartConfirm.addEventListener('click', () => {
      const nameA = document.getElementById('player-a-name')?.value.trim() || 'プレイヤー A';
      const nameB = document.getElementById('player-b-name')?.value.trim() || 'プレイヤー B';
      document.getElementById('duel-name-section').classList.add('hidden');
      startDuel(nameA, nameB);
    });
  }
  
  // 対戦モード: 名前入力画面の戻るボタン
  const duelNameBack = document.getElementById('duel-name-back');
  if (duelNameBack) {
    duelNameBack.addEventListener('click', () => {
      document.getElementById('duel-name-section').classList.add('hidden');
      el.gachaSection.classList.remove('hidden');
    });
  }
  
  // 対戦モード: 停止ボタン
  if (el.duelStop) {
    el.duelStop.addEventListener('click', () => {
      stopDuel();
    });
  }
  
  // 対戦モード: ホームに戻るボタン
  if (el.duelBack) {
    el.duelBack.addEventListener('click', () => {
      stopDuel();
      el.duelSection.classList.add('hidden');
      el.gachaSection.classList.remove('hidden');
      // 結果表示があれば削除
      const results = el.duelSection.querySelectorAll('div[style*="grid-column"]');
      results.forEach(r => r.remove());
    });
  }

  el.pauseResume.addEventListener('click', () => {
    if (!timer) { 
      console.log('[CONTROL] Resuming game');
      startLoop(); 
      el.pauseResume.textContent = '一時停止'; 
    }
    else { 
      console.log('[CONTROL] Pausing game');
      stopLoop(); 
      el.pauseResume.textContent = '再開'; 
    }
  });


  el.speed.addEventListener('change', () => {
    const mult = parseFloat(el.speed.value);
    tickMs = Math.max(120, baseTickMs / mult);
    console.log(`[SPEED] Changed to ${mult}x (tickMs: ${tickMs}ms)`);
    if (state && state.alive) {
      startLoop(); // 生存中なら必ず再起動
    }
  });

  el.skip10.addEventListener('click', () => {
    if (!state?.alive) return;
    for (let i = 0; i < 10 && state.alive; i++) tick();
  });

  el.reset.addEventListener('click', () => {
    stopLoop();
    state = null;
    el.gachaSection.classList.remove('hidden');
    el.controlsSection.classList.add('hidden');
    el.logSection.classList.add('hidden');
    el.endingSection.classList.add('hidden');
    el.gachaResult.classList.add('hidden');
  });

  el.copyResult.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareText());
      el.copyResult.textContent = 'コピーしました！';
      setTimeout(() => (el.copyResult.textContent = '結果をコピー'), 1500);
    } catch {}
  });

  el.reincarnate.addEventListener('click', () => {
    el.endingSection.classList.add('hidden');
    el.gachaResult.classList.add('hidden');
    startNewRun();
  });

  const backHomeBtn = document.getElementById('back-home');
  if (backHomeBtn) {
    backHomeBtn.addEventListener('click', () => {
      stopLoop();
      state = null;
      el.gachaResult.classList.add('hidden');
      el.controlsSection.classList.add('hidden');
      el.logSection.classList.add('hidden');
      el.endingSection.classList.add('hidden');
      el.sceneSection?.classList.add('hidden');
      el.gachaSection.classList.remove('hidden');
    });
  }

  el.openDex.addEventListener('click', () => {
    renderDex();
    el.dexDialog.showModal();
  });
  el.closeDex.addEventListener('click', () => el.dexDialog.close());
}

function main() {
  bindUI();
  renderDex();
}

main();
