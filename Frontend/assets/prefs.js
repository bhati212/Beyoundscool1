export const DEFAULT_PREFS = { board: "CBSE", grade: "10", language: "English", subjects: ["Maths"], interests: ["PYQ"] };
export const $ = (s, d=document)=>d.querySelector(s);
export const $$ = (s, d=document)=>Array.from(d.querySelectorAll(s));
export function getPrefs(){ try{ return JSON.parse(localStorage.getItem("bsc_prefs")||"{}"); }catch{ return {} } }
export function setPrefs(p){ localStorage.setItem("bsc_prefs", JSON.stringify(p)); }
export function openPrefsDialog(){ const dlg = $("#prefs"); hydratePrefsForm(); dlg && dlg.showModal(); }
export function hydratePrefsForm(){
  const p = { ...DEFAULT_PREFS, ...getPrefs() };
  $("#prefBoard").value = p.board; $("#prefGrade").value = p.grade; $("#prefLanguage").value = p.language;
  Array.from($("#prefSubjects").options).forEach(o=>o.selected=(p.subjects||[]).includes(o.value));
  $$(".chip").forEach(ch=> ch.checked=(p.interests||[]).includes(ch.value));
}
export function savePrefsFromForm(ev){
  ev.preventDefault();
  const subjects = Array.from($("#prefSubjects").selectedOptions).map(o=>o.value);
  const interests = Array.from($$(".chip")).filter(ch=>ch.checked).map(ch=>ch.value);
  setPrefs({ board:$("#prefBoard").value, grade:$("#prefGrade").value, language:$("#prefLanguage").value, subjects, interests });
  $("#prefs")?.close();
}
