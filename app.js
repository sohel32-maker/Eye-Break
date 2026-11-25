const $ = id => document.getElementById(id);
const STORE = 'eyepause-settings-v3';
let mode = 'focus', total = 1200, left = 1200, timer = null, endAt = 0;
let count = Number(localStorage.epCount || 0), soundData = localStorage.epSoundData || '', soundName = localStorage.epSoundName || '';
let soundStopTimer = null, soundPopTimer = null, audioContext = null;
const today = new Date().toDateString();
if (localStorage.epDay !== today) { count = 0; localStorage.epCount = '0'; localStorage.epDay = today; }
$('count').textContent = count;
if (soundData) { $('status').textContent = `Saved sound: ${soundName || 'Custom sound'}`; }

function cfg() { return { work: Math.max(1, Math.min(180, Number($('work').value) || 20)) * 60, rest: Math.max(5, Math.min(300, Number($('rest').value) || 20)) }; }
function show() {
  $('timer').textContent = `${String(Math.floor(left / 60)).padStart(2,'0')}:${String(left % 60).padStart(2,'0')}`;
  $('mode').textContent = mode === 'focus' ? 'FOCUS TIME' : 'EYE BREAK';
  $('hint').textContent = mode === 'focus' ? '২০ মিনিট কাজের পর দূরে তাকানোর বিরতি নাও।' : 'প্রায় ৬ মিটার দূরের কোনো কিছুর দিকে তাকাও।';
  $('bar').style.width = `${Math.max(0, Math.min(100, (total-left)/total*100))}%`;
  $('start').textContent = timer ? 'Running' : 'Start';
  $('start').disabled = !!timer;
  $('pause').textContent = timer ? 'Pause' : 'Resume';
  document.title = `${$('timer').textContent} · EyePause`;
}
function stopTimer() { if (timer) clearInterval(timer); timer = null; }
function stopSound() {
  clearTimeout(soundStopTimer); clearInterval(soundPopTimer); soundStopTimer = soundPopTimer = null;
  const a = $('audio'); a.pause(); a.loop = false; a.currentTime = 0;
}
function tone() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    audioContext ||= new AC(); if (audioContext.state === 'suspended') audioContext.resume();
    const o = audioContext.createOscillator(), g = audioContext.createGain();
    o.connect(g); g.connect(audioContext.destination); o.type = 'sine'; o.frequency.value = 740;
    const now = audioContext.currentTime; g.gain.setValueAtTime(0.001, now); g.gain.exponentialRampToValueAtTime(0.12, now + 0.015); g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    o.start(now); o.stop(now + 0.2);
  } catch (e) { console.warn('Sound error', e); }
}
function beep(durationSeconds = 5) {
  if (!$('soundOn').checked) return;
  stopSound();
  if (soundData) {
    const a = $('audio'); a.src = soundData; a.loop = true; a.currentTime = 0;
    a.play().catch(() => { $('status').textContent = 'সাউন্ড চালাতে অ্যাপের ভেতরে একবার Preview sound চাপো।'; });
    soundStopTimer = setTimeout(stopSound, durationSeconds * 1000);
  } else {
    tone(); soundPopTimer = setInterval(tone, 550); soundStopTimer = setTimeout(stopSound, durationSeconds * 1000);
  }
}
async function notify(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg && reg.showNotification) await reg.showNotification(title, { body, icon: './icon-192.png', badge: './icon-192.png', tag: 'eyepause-reminder', renotify: true });
    else new Notification(title, { body, icon: './icon-192.png' });
  } catch (e) { console.warn('Notification error', e); }
}
function saveState() { localStorage.epMode = mode; localStorage.epLeft = String(left); localStorage.epSavedAt = String(Date.now()); }
function start() { if (timer) return; endAt = Date.now() + left * 1000; timer = setInterval(tick, 250); show(); saveState(); }
function tick() {
  left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000)); show();
  if (left <= 0) {
    stopTimer(); beep(mode === 'focus' ? 5 : 2);
    if (mode === 'focus') {
      mode = 'break'; total = cfg().rest; left = total;
      notify('EyePause: বিরতির সময়', `${total} সেকেন্ড দূরে তাকিয়ে চোখকে বিশ্রাম দিন।`);
    } else {
      mode = 'focus'; total = cfg().work; left = total; count++;
      localStorage.epCount = String(count); $('count').textContent = count;
      notify('EyePause: কাজে ফিরুন', 'বিরতি শেষ। পরের কাজের সময় শুরু হয়েছে।');
    }
    show(); saveState(); start();
  }
}
$('start').onclick = start;
$('pause').onclick = () => { if (timer) { left = Math.max(0, Math.ceil((endAt - Date.now())/1000)); stopTimer(); saveState(); show(); } else start(); };
$('reset').onclick = () => { stopTimer(); stopSound(); mode = 'focus'; total = cfg().work; left = total; saveState(); show(); };
$('break').onclick = () => { stopTimer(); mode = 'break'; total = cfg().rest; left = total; show(); saveState(); start(); };
$('work').onchange = () => { if (mode === 'focus' && !timer) { total = cfg().work; left = total; show(); saveState(); } };
$('rest').onchange = () => { if (mode === 'break' && !timer) { total = cfg().rest; left = total; show(); saveState(); } };
$('soundFile').onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  if (!file.type.startsWith('audio/')) { $('status').textContent = 'একটি WAV বা MP3 অডিও ফাইল বেছে নাও।'; return; }
  if (file.size > 3 * 1024 * 1024) { $('status').textContent = 'সাউন্ড ফাইলটি ৩ MB-এর ছোট রাখো।'; e.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = () => { soundData = String(reader.result); soundName = file.name; try { localStorage.epSoundData = soundData; localStorage.epSoundName = soundName; $('status').textContent = `Saved sound: ${soundName}`; } catch (err) { $('status').textContent = 'এই ফাইলটি সংরক্ষণ করা যায়নি। ছোট ফাইল ব্যবহার করো।'; } };
  reader.readAsDataURL(file);
};
$('preview').onclick = beep;
$('clear').onclick = () => { soundData = ''; soundName = ''; delete localStorage.epSoundData; delete localStorage.epSoundName; $('soundFile').value = ''; stopSound(); $('status').textContent = 'Default Pop sound selected.'; };
$('notify').onclick = async () => {
  if (!('Notification' in window)) { $('status').textContent = 'এই ব্রাউজারে Notification সমর্থিত নয়।'; return; }
  const p = await Notification.requestPermission();
  $('status').textContent = p === 'granted' ? 'Notification permission দেওয়া হয়েছে।' : `Notification permission: ${p}`;
  if (p === 'granted') notify('EyePause চালু হয়েছে', 'বিরতির রিমাইন্ডার প্রস্তুত।');
};
let promptEvent;
$('install').onclick = async () => { if (promptEvent) { promptEvent.prompt(); await promptEvent.userChoice; promptEvent = null; $('install').hidden = true; } };
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptEvent = e; $('install').hidden = false; });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(console.error);
// Restore a paused session after reopening; running timers cannot be guaranteed while Android suspends the app.
if (localStorage.epLeft && localStorage.epMode) { mode = localStorage.epMode === 'break' ? 'break' : 'focus'; left = Math.max(0, Number(localStorage.epLeft) || 0); total = mode === 'focus' ? cfg().work : cfg().rest; }
show();
