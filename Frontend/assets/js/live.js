import { supabase } from './supabaseClient.js';

// --- DOM Elements ---
const headerTitle = document.getElementById('header-title');
const joinView = document.getElementById('join-view');
const hostView = document.getElementById('host-view');
const playerGameView = document.getElementById('player-game-view');
const leaderboardView = document.getElementById('leaderboard-view');
const pinInput = document.getElementById('pin-input');
const nickInput = document.getElementById('nick-input');
const joinBtn = document.getElementById('join-btn');
const joinMessage = document.getElementById('join-message');
const pinDisplay = document.getElementById('pin-display');
const playerList = document.getElementById('player-list');
const noPlayersMessage = document.getElementById('no-players');
const startQuizBtn = document.getElementById('start-quiz-btn');
const refreshPlayersBtn = document.getElementById('refresh-players-btn');
const hostQuestionView = document.getElementById('host-question-view');
const hostQuestionEl = document.getElementById('host-question');
const hostTimerEl = document.getElementById('host-timer');
const playerQuestionEl = document.getElementById('player-question');
const playerTimerEl = document.getElementById('player-timer');
const playerOptionsEl = document.getElementById('player-options');
const nextQuestionBtn = document.getElementById('next-question-btn');
const showLeaderboardBtn = document.getElementById('show-leaderboard-btn');
const leaderboardTable = document.getElementById('leaderboard-table');
const quizTitleHost = document.getElementById('quiz-title-host');
const playerResultsView = document.getElementById('player-results-view');
const playerFinalScore = document.getElementById('player-final-score');
const playerCoinsEarned = document.getElementById('player-coins-earned');
const viewLeaderboardBtn = document.getElementById('view-leaderboard-btn');
const skipQuestionBtn = document.getElementById('skip-question-btn');


// --- State ---
let currentUser = null;
let currentQuiz = null;
let channel = null;
let isHost = false;
let pin = null;
let myNick = 'Player';
let currentQuestionIndex = -1;
let questionTimer;
const playerScores = new Map(); // K: userId, V: { nick, score, timeBonus }
let myScore = 0; // Player's own score
let myAnswers = []; // Track player's answers for scoring


// Authentication Check
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
        window.location.href = '../auth.html'; // Redirect to login if not authenticated
    }
}

// Run authentication check on page load
checkAuth();


// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '../auth.html';
        return;
    }
    currentUser = session.user;
    myNick = currentUser.user_metadata.username || `Player${Math.floor(Math.random() * 1000)}`;
    nickInput.value = myNick;

    const params = new URLSearchParams(window.location.search);
    const quizId = params.get('id');
    const urlPin = params.get('pin');

    if (quizId) {
        isHost = true;
        await setupHost(quizId);
    } else {
        if (urlPin) {
            pinInput.value = urlPin;
        }
        setupJoin();
    }
});

function showView(view) {
    [joinView, hostView, playerGameView, playerResultsView, leaderboardView].forEach(v => v.classList.add('hidden'));
    view.classList.remove('hidden');
}

