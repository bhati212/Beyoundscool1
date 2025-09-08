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
    const qCount = (quiz.questions || []).length;
    const subject = quiz.subject || "General";
    const initial = (subject || "Q")[0].toUpperCase();
    el.innerHTML = `
        <div class="thumb"><span>${initial}</span></div>
        <div class="card-body">
          <div class="title">${quiz.title || "Untitled quiz"}</div>
          <div class="tags">
            <span class="tag">${subject}</span>
            <span class="tag">${qCount} Qs</span>
            <span class="tag">Grade ${quiz.grade ?? "-"}</span>
          </div>
          <div class="actions">
            <a class="btn start" href="./play.html?id=${quiz.id}">Start</a>
            <a class="btn host" href="../live/live.html?id=${quiz.id}">Host</a>
          </div>
        </div>`;
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
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching quizzes:', error);
        EMPTY.textContent = "Could not load quizzes.";
        EMPTY.style.display = 'block';
        return;
    }
    allQuizzes = data;
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


document.addEventListener('DOMContentLoaded', () => {
    const addQuestionBtn = document.getElementById('add-question-btn');
    const questionsContainer = document.getElementById('questions-container');
    const form = document.getElementById('create-quiz-form');
    let questionCount = 0;

    function createQuestionCard() {
        questionCount++;
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question-card';
        questionDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                <h3>Question ${questionCount}</h3>
                <button type="button" class="qz-btn qz-btn-danger delete-question">Remove</button>
            </div>
            <input type="text" class="inp question-text" placeholder="Enter question" required>
            <div class="options-container">
                <div class="option-group">
                    <input type="radio" name="correct_${questionCount}" value="0" required>
                    <input type="text" class="inp option-text" placeholder="Option 1" required>
                </div>
                <div class="option-group">
                    <input type="radio" name="correct_${questionCount}" value="1" required>
                    <input type="text" class="inp option-text" placeholder="Option 2" required>
                </div>
                <div class="option-group">
                    <input type="radio" name="correct_${questionCount}" value="2" required>
                    <input type="text" class="inp option-text" placeholder="Option 3" required>
                </div>
                <div class="option-group">
                    <input type="radio" name="correct_${questionCount}" value="3" required>
                    <input type="text" class="inp option-text" placeholder="Option 4" required>
                </div>
            </div>
        `;

        questionDiv.querySelector('.delete-question').addEventListener('click', () => {
            questionDiv.remove();
        });

        questionsContainer.appendChild(questionDiv);
    }

    // Initialize with one question
    createQuestionCard();

    addQuestionBtn.addEventListener('click', createQuestionCard);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // First check if user is logged in
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (!session?.user) {
            document.getElementById('form-message').textContent = 'Please login to create a quiz';
            document.getElementById('form-message').style.color = 'red';
            return;
        }

        const formData = {
            title: document.getElementById('quiz-title').value,
            subject: document.getElementById('quiz-subject').value,
            grade: parseInt(document.getElementById('quiz-grade').value),
            coins_per_answer: parseInt(document.getElementById('quiz-coins').value),
            user_id: session.user.id,
            questions: []
        };

        const questionCards = document.querySelectorAll('.question-card');
        if (questionCards.length === 0) {
            document.getElementById('form-message').textContent = 'Please add at least one question';
            document.getElementById('form-message').style.color = 'red';
            return;
        }

        questionCards.forEach((card) => {
            const options = Array.from(card.querySelectorAll('.option-text')).map(opt => opt.value);
            const correctAnswer = card.querySelector('input[type="radio"]:checked')?.value;
            
            if (!correctAnswer) {
                throw new Error('Please select a correct answer for all questions');
            }

            formData.questions.push({
                question_text: card.querySelector('.question-text').value,
                options: options,
                correct_answer: parseInt(correctAnswer)
            });
        });

        try {
            // Create quiz in Supabase
            const { data: quiz, error: quizError } = await supabase
                .from('quizzes')
                .insert([{
                    title: formData.title,
                    subject: formData.subject,
                    grade: formData.grade,
                    coins_per_answer: formData.coins_per_answer,
                    user_id: formData.user_id
                }])
                .select()
                .single();

            if (quizError) throw quizError;

            // Create questions
            const { error: questionsError } = await supabase
                .from('questions')
                .insert(
                    formData.questions.map(q => ({
                        quiz_id: quiz.id,
                        question_text: q.question_text,
                        options: q.options,
                        correct_answer: q.correct_answer
                    }))
                );

            if (questionsError) throw questionsError;

            document.getElementById('form-message').textContent = 'Quiz created successfully!';
            document.getElementById('form-message').style.color = 'green';
            
            // Reset form
            form.reset();
            questionsContainer.innerHTML = '';
            questionCount = 0;
            createQuestionCard(); // Add one empty question card

            // Redirect after delay
            setTimeout(() => {
                window.location.href = './';
            }, 2000);

        } catch (error) {
            console.error('Error:', error);
            document.getElementById('form-message').textContent = 
                'Error creating quiz: ' + (error.message || 'Unknown error');
            document.getElementById('form-message').style.color = 'red';
        }
    });
});
