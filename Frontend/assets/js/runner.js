/* Frontend/assets/js/runner.js (compat)
   Solo play engine:
   - Load quiz by id OR build a 5-Q Daily Deck from last selected grade
   - Timer, scoring, streaks, coins
   - Power-ups: Bet ×2, Freeze (20s), Jump
   - Saves progress in localStorage (key: beyondscool_profile)
   - Loads quizzes from Supabase database
*/

/* ---------- Import Supabase ---------- */
import { supabase } from './supabaseClient.js';

/* ---------- DOM helpers & URL params ---------- */
function qs(s){ return document.querySelector(s); }
var url = new URL(location.href);
var qp = url.searchParams;
var quizId = qp.get('id');
var isDaily = qp.get('daily') === '1';

/* ---------- Config ---------- */
var DEFAULT_TIMER = 60;      // seconds per question
var BET_CHOICES = [5, 10, 20];
var FREEZE_WINDOW_S = 20;
var JUMP_FREE = 1;
var JUMP_COST = 10;

/* Data search paths (keep all of them) */
var BASES = [
  './data/',
  '../data/',
  '/data/',
  '/Frontend/data/'
];

/* ---------- Fetch helpers ---------- */
async function fetchJSON(paths, file){
  for (var i=0;i<paths.length;i++){
    var base = paths[i];
    try{
      var res = await fetch(base + file, { cache: 'no-store' });
      if (res.ok) return res.json();
    } catch (e) {}
  }
  throw new Error('Could not load ' + file);
}

async function loadManifest(){
  var raw = await fetchJSON(BASES, 'quizzes.manifest.json');
  // supports {files:{...}} or flat object
  return raw && raw.files ? raw : { files: raw };
}

function pad2(n){ n = String(n); return n.length===1 ? '0'+n : n; }

function findGradeFile(man, grade){
  var t = man.files || man;
  var g = String(grade), g2 = pad2(grade);
  var direct = t[g] || t[Number(g)] || t['g'+g2] || t['grade'+g] || t['grade-'+g];
  if (direct) return direct;
  var vals = Object.values(t);
  for (var i=0;i<vals.length;i++){
    var v = vals[i];
    if (typeof v === 'string' && (v.indexOf('g'+g2)>-1 || v.indexOf('grade'+g)>-1 || v.indexOf('grade-'+g)>-1)){
      return v;
    }
  }
  return null;
}

async function loadGradeFile(grade){
  var man = await loadManifest();
  var file = findGradeFile(man, grade);
  if (!file) return [];
  var arr = await fetchJSON(BASES, file);
  return Array.isArray(arr) ? arr : [];
}

async function findQuizById(id){
  try {
    // Load quiz from Supabase
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', id)
      .single();

    if (quizError) throw quizError;

    // Load questions for this quiz
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', id)
      .order('id');

    if (questionsError) throw questionsError;

    return {
      ...quiz,
      questions: questions || []
    };
  } catch (error) {
    console.error('Error loading quiz:', error);
    return null;
  }
}

/* ---------- Profile (coins, streak) ---------- */
var PROFILE_KEY = 'beyondscool_profile';
var profile = { coins:0, streak:0, last_daily:null, character:null };

async function loadProfile(){
  try{
    // First try to load from localStorage for offline support
    var localProfile = JSON.parse(localStorage.getItem(PROFILE_KEY)) || { coins:0, streak:0, last_daily:null, character:null };
    
    // Try to load from Supabase if user is logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      try {
        const { data: userProfile, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single();
        
        if (!error && userProfile) {
          profile = {
            coins: userProfile.coins || 0,
            streak: userProfile.streak || 0,
            last_daily: userProfile.last_daily,
            character: userProfile.character
          };
        } else {
          // Table might not exist or no profile found, use local profile
          console.log('No database profile found, using local profile');
          profile = localProfile;
        }
      } catch (dbError) {
        console.log('Database error, using local profile:', dbError.message);
        profile = localProfile;
      }
    } else {
      profile = localProfile;
    }
    
    // Update UI
    var coinsEl = qs('#coinsVal'); 
    if (coinsEl) coinsEl.textContent = profile.coins || 0;
    
    return profile;
  }catch(e){
    console.error('Error loading profile:', e);
    profile = { coins:0, streak:0, last_daily:null, character:null };
    return profile;
  }
}