// --- Host Logic ---
async function setupHost(quizId) {
    showView(hostView);
    headerTitle.textContent = "Host Quiz";
    pin = Math.floor(100000 + Math.random() * 900000).toString();
    pinDisplay.textContent = pin;

    const { data: quizData, error: quizError } = await supabase.from('quizzes').select('*, questions(*)').eq('id', quizId).single();
    if (quizError || !quizData) {
        quizTitleHost.textContent = "Error: Could not load quiz.";
        return;
    }
    currentQuiz = quizData;
    quizTitleHost.textContent = currentQuiz.title;

    // Create room in database (optional - continue even if it fails)
    try {
        await supabase.from('rooms').insert({
            pin: pin,
            quiz_id: currentQuiz.id,
            host_id: currentUser.id
        });
    } catch (roomError) {
        console.log("Room creation failed, continuing anyway:", roomError.message);
    }

    channel = supabase.channel(`quiz:${pin}`, { config: { presence: { key: currentUser.id } } });

    channel.on('presence', { event: 'sync' }, () => {
        const presences = channel.presenceState();
        updatePlayerList(presences);
    });
    
    // Also check database for players every 2 seconds
    setInterval(async () => {
        await updatePlayerListFromDatabase();
    }, 2000);
    
    channel.on('broadcast', { event: 'answer' }, ({ payload }) => {
        handlePlayerAnswer(payload);
    });

    await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            await channel.track({ nick: myNick, isHost: true, user_id: currentUser.id });
        }
    });

    startQuizBtn.addEventListener('click', startQuiz);
    refreshPlayersBtn.addEventListener('click', async () => {
        console.log("Manually refreshing player list");
        if (channel) {
            const presences = channel.presenceState();
            updatePlayerList(presences);
        }
        await updatePlayerListFromDatabase();
    });
    
    // Initial check for players in database
    await updatePlayerListFromDatabase();
    
    // Enable start button after 5 seconds regardless of player count (for testing)
    setTimeout(() => {
        if (startQuizBtn.disabled) {
            console.log("Enabling start button after timeout");
            startQuizBtn.disabled = false;
            startQuizBtn.textContent = "Start Quiz (Force)";
        }
    }, 5000);
}

function updatePlayerList(presences) {
    playerList.innerHTML = '';
    const players = Object.values(presences).flat().filter(p => !p.isHost);
    
    console.log('Current presences:', presences);
    console.log('Filtered players:', players);
    
    if (players.length > 0) {
        if(noPlayersMessage) noPlayersMessage.classList.add('hidden');
        players.forEach(p => {
            const li = document.createElement('li');
            li.textContent = p.nick || 'Player';
            playerList.appendChild(li);
        });
        startQuizBtn.disabled = false;
    } else {
        if(noPlayersMessage) {
            playerList.appendChild(noPlayersMessage);
            noPlayersMessage.classList.remove('hidden');
        }
        startQuizBtn.disabled = true;
    }
}

async function updatePlayerListFromDatabase() {
    if (!pin) return;
    
    try {
        const { data: players, error } = await supabase
            .from('players')
            .select('nickname, user_id')
            .eq('room_pin', pin);
        
        if (error) {
            console.log('Database player fetch error:', error.message);
            return;
        }
        
        console.log('Players from database:', players);
        
        if (players && players.length > 0) {
            playerList.innerHTML = '';
            if(noPlayersMessage) noPlayersMessage.classList.add('hidden');
            
            players.forEach(player => {
                const li = document.createElement('li');
                li.textContent = player.nickname || 'Player';
                playerList.appendChild(li);
            });
            
            startQuizBtn.disabled = false;
            console.log('Start button enabled - players found in database');
        } else {
            // Only show "no players" if we haven't found any in presence either
            const presences = channel ? channel.presenceState() : {};
            const presencePlayers = Object.values(presences).flat().filter(p => !p.isHost);
            
            if (presencePlayers.length === 0) {
                if(noPlayersMessage) {
                    playerList.innerHTML = '';
                    playerList.appendChild(noPlayersMessage);
                    noPlayersMessage.classList.remove('hidden');
                }
                startQuizBtn.disabled = true;
            }
        }
    } catch (error) {
        console.log('Error fetching players from database:', error.message);
    }
}

function startQuiz() {
    console.log("Starting quiz...");
    console.log("Current quiz:", currentQuiz);
    console.log("Questions:", currentQuiz?.questions);
    
    if (!currentQuiz || !currentQuiz.questions || currentQuiz.questions.length === 0) {
        alert("No quiz data available. Please refresh and try again.");
        return;
    }
    
    hostView.querySelector('.qz-stage').classList.add('hidden');
    hostQuestionView.classList.remove('hidden');
    currentQuestionIndex = 0;
    sendQuestion();
}

