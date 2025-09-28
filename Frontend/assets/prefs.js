export const DEFAULT_PREFS = { board: "CBSE", grade: "10" };

export const $ = (s, d = document) => d.querySelector(s);
export const $$ = (s, d = document) => Array.from(d.querySelectorAll(s));

export function getPrefs() {
  try {
    return JSON.parse(localStorage.getItem("bsc_prefs") || "{}");
  } catch {
    return {};
  }
}

export function setPrefs(p) {
  localStorage.setItem("bsc_prefs", JSON.stringify(p));
}

export function openPrefsDialog() {
  const dlg = $("#prefs");
  hydratePrefsForm();
  dlg && dlg.showModal();
}

// This function is now simpler and won't cause the error
export function hydratePrefsForm() {
  const p = { ...DEFAULT_PREFS, ...getPrefs() };
  const boardEl = $("#prefBoard");
  const gradeEl = $("#prefGrade");
  
  if (boardEl) boardEl.value = p.board;
  if (gradeEl) gradeEl.value = p.grade;
}

// This function is also simpler now
export function savePrefsFromForm(ev) {
  ev.preventDefault();
  const board = $("#prefBoard")?.value;
  const grade = $("#prefGrade")?.value;
  setPrefs({ ...getPrefs(), board, grade }); // Keep existing prefs like language
  $("#prefs")?.close();
}