// ============================================================
//  KupaTakip — Ana Uygulama
// ============================================================

let RESULTS   = {};      // results.json'dan yüklenir
let FORM_DATA = null;    // form.json'dan yüklenir (form.js çalıştırıldıktan sonra)
let SIM_DATA  = null;    // sim_results.json'dan yüklenir (simulate.js çalıştırıldıktan sonra)
let STATE    = {};      // türetilmiş turnuva durumu
let SCORES   = {};      // katılımcı → puan bilgisi
let timelineChart = null;

// ── Türkçe yardımcılar ────────────────────────────────────
// Apostroftan sonra gelen ek (sayının okunuşundaki son sese göre)
function trNumSuffix(n) {
  if (n === 0) return "'ı";
  const last    = n % 10;
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 19) {
    return {11:"'i",12:"'si",13:"'ü",14:"'ü",15:"'i",16:"'sı",17:"'si",18:"'i",19:"'u"}[lastTwo] || "'i";
  }
  if (last === 0) {
    return {10:"'u",20:"'si",30:"'u",40:"'ı",50:"'si",60:"'ı",70:"'i",80:"'i",90:"'ı",100:"'ü"}[lastTwo] || "'i";
  }
  return {1:"'i",2:"'si",3:"'ü",4:"'ü",5:"'i",6:"'sı",7:"'si",8:"'i",9:"'u"}[last] || "'i";
}

// Takım adını yükleme halinde (accusative) döndürür
const TEAM_ACCUSATIVE = {
  "Fransa":"Fransa'yı", "İspanya":"İspanya'yı",
  "Arjantin":"Arjantin'i", "İngiltere":"İngiltere'yi", "Portekiz":"Portekiz'i"
};
function trAccusative(teamTR) { return TEAM_ACCUSATIVE[teamTR] || teamTR + "'i"; }

// ── Bootstrap ──────────────────────────────────────────────
async function init() {
  try {
    const res = await fetch('results.json?t=' + Date.now());
    RESULTS = await res.json();
  } catch(e) {
    RESULTS = {};
  }
  delete RESULTS._comment;

  try {
    const res = await fetch('form.json?t=' + Date.now());
    FORM_DATA = await res.json();
  } catch(e) {
    FORM_DATA = null;
  }

  STATE  = computeState(RESULTS);
  SCORES = computeScores(STATE);

  renderHero();
  renderUpcomingMatches();
  renderLeaderboard();
  renderBracket();
  renderTimeline();
  setupNav();
  setupAccordion();

  document.getElementById('loading-screen').classList.add('hidden');

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMatchModal();
  });
}

// ── Turnuva Durumu Hesapla ─────────────────────────────────
function computeState(results) {
  const winners = {};   // matchId → winning team (EN)
  const losers  = {};

  function getTeam(matchId, side) {
    const m = BRACKET[matchId];
    if (!m) return null;
    if (m.round === 'RO32') return side === 'home' ? m.home : m.away;
    const fromKey = side === 'home' ? m.homeFrom : m.awayFrom;
    return fromKey ? (winners[fromKey] || null) : null;
  }

  function resolveMatch(matchId) {
    if (winners[matchId] !== undefined) return;
    const m = BRACKET[matchId];
    if (!m) return;

    // Resolve dependencies first
    if (m.homeFrom) resolveMatch(m.homeFrom);
    if (m.awayFrom) resolveMatch(m.awayFrom);

    const home = getTeam(matchId, 'home');
    const away = getTeam(matchId, 'away');
    const result = results[matchId];

    if (result === 1 && home) { winners[matchId] = home; losers[matchId] = away; }
    else if (result === 2 && away) { winners[matchId] = away; losers[matchId] = home; }
    else { winners[matchId] = null; losers[matchId] = null; }
  }

  Object.keys(BRACKET).forEach(resolveMatch);

  // Build sets of teams at each stage (English names)
  const teamsInRO16   = new Set();
  const teamsInQF     = new Set();
  const teamsInSF     = new Set();
  const teamsInFinal  = new Set();
  let   champion      = null;

  // Teams that won a RO32 match are in RO16
  ['match_1','match_2','match_3','match_4','match_5','match_6','match_7','match_8',
   'match_9','match_10','match_11','match_12','match_13','match_14','match_15','match_16']
    .forEach(id => { if (winners[id]) teamsInRO16.add(winners[id]); });

  // Teams that won a RO16 match are in QF
  ['match_17','match_18','match_19','match_20','match_21','match_22','match_23','match_24']
    .forEach(id => { if (winners[id]) teamsInQF.add(winners[id]); });

  // Teams that won a QF match are in SF
  ['match_25','match_26','match_27','match_28']
    .forEach(id => { if (winners[id]) teamsInSF.add(winners[id]); });

  // Teams that won a SF match are in Final
  ['match_29','match_30']
    .forEach(id => { if (winners[id]) teamsInFinal.add(winners[id]); });

  // Champion
  if (winners['match_31']) champion = winners['match_31'];

  // Still-alive teams (reached highest stage and not eliminated yet)
  const eliminated = new Set(Object.values(losers).filter(Boolean));

  return { winners, losers, teamsInRO16, teamsInQF, teamsInSF, teamsInFinal, champion, eliminated };
}