async function saveProfile(p){
  try{ 
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    
    // Also save to database if user is logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      try {
        await saveProfileToDatabase(p, session.user.id);
      } catch (dbError) {
        console.log('Database save failed, profile saved locally:', dbError.message);
      }
    }
  }catch(e){
    console.error('Error saving profile:', e);
  }
}

async function saveProfileToDatabase(p, userId){
  try {
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        coins: p.coins || 0,
        streak: p.streak || 0,
        last_daily: p.last_daily,
        character: p.character,
        updated_at: new Date().toISOString()
      });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error saving profile to database:', error);
  }
}

function todayISO(){ return new Date().toISOString().slice(0,10); }
function ydayISO(){ var d=new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); }

/* ---------- UI state ---------- */
var state = {
  quiz: null,
  index: 0,
  total: 0,
  score: 0,
  coinsEarned: 0,
  streak: 0,
  bestStreak: 0,
  timer: DEFAULT_TIMER,
  tHandle: null,
  startTs: 0,
  freezeUntil: 0,
  jumpsLeft: JUMP_FREE,
  bet: null,      // {amount, used:true}
  locked: false
};

function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }

/* ---------- Scoring ---------- */
function scoreFor(timeMs, correct){
  if (!correct) return 0;
  var t = timeMs/1000;
  var timeMult = clamp(1.10 - 0.03*t, 0.20, 1.10);
  var base = Math.round(100 * timeMult);
  var streakMult = clamp(1 + 0.10 * Math.max(0, state.streak - 1), 1, 1.5);
  var pts = Math.round(base * streakMult);
  if (state.bet && state.bet.used) pts *= 2;
  return pts;
}
function coinGainFrom(pts, correct){
  var gain = correct ? (state.quiz?.coins_per_answer || 5) : 0;
  if (correct && state.bet && state.bet.used) gain += state.bet.amount;
  return gain;
}

/* ---------- Rendering & Timer ---------- */
function setTimer(v){
  state.timer = v;
  var t = qs('#tval'); if (t) t.textContent = String(v);
}
function tick(){
  setTimer(state.timer - 1);
  var freezeBtn = qs('#pu-freeze');
  if (freezeBtn){
    freezeBtn.textContent = (Date.now()<state.freezeUntil) ? 'Freeze ON' : 'Freeze (20s)';
  }
  if (state.timer <= 0) onAnswer(-1);
}

function renderQuestion(){
  var q = state.quiz.questions[state.index];
  var qh = qs('#qz-question'); if (qh) qh.textContent = 'Q'+(state.index+1)+'/'+state.total+': '+q.question_text;

  var box = qs('#qz-options'); if (box) box.innerHTML = '';
  for (var i=0;i<q.options.length;i++){
    var opt = q.options[i];
    var b = document.createElement('button');
    b.className = 'qz-opt';
    b.textContent = opt;
    b.onclick = (function(idx){ return function(){ onAnswer(idx); }; })(i);
    box.appendChild(b);
  }

  var fb = qs('#qz-feedback'); if (fb) fb.textContent = '';
  state.locked = false;
  state.bet = null;
  setTimer(DEFAULT_TIMER);
  state.startTs = performance.now();
  if (state.tHandle) clearInterval(state.tHandle);
  state.tHandle = setInterval(tick, 1000);

  updateNav();
}

function updateNav(){
  var prev = qs('#btn-prev');
  var next = qs('#btn-next');
  var finish = qs('#btn-finish');
  if (prev) prev.disabled = state.index===0;
  var isLast = state.index === state.total - 1;
  if (next) next.classList.toggle('hidden', isLast);
  if (finish) finish.classList.toggle('hidden', !isLast);
}