function sendQuestion() {
    const question = currentQuiz.questions[currentQuestionIndex];
    const questionEndTime = Date.now() + 20000; // 20s per question
    
    console.log("Sending question:", question);
    console.log("Question index:", currentQuestionIndex);
    
    hostQuestionEl.textContent = `Q${currentQuestionIndex + 1}: ${question.question_text}`;
    startHostTimer(questionEndTime);

    if (channel) {
        channel.send({
            type: 'broadcast',
            event: 'new_question',
            payload: {
                question: question.question_text,
                options: question.options,
                index: currentQuestionIndex,
                endTime: questionEndTime,
            },
        });
        console.log("Question broadcast sent");
    } else {
        console.error("No channel available to send question");
    }
    
    // Auto-advance after time is up
    setTimeout(() => {
        currentQuestionIndex++;
        if (currentQuestionIndex < currentQuiz.questions.length) {
            sendQuestion();
        } else {
            showLeaderboard();
        }
    }, 20000); // 20 seconds
    
    nextQuestionBtn.onclick = () => {
        currentQuestionIndex++;
        if (currentQuestionIndex < currentQuiz.questions.length) {
            sendQuestion();
        } else {
            showLeaderboard();
        }
    };
}

function startHostTimer(endTime) {
    clearInterval(questionTimer);
    questionTimer = setInterval(() => {
        const timeLeft = Math.round((endTime - Date.now()) / 1000);
        hostTimerEl.textContent = `Time left: ${timeLeft > 0 ? timeLeft : 0}s`;
        if (timeLeft <= 0) clearInterval(questionTimer);
    }, 1000);
}

function handlePlayerAnswer({ userId, nick, answerIndex, questionIndex, timeTaken }) {
    if (questionIndex !== currentQuestionIndex) return;

    const question = currentQuiz.questions[questionIndex];
    if (!playerScores.has(userId)) {
        playerScores.set(userId, { nick, score: 0, timeBonus: 0 });
    }
    
    // Handle skipped questions (answerIndex = -1)
    if (answerIndex === -1) {
        // No points for skipped questions
        return;
    }
    
    if (answerIndex === question.correct_answer) {
        const score = 100;
        const timeBonus = Math.max(0, 20 - Math.floor(timeTaken / 1000)) * 5;
        const currentData = playerScores.get(userId);
        currentData.score += score;
        currentData.timeBonus += timeBonus;
        playerScores.set(userId, currentData);
    }
}

async function showLeaderboard() {
    hostQuestionView.classList.add('hidden');
    const finalScores = [];

    // Calculate total score and coins
    for (const [userId, data] of playerScores.entries()) {
        const totalScore = data.score + data.timeBonus;
        const coinsEarned = Math.floor(totalScore / 10);
        finalScores.push({ userId, nick: data.nick, totalScore, coinsEarned });
    }
    
    finalScores.sort((a, b) => b.totalScore - a.totalScore);
    
    await channel.send({
        type: 'broadcast',
        event: 'leaderboard',
        payload: { scores: finalScores },
    });
    
    renderLeaderboard(finalScores);
    
    // Save scores to DB
    const scoresToSave = finalScores.map(s => ({
        user_id: s.userId,
        score: s.totalScore,
        coins: s.coinsEarned
    }));
    
    if(scoresToSave.length > 0) {
        await supabase.rpc('save_live_quiz_scores', {
            quiz_id_param: currentQuiz.id,
            scores_param: scoresToSave
        });
    }
}


// --- Join Logic ---
function setupJoin() {
    showView(joinView);
    headerTitle.textContent = "Join Quiz";
    joinBtn.addEventListener('click', attemptJoin);
}