// ── Puan Hesapla ──────────────────────────────────────────
function computeScores(state) {
  const scores = {};

  PARTICIPANTS.forEach(name => {
    const p = PREDICTIONS[name];
    const toEn = t => TR_TO_EN[t] || t;

    let pts = 0;
    const breakdown = { ro16: 0, qf: 0, sf: 0, final: 0, champion: 0 };

    p.ro16.forEach(t => { if (state.teamsInRO16.has(toEn(t))) { pts += 1; breakdown.ro16 += 1; }});
    p.qf.forEach(t   => { if (state.teamsInQF.has(toEn(t)))   { pts += 2; breakdown.qf   += 2; }});
    p.sf.forEach(t   => { if (state.teamsInSF.has(toEn(t)))   { pts += 3; breakdown.sf   += 3; }});
    p.final.forEach(t=> { if (state.teamsInFinal.has(toEn(t))){ pts += 5; breakdown.final += 5; }});
    if (state.champion && toEn(p.champion) === state.champion) {
      pts += 8; breakdown.champion = 8;
    }

    // Max possible
    let maxPts = pts;

    // RO16 remaining
    p.ro16.forEach(t => {
      const en = toEn(t);
      if (!state.teamsInRO16.has(en) && !state.eliminated.has(en)) maxPts += 1;
    });
    // QF remaining
    p.qf.forEach(t => {
      const en = toEn(t);
      if (!state.teamsInQF.has(en) && !state.eliminated.has(en)) maxPts += 2;
    });
    // SF remaining
    p.sf.forEach(t => {
      const en = toEn(t);
      if (!state.teamsInSF.has(en) && !state.eliminated.has(en)) maxPts += 3;
    });
    // Final remaining
    p.final.forEach(t => {
      const en = toEn(t);
      if (!state.teamsInFinal.has(en) && !state.eliminated.has(en)) maxPts += 5;
    });
    // Champion remaining
    if (!state.champion) {
      const en = toEn(p.champion);
      if (!state.eliminated.has(en)) maxPts += 8;
    }

    scores[name] = { pts, maxPts, breakdown };
  });

  return scores;
}

// ── Zaman Çizelgesi Puanları ──────────────────────────────
function computeTimelineData() {
  const matchOrder = [
    'match_1','match_2','match_3','match_4','match_5','match_6','match_7','match_8',
    'match_9','match_10','match_11','match_12','match_13','match_14','match_15','match_16',
    'match_17','match_18','match_19','match_20','match_21','match_22','match_23','match_24',
    'match_25','match_26','match_27','match_28',
    'match_29','match_30',
    'match_31'
  ];

  const matchLabels = {
    match_1:'Almanya-Paraguay', match_2:'Fransa-İsveç', match_3:'G.Afrika-Kanada',
    match_4:'Hollanda-Fas', match_5:'Portekiz-Hırvatistan', match_6:'İspanya-Avusturya',
    match_7:'ABD-Bosna H.', match_8:'Belçika-Senegal', match_9:'Brezilya-Japonya',
    match_10:'F.Sahilleri-Norveç', match_11:'Meksika-Ekvador', match_12:'İngiltere-K.Kongo',
    match_13:'Arjantin-Y.Burun A.', match_14:'Avustralya-Mısır', match_15:'İsviçre-Cezayir',
    match_16:'Kolombiya-Gana',
    match_17:'Son16-1', match_18:'Son16-2', match_19:'Son16-3', match_20:'Son16-4',
    match_21:'Son16-5', match_22:'Son16-6', match_23:'Son16-7', match_24:'Son16-8',
    match_25:'ÇF-1', match_26:'ÇF-2', match_27:'ÇF-3', match_28:'ÇF-4',
    match_29:'YF-1', match_30:'YF-2',
    match_31:'Final'
  };

  // Only include matches that have been played
  const playedMatches = matchOrder.filter(id => RESULTS[id] != null);

  const labels = ['Başlangıç', ...playedMatches.map(id => matchLabels[id] || id)];

  const top5 = [...PARTICIPANTS]
    .sort((a, b) => SCORES[b].pts - SCORES[a].pts)
    .slice(0, 5);

  const datasets = top5.map(name => {
    const i = PARTICIPANTS.indexOf(name);
    const data = [0];
    // Simulate state after each match
    for (let j = 0; j < playedMatches.length; j++) {
      const partialResults = {};
      playedMatches.slice(0, j + 1).forEach(id => { partialResults[id] = RESULTS[id]; });
      const partialState = computeState(partialResults);
      const partialScores = computeScores(partialState);
      data.push(partialScores[name].pts);
    }
    return {
      label: name.split(' ')[0],
      fullLabel: name,
      data,
      borderColor: PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length],
      backgroundColor: PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length] + '22',
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 6,
      tension: 0.3,
      fill: false
    };
  });

  return { labels, datasets };
}