/* ---------- Feedback ---------- */
function showMeme(correct, timeMs){
  var speed = timeMs<=5000 ? '🔥 blazing' :
              timeMs<=15000? '⚡ fast'    :
              timeMs<=30000? '🙂 steady'  : '🐢 slow';
  var fb = qs('#qz-feedback');
  if (fb) fb.textContent = correct ? ('Nice! ' + speed) : 'Oops. Keep going!';
}

/* ---------- Answer handling ---------- */
function onAnswer(choiceIndex){
  if (state.locked) return;
  state.locked = true;
  if (state.tHandle) clearInterval(state.tHandle);

  var q = state.quiz.questions[state.index];
  var correctIdx = q.correct_answer;

  var box = qs('#qz-options');
  var btns = box ? Array.prototype.slice.call(box.children) : [];

  var answered = choiceIndex >= 0;
  var correct = answered && (choiceIndex === correctIdx);

  if (answered && btns[choiceIndex]) btns[choiceIndex].classList.add(correct ? 'correct' : 'wrong');
  if (btns[correctIdx]) btns[correctIdx].classList.add('correct');

  var dt = Math.max(0, performance.now() - state.startTs);

  // Streak + bet loss handling
  if (correct){
    state.streak++;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
  } else {
    if (Date.now() >= state.freezeUntil) state.streak = 0;
    if (state.bet && state.bet.used){
      var pc = (profile.coins || 0) - state.bet.amount;
      profile.coins = pc < 0 ? 0 : pc;
      saveProfile(profile);
      var cEl = qs('#coinsVal'); if (cEl) cEl.textContent = profile.coins;
    }
  }

  var pts = scoreFor(dt, correct);
  var coinsGain = coinGainFrom(pts, correct);
  state.score += pts;
  state.coinsEarned += coinsGain;

  var fb = qs('#qz-feedback');
  if (fb) fb.textContent = correct ? ('+'+pts+' pts • +'+coinsGain+' coins') : '0 pts';

  showMeme(correct, dt);
  updateNav();
}

/* ---------- Power-ups ---------- */
var betBtn = qs('#pu-bet');
if (betBtn){
  betBtn.addEventListener('click', function(){
    if (state.locked) return;
    var amt = window.prompt('Bet amount ('+BET_CHOICES.join(', ')+')', BET_CHOICES[0]);
    var n = parseInt(amt||'', 10);
    if (BET_CHOICES.indexOf(n) === -1) return;
    if ((profile.coins||0) < n){ alert('Not enough coins'); return; }
    state.bet = { amount:n, used:true };
  });
}
var freezeBtn = qs('#pu-freeze');
if (freezeBtn){
  freezeBtn.addEventListener('click', function(){
    var cost = 5;
    if ((profile.coins||0) < cost){ alert('Need 5 coins'); return; }
    profile.coins -= cost; saveProfile(profile);
    var cEl = qs('#coinsVal'); if (cEl) cEl.textContent = profile.coins;
    state.freezeUntil = Date.now() + FREEZE_WINDOW_S*1000;
    freezeBtn.textContent = 'Freeze ON';
  });
}
var jumpBtn = qs('#pu-jump');
if (jumpBtn){
  jumpBtn.addEventListener('click', function(){
    if (state.jumpsLeft > 0){ state.jumpsLeft--; nextQ(); return; }
    if ((profile.coins||0) < JUMP_COST){ alert('Need '+JUMP_COST+' coins'); return; }
    profile.coins -= JUMP_COST; saveProfile(profile);
    var cEl = qs('#coinsVal'); if (cEl) cEl.textContent = profile.coins;
    nextQ();
  });
}

/* ---------- Navigation ---------- */
var prevBtn = qs('#btn-prev');
if (prevBtn) prevBtn.addEventListener('click', function(){ if (state.index>0){ state.index--; renderQuestion(); } });
var nextBtn = qs('#btn-next');
if (nextBtn) nextBtn.addEventListener('click', function(){ nextQ(); });
var finishBtn = qs('#btn-finish');
if (finishBtn) finishBtn.addEventListener('click', function(){ finish(); });

