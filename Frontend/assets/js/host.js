// Host page logic: generates PIN, manages presence, sends questions, computes leaderboard.

(function(){
  const qTitleEl = document.getElementById('quizTitle');
  const pinText  = document.getElementById('pinText');
  const players  = document.getElementById('playersList');
  const statusEl = document.getElementById('status');

  const qBox   = document.getElementById('questionBox');
  const qText  = document.getElementById('qText');
  const optLis = document.getElementById('optList');
  const tally  = document.getElementById('tally');

  const lbBox  = document.getElementById('leaderboardBox');
  const lbList = document.getElementById('lbList');

  const startBtn = document.getElementById('startBtn');
  const nextBtn  = document.getElementById('nextBtn');
  const showLbBtn= document.getElementById('showLbBtn');

  const PARAMS = new URLSearchParams(location.search);
  const QUIZ_ID = PARAMS.get('id');
  let PIN = (Math.floor(100000 + Math.random()*900000)).toString();

  const BASES = ['../data/','/data/','./data/','/Frontend/data/'];

  async function fetchJSON(paths, file){
    for (const base of paths){
      try{ const res = await fetch(base + file, { cache:'no-store' }); if (res.ok) return res.json(); }catch{}
    }
    throw new Error('Could not load '+file);
  }
  async function loadManifest(){
    const raw = await fetchJSON(BASES, 'quizzes.manifest.json');
    return raw?.files ? raw : { files: raw };
  }
  async function loadQuizById(id){
    const man = await loadManifest();
    const files = Object.values(man.files || {});
    for (const f of files){
      const arr = await fetchJSON(BASES, f);
      const q = (arr || []).find(x => x.id === id);
      if (q) return q;
    }
    throw new Error('Quiz not found: '+id);
  }

  // State
  let channel, me, quiz, qIndex = 0;
  const scores = new Map();        // uid -> { nick, score }
  const answersFor = new Map();    // qIndex -> Map<optionIndex, count>
  const correctIndexFor = new Map(); // qIndex -> correct index

  function renderPlayers(list){
    players.innerHTML = list
      .filter(p => p.role !== 'host')
      .map(p => `<li>${p.nick || 'Player'}</li>`).join('') || '<li class="muted">No players yet.</li>';
  }

  function setStatus(msg){ statusEl.textContent = msg; }

  function showQuestion(q){
    qBox.style.display = 'block';
    lbBox.style.display = 'none';
    qText.textContent = q.question;
    optLis.innerHTML = (q.options || []).map((opt, i)=>`<li>${opt}</li>`).join('');
    tally.textContent = 'No answers yet.';
  }

  function updateTally(){
    const aMap = answersFor.get(qIndex) || new Map();
    const total = Array.from(aMap.values()).reduce((a,b)=>a+b,0);
    if (total === 0){ tally.textContent = 'No answers yet.'; return; }
    const parts = [];
    aMap.forEach((count, idx) => parts.push(`Option ${idx+1}: ${count}`));
    tally.textContent = parts.join('  •  ');
  }

  function computeLeaderboard(){
    const arr = Array.from(scores.entries()).map(([uid, val]) => ({ uid, nick: val.nick, score: val.score|0 }));
    arr.sort((a,b) => b.score - a.score);
    return arr;
  }

  async function broadcastLeaderboard(){
    const lb = computeLeaderboard();
    await channel.emit('quiz:scoreboard', { leaderboard: lb });
    // Also show on host
    lbBox.style.display = 'block';
    qBox.style.display  = 'none';
    lbList.innerHTML = lb.map(it => `<li>${it.nick || 'Player'} — <strong>${it.score}</strong></li>`).join('') || '<li class="muted">No scores yet.</li>';
  }

  async function sendQuestion(idx){
    const q = quiz.questions[idx];
    const now = Date.now();
    const durationMs = 30000; // 30s per question (simple for now)
    const expireAt = now + durationMs;

    correctIndexFor.set(idx, q.answer_index ?? 0);
    answersFor.set(idx, new Map());

    showQuestion(q);
    setStatus(`Question ${idx+1} of ${quiz.questions.length}`);
    nextBtn.disabled = true;
    showLbBtn.disabled = true;

    await channel.emit('quiz:start', {
      quizId: quiz.id,
      qIndex: idx,
      question: { text: q.question, options: q.options },
      expireAt
    });

    // Auto-enable "Next" when time is up
    setTimeout(() => {
      nextBtn.disabled = false;
      showLbBtn.disabled = false;
    }, durationMs);
  }

  function handleAnswer(payload){
    const { uid, nick, qIndex: qi, choice } = payload;
    if (qi !== qIndex) return;
    // tally
    const aMap = answersFor.get(qi) || new Map();
    aMap.set(choice, (aMap.get(choice) || 0) + 1);
    answersFor.set(qi, aMap);
    updateTally();

    // scoring
    const correct = correctIndexFor.get(qi);
    const isCorrect = Number(choice) === Number(correct);
    const current = scores.get(uid) || { nick, score: 0 };
    if (isCorrect) current.score += 100;
    scores.set(uid, current);
  }

  async function init(){
    if (!QUIZ_ID){
      qTitleEl.textContent = 'No quiz selected. Open from Library.';
      startBtn.disabled = true;
      return;
    }

    try {
      quiz = await loadQuizById(QUIZ_ID);
      qTitleEl.textContent = quiz.title || QUIZ_ID;
    } catch (e){
      qTitleEl.textContent = 'Failed to load quiz.';
      console.error(e);
      startBtn.disabled = true;
      return;
    }

    pinText.textContent = PIN;

    me = { uid: BSRT.getUID(), nick: 'Host', role: 'host' };
    channel = BSRT.openChannel(PIN, me);

    channel.onPresence(renderPlayers);
    channel.onEvent('quiz:answer', handleAnswer);

    await channel.subscribe();
    await channel.trackPresence();

    setStatus('Share the PIN. Click Start when ready.');
  }

  startBtn.addEventListener('click', async ()=>{
    qIndex = 0;
    scores.clear();
    answersFor.clear();
    await sendQuestion(qIndex);
  });

  nextBtn.addEventListener('click', async ()=>{
    if (qIndex + 1 < quiz.questions.length){
      qIndex += 1;
      await sendQuestion(qIndex);
    } else {
      setStatus('Quiz finished.');
      await broadcastLeaderboard();
      nextBtn.disabled = true;
    }
  });

  showLbBtn.addEventListener('click', async ()=>{
    await broadcastLeaderboard();
  });

  window.addEventListener('beforeunload', ()=>{ try{ channel.unsubscribe(); }catch{} });

  init();
})();