// ── HERO - Kayan Kartlar ───────────────────────────────────
function renderHero() {
  const container = document.getElementById('hero-slides');
  const dotsEl    = document.getElementById('hero-dots');
  if (!container) return;

  // Editorial slides (prepended before team slides)
  const editorialSlides = [
    {
      type: 'editorial',
      photoUrl: '../docs_for_claude/asset_pictures/canada_goal_dramatic.jpg',
      bgPos: 'center top',
      content: `
        <div class="hero-label">Son 32 · İlk 48 Saat</div>
        <div class="hero-stat">SON 32,<br><span>SON DAKİKADA</span></div>
        <div style="font-size:13px;color:rgba(255,255,255,0.55);line-height:1.6;margin-bottom:10px;">
          İlk iki maç da son dakika golleri ile belirlendi.<br>Martinelli'nin golü 8 katılımcıyı 2 puanla<br>listenin üst kısmında tuttu.
        </div>`
    },
    {
      type: 'editorial',
      photoUrl: '../docs_for_claude/asset_pictures/paraguay_dramatic.jpg',
      bgPos: 'center 15%',
      content: `
        <div class="hero-label">Son 32 · 29 Haziran</div>
        <div class="hero-stat">PARAGUAY<br><span>İMKANSIZI BAŞARDI</span></div>
        <div style="font-size:13px;color:rgba(255,255,255,0.55);line-height:1.6;margin-bottom:10px;">
          Penaltılarla Almanya'yı eleyen Paraguay 17 üye için<br>puan kaybına sebep olurken Emin ve Emre'yi üste taşıdı.
        </div>`
    },
    {
      type: 'editorial',
      photoUrl: '../docs_for_claude/asset_pictures/netherlands_v_morocco_dramatic.jpg',
      bgPos: 'center 35%',
      content: `
        <div class="hero-label">Son 32 · 30 Haziran</div>
        <div class="hero-stat">13'E 6:<br><span>FAS</span></div>
        <div style="font-size:13px;color:rgba(255,255,255,0.55);line-height:1.6;margin-bottom:10px;">
          19 katılımcıdan 13'ü Fas'ı geçiriyor.<br>Hollanda'ya inanan sadece 6 kişi.
        </div>`
    }
  ];

  // Build team slides
  const slideData = [];

  Object.entries(DRAMATIC_PHOTOS).forEach(([teamEn, photoUrl]) => {
    const finalPickers = PARTICIPANTS.filter(name =>
      PREDICTIONS[name].final.some(t => (TR_TO_EN[t] || t) === teamEn)
    );
    const champPickers = PARTICIPANTS.filter(name =>
      (TR_TO_EN[PREDICTIONS[name].champion] || PREDICTIONS[name].champion) === teamEn
    );

    const pct = Math.round((finalPickers.length / PARTICIPANTS.length) * 100);
    const champPct = Math.round((champPickers.length / PARTICIPANTS.length) * 100);

    slideData.push({ type: 'team', teamEn, photoUrl, finalPickers, champPickers, pct, champPct });
  });

  slideData.sort((a,b) => b.champPct - a.champPct);

  const allSlides = [...editorialSlides, ...slideData];

  allSlides.forEach((s, i) => {
    const slide = document.createElement('div');
    slide.className = 'hero-slide' + (i === 0 ? ' active' : '');

    if (s.type === 'editorial') {
      slide.innerHTML = `
        <div class="hero-slide-bg" style="background-image:url('${s.photoUrl}');background-position:${s.bgPos};"></div>
        <div class="hero-content">${s.content}</div>
        <div class="hero-wc-logo">
          <img src="../docs_for_claude/asset_pictures/world_cup_icon.png" alt="FIFA World Cup 2026">
        </div>`;
    } else {
      const avatarsHtml = s.champPickers.slice(0,8).map(name =>
        `<img class="hero-avatar" src="${PARTICIPANT_PICS[name]}" alt="${name}" title="${name}" onerror="this.style.display='none'">`
      ).join('');

      const teamTR = toTR(s.teamEn);
      slide.innerHTML = `
        <div class="hero-slide-bg" style="background-image:url('${s.photoUrl}');${s.teamEn === 'Argentina' ? 'background-position:center 42%;' : ''}"></div>
        <div class="hero-content">
          <div class="hero-label">FIFA Dünya Kupası 2026 · #kupatakip</div>
          <div class="hero-stat">
            Katılımcıların <span>%${s.champPct}${trNumSuffix(s.champPct)}</span><br>${trAccusative(teamTR)}<br>şampiyon seçti
          </div>
          <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:6px;">
            %${s.pct}${trNumSuffix(s.pct)} finale çıkardı
          </div>
          ${avatarsHtml ? `<div class="hero-avatars">${avatarsHtml}</div>` : ''}
        </div>
        <div class="hero-wc-logo">
          <img src="../docs_for_claude/asset_pictures/world_cup_icon.png" alt="FIFA World Cup 2026">
        </div>`;
    }

    container.appendChild(slide);

    const dot = document.createElement('button');
    dot.className = 'hero-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', s.teamEn || s.type || String(i));
    dot.addEventListener('click', () => goToSlide(i));
    dotsEl.appendChild(dot);
  });

  let current = 0;
  const slides = container.querySelectorAll('.hero-slide');
  const dots   = dotsEl.querySelectorAll('.hero-dot');

  function goToSlide(n) {
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = (n + slides.length) % slides.length;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
  }

  // Auto-advance every 5 seconds
  setInterval(() => goToSlide(current + 1), 15000);
}

