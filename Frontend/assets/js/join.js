// Join page logic: joins a PIN room, receives questions, sends answers, shows leaderboard.

(function(){
  const joinForm = document.getElementById('joinForm');
  const pinInput = document.getElementById('pinInput');
  const nickInput= document.getElementById('nickInput');
  const joinBtn  = document.getElementById('joinBtn');

  const playArea = document.getElementById('playArea');
  const pinEcho  = document.getElementById('pinEcho');
  const nickEcho = document.getElementById('nickEcho');

  const waiting  = document.getElementById('waiting');

  const qArea    = document.getElementById('qArea');
  const qText    = document.getElementById('qText');
  const optBtns  = document.getElementById('optBtns');
  const timeLeft = document.getElementById('timeLeft');

  const lbArea   = document.getElementById('lbArea');
  const lbList   = document.getElementById('lbList');

  const PARAMS = new URLSearchParams(location.search);
  let PIN   = (PARAMS.get('pin') || '').trim();
  let NICK  = (PARAMS.get('nick') || '').trim() || 'Player';

  let channel, me, answeredFor = new Set();
  let timerId = null;

  function startTimer(expireAt){
    clearInterval(timerId);
    timerId = setInterval(()=>{
      const ms = Math.max(0, expireAt - Date.now());
      const s = Math.ceil(ms / 1000);
      timeLeft.textContent = `Time left: ${s}s`;
      if (ms <= 0){ clearInterval(timerId); disableOptions(); }
    }, 200);
  }

  function disableOptions(){
    [...optBtns.querySelectorAll('button')].forEach(b => b.disabled = true);
  }

  function showJoin(){
    joinForm.style.display = 'block';
    playArea.style.display = 'none';
  }
  function showPlay(){
    joinForm.style.display = 'none';
    playArea.style.display = 'grid';
    pinEcho.textContent = PIN;
    nickEcho.textContent = NICK;
  }

  async function doJoin(){
    if (!PIN || PIN.length < 4){ alert('Enter a valid PIN'); return; }
    showPlay();

    me = { uid: BSRT.getUID(), nick: NICK, role: 'player' };
    channel = BSRT.openChannel(PIN, me);
    await channel.subscribe();
    await channel.trackPresence();

    // Question from host
    channel.onEvent('quiz:start', payload => {
      waiting.style.display = 'none';
      lbArea.style.display = 'none';

      const { qIndex, question, expireAt } = payload;
      answeredFor.delete(qIndex);

      qArea.style.display = 'block';
      qText.textContent = question.text || '';
      optBtns.innerHTML = (question.options || []).map((opt, i) =>
        `<button class="btn" data-choice="${i}" style="margin-bottom:6px;">${opt}</button>`
      ).join('');

      startTimer(expireAt);
    });

    // Leaderboard from host
    channel.onEvent('quiz:scoreboard', payload => {
      const list = payload.leaderboard || [];
      lbList.innerHTML = list.map(it => `<li>${it.nick || 'Player'} — <strong>${it.score}</strong></li>`).join('') || '<li class="muted">No scores yet.</li>';
      lbArea.style.display = 'block';
    });

    optBtns.addEventListener('click', async (ev)=>{
      const btn = ev.target.closest('button[data-choice]');
      if (!btn) return;
      const choice = Number(btn.dataset.choice);
      // Prevent multiple answers for same question (client-side)
      if (answeredFor.has(qText.textContent)) return;

      disableOptions();
      answeredFor.add(qText.textContent);

      await channel.emit('quiz:answer', {
        uid: me.uid, nick: me.nick,
        // Note: we don't have qIndex here directly; host matches by current qIndex
        // To be robust, we could add qIndex to payload from last 'quiz:start':
        // but since host updates only one question at a time, it's fine.
        qIndex: (window.__lastQIndex || 0),
        choice
      });
    });

    // Track last qIndex for safety
    channel.onEvent('quiz:start', payload => { window.__lastQIndex = payload.qIndex|0; });

    // Ready
    waiting.textContent = 'Waiting for host to start…';
  }

  // If pin/nick supplied via URL, auto-join
  if (PIN){
    nickInput.value = NICK;
    pinInput.value  = PIN;
    doJoin();
  } else {
    showJoin();
  }

  joinBtn.addEventListener('click', ()=>{
    PIN  = pinInput.value.trim();
    NICK = (nickInput.value || 'Player').trim();
    const query = new URLSearchParams({ pin: PIN, nick: NICK }).toString();
    history.replaceState(null, '', `?${query}`);
    doJoin();
  });

  window.addEventListener('beforeunload', ()=>{ try{ channel.unsubscribe(); }catch{} });
})();