function nextQ(){
  if (state.index < state.total - 1){
    state.index++;
    renderQuestion();
  } else {
    finish();
  }
}

function finish(){
  if (state.tHandle) clearInterval(state.tHandle);

  // Persist results
  profile.coins = (profile.coins||0) + state.coinsEarned;

  // Daily Deck bonus and streak update (once/day)
  if (isDaily){
    var today = todayISO();
    if (profile.last_daily !== today){
      if (profile.last_daily === ydayISO()){
        profile.streak = (profile.streak||0) + 1;
      } else {
        profile.streak = 1;
      }
      profile.last_daily = today;
      profile.coins += 10; // daily completion bonus
    }
  }
  saveProfile(profile);
  var cEl = qs('#coinsVal'); if (cEl) cEl.textContent = profile.coins;

  var result = qs('#qz-result');
  var stage = qs('#stage');

  var maxPerQ = 110 * 1.5;
  var acc = Math.round(100 * state.score / Math.max(1, state.total * maxPerQ));

  if (result){
    result.innerHTML =
      '<h2>Results</h2>'+
      '<p><strong>Score:</strong> '+state.score+' pts</p>'+
      '<p><strong>Best streak:</strong> '+state.bestStreak+'</p>'+
      '<p><strong>Coins earned:</strong> '+state.coinsEarned+(isDaily?' (+10 daily bonus)':'')+'</p>'+
      '<p><strong>Accuracy estimate:</strong> '+acc+'%</p>'+
      '<div style="margin-top:12px"><a class="qz-btn" href="./">Back to Quizzes</a></div>';
    result.classList.remove('hidden');
  }
  if (stage) stage.classList.add('hidden');
}

/* ---------- Daily Deck builder ---------- */
function pickRandom(arr, n){
  var copy = arr.slice();
  for (var i=copy.length-1;i>0;i--){
    var j = (Math.random()*(i+1))|0;
    var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
  }
  return copy.slice(0,n);
}

async function buildDailyDeck(){
  var g = (localStorage.getItem('beyondscool_lastGrade')||'').trim();
  if (!g){
    alert('Choose your grade first on the Quizzes page, then tap Daily Deck again.');
    location.href = './';
    return null;
  }
  var arr = await loadGradeFile(g);
  var pool = [];
  for (var i=0;i<arr.length;i++){
    var quiz = arr[i];
    if (quiz && Array.isArray(quiz.questions)){
      for (var j=0;j<quiz.questions.length;j++){
        var q = quiz.questions[j];
        if (q && Array.isArray(q.options) && Number.isInteger(q.answer_index)){
          pool.push(q);
        }
      }
    }
  }
  if (pool.length < 5){
    var t = qs('#qz-title'); if (t) t.textContent = 'Not enough questions for Daily Deck';
    return null;
  }
  var picked = pickRandom(pool, 5);
  return { title: 'Daily Deck — Grade '+g, subject:'Mixed', grade:g, questions:picked };
}

/* ---------- Boot ---------- */
(async function init(){
  try{
    // Load profile first
    await loadProfile();
    
    var quiz = null;
    if (isDaily){
      quiz = await buildDailyDeck();
    } else if (quizId){
      quiz = await findQuizById(quizId);
    }

    if (!quiz){
      var t = qs('#qz-title'); if (t) t.textContent = 'Quiz not found';
      var m = qs('#qz-meta'); if (m) m.textContent = '—';
      return;
    }

    state.quiz = quiz;
    state.total = quiz.questions.length;

    var tt = qs('#qz-title'); if (tt) tt.textContent = quiz.title || 'Quiz';
    var mm = qs('#qz-meta');  if (mm) mm.textContent = 'Grade '+(quiz.grade!=null?quiz.grade:'-')+' • '+(quiz.subject||'-');

    renderQuestion();
  }catch(err){
    console.error(err);
    var t2 = qs('#qz-title'); if (t2) t2.textContent = 'Error loading quiz';
    var m2 = qs('#qz-meta');  if (m2) m2.textContent = (err && err.message) ? err.message : String(err || 'Unknown error');
  }
})();