// ── LEADERBOARD ────────────────────────────────────────────
function renderLeaderboard() {
  const el = document.getElementById('leaderboard-body');
  if (!el) return;

  const sorted = [...PARTICIPANTS].sort((a,b) => {
    const diff = SCORES[b].pts - SCORES[a].pts;
    return diff !== 0 ? diff : SCORES[b].maxPts - SCORES[a].maxPts;
  });

  const maxScore      = Math.max(...sorted.map(n => SCORES[n].pts), 1);
  const currentTopPts = maxScore; // highest actual score right now

  el.innerHTML = '';

  sorted.forEach((name, i) => {
    const s = SCORES[name];
    const rank = i + 1;
    const isOut = s.maxPts < currentTopPts; // can't reach the current leader's score
    const rowClass = rank === 1 ? 'lb-gold' : rank === 2 ? 'lb-silver' : rank === 3 ? 'lb-bronze' : isOut ? 'lb-out' : '';

    const champEn  = TR_TO_EN[PREDICTIONS[name].champion] || PREDICTIONS[name].champion;
    const champFlag= flagUrl(champEn);
    const champTR  = toTR(champEn);

    const formCircles = (() => {
      const dots = FORM_DATA?.participants?.[name] ?? [null,null,null,null,null];
      return dots.map(v => {
        const cls = v === null ? 'form-dot-empty' : v ? 'form-dot-green' : 'form-dot-red';
        return `<span class="form-dot ${cls}"></span>`;
      }).join('');
    })();

    const row = document.createElement('div');
    row.className = `lb-row ${rowClass}`;
    row.innerHTML = `
      <div class="lb-rank">${rank}</div>
      <div class="lb-participant">
        <img class="lb-avatar" src="${PARTICIPANT_PICS[name]}" alt="${name}" onerror="this.style.background='#333'">
        <div style="min-width:0">
          <div class="lb-name">${name}</div>
          <div class="lb-form">${formCircles}</div>
        </div>
      </div>
      <div class="lb-champ">
        ${champFlag ? `<img src="${champFlag}" alt="${champTR}">` : ''}
        <span>${champTR}</span>
      </div>
      <div class="lb-pts-col">
        <div class="val">${s.pts}</div>
        <div class="lbl">Puan</div>
      </div>
      <div class="lb-pts-col">
        <div class="max-val">Maks: ${s.maxPts}</div>
        ${isOut ? '<div class="badge-out" style="margin-top:3px">dışarıda</div>' : ''}
      </div>`;
    el.appendChild(row);
  });
}

// ── UPCOMING MATCHES ───────────────────────────────────────
function renderUpcomingMatches() {
  const el = document.getElementById('upcoming-strip');
  if (!el) return;

  const now        = Date.now();
  const in24h      = now + 24 * 60 * 60 * 1000;
  const twoHoursMs = 2 * 60 * 60 * 1000;

  const upcoming = Object.entries(BRACKET)
    .filter(([id, m]) => {
      if (m.round !== 'RO32') return false;
      if (RESULTS[id] != null) return false;
      if (!m.datetime) return false;
      const t = new Date(m.datetime).getTime();
      return t >= now - twoHoursMs && t <= in24h;
    })
    .sort(([, a], [, b]) => new Date(a.datetime) - new Date(b.datetime));

  if (upcoming.length === 0) {
    el.style.display = 'none';
    return;
  }

  const cards = upcoming.map(([id, m]) => {
    const homeFlag = flagUrl(m.home);
    const awayFlag = flagUrl(m.away);
    const homeTR   = toTR(m.home);
    const awayTR   = toTR(m.away);
    const kickoff  = new Date(m.datetime).getTime();
    const isLive   = kickoff <= now;
    const timeStr  = isLive ? 'CANLI' : (m.time || '');

    return `
      <button class="upcoming-card${isLive ? ' live' : ''}" onclick="openMatchModal('${id}')">
        <div class="upcoming-time${isLive ? ' live-label' : ''}">${timeStr}</div>
        <div class="upcoming-matchup">
          <div class="upcoming-team">
            ${homeFlag ? `<img class="upcoming-flag" src="${homeFlag}" alt="${homeTR}" onerror="this.style.display='none'">` : ''}
            <span class="upcoming-name">${homeTR}</span>
          </div>
          <span class="upcoming-vs">VS</span>
          <div class="upcoming-team">
            ${awayFlag ? `<img class="upcoming-flag" src="${awayFlag}" alt="${awayTR}" onerror="this.style.display='none'">` : ''}
            <span class="upcoming-name">${awayTR}</span>
          </div>
        </div>
      </button>`;
  }).join('');

  el.innerHTML = `
    <div class="upcoming-label">Yaklaşan Maçlar · 24 Saat</div>
    <div class="upcoming-scroll">${cards}</div>`;
}

