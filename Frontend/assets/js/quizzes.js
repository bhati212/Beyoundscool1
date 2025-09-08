import { supabase } from './supabaseClient.js';

const GRID = document.getElementById('grid');
const EMPTY = document.getElementById('empty');
const GRADE = document.getElementById('grade');
const SEARCH = document.getElementById('search');
const AUTH_LINKS = document.getElementById('auth-links');

let allQuizzes = [];
let currentUser = null;

const renderAuthLinks = (user) => {
    if (user) {
        // Logged-in user view
        AUTH_LINKS.innerHTML = `
            <input class="chip-input" id="join-code" placeholder="Enter code">
            <button class="btn-join">Join</button>
            <a href="./profile.html"><div class="avatar" aria-hidden="true" title="View Profile"></div></a>`;
    } else {
        // Logged-out user view
        AUTH_LINKS.innerHTML = `
            <a href="../auth.html" class="btn-join" style="text-decoration:none; display:inline-block; text-align:center; padding-top:10px;">Login / Sign Up</a>`;
    }

    const joinBtn = AUTH_LINKS.querySelector('.btn-join');
    if (joinBtn && user) {
        joinBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const pin = (document.getElementById('join-code')?.value || '').trim();
            if (!pin) { alert('Enter code'); return; }
            const nick = currentUser?.user_metadata?.username || 'Player';
            location.href = `../live/live.html?pin=${encodeURIComponent(pin)}&nick=${encodeURIComponent(nick)}`;
        });
    }
};

const buildGrades = () => {
    GRADE.innerHTML = '<option value="">All Grades</option>';
    for (let g = 1; g <= 12; g++) {
        const opt = document.createElement('option');
        opt.value = String(g);
        opt.textContent = "Grade " + g;
        GRADE.appendChild(opt);
    }
};

const makeCard = (quiz) => {
    const el = document.createElement('article');
    el.className = "card";
    const qCount = quiz.question_count || 0;
    const subject = quiz.subject || "General";
    const initial = (subject || "Q")[0].toUpperCase();
    const coinsPerAnswer = quiz.coins_per_answer || 5;
    el.innerHTML = `
        <div class="thumb"><span>${initial}</span></div>
        <div class="card-body">
          <div class="title">${quiz.title || "Untitled quiz"}</div>
          <div class="tags">
            <span class="tag">${subject}</span>
            <span class="tag">${qCount} Qs</span>
            <span class="tag">Grade ${quiz.grade ?? "-"}</span>
            <span class="tag">${coinsPerAnswer} coins</span>
          </div>
          <div class="actions">
            <a class="btn start" href="./play.html?id=${quiz.id}">Start</a>
            <a class="btn host" href="../live/live.html?id=${quiz.id}">Host</a>
          </div>
        </div>`;

        const startBtn = el.querySelector('.btn.start');
    startBtn.addEventListener('click', (event) => {
        if (!currentUser) {
            event.preventDefault(); // Prevent navigation
            window.location.href = '../auth.html'; // Redirect to login page
        }
    });
    return el;
};

const filterAndRender = () => {
    const needle = SEARCH.value.trim().toLowerCase();
    const grade = GRADE.value;

    const filtered = allQuizzes.filter(q => {
        const gradeMatch = !grade || String(q.grade) === grade;
        if (!gradeMatch) return false;

        if (!needle) return true;
        const hay = (q.title + " " + (q.subject || "")).toLowerCase();
        return hay.includes(needle);
    });

    GRID.innerHTML = "";
    if (filtered.length === 0) {
        EMPTY.style.display = "block";
    } else {
        EMPTY.style.display = "none";
        filtered.forEach(q => GRID.appendChild(makeCard(q)));
    }
};

const loadQuizzes = async () => {
    const { data, error } = await supabase
        .from('quizzes')
        .select(`
            *,
            questions(count)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching quizzes:', error);
        EMPTY.textContent = "Could not load quizzes.";
        EMPTY.style.display = 'block';
        return;
    }
    
    // Add question count to each quiz
    allQuizzes = data.map(quiz => ({
        ...quiz,
        question_count: quiz.questions?.[0]?.count || 0
    }));
    
    filterAndRender();
};

const handleAuthState = (session) => {
    currentUser = session?.user ?? null;
    renderAuthLinks(currentUser);
    const createQuizBtn = document.getElementById('create-quiz-btn');
    if (createQuizBtn) {
        createQuizBtn.href = currentUser ? './create-quiz.html' : '../auth.html';
    }
};

(async function init() {
    buildGrades();
    await loadQuizzes();

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
        handleAuthState(session);
    });

    // Initial check
    const { data: { session } } = await supabase.auth.getSession();
    handleAuthState(session);

    GRADE.addEventListener("change", filterAndRender);
    SEARCH.addEventListener("input", filterAndRender);

    document.getElementById("pick-quiz")?.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelector("#grid").scrollIntoView({ behavior: "smooth" });
    });
})();
