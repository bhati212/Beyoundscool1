import { supabase } from './supabaseClient.js';

const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginToggle = document.getElementById('login-toggle');
const signupToggle = document.getElementById('signup-toggle');
const messageEl = document.getElementById('message');

loginToggle.addEventListener('click', () => {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    loginToggle.classList.add('active');
    signupToggle.classList.remove('active');
    messageEl.textContent = '';
});

signupToggle.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    loginToggle.classList.remove('active');
    signupToggle.classList.add('active');
    messageEl.textContent = '';
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    messageEl.textContent = 'Logging in...';

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        messageEl.textContent = error.message;
    } else {
        messageEl.textContent = 'Logged in successfully! Redirecting...';
        window.location.href = './quizzes/index.html';
    }
});

signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    messageEl.textContent = 'Signing up...';

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                username: username,
            }
        }
    });

    if (error) {
        messageEl.textContent = error.message;
    } else {
        // The handle_new_user trigger in your SQL creates the profile
        messageEl.textContent = 'Signup successful! Please check your email to verify your account.';
        loginForm.reset();
        signupForm.reset();
    }
});