function openMatchModal(matchId) {
  const m = BRACKET[matchId];
  if (!m) return;

  const homeFlag = flagUrl(m.home);
  const awayFlag = flagUrl(m.away);
  const homeTR   = toTR(m.home);
  const awayTR   = toTR(m.away);
  const timeStr  = m.time || '';

  const homePickers = PARTICIPANTS.filter(name =>
    PREDICTIONS[name].ro16.some(t => (TR_TO_EN[t] || t) === m.home)
  );
  const awayPickers = PARTICIPANTS.filter(name =>
    PREDICTIONS[name].ro16.some(t => (TR_TO_EN[t] || t) === m.away)
  );

  const avatarRow = pickers => pickers.map(n =>
    `<img class="modal-picker-avatar" src="${PARTICIPANT_PICS[n]}" alt="${n}" title="${n}" onerror="this.style.display='none'">`
  ).join('');

  const teamCol = (flag, nameTR, pickers) => `
    <div class="modal-team">
      ${flag ? `<img class="modal-flag" src="${flag}" alt="${nameTR}" onerror="this.style.display='none'">` : ''}
      <div class="modal-team-name">${nameTR}</div>
      <div class="modal-pickers-label">Son 16'ya çıkardı</div>
      <div class="modal-pickers">${avatarRow(pickers)}</div>
      <div class="modal-picker-count">${pickers.length} kişi</div>
    </div>`;

  document.getElementById('modal-content').innerHTML = `
    <div class="modal-round-tag">Son 32 · ${m.date} · ${timeStr}</div>
    <div class="modal-teams">
      ${teamCol(homeFlag, homeTR, homePickers)}
      <div class="modal-vs">VS</div>
      ${teamCol(awayFlag, awayTR, awayPickers)}
    </div>`;

  document.getElementById('match-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeMatchModal() {
  document.getElementById('match-modal').classList.remove('open');
  document.body.style.overflow = '';
}

// ── BRACKET ────────────────────────────────────────────────
function renderBracket() {
  const container = document.getElementById('bracket-rounds');
  if (!container) return;
  container.innerHTML = '';

  // For each round, render each match
  BRACKET_ROUNDS.forEach(rnd => {
    const col = document.createElement('div');
    col.className = 'bracket-round-col';
    col.innerHTML = `<div class="bracket-round-label">${rnd.label}</div>`;

    const matchesDiv = document.createElement('div');
    matchesDiv.className = 'bracket-matches';

    rnd.matches.forEach(matchId => {
      const m = BRACKET[matchId];
      const homeTeam = resolveMatchTeam(matchId, 'home');
      const awayTeam = resolveMatchTeam(matchId, 'away');
      const winner   = STATE.winners[matchId];

      const matchEl = document.createElement('div');
      matchEl.className = 'bracket-match';

      // How many people backed each team to advance past THIS round
      const nextRoundKey = { 'RO32':'ro16', 'RO16':'qf', 'QF':'sf', 'SF':'final', 'Final':'champion' }[m.round] || 'ro16';

      function backersFor(teamEn) {
        if (!teamEn) return 0;
        return PARTICIPANTS.filter(name => {
          const p = PREDICTIONS[name];
          if (nextRoundKey === 'champion') return (TR_TO_EN[p.champion] || p.champion) === teamEn;
          return (p[nextRoundKey] || []).some(t => (TR_TO_EN[t] || t) === teamEn);
        }).length;
      }

      [homeTeam, awayTeam].forEach(team => {
        const teamDiv = document.createElement('div');
        const isWinner     = team && team === winner;
        const isEliminated = team && winner && !isWinner;
        const isTbd        = !team;

        teamDiv.className = `bracket-team ${isWinner ? 'winner' : ''} ${isEliminated ? 'eliminated' : ''} ${isTbd ? 'tbd' : ''}`;

        const flagSrc    = team ? flagUrl(team) : null;
        const teamNameTR = team ? toTR(team) : '?';
        const count      = backersFor(team);
        const countHtml  = (team && count > 0) ? `<span class="bracket-pick-count" title="${count} kişi bu takımı seçti">${count}</span>` : '';

        teamDiv.innerHTML = `
          ${flagSrc ? `<img class="bracket-flag" src="${flagSrc}" alt="${teamNameTR}" onerror="this.style.display='none'">` : '<div style="width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,0.05)"></div>'}
          <span class="bracket-team-name">${teamNameTR}</span>
          ${countHtml}
          ${isWinner ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="flex-shrink:0"><path d="M20 6L9 17l-5-5" stroke="#D4AF37" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
        `;
        matchEl.appendChild(teamDiv);
      });

      matchesDiv.appendChild(matchEl);
    });

    col.appendChild(matchesDiv);
    container.appendChild(col);
  });
}

function resolveMatchTeam(matchId, side) {
  const m = BRACKET[matchId];
  if (!m) return null;
  if (m.round === 'RO32') return side === 'home' ? m.home : m.away;
  const fromKey = side === 'home' ? m.homeFrom : m.awayFrom;
  return fromKey ? (STATE.winners[fromKey] || null) : null;
}

// ── TIMELINE ───────────────────────────────────────────────
function renderTimeline() {
  const canvas = document.getElementById('timeline-chart');
  if (!canvas) return;

  const { labels, datasets } = computeTimelineData();

  if (timelineChart) timelineChart.destroy();

  if (labels.length <= 1) {
    canvas.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--text-muted);font-size:13px;">İlk maç sonucu girilince grafik burada belirecek.</div>';
    return;
  }

  timelineChart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#9ca3af', font: { size: 11 }, boxWidth: 12, padding: 12 }
        },
        tooltip: {
          backgroundColor: 'rgba(7,9,15,0.95)',
          borderColor: 'rgba(212,175,55,0.3)',
          borderWidth: 1,
          titleColor: '#D4AF37',
          bodyColor: '#e8eaf0',
          callbacks: {
            title: items => items[0].label,
            label: item => ` ${item.dataset.fullLabel}: ${item.raw} puan`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#6b7280', font: { size: 10 }, maxRotation: 45 },
          grid: { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          ticks: { color: '#6b7280', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.06)' },
          beginAtZero: true
        }
      }
    }
  });
}