async function attemptJoin() {
    pin = pinInput.value.trim();
    myNick = nickInput.value.trim();
    if (!pin || !myNick) {
        joinMessage.textContent = "Please enter a PIN and a nickname.";
        return;
    }

    joinMessage.textContent = "Checking PIN...";

    // Check if the room exists (optional - continue even if check fails)
    try {
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('pin')
            .eq('pin', pin)
            .single();

        if (roomError || !room) {
            console.log("Room not found in database, but continuing anyway:", roomError?.message);
        }
    } catch (error) {
        console.log("Room check failed, continuing anyway:", error.message);
    }
    
    joinMessage.textContent = "Room found! Joining...";

    channel = supabase.channel(`quiz:${pin}`, { config: { presence: { key: currentUser.id } } });

    channel.on('broadcast', { event: 'new_question' }, ({ payload }) => {
        showView(playerGameView);
        displayPlayerQuestion(payload);
    });
    
    // Load quiz data for scoring
    try {
        const { data: roomData } = await supabase
            .from('rooms')
            .select('quiz_id')
            .eq('pin', pin)
            .single();
        
        if (roomData && roomData.quiz_id) {
            const { data: quizData } = await supabase
                .from('quizzes')
                .select('*, questions(*)')
                .eq('id', roomData.quiz_id)
                .single();
            
            if (quizData) {
                currentQuiz = quizData;
                console.log('Quiz data loaded for player:', currentQuiz);
            }
        }
    } catch (error) {
        console.log('Could not load quiz data for player:', error.message);
    }
    
    channel.on('broadcast', { event: 'leaderboard' }, async ({ payload }) => {
        // Show player results first
        await showPlayerResults(payload.scores);
    });

    await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            // Track presence
            await channel.track({ nick: myNick, isHost: false, user_id: currentUser.id });
            
            // Add player to database (optional)
            try {
                await supabase.from('players').insert({
                    room_pin: pin,
                    user_id: currentUser.id,
                    nickname: myNick
                });
            } catch (error) {
                console.log("Player insertion failed, continuing anyway:", error.message);
            }

            playerQuestionEl.textContent = "Joined! Waiting for the host to start the quiz...";
            showView(playerGameView);
        } else {
             joinMessage.textContent = "Could not join room. Realtime connection failed.";
        }
    });
    
    // Add event listener for view leaderboard button
    viewLeaderboardBtn.addEventListener('click', () => {
        if (window.currentLeaderboardScores) {
            renderLeaderboard(window.currentLeaderboardScores);
        } else {
            showView(leaderboardView);
        }
    });
}

function displayPlayerQuestion({ question, options, index, endTime }) {
    playerQuestionEl.textContent = `Q${index + 1}: ${question}`;
    playerOptionsEl.innerHTML = '';
    skipQuestionBtn.style.display = 'block';
    skipQuestionBtn.disabled = false;
    const questionStartTime = Date.now();

    options.forEach((opt, i) => {
        const button = document.createElement('button');
        button.className = 'qz-opt';
        button.textContent = opt;
        button.onclick = () => {
            const timeTaken = Date.now() - questionStartTime;
            
            // Calculate score for this answer
            const question = currentQuiz.questions[index];
            const isCorrect = i === question.correct_answer;
            const baseScore = isCorrect ? 100 : 0;
            const timeBonus = isCorrect ? Math.max(0, 20 - Math.floor(timeTaken / 1000)) * 5 : 0;
            const totalScore = baseScore + timeBonus;
            
            myScore += totalScore;
            myAnswers.push({
                questionIndex: index,
                answerIndex: i,
                isCorrect: isCorrect,
                timeTaken: timeTaken,
                score: totalScore
            });
            
            channel.send({
                type: 'broadcast',
                event: 'answer',
                payload: { userId: currentUser.id, nick: myNick, answerIndex: i, questionIndex: index, timeTaken }
            });
            playerOptionsEl.querySelectorAll('button').forEach(btn => btn.disabled = true);
            skipQuestionBtn.disabled = true;
            button.style.border = '2px solid blue';
            
            // Show feedback with score
            const feedback = isCorrect ? 
                `✅ Correct! +${totalScore} points` : 
                `❌ Wrong answer. +0 points`;
            playerQuestionEl.innerHTML = `Q${index + 1}: ${question.question_text}<br><br><span style="color: ${isCorrect ? 'green' : 'red'}; font-weight: bold;">${feedback}<br>Total Score: ${myScore}</span>`;
        };
        playerOptionsEl.appendChild(button);
    });

    // Skip button functionality
    skipQuestionBtn.onclick = () => {
        const timeTaken = Date.now() - questionStartTime;
        
        // Record skip (no points)
        myAnswers.push({
            questionIndex: index,
            answerIndex: -1, // -1 indicates skip
            isCorrect: false,
            timeTaken: timeTaken,
            score: 0
        });
        
        channel.send({
            type: 'broadcast',
            event: 'answer',
            payload: { userId: currentUser.id, nick: myNick, answerIndex: -1, questionIndex: index, timeTaken }
        });
        
        playerOptionsEl.querySelectorAll('button').forEach(btn => btn.disabled = true);
        skipQuestionBtn.disabled = true;
        
        playerQuestionEl.innerHTML = `Q${index + 1}: ${question}<br><br><span style="color: orange; font-weight: bold;">⏭️ Question skipped. +0 points<br>Total Score: ${myScore}</span>`;
    };

    clearInterval(questionTimer);
    questionTimer = setInterval(() => {
        const timeLeft = Math.round((endTime - Date.now()) / 1000);
        playerTimerEl.textContent = `Time left: ${timeLeft > 0 ? timeLeft : 0}s`;
        if (timeLeft <= 0) {
            clearInterval(questionTimer);
            playerOptionsEl.querySelectorAll('button').forEach(btn => btn.disabled = true);
            skipQuestionBtn.disabled = true;
            playerQuestionEl.innerHTML = `Q${index + 1}: ${question}<br><br><span style="color: red; font-weight: bold;">Time's up! Waiting for next question...</span>`;
        }
    }, 1000);
}