// ── POSSİBİLİTY GRİD ───────────────────────────────────────
function renderPossibility() {
  const el = document.getElementById('possibility-tbody');
  if (!el) return;

  const sorted = [...PARTICIPANTS].sort((a,b) => SCORES[b].pts - SCORES[a].pts);
  const currentTopPts = Math.max(...sorted.map(n => SCORES[n].pts), 0);

  el.innerHTML = '';

  sorted.forEach((name, i) => {
    const s = SCORES[name];
    const isOut = s.maxPts < currentTopPts;
    const isLeader = i === 0 && s.pts > 0;
    const champEn  = TR_TO_EN[PREDICTIONS[name].champion] || PREDICTIONS[name].champion;
    const champTR  = toTR(champEn);
    const champEliminated = STATE.eliminated.has(champEn);
    const champWon = STATE.champion === champEn;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="poss-participant">
          <img class="poss-avatar" src="${PARTICIPANT_PICS[name]}" alt="${name}" onerror="this.style.background='#333'">
          <span>${name}</span>
          ${isLeader ? '<span class="badge-leader" style="margin-left:6px">LİDER</span>' : ''}
          ${isOut ? '<span class="badge-out" style="margin-left:6px">dışarıda</span>' : ''}
        </div>
      </td>
      <td class="pts-current">${s.pts}</td>
      <td class="pts-max">${s.maxPts}</td>
      <td>${s.breakdown.ro16} <span style="color:var(--text-muted)">/ ${PREDICTIONS[name].ro16.length}</span></td>
      <td>${s.breakdown.qf / 2} <span style="color:var(--text-muted)">/ ${PREDICTIONS[name].qf.length}</span></td>
      <td>${s.breakdown.sf / 3} <span style="color:var(--text-muted)">/ ${PREDICTIONS[name].sf.length}</span></td>
      <td>${s.breakdown.final / 5} <span style="color:var(--text-muted)">/ ${PREDICTIONS[name].final.length}</span></td>
      <td>
        <span style="color:${champWon ? 'var(--gold)' : champEliminated ? 'var(--red)' : 'var(--text-muted)'}">
          ${champTR} ${champWon ? '🏆' : champEliminated ? '✗' : '?'}
        </span>
      </td>`;
    el.appendChild(tr);
  });
}

// ── STATİSTİKLER ───────────────────────────────────────────
function renderStats() {
  renderMostPickedChampion();
  renderMostPickedFinal();
  renderUpsetTeams();
  renderDarkHorses();
}

function teamPickCounts(pickFn) {
  const counts = {};
  PARTICIPANTS.forEach(name => {
    const teams = pickFn(PREDICTIONS[name]);
    teams.forEach(t => {
      const en = TR_TO_EN[t] || t;
      counts[en] = (counts[en] || 0) + 1;
    });
  });
  return Object.entries(counts).sort((a,b) => b[1]-a[1]);
}

function renderMostPickedChampion() {
  const el = document.getElementById('stat-champion-picks');
  if (!el) return;
  const counts = teamPickCounts(p => [p.champion]);
  el.innerHTML = counts.slice(0,6).map(([team, count]) => teamStatRow(team, count, PARTICIPANTS.length)).join('');
}

function renderMostPickedFinal() {
  const el = document.getElementById('stat-final-picks');
  if (!el) return;
  const counts = teamPickCounts(p => p.final);
  el.innerHTML = counts.slice(0,6).map(([team, count]) => teamStatRow(team, count, PARTICIPANTS.length * 2)).join('');
}

function renderUpsetTeams() {
  const el = document.getElementById('stat-upsets');
  if (!el) return;

  // Teams that made it through but few people predicted
  const upsets = [];
  STATE.teamsInRO16.forEach(team => {
    const pickers = PARTICIPANTS.filter(name =>
      PREDICTIONS[name].ro16.some(t => (TR_TO_EN[t] || t) === team)
    ).length;
    if (pickers <= 3) upsets.push({ team, pickers, stage: 'Son 16' });
  });
  STATE.teamsInQF.forEach(team => {
    const pickers = PARTICIPANTS.filter(name =>
      PREDICTIONS[name].qf.some(t => (TR_TO_EN[t] || t) === team)
    ).length;
    if (pickers <= 4) upsets.push({ team, pickers, stage: 'Çeyrek' });
  });

  if (upsets.length === 0) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:10px 0">Henüz sürpriz yok.</div>';
    return;
  }

  el.innerHTML = upsets.slice(0,6).map(u => `
    <div class="stat-team-row">
      ${flagUrl(u.team) ? `<img class="stat-flag" src="${flagUrl(u.team)}" alt="${toTR(u.team)}">` : ''}
      <span class="stat-team-name">${toTR(u.team)}</span>
      <span class="stat-count">${u.pickers} kişi</span>
      <span style="font-size:11px;color:var(--gold)">${u.stage}</span>
    </div>`).join('');
}

function renderDarkHorses() {
  const el = document.getElementById('stat-dark-horses');
  if (!el) return;

  // Teams predicted by 1-2 people to win the tournament
  const darkHorses = teamPickCounts(p => [p.champion]).filter(([,c]) => c <= 2);

  if (darkHorses.length === 0) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:10px 0">Herkes popüler takımlara güvenmiş!</div>';
    return;
  }

  el.innerHTML = darkHorses.slice(0,6).map(([team, count]) => {
    const backers = PARTICIPANTS.filter(name =>
      (TR_TO_EN[PREDICTIONS[name].champion] || PREDICTIONS[name].champion) === team
    );
    return `
    <div class="stat-team-row">
      ${flagUrl(team) ? `<img class="stat-flag" src="${flagUrl(team)}" alt="${toTR(team)}">` : ''}
      <span class="stat-team-name">${toTR(team)}</span>
      <div style="display:flex;gap:3px">
        ${backers.map(n => `<img src="${PARTICIPANT_PICS[n]}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;border:1px solid var(--glass-border)" title="${n}" onerror="this.style.display='none'">`).join('')}
      </div>
    </div>`;
  }).join('');
}

function teamStatRow(teamEn, count, total) {
  const pct = Math.round((count / total) * 100);
  return `
  <div class="stat-team-row">
    ${flagUrl(teamEn) ? `<img class="stat-flag" src="${flagUrl(teamEn)}" alt="${toTR(teamEn)}">` : ''}
    <span class="stat-team-name">${toTR(teamEn)}</span>
    <div class="stat-bar-outer"><div class="stat-bar-inner" style="width:${pct}%"></div></div>
    <span class="stat-count">${count}</span>
    <span class="stat-pct">%${pct}</span>
  </div>`;
}

// ── KİŞİSEL TAHMİNLER ─────────────────────────────────────
function renderPersonalBrackets() {
  const tabsEl = document.getElementById('pb-tabs');
  if (!tabsEl) return;

  PARTICIPANTS.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.className = 'pb-tab' + (i === 0 ? ' active' : '');
    const firstName = name.split(' ')[0];
    btn.innerHTML = `<img src="${PARTICIPANT_PICS[name]}" alt="${name}" onerror="this.style.display='none'"><span>${firstName}</span>`;
    btn.addEventListener('click', () => {
      tabsEl.querySelectorAll('.pb-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      renderPbPanel(name);
    });
    tabsEl.appendChild(btn);
  });

  renderPbPanel(PARTICIPANTS[0]);
}

function getPbStatus(teamEn, stageSet) {
  if (stageSet && stageSet.has(teamEn)) return 'correct';
  if (STATE.eliminated.has(teamEn)) return 'wrong';
  return 'pending';
}

function renderPbPanel(name) {
  const panelEl = document.getElementById('pb-panel');
  if (!panelEl) return;
  const p    = PREDICTIONS[name];
  const toEn = t => TR_TO_EN[t] || t;

  const ro16En  = p.ro16.map(toEn);
  const qfEn    = p.qf.map(toEn);
  const sfEn    = p.sf.map(toEn);
  const finalEn = p.final.map(toEn);
  const champEn = toEn(p.champion);

  // Predictions are ordered to mirror the actual bracket topology:
  // ro16[0,1] meet in RO16 → predicted winner is qf[0]; ro16[2,3] → qf[1]; etc.
  const rounds = [
    {
      label: 'Son 16', stageSet: STATE.teamsInRO16,
      matches: Array.from({ length: 8 }, (_, i) => ({
        home: ro16En[i * 2], away: ro16En[i * 2 + 1], winner: qfEn[i]
      }))
    },
    {
      label: 'Çeyrek Final', stageSet: STATE.teamsInQF,
      matches: Array.from({ length: 4 }, (_, i) => ({
        home: qfEn[i * 2], away: qfEn[i * 2 + 1], winner: sfEn[i]
      }))
    },
    {
      label: 'Yarı Final', stageSet: STATE.teamsInSF,
      matches: Array.from({ length: 2 }, (_, i) => ({
        home: sfEn[i * 2], away: sfEn[i * 2 + 1], winner: finalEn[i]
      }))
    },
    {
      label: 'Final', stageSet: STATE.teamsInFinal,
      matches: [{ home: finalEn[0], away: finalEn[1], winner: champEn }]
    },
  ];

  const arrowSvg = '<svg class="pb-winner-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const checkSvg = '<svg class="pb-winner-arrow" width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#D4AF37" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  let html = '<div class="pb-bracket-rounds">';

  rounds.forEach(r => {
    html += '<div class="pb-bracket-col"><div class="pb-bracket-label">' + r.label + '</div><div class="pb-bracket-matches">';
    r.matches.forEach(m => {
      html += '<div class="pb-bracket-match">';
      [m.home, m.away].forEach(teamEn => {
        const isPredWinner = teamEn === m.winner;
        const status       = getPbStatus(teamEn, r.stageSet);
        const flag         = flagUrl(teamEn);
        const teamTR       = toTR(teamEn);
        html += '<div class="pb-bracket-team ' + status + (isPredWinner ? ' pred-winner' : '') + '">'
          + (flag ? '<img src="' + flag + '" alt="' + teamTR + '">' : '')
          + '<span>' + teamTR + '</span>'
          + (isPredWinner ? arrowSvg : '')
          + '</div>';
      });
      html += '</div>';
    });
    html += '</div></div>';
  });

  // Champion column
  const champStatus = STATE.champion === champEn ? 'correct'
    : (STATE.eliminated.has(champEn) || (STATE.champion && STATE.champion !== champEn)) ? 'wrong'
    : 'pending';
  const champTR = toTR(champEn);
  const champFlag = flagUrl(champEn);

  html += '<div class="pb-bracket-col pb-champ-col"><div class="pb-bracket-label">Şampiyon</div><div class="pb-bracket-matches"><div class="pb-bracket-match">'
    + '<div class="pb-bracket-team pred-winner ' + champStatus + '">'
    + (champFlag ? '<img src="' + champFlag + '" alt="' + champTR + '">' : '')
    + '<span>' + champTR + '</span>'
    + (champStatus === 'correct' ? checkSvg : '')
    + '</div></div></div></div>';

  html += '</div>';
  panelEl.innerHTML = html;
}

// ── ACCORDION ─────────────────────────────────────────────
function setupAccordion() {
  const sections  = document.querySelectorAll('section[id]');
  const chevronSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  sections.forEach(section => {
    const header = section.querySelector('.section-header');
    const body   = section.querySelector('.section-body');
    if (!header || !body) return;

    const chevron = document.createElement('div');
    chevron.className = 'section-chevron';
    chevron.innerHTML = chevronSvg;
    header.appendChild(chevron);

    header.addEventListener('click', () => {
      const opening = !body.classList.contains('open');
      body.classList.toggle('open');
      header.classList.toggle('section-open');
      if (opening && section.id === 'timeline' && timelineChart) {
        setTimeout(() => timelineChart.resize(), 420);
      }
    });
  });

  // Nav links open their target section without touching others
  document.querySelectorAll('.site-nav a[href^="#"]').forEach(link => {
    link.addEventListener('click', () => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        const body   = target.querySelector('.section-body');
        const header = target.querySelector('.section-header');
        if (body && !body.classList.contains('open')) {
          body.classList.add('open');
          header?.classList.add('section-open');
          if (target.id === 'timeline' && timelineChart) {
            setTimeout(() => timelineChart.resize(), 420);
          }
        }
      }
    });
  });

  // Open leaderboard by default
  const lb = document.getElementById('leaderboard');
  if (lb) {
    lb.querySelector('.section-body')?.classList.add('open');
    lb.querySelector('.section-header')?.classList.add('section-open');
  }
}

// ── NAV ────────────────────────────────────────────────────
function setupNav() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.site-nav a');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(a => {
          a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id);
        });
      }
    });
  }, { rootMargin: '-30% 0px -60% 0px' });

  sections.forEach(s => observer.observe(s));
}

// ── Start ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', init);