async function showPlayerResults(scores) {
    // Find player's score in the leaderboard
    const playerScore = scores.find(s => s.userId === currentUser.id);
    const finalScore = playerScore ? playerScore.totalScore : myScore;
    const coinsEarned = Math.floor(finalScore / 10);
    
    // Display player's results
    playerFinalScore.textContent = finalScore;
    playerCoinsEarned.textContent = `+${coinsEarned} 🪙`;
    
    // Save coins to user's profile
    await saveCoinsToProfile(coinsEarned);
    
    // Show results view
    showView(playerResultsView);
    
    // Store scores for leaderboard view
    window.currentLeaderboardScores = scores;
}

async function saveCoinsToProfile(coinsEarned) {
    if (coinsEarned <= 0) return;
    
    try {
        // Load current profile
        const profileKey = 'beyondscool_profile';
        const currentProfile = JSON.parse(localStorage.getItem(profileKey)) || {
            coins: 0,
            streak: 0,
            last_daily: null,
            character: null,
            owned_characters: []
        };
        
        // Add earned coins
        currentProfile.coins = (currentProfile.coins || 0) + coinsEarned;
        
        // Save back to localStorage
        localStorage.setItem(profileKey, JSON.stringify(currentProfile));
        
        console.log(`Added ${coinsEarned} coins to profile. Total: ${currentProfile.coins}`);
        
        // Also try to save to database if user is logged in
        try {
            const { error } = await supabase
                .from('user_profiles')
                .upsert({
                    user_id: currentUser.id,
                    coins: currentProfile.coins,
                    streak: currentProfile.streak || 0,
                    last_daily: currentProfile.last_daily,
                    character: currentProfile.character,
                    updated_at: new Date().toISOString()
                });
            
            if (error) throw error;
            console.log('Coins saved to database');
        } catch (dbError) {
            console.log('Database save failed, coins saved locally:', dbError.message);
        }
    } catch (error) {
        console.error('Error saving coins:', error);
    }
}


// --- Shared Logic ---
function renderLeaderboard(scores) {
    showView(leaderboardView);
    let tableHtml = `<thead><tr><th>Rank</th><th>Player</th><th>Score</th><th>Coins Earned</th></tr></thead><tbody>`;
    scores.forEach((player, index) => {
        const isCurrentPlayer = player.userId === currentUser.id;
        const rowStyle = isCurrentPlayer ? 'background-color: #f6c41b; font-weight: bold;' : '';
        tableHtml += `
            <tr style="${rowStyle}">
                <td>${index + 1}</td>
                <td>${player.nick} ${isCurrentPlayer ? '(You)' : ''}</td>
                <td>${player.totalScore}</td>
                <td>${player.coinsEarned} 🪙</td>
            </tr>
        `;
    });
    tableHtml += `</tbody>`;
    leaderboardTable.innerHTML = tableHtml;
}