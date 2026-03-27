import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 🚨 1. ตั้งค่า Firebase & API ต่างๆ
// ==========================================
const firebaseConfig = { apiKey: "AIzaSyBNsG-gdNHZzIerTyd33fIwblwccktfU9I", authDomain: "apoko-hq.firebaseapp.com", projectId: "apoko-hq", storageBucket: "apoko-hq.firebasestorage.app", messagingSenderId: "122632343459", appId: "1:122632343459:web:c225aaff8464f1b0c35416" };
const app = initializeApp(firebaseConfig); const auth = getAuth(app); const db = getFirestore(app);
const IMGBB_API_KEY = "6b400d48dc08e690c88a8b32f3cef56a"; const AGORA_APP_ID = "8d7eec85ee1949d491e1dc191f265ed2"; 

// ==========================================
// 🧠 2. ระบบ AI คิดคำศัพท์ (Gemini API)
// ==========================================
const GEMINI_API_KEY = "AIzaSyCifkioB2z1Ho9LAGSFBYWtV-kM4bgtzhw"; 

async function getWordFromAI() {
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: "สุ่มคำศัพท์ภาษาไทย 1 คำ สำหรับเกมทายภาพ (Draw & Guess) ขอเป็นคำนามที่คนทั่วไปรู้จัก วาดเป็นรูปได้ ไม่เอาคำนามธรรม ขอแปลกๆ สร้างสรรค์ ไม่ซ้ำเดิม ขอแค่คำศัพท์ 1 คำโดดๆ ห้ามมีเครื่องหมายใดๆ ห้ามมีคำอธิบาย" }] }], generationConfig: { temperature: 1.5 } })
        });
        const data = await res.json();
        return data.candidates[0].content.parts[0].text.replace(/[\r\n.]/g, "").trim();
    } catch (err) {
        console.log("❌ AI เอ๋อ หรือ API หมดอายุ:", err);
        const backup = ["ไดโนเสาร์", "ชาบู", "ยูทูบเบอร์", "มนุษย์ต่างดาว", "แฮมเบอร์เกอร์", "ชานมไข่มุก"];
        return backup[Math.floor(Math.random() * backup.length)];
    }
}

// ==========================================
// ⚙️ 3. ตัวแปรและฟังก์ชันช่วยเหลือ (Globals)
// ==========================================
const rtcClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
let localTracks = { audioTrack: null }, screenTrack = null, screenAudioTrack = null;
let isMuted = false, isSharingScreen = false, myNumericUid = null, currentUserId = null, currentUsername = "Guest", activeChannel = "general", currentUserRole = "Member"; 
let allMessages = [], usersData = {}, typingTimeout = null, isTyping = false, unreadCounts = { general: 0, project: 0, game_draw: 0 };
let replyingTo = null; let messageToDelete = null;

let remoteAudioTracks = {}; 
let userVolumes = JSON.parse(localStorage.getItem('dosh_volumes')) || {};

const sfxMsg = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3'); sfxMsg.volume = 0.5;
const sfxPing = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); sfxPing.volume = 0.8;

window.showToast = (msg, type = "success") => {
    const toast = document.createElement("div");
    const icon = type === "success" ? `<i class="ph-fill ph-check-circle text-[#23a559] text-[20px]"></i>` : (type === "error" ? `<i class="ph-fill ph-warning-circle text-[#da373c] text-[20px]"></i>` : `<i class="ph-fill ph-info text-[#5865F2] text-[20px]"></i>`);
    toast.className = `flex items-center gap-3 bg-[#1e1f22] border border-[#2b2d31] text-[#dbdee1] px-4 py-3 rounded-lg shadow-xl animate-[slideUpFade_0.3s_ease-out] z-[200]`;
    toast.innerHTML = `${icon} <span class="text-[13px] font-medium">${msg}</span>`;
    document.getElementById("toast-container").appendChild(toast);
    setTimeout(() => { toast.classList.add("opacity-0", "translate-y-4", "transition-all", "duration-300"); setTimeout(() => toast.remove(), 300); }, 3000);
};

const lightbox = document.createElement('div'); lightbox.className = 'fixed inset-0 bg-black/95 z-[100] hidden flex items-center justify-center opacity-0 transition-opacity duration-300 cursor-zoom-out p-4'; lightbox.innerHTML = `<img id="lightbox-img" src="" class="max-w-full max-h-full object-contain rounded-lg shadow-2xl scale-95 transition-transform duration-300"><button class="absolute top-6 right-6 text-white hover:text-gray-300 transition"><i class="ph ph-x text-[32px]"></i></button>`; document.body.appendChild(lightbox);
window.openLightbox = (url) => { document.getElementById('lightbox-img').src = url; lightbox.classList.remove('hidden'); void lightbox.offsetWidth; lightbox.classList.remove('opacity-0'); document.getElementById('lightbox-img').classList.replace('scale-95', 'scale-100'); };
lightbox.onclick = () => { lightbox.classList.add('opacity-0'); document.getElementById('lightbox-img').classList.replace('scale-100', 'scale-95'); setTimeout(() => lightbox.classList.add('hidden'), 300); };
window.sendWave = () => { const input = document.getElementById('chat-input'); input.value = '👋 โบกมือทักทาย!'; document.getElementById('send-btn').click(); };

function startBackgroundAudioMode() {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: 'HIVE Voice Lounge', artist: 'Active Call', album: currentUsername, artwork: [{ src: 'https://ui-avatars.com/api/?name=H&background=5865F2&size=512', sizes: '512x512', type: 'image/png' }] });
        const silentAudio = new Audio('https://www.soundjay.com/buttons/beep-01a.mp3'); silentAudio.volume = 0.01; silentAudio.loop = true;
        navigator.mediaSession.setActionHandler('play', () => silentAudio.play()); navigator.mediaSession.setActionHandler('pause', () => silentAudio.pause());
        silentAudio.play().catch(e => console.log("Background Audio Triggered"));
    }
}

// ==========================================
// 📺 4. ระบบ Watch Party
// ==========================================
let ytPlayer = null; let ignoreNextYtEvent = false; let lastSyncTime = 0; let pendingVideoData = null; let amIInVoice = false; let latestWPData = null; 
if (window.YT && window.YT.Player) { if (pendingVideoData && amIInVoice) { initOrUpdatePlayer(pendingVideoData.vid, pendingVideoData.time, pendingVideoData.state, pendingVideoData.host); pendingVideoData = null; } } else { window.onYouTubeIframeAPIReady = function() { if(pendingVideoData && amIInVoice) { initOrUpdatePlayer(pendingVideoData.vid, pendingVideoData.time, pendingVideoData.state, pendingVideoData.host); pendingVideoData = null; } }; }
function extractVideoID(url) { const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/; const match = url.match(regExp); return (match && match[2].length === 11) ? match[2] : null; }
document.getElementById('toggle-wp-input-btn').onclick = () => { document.getElementById('wp-controls').classList.toggle('hidden'); };
document.getElementById('start-wp-btn').onclick = async () => { const url = document.getElementById('wp-link-input').value; const vid = extractVideoID(url); if(!vid) return showToast("ลิงก์ YouTube ไม่ถูกต้อง", "error"); await setDoc(doc(db, "appData", "watchParty"), { videoId: vid, state: 1, time: 0, updatedBy: currentUsername, timestamp: serverTimestamp() }); document.getElementById('wp-link-input').value = ""; document.getElementById('wp-controls').classList.add('hidden'); showToast("เริ่มสตรีมคลิป YouTube!", "success"); };
document.getElementById('close-wp-btn').onclick = async () => { if(confirm("ต้องการปิดคลิปใช่ไหม?")) { await setDoc(doc(db, "appData", "watchParty"), { videoId: "", state: -1, time: 0, updatedBy: currentUsername, timestamp: serverTimestamp() }); showToast("ปิดสตรีมเรียบร้อย", "success"); } };
async function onPlayerStateChange(event) { if(ignoreNextYtEvent) { ignoreNextYtEvent = false; return; } if(event.data === 1 || event.data === 2) { const now = Date.now(); if (now - lastSyncTime < 1000) return; lastSyncTime = now; if(ytPlayer && typeof ytPlayer.getCurrentTime === 'function') { const time = ytPlayer.getCurrentTime(); const vid = ytPlayer.getVideoData().video_id; await setDoc(doc(db, "appData", "watchParty"), { videoId: vid, state: event.data, time: time, updatedBy: currentUsername, timestamp: serverTimestamp() }); } } }
function initOrUpdatePlayer(vid, time, state, host) { if (!amIInVoice) return; if(typeof window.YT === 'undefined' || typeof window.YT.Player === 'undefined') { pendingVideoData = { vid, time, state, host }; return; } document.getElementById('watch-party-stage').classList.remove('hidden'); document.getElementById('watch-party-stage').classList.add('flex'); if(host) document.getElementById('wp-host').textContent = host; if(!ytPlayer) { ytPlayer = new window.YT.Player('yt-player-container', { height: '100%', width: '100%', videoId: vid, playerVars: { 'autoplay': 1, 'controls': 1, 'rel': 0, 'modestbranding': 1, 'origin': window.location.origin }, events: { 'onReady': (e) => { e.target.seekTo(time, true); if(state === 1) e.target.playVideo(); else e.target.pauseVideo(); }, 'onStateChange': onPlayerStateChange, 'onError': (e) => { showToast("คลิปถูกบล็อกนอกเว็บ YouTube", "error"); } } }); } else { if (typeof ytPlayer.getVideoData !== 'function') return; const currentVid = ytPlayer.getVideoData().video_id; if(currentVid !== vid) { ignoreNextYtEvent = true; ytPlayer.loadVideoById(vid, time); } else { if(host !== currentUsername) { ignoreNextYtEvent = true; const currentTime = ytPlayer.getCurrentTime(); if(Math.abs(currentTime - time) > 2) ytPlayer.seekTo(time, true); if(state === 1 && ytPlayer.getPlayerState() !== 1) ytPlayer.playVideo(); if(state === 2 && ytPlayer.getPlayerState() !== 2) ytPlayer.pauseVideo(); } } } }
onSnapshot(doc(db, "appData", "watchParty"), (d) => { if(d.exists()) { const wp = d.data(); latestWPData = wp; if(wp.videoId) { if (amIInVoice) { initOrUpdatePlayer(wp.videoId, wp.time, wp.state, wp.updatedBy); } } else { document.getElementById('watch-party-stage').classList.add('hidden'); document.getElementById('watch-party-stage').classList.remove('flex'); if(ytPlayer && typeof ytPlayer.destroy === 'function') { ytPlayer.destroy(); ytPlayer = null; } document.getElementById('yt-wrapper').innerHTML = '<div id="yt-player-container"></div>'; pendingVideoData = null; latestWPData = null; } } });

// ==========================================
// 🗺️ 5. ระบบ Navigation
// ==========================================
const views = { chat: document.getElementById('view-chat'), board: document.getElementById('view-board'), voice: document.getElementById('view-voice'), whiteboard: document.getElementById('view-whiteboard'), 'game-draw': document.getElementById('view-game-draw') };
const membersSidebar = document.getElementById('members-sidebar'), sidebar = document.getElementById('sidebar'), overlay = document.getElementById('overlay');
document.querySelectorAll('.open-menu, #open-members-voice').forEach(btn => btn.onclick = () => { sidebar.classList.add('open'); overlay.classList.add('active'); }); document.getElementById('close-menu').onclick = () => { sidebar.classList.remove('open'); overlay.classList.remove('active'); }; document.getElementById('open-members').onclick = () => { membersSidebar.classList.remove('translate-x-full'); overlay.classList.add('active'); }; document.getElementById('close-members').onclick = () => { membersSidebar.classList.add('translate-x-full'); overlay.classList.remove('active'); }; overlay.onclick = () => { sidebar.classList.remove('open'); membersSidebar.classList.add('translate-x-full'); overlay.classList.remove('active'); };
function updateUnreadBadge(channel) { const btn = document.querySelector(`.nav-btn[data-channel="${channel}"]`); if (!btn) return; let badge = btn.querySelector('.unread-badge'); if (unreadCounts[channel] > 0) { if (!badge) { badge = document.createElement('span'); badge.className = 'unread-badge bg-[#da373c] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto animate-[fadeIn_0.2s_ease-out] shadow-sm'; btn.appendChild(badge); } badge.textContent = unreadCounts[channel] > 99 ? '99+' : unreadCounts[channel]; } else { if (badge) badge.remove(); } }
document.querySelectorAll('.nav-btn').forEach(btn => { btn.onclick = (e) => { e.preventDefault(); const view = btn.getAttribute('data-view'); if(!view) return; if (isTyping && currentUserId) { isTyping = false; clearTimeout(typingTimeout); updateDoc(doc(db, "users", currentUserId), { isTyping: false }); } document.querySelectorAll('.nav-btn').forEach(b => { b.classList.remove('channel-active', 'text-[#dbdee1]'); b.classList.add('channel-inactive', 'text-[#80848e]'); }); btn.classList.remove('channel-inactive', 'text-[#80848e]'); btn.classList.add('channel-active', 'text-[#dbdee1]'); Object.values(views).forEach(v => v.classList.add('hidden')); views[view].classList.remove('hidden'); if (view === 'chat' || view === 'voice') { membersSidebar.classList.remove('hidden', 'md:hidden'); if (view === 'chat') { activeChannel = btn.getAttribute('data-channel'); document.getElementById('chat-header-title').textContent = btn.getAttribute('data-name'); unreadCounts[activeChannel] = 0; updateUnreadBadge(activeChannel); renderMessages(); } } else { membersSidebar.classList.add('hidden', 'md:hidden'); } 
if (view === 'game-draw') { activeChannel = 'game_draw'; unreadCounts[activeChannel] = 0; updateUnreadBadge(activeChannel); renderMessages(); setTimeout(initGameCanvasSize, 100); }
if (view === 'whiteboard') setTimeout(initCanvasSize, 100); sidebar.classList.remove('open'); overlay.classList.remove('active'); }; });

window.showUserProfile = (userName) => { const u = usersData[userName]; if(!u) return; document.getElementById('profile-card-name').textContent = userName; document.getElementById('profile-card-avatar').src = u.avatar; const bannerImg = document.getElementById('profile-card-banner'); if (u.banner) { bannerImg.src = u.banner; bannerImg.classList.remove('hidden'); } else { bannerImg.classList.add('hidden'); } document.getElementById('profile-card-status').textContent = u.customStatus || 'ไม่ได้ตั้งสถานะ'; let badges = ''; if(u.role === 'Admin') badges += '<span class="bg-[#da373c]/20 text-[#da373c] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-[#da373c]/30">Admin</span>'; else badges += '<span class="bg-[#5865F2]/20 text-[#5865F2] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-[#5865F2]/30">Member</span>'; document.getElementById('profile-card-badges').innerHTML = badges; document.getElementById('profile-card-modal').classList.remove('hidden'); }
document.getElementById('close-profile-card').onclick = () => document.getElementById('profile-card-modal').classList.add('hidden'); document.getElementById('profile-card-modal').addEventListener('click', (e) => { if (e.target === document.getElementById('profile-card-modal')) document.getElementById('profile-card-modal').classList.add('hidden'); });

// ==========================================
// 🟢 6. โหลดรายชื่อผู้ใช้งาน (และระบบเร่งเสียง)
// ==========================================
window.changeUserVolume = (uid, userId, vol) => {
    if (remoteAudioTracks[uid]) {
        remoteAudioTracks[uid].setVolume(parseInt(vol)); 
    }
    userVolumes[userId] = vol; 
    localStorage.setItem('dosh_volumes', JSON.stringify(userVolumes)); 
};

onSnapshot(collection(db, "users"), (snapshot) => {
    const membersList = document.getElementById('members-list'), voiceActiveList = document.getElementById('voice-active-users'), voiceGrid = document.getElementById('voice-grid'), typingIndicator = document.getElementById('typing-indicator');
    membersList.innerHTML = ''; if (voiceActiveList) voiceActiveList.innerHTML = ''; let voiceGridHTML = '', usersInVoiceCount = 0, peopleTyping = []; document.getElementById('member-count').textContent = snapshot.size; usersData = {}; 

    snapshot.forEach((docSnap) => {
        const u = docSnap.data(), id = docSnap.id, userName = u.username || 'Unknown';
        const userAvatar = u.photoURL || `https://ui-avatars.com/api/?name=${userName}&background=5865F2&color=fff&rounded=true&bold=true`;
        usersData[userName] = { avatar: userAvatar, banner: u.bannerURL || '', id: id, agoraUid: u.agoraUid, customStatus: u.customStatus || '', role: u.role }; 
        if (u.isTyping && u.typingChannel === activeChannel && id !== currentUserId) peopleTyping.push(userName);
        const isOnline = u.status === 'online', statusColor = isOnline ? 'bg-[#23a559]' : 'bg-[#5c6069]';
        const roleDisplay = u.role === 'Admin' ? `<span class="text-[#da373c] font-extrabold ml-1.5 text-[9px] bg-[#da373c]/10 px-1.5 py-0.5 rounded uppercase">Admin</span>` : '';
        const nameStyle = u.role === 'Banned' ? 'line-through text-[#da373c]' : (isOnline ? 'text-[#d1d3d6]' : 'text-[#6d717a]');
        const muteIconSmall = u.isMuted ? '<i class="ph-fill ph-microphone-slash text-[#da373c] ml-auto text-[14px]"></i>' : '';
        const muteIconLarge = u.isMuted ? '<div class="absolute -bottom-1 -right-1 bg-[#111214] rounded-full p-1.5 border-2 border-[#1e1f22] shadow-sm flex items-center justify-center"><i class="ph-fill ph-microphone-slash text-[#da373c] text-[14px]"></i></div>' : '';
        const screenBadgeSmall = u.isSharingScreen ? '<span class="ml-2 text-[9px] bg-[#5865F2] text-white px-1.5 py-0.5 rounded flex items-center font-bold tracking-wider"><i class="ph-fill ph-screencast mr-1"></i>LIVE</span>' : '';
        const customStatusText = u.customStatus ? `<p class="text-[11px] text-[#23a559] truncate mt-0.5">${u.customStatus}</p>` : `<p class="text-[11px] text-[#6d717a] truncate mt-0.5">${isOnline ? 'ออนไลน์' : 'ออฟไลน์'}</p>`;
        
        if (id === currentUserId) { const myStatusUI = document.getElementById('current-user-status'); myStatusUI.textContent = u.customStatus || 'ออนไลน์'; myStatusUI.className = u.customStatus ? 'text-[11px] text-[#23a559] truncate leading-none mt-0.5' : 'text-[11px] text-[#6d717a] truncate leading-none mt-0.5'; document.getElementById('settings-custom-status').value = u.customStatus || ''; document.getElementById('settings-username-input').value = currentUsername; if(u.bannerURL) { document.getElementById('settings-banner-preview').src = u.bannerURL; document.getElementById('settings-banner-preview').classList.remove('hidden'); } }

        membersList.insertAdjacentHTML('beforeend', `<div onclick="showUserProfile('${userName}')" class="flex items-center space-x-3 cursor-pointer p-2 rounded-md hover:bg-[#2b2d31] transition group ${!isOnline ? 'opacity-50' : ''}"><div class="relative flex-shrink-0"><img id="img-avatar-${id}" src="${userAvatar}" class="w-8 h-8 rounded-full object-cover opacity-90"><div class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${statusColor} rounded-full border-[3px] border-[#151619]"></div></div><div class="overflow-hidden flex-1"><div class="flex items-center"><p class="text-[14px] font-medium truncate ${nameStyle}">${userName} ${roleDisplay}</p></div>${customStatusText}</div></div>`);
        if (u.inVoice && voiceActiveList) voiceActiveList.insertAdjacentHTML('beforeend', `<div class="flex items-center space-x-2.5 text-[13px] text-[#80848e] py-1 px-2 hover:bg-[#2b2d31] hover:text-[#dbdee1] rounded-md transition cursor-pointer ml-2"><div class="relative flex-shrink-0"><img id="img-sidebar-voice-${id}" src="${userAvatar}" class="w-6 h-6 rounded-full object-cover opacity-90"></div><span class="truncate font-medium flex-1 flex items-center">${userName} ${screenBadgeSmall}</span>${muteIconSmall}</div>`);
        if (u.inVoice) { 
            usersInVoiceCount++; 
            const isMe = id === currentUserId;
            const savedVol = userVolumes[id] !== undefined ? userVolumes[id] : 100;
            const volSlider = (!isMe && u.agoraUid) ? `<div class="w-full mt-1.5 px-3 flex items-center space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onclick="event.stopPropagation()"><i class="ph ph-speaker-high text-[#80848e] text-[12px]"></i><input type="range" min="0" max="300" value="${savedVol}" class="w-full h-1 accent-[#5865F2] cursor-pointer" oninput="changeUserVolume('${u.agoraUid}', '${id}', this.value)" title="ปรับเสียง (สูงสุด 300%)"></div>` : `<div class="h-6"></div>`;

            voiceGridHTML += `<div class="bg-[#111214] rounded-2xl w-[140px] h-[160px] sm:w-[160px] sm:h-[180px] md:w-[190px] md:h-[210px] pt-4 pb-2 px-2 flex flex-col items-center justify-center relative shadow-xl border border-[#1e1f22] animate-[fadeIn_0.3s_ease-out] hover:border-[#35373c] transition-colors group"><div class="relative mb-2 md:mb-3 flex-shrink-0"><img id="img-grid-voice-${id}" src="${userAvatar}" class="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full object-cover bg-gray-900 border-4 border-[#151619] shadow-2xl">${muteIconLarge}</div><p class="font-bold text-[#dbdee1] text-[13px] md:text-[15px] truncate w-full text-center px-2">${userName}</p>${volSlider}</div>`; 
        }
    });

    if (typingIndicator) { if (peopleTyping.length > 0) { typingIndicator.innerHTML = `<i class="ph-fill ph-chat-teardrop-dots mr-1.5 animate-bounce"></i> ${peopleTyping.join(', ')} กำลังพิมพ์...`; typingIndicator.classList.remove('opacity-0'); } else { typingIndicator.classList.add('opacity-0'); } }
    if (voiceGrid) { if (usersInVoiceCount > 0) { voiceGrid.innerHTML = voiceGridHTML; } else { voiceGrid.innerHTML = `<div class="w-full flex flex-col items-center justify-center mt-20 md:mt-32 text-[#6d717a]"><div class="w-20 h-20 md:w-24 md:h-24 bg-[#111214] rounded-full flex items-center justify-center mb-4 border border-[#1e1f22]"><i class="ph ph-users-three text-[40px] opacity-40"></i></div><p class="font-bold text-base text-[#949ba4]">ไม่มีใครอยู่ในห้องเสียง</p></div>`; } }
    renderMessages();
});

// ==========================================
// 🎨 7. โปรไฟล์ Settings
// ==========================================
const settingsModal = document.getElementById('settings-modal'), avatarInput = document.getElementById('settings-avatar-input'), bannerInput = document.getElementById('settings-banner-input');
document.getElementById('open-settings-btn').onclick = document.getElementById('mini-profile-btn').onclick = (e) => { e.preventDefault(); document.getElementById('settings-avatar-preview').src = document.getElementById('current-user-avatar').src; settingsModal.classList.remove('hidden'); sidebar.classList.remove('open'); overlay.classList.remove('active'); }; document.getElementById('close-settings-btn').onclick = () => { settingsModal.classList.add('hidden'); }; document.getElementById('settings-avatar-wrapper').onclick = () => avatarInput.click(); document.getElementById('settings-banner-wrapper').onclick = () => bannerInput.click();
async function uploadImage(file, type) { showToast(`กำลังอัปโหลด${type === 'avatar' ? 'โปรไฟล์' : 'ภาพปก'}... ⏳`, "info"); document.getElementById(`settings-${type}-wrapper`).classList.add('opacity-50', 'pointer-events-none'); try { const fd = new FormData(); fd.append("image", file); const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: fd }); const r = await res.json(); if (r.success) { if(type === 'avatar') { await updateProfile(auth.currentUser, { photoURL: r.data.url }); await updateDoc(doc(db, "users", currentUserId), { photoURL: r.data.url }); document.getElementById('settings-avatar-preview').src = r.data.url; document.getElementById('current-user-avatar').src = r.data.url; } else { await updateDoc(doc(db, "users", currentUserId), { bannerURL: r.data.url }); document.getElementById('settings-banner-preview').src = r.data.url; document.getElementById('settings-banner-preview').classList.remove('hidden'); } showToast("อัปโหลดสำเร็จ!", "success"); } } catch(err) { showToast("เกิดข้อผิดพลาดในการอัปโหลด", "error"); } finally { document.getElementById(`settings-${type}-wrapper`).classList.remove('opacity-50', 'pointer-events-none'); } }
avatarInput.onchange = (e) => { if(e.target.files[0]) uploadImage(e.target.files[0], 'avatar'); avatarInput.value = ""; }; bannerInput.onchange = (e) => { if(e.target.files[0]) uploadImage(e.target.files[0], 'banner'); bannerInput.value = ""; };
document.getElementById('save-settings-btn').onclick = async () => { const newName = document.getElementById('settings-username-input').value.trim() || currentUsername; const newStatus = document.getElementById('settings-custom-status').value.trim(); try { await updateProfile(auth.currentUser, { displayName: newName }); await updateDoc(doc(db, "users", currentUserId), { username: newName, customStatus: newStatus }); currentUsername = newName; document.getElementById('current-user-name').textContent = currentUsername; showToast("บันทึกการตั้งค่าโปรไฟล์สำเร็จ!", "success"); settingsModal.classList.add('hidden'); } catch(e) { showToast("เกิดข้อผิดพลาดในการบันทึก", "error"); } };

// ==========================================
// 🛡️ 8. ระบบ Auth
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid; currentUsername = user.displayName || user.email.split('@')[0];
        document.getElementById('current-user-name').textContent = currentUsername;
        document.getElementById('current-user-avatar').src = user.photoURL || `https://ui-avatars.com/api/?name=${currentUsername}&background=5865F2&color=fff&rounded=true&bold=true`;
        try { const userDoc = await getDoc(doc(db, "users", currentUserId)); if (userDoc.exists()) { currentUserRole = userDoc.data().role; if (currentUserRole === 'Admin') document.getElementById('admin-menu-btn').classList.remove('hidden'); } } catch (err) {}
        if ("Notification" in window && Notification.permission === "default") { Notification.requestPermission(); }
        const wasInVoice = localStorage.getItem('dosh_active_voice') === 'true';
        if (wasInVoice) { await updateDoc(doc(db, "users", currentUserId), { status: 'online' }).catch(e=>console.log(e)); setTimeout(() => { joinVoice(); document.querySelectorAll('.nav-btn').forEach(b => { b.classList.remove('channel-active', 'text-[#dbdee1]'); b.classList.add('channel-inactive', 'text-[#80848e]'); if (b.getAttribute('data-view') === 'voice') { b.classList.remove('channel-inactive', 'text-[#80848e]'); b.classList.add('channel-active', 'text-[#dbdee1]'); } }); Object.values(views).forEach(v => v.classList.add('hidden')); views['voice'].classList.remove('hidden'); membersSidebar.classList.remove('hidden', 'md:hidden'); }, 1500); } else { await updateDoc(doc(db, "users", currentUserId), { status: 'online', inVoice: false, agoraUid: null, isMuted: false, isSharingScreen: false, isTyping: false }).catch(e=>console.log(e)); }
    } else { window.location.href = "index.html"; }
});
document.getElementById('logout-btn').addEventListener('click', async () => { if (currentUserId) { try { await updateDoc(doc(db, "users", currentUserId), { status: 'offline', inVoice: false, agoraUid: null, isMuted: false, isSharingScreen: false, isTyping: false }); } catch (e) {} } localStorage.removeItem('dosh_active_voice'); if (localTracks.audioTrack) { await leaveVoice(); } signOut(auth); });

// ==========================================
// 💬 9. ระบบ Chat & Mentions
// ==========================================
const chatInput = document.getElementById('chat-input');
const gameChatInput = document.getElementById('game-chat-input');

const mentionPopup = document.createElement('div');
mentionPopup.id = 'mention-popup';
mentionPopup.className = 'hidden absolute bg-[#2b2d31] border border-[#1e1f22] rounded-lg shadow-2xl z-[100] w-48 max-h-40 overflow-y-auto py-1 animate-[slideUpFade_0.1s_ease-out]';
document.body.appendChild(mentionPopup);

let currentActiveInput = null;
let mentionQuery = '';

function handleMentionInput(e) {
    const input = e.target; currentActiveInput = input;
    const val = input.value; const cursorPos = input.selectionStart;
    const textBeforeCursor = val.substring(0, cursorPos);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_ก-๙]*)$/);
    if (match) {
        mentionQuery = match[1].toLowerCase();
        showMentionPopup(input, match[0]);
    } else { mentionPopup.classList.add('hidden'); }
}

function showMentionPopup(inputEl, fullMatch) {
    mentionPopup.innerHTML = '';
    const rect = inputEl.getBoundingClientRect();
    mentionPopup.style.left = `${rect.left}px`;
    mentionPopup.style.top = `${rect.top - 160}px`; 
    const matchedUsers = Object.keys(usersData).filter(name => name.toLowerCase().includes(mentionQuery));
    if (matchedUsers.length === 0) { mentionPopup.classList.add('hidden'); return; }
    mentionPopup.classList.remove('hidden');
    matchedUsers.forEach(name => {
        const u = usersData[name]; const item = document.createElement('div');
        item.className = 'flex items-center px-3 py-2 hover:bg-[#35373c] cursor-pointer transition';
        item.innerHTML = `<img src="${u.avatar}" class="w-6 h-6 rounded-full mr-2 object-cover opacity-90"><span class="text-[13px] font-bold text-[#dbdee1]">${name}</span>`;
        item.onclick = () => {
            const val = inputEl.value; const cursorPos = inputEl.selectionStart;
            const textBeforeCursor = val.substring(0, cursorPos); const textAfterCursor = val.substring(cursorPos);
            const newTextBefore = textBeforeCursor.replace(/@([a-zA-Z0-9_ก-๙]*)$/, `@${name} `);
            inputEl.value = newTextBefore + textAfterCursor; inputEl.focus();
            inputEl.selectionStart = inputEl.selectionEnd = newTextBefore.length;
            mentionPopup.classList.add('hidden');
        };
        mentionPopup.appendChild(item);
    });
}

chatInput.addEventListener('input', handleMentionInput);
gameChatInput.addEventListener('input', handleMentionInput);
document.addEventListener('click', (e) => { if (!mentionPopup.contains(e.target) && e.target !== chatInput && e.target !== gameChatInput) mentionPopup.classList.add('hidden'); });

chatInput.addEventListener('input', () => { if (!currentUserId) return; if (!isTyping) { isTyping = true; updateDoc(doc(db, "users", currentUserId), { isTyping: true, typingChannel: activeChannel }); } clearTimeout(typingTimeout); typingTimeout = setTimeout(() => { isTyping = false; updateDoc(doc(db, "users", currentUserId), { isTyping: false }); }, 2000); });
const deleteModal = document.getElementById('delete-confirm-modal'); window.deleteChatMsg = (msgId) => { messageToDelete = msgId; deleteModal.classList.remove('hidden'); }; document.getElementById('cancel-delete-btn').onclick = () => { messageToDelete = null; deleteModal.classList.add('hidden'); }; document.getElementById('confirm-delete-btn').onclick = async () => { if (messageToDelete) { try { await deleteDoc(doc(db, "messages", messageToDelete)); showToast("ลบข้อความสำเร็จ", "success"); } catch (err) { showToast("เกิดข้อผิดพลาดในการลบ", "error"); } messageToDelete = null; deleteModal.classList.add('hidden'); } };
window.setReply = (msgId, senderName, rawText) => { replyingTo = { msgId, senderName, text: rawText.substring(0, 40) + (rawText.length > 40 ? '...' : '') }; document.getElementById('reply-to-name').textContent = `@${senderName}`; document.getElementById('reply-to-text').textContent = replyingTo.text; document.getElementById('reply-banner').classList.remove('hidden'); chatInput.focus(); }; document.getElementById('cancel-reply-btn').onclick = () => { replyingTo = null; document.getElementById('reply-banner').classList.add('hidden'); };

function scrollToBottom(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const images = container.querySelectorAll('img');
    let loadedCount = 0;
    if (images.length > 0) {
        images.forEach(img => {
            if (img.complete) { loadedCount++; } 
            else { img.onload = () => { loadedCount++; if (loadedCount === images.length) container.scrollTop = container.scrollHeight; }; }
        });
    }
    container.scrollTop = container.scrollHeight;
}

let isInitialLoad = true;
onSnapshot(query(collection(db, "messages"), orderBy("timestamp", "asc")), (snapshot) => { 
    allMessages = []; snapshot.forEach((docSnap) => { allMessages.push({ id: docSnap.id, ...docSnap.data() }); }); renderMessages(); 
    
    if (activeChannel === 'game_draw') scrollToBottom('game-chat-container');
    else scrollToBottom('chat-container');

    if (!isInitialLoad) { 
        snapshot.docChanges().forEach((change) => { 
            if (change.type === "added") { 
                const m = change.doc.data(); 
                if (m.senderName !== currentUsername) { 
                    if (m.channel !== activeChannel) { unreadCounts[m.channel] = (unreadCounts[m.channel] || 0) + 1; updateUnreadBadge(m.channel); }
                    const isTagged = m.text && m.text.includes(`@${currentUsername}`);
                    if (isTagged) { sfxPing.play().catch(()=>{}); } else if (m.channel === activeChannel) { sfxMsg.play().catch(()=>{}); }
                } 
            } 
        }); 
    }
    isInitialLoad = false;
});

window.toggleReaction = async (msgId, emoji) => { if (!currentUserId) return; const msgRef = doc(db, "messages", msgId); const msgDoc = await getDoc(msgRef); if (!msgDoc.exists()) return; const data = msgDoc.data(); let reactions = data.reactions || {}; let usersReacted = reactions[emoji] || []; if (usersReacted.includes(currentUserId)) { usersReacted = usersReacted.filter(id => id !== currentUserId); } else { usersReacted.push(currentUserId); } if (usersReacted.length === 0) { delete reactions[emoji]; } else { reactions[emoji] = usersReacted; } await updateDoc(msgRef, { reactions: reactions }); };

function renderMessages() {
    let chatContainer = (activeChannel === 'game_draw') ? document.getElementById('game-chat-container') : document.getElementById('chat-container');
    if (!chatContainer) return;
    
    chatContainer.innerHTML = ''; 
    const filteredMessages = allMessages.filter(msg => msg.channel === activeChannel);
    let lastSender = null; 
    
    filteredMessages.forEach((m) => {
        let timeString = m.timestamp ? m.timestamp.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : "...";
        let formattedText = m.text ? m.text.replace(/\*\*(.*?)\*\*/g, '<span class="font-bold text-[#e4e5e7]">$1</span>') : '';

        let isMentioned = false;
        formattedText = formattedText.replace(/@([a-zA-Z0-9_ก-๙]+)/g, (match, username) => {
            if (username === currentUsername) {
                isMentioned = true;
                return `<span class="bg-[#5865F2]/40 text-[#dbdee1] font-bold px-1.5 py-0.5 rounded-md border border-[#5865F2]/50">@${username}</span>`;
            } else if (usersData[username]) {
                return `<span class="text-[#5865F2] font-bold hover:underline cursor-pointer" onclick="showUserProfile('${username}')">@${username}</span>`;
            }
            return match;
        });

        const rowHighlight = isMentioned ? "bg-[#5865F2]/10 border-l-[3px] border-[#5865F2] hover:bg-[#5865F2]/20" : "hover:bg-[#2b2d31]/50 border-l-[3px] border-transparent";

        if (m.senderName === "🤖 System Bot") {
            if (formattedText.includes("ยินดีต้อนรับสมาชิกใหม่")) {
                let cleanName = formattedText.split('**')[1] || "ใครบางคน";
                chatContainer.insertAdjacentHTML('beforeend', `<div class="chat-msg-row flex space-x-3 hover:bg-[#2b2d31]/50 border-l-[3px] border-transparent px-2 md:px-4 py-2.5 mt-2 -mx-2 md:-mx-4 group transition duration-150 items-start"><div class="w-8 md:w-10 flex justify-center mt-1"><i class="ph-bold ph-arrow-right text-[#23a559] text-[18px]"></i></div><div class="min-w-0 flex-1"><p class="text-[#949ba4] text-[14px] leading-relaxed"><span class="text-[#dbdee1] font-bold">${cleanName}</span> เพิ่งสไลด์เข้ามาในเซิร์ฟเวอร์! <span class="text-[10px] text-[#5c6069] ml-2 font-medium">${timeString}</span></p><button onclick="sendWave()" class="mt-2.5 flex items-center space-x-2 bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] px-3 py-1.5 rounded-md text-[13px] font-bold transition shadow-sm"><span class="text-[16px]">👋</span> <span>โบกมือทักทาย!</span></button></div></div>`);
                lastSender = "system_bot_join"; return;
            } else if (formattedText.includes("กระโดดเข้ามา") || formattedText.includes("ออกจากห้องนั่งเล่น")) {
                return;
            }
            chatContainer.insertAdjacentHTML('beforeend', `<div class="chat-msg-row flex space-x-3 md:space-x-4 hover:bg-[#2b2d31]/50 px-2 md:px-4 py-3 mt-4 -mx-2 md:-mx-4 group transition duration-150 relative items-center border-l-[3px] border-transparent hover:border-[#5865F2]"><div class="w-8 md:w-10 h-8 md:h-10 rounded-full bg-[#5865F2] flex items-center justify-center flex-shrink-0 shadow-lg"><i class="ph-fill ph-robot text-white text-[20px]"></i></div><div class="min-w-0 flex-1 pb-1"><div class="flex items-baseline space-x-2"><span class="font-extrabold text-[12px] text-[#5865F2] uppercase tracking-wider">System</span><span class="text-[10px] md:text-[11px] text-[#6d717a] font-medium">${timeString}</span></div><p class="text-[#949ba4] mt-1 text-[13px] md:text-[14px] leading-relaxed">${formattedText}</p></div></div>`);
            lastSender = "system_bot"; return; 
        }

        let msgAvatarUrl = usersData[m.senderName] ? usersData[m.senderName].avatar : `https://ui-avatars.com/api/?name=${m.senderName}&background=5865F2&color=fff&rounded=true&bold=true`;
        let contentHTML = formattedText ? `<p class="text-[#dbdee1] mt-0.5 leading-relaxed text-[14px] md:text-[15px]">${formattedText}</p>` : '';
        
        if (m.imageUrl) contentHTML += `<img src="${m.imageUrl}" onload="const c = this.closest('.overflow-y-auto'); if(c) c.scrollTop = c.scrollHeight;" onclick="openLightbox('${m.imageUrl}')" class="mt-2 rounded-lg max-w-[80%] md:max-w-sm shadow-sm cursor-zoom-in border border-[#2b2d31]">`;
        
        let reactsHTML = '';
        if (m.reactions && Object.keys(m.reactions).length > 0) {
            reactsHTML = `<div class="flex flex-wrap gap-1.5 mt-2">`;
            Object.entries(m.reactions).forEach(([emoji, usersArr]) => {
                const count = usersArr.length, hasReacted = usersArr.includes(currentUserId);
                const activeStyle = hasReacted ? 'bg-[#5865F2]/20 border-[#5865F2]/50 text-[#dbdee1]' : 'bg-[#2b2d31] border-[#1e1f22] text-[#80848e] hover:bg-[#35373c]';
                if (count > 0) reactsHTML += `<div class="border rounded-md px-1.5 py-0.5 text-[12px] flex items-center cursor-pointer transition ${activeStyle}" onclick="toggleReaction('${m.id}', '${emoji}')">${emoji} <span class="ml-1 font-bold ${hasReacted ? 'text-[#5865F2]' : ''}">${count}</span></div>`;
            });
            reactsHTML += `</div>`;
        }

        let replyBlockHTML = ''; let isReply = !!m.replyTo;
        if (isReply) {
            const replyAvatar = usersData[m.replyTo.senderName] ? usersData[m.replyTo.senderName].avatar : `https://ui-avatars.com/api/?name=${m.replyTo.senderName}`;
            replyBlockHTML = `<div class="flex items-center space-x-1.5 mb-1 opacity-70 hover:opacity-100 cursor-pointer transition select-none"><div class="w-4 h-4 border-l-2 border-t-2 border-[#4e5058] rounded-tl-md ml-3 mt-1"></div><img src="${replyAvatar}" class="w-4 h-4 rounded-full object-cover opacity-80"><span class="text-[11px] font-bold text-[#e4e5e7]">@${m.replyTo.senderName}</span><span class="text-[11px] text-[#b5bac1] truncate max-w-[150px] md:max-w-xs">${m.replyTo.text}</span></div>`;
        }

        const safeTextForReply = m.text ? m.text.replace(/'/g, "\\'").replace(/"/g, "&quot;") : 'ส่งรูปภาพ 🖼️';
        const replyBtn = `<div class="w-px h-4 bg-[#35373c] mx-1"></div><button onclick="setReply('${m.id}', '${m.senderName}', '${safeTextForReply}')" class="reaction-btn hover:bg-[#35373c] text-[#80848e] hover:text-[#dbdee1] rounded p-1 text-[16px]" title="ตอบกลับ"><i class="ph ph-arrow-bend-up-left"></i></button>`;
        const adminDeleteBtn = (currentUserRole === 'Admin') ? `<div class="w-px h-4 bg-[#35373c] mx-1"></div><button onclick="deleteChatMsg('${m.id}')" class="reaction-btn hover:bg-[#da373c]/20 text-[#da373c] rounded p-1 text-[16px]" title="ลบข้อความ"><i class="ph-fill ph-trash"></i></button>` : '';
        const actionMenuUI = `<div class="reaction-bar absolute -top-5 right-6 bg-[#2b2d31] border border-[#1e1f22] rounded-lg p-1 shadow-xl flex items-center space-x-0.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity"><button class="reaction-btn hover:bg-[#35373c] rounded p-1 text-[15px]" onclick="toggleReaction('${m.id}', '👍')">👍</button><button class="reaction-btn hover:bg-[#35373c] rounded p-1 text-[15px]" onclick="toggleReaction('${m.id}', '❤️')">❤️</button><button class="reaction-btn hover:bg-[#35373c] rounded p-1 text-[15px]" onclick="toggleReaction('${m.id}', '😂')">😂</button><button class="reaction-btn hover:bg-[#35373c] rounded p-1 text-[15px]" onclick="toggleReaction('${m.id}', '🔥')">🔥</button><button class="reaction-btn hover:bg-[#35373c] rounded p-1 text-[15px]" onclick="toggleReaction('${m.id}', '✅')">✅</button>${replyBtn}${adminDeleteBtn}</div>`;

        if (lastSender === m.senderName && !isReply) {
            chatContainer.insertAdjacentHTML('beforeend', `<div class="chat-msg-row flex space-x-3 md:space-x-4 ${rowHighlight} px-2 md:px-4 py-0.5 -mx-2 md:-mx-4 group transition duration-150 relative"><div class="w-8 md:w-10 flex-shrink-0 text-right"><span class="text-[9px] md:text-[10px] text-[#5c6069] opacity-0 group-hover:opacity-100 transition leading-relaxed font-medium">${timeString}</span></div><div class="min-w-0 flex-1 pb-0.5 pr-10">${contentHTML}${reactsHTML}</div>${actionMenuUI}</div>`);
        } else {
            chatContainer.insertAdjacentHTML('beforeend', `<div class="chat-msg-row flex flex-col ${rowHighlight} px-2 md:px-4 py-2 mt-4 -mx-2 md:-mx-4 group transition duration-150 relative">${replyBlockHTML}<div class="flex space-x-3 md:space-x-4"><img src="${msgAvatarUrl}" onclick="showUserProfile('${m.senderName}')" class="w-8 h-8 md:w-10 md:h-10 rounded-full flex-shrink-0 object-cover opacity-95 cursor-pointer hover:opacity-80 transition"><div class="min-w-0 flex-1 pb-0.5 pr-10"><div class="flex items-baseline space-x-2"><span onclick="showUserProfile('${m.senderName}')" class="font-medium text-[14px] md:text-[15px] text-[#e4e5e7] tracking-wide hover:underline cursor-pointer">${m.senderName}</span><span class="text-[10px] md:text-[11px] text-[#80848e] font-medium">${timeString}</span></div>${contentHTML}${reactsHTML}</div></div>${actionMenuUI}</div>`);
        }
        lastSender = m.senderName;
    });
    chatContainer.insertAdjacentHTML('beforeend', '<div class="h-4 w-full flex-shrink-0"></div>'); 
    setTimeout(() => { chatContainer.scrollTop = chatContainer.scrollHeight; }, 150);
}

const cmdMenu = document.getElementById('slash-command-menu');
chatInput.addEventListener('keyup', (e) => { if(chatInput.value.startsWith('/')) { cmdMenu.classList.remove('hidden'); } else { cmdMenu.classList.add('hidden'); } });
document.querySelectorAll('#command-list li').forEach(li => { li.onclick = () => { chatInput.value = li.getAttribute('data-cmd') + " "; chatInput.focus(); cmdMenu.classList.add('hidden'); } });

// ==========================================
// 🎨 10. เกมทายภาพ (Draw & Guess) + AI Word
// ==========================================
let currentDrawGame = { isActive: false };
onSnapshot(doc(db, "appData", "drawGame"), (d) => {
    if(d.exists()) {
        currentDrawGame = d.data();
        const display = document.getElementById('game-word-display');
        const toolbar = document.getElementById('game-toolbar');
        
        if(currentDrawGame.isActive) {
            if(currentDrawGame.drawerId === currentUserId) {
                display.innerHTML = `🎨 คำปริศนาของคุณคือ: <span class="text-yellow-400 ml-2 font-bold tracking-wider">${currentDrawGame.word}</span>`;
                toolbar.classList.remove('hidden');
            } else {
                let hiddenWord = currentDrawGame.word.replace(/./g, '_ ');
                display.innerHTML = `🤔 <span class="text-yellow-400 mr-2 font-bold">${currentDrawGame.drawerName}</span> กำลังวาด... | <span class="tracking-widest ml-2">${hiddenWord}</span>`;
                toolbar.classList.add('hidden');
            }
        } else {
            display.innerHTML = `<i class="ph-fill ph-check-circle mr-2 text-[#23a559]"></i> เกมจบแล้ว รอเริ่มรอบใหม่`;
            toolbar.classList.add('hidden');
        }
    }
});

document.getElementById('start-game-btn').onclick = async () => {
    const btn = document.getElementById('start-game-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="ph-fill ph-spinner animate-spin mr-1.5 text-[16px]"></i> AI กำลังคิดคำ...`;
    btn.disabled = true;

    const randomWord = await getWordFromAI(); 
    
    const gameCanvas = document.getElementById('game-whiteboard-canvas'); const gctx = gameCanvas.getContext('2d');
    gctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
    await setDoc(doc(db, "appData", "gameWhiteboard"), { image: "", updatedBy: "System", timestamp: serverTimestamp() }, { merge: true });
    
    await setDoc(doc(db, "appData", "drawGame"), { isActive: true, drawerId: currentUserId, drawerName: currentUsername, word: randomWord, channel: "game_draw", timestamp: serverTimestamp() });
    await addDoc(collection(db, "messages"), { text: `🎨 **${currentUsername}** เริ่มเกมทายภาพแล้ว! (คำศัพท์รอบนี้สุ่มโดย AI 🧠)`, senderName: "🤖 System Bot", channel: "game_draw", timestamp: serverTimestamp() });
    
    btn.innerHTML = originalText;
    btn.disabled = false;
};

async function sendAnyMessage(inputEl, channelStr) {
    const txt = inputEl.value.trim(); if (!txt) return; inputEl.value = ''; 
    clearTimeout(typingTimeout); isTyping = false; updateDoc(doc(db, "users", currentUserId), { isTyping: false }); 
    cmdMenu.classList.add('hidden');
    mentionPopup.classList.add('hidden');
    
    if(txt.startsWith('/') && channelStr !== 'game_draw') {
        let botReply = "";
        if(txt === '/roll') { const roll = Math.floor(Math.random() * 100) + 1; botReply = `🎲 **${currentUsername}** ทอยลูกเต๋าได้แต้ม **${roll}** (จาก 100)`; } 
        else if(txt === '/coin') { const coin = Math.random() < 0.5 ? "หัว" : "ก้อย"; botReply = `🪙 **${currentUsername}** โยนเหรียญออก **${coin}**`; } 
        else if(txt === '/clear') { if(currentUserRole !== 'Admin') { showToast("คุณไม่ใช่ Admin ไม่มีสิทธิ์", "error"); return; } const msgs = allMessages.filter(m => m.channel === channelStr); for(let m of msgs) await deleteDoc(doc(db, "messages", m.id)); botReply = `🧹 แอดมินล้างห้องแชทเรียบร้อยแล้ว`; } 
        else if(txt === '/draw') { 
            await addDoc(collection(db, "messages"), { text: `⏳ บอทกำลังปลุก AI ให้หาคำศัพท์ยากๆ แป๊บนึงนะ...`, senderName: "🤖 System Bot", channel: activeChannel, timestamp: serverTimestamp() });
            const randomWord = await getWordFromAI();
            const canvas = document.getElementById('whiteboard-canvas'); const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            await setDoc(doc(db, "appData", "whiteboard"), { image: "", updatedBy: "System", timestamp: serverTimestamp() }, { merge: true });
            await setDoc(doc(db, "appData", "drawGame"), { isActive: true, drawerId: currentUserId, drawerName: currentUsername, word: randomWord, channel: activeChannel, timestamp: serverTimestamp() });
            botReply = `🎨 **${currentUsername}** ท้าประลองเกมทายภาพ!\nรีบสลับหน้าจอไปดูที่แท็บ **"🎮 ทายคำจากภาพ"** แล้วพิมพ์คำตอบเลย! (AI เป็นคนคิดคำนะรอบนี้)`; 
        }
        else { showToast("ไม่รู้จักคำสั่งนี้", "error"); return; }
        await addDoc(collection(db, "messages"), { text: botReply, senderName: "🤖 System Bot", channel: channelStr, timestamp: serverTimestamp() }); return;
    }

    if (channelStr === 'game_draw' && currentDrawGame.isActive && currentDrawGame.drawerId === currentUserId) {
        const answer = currentDrawGame.word.toLowerCase();
        const msg = txt.toLowerCase();
        if (msg.includes(answer)) {
            showToast("ห้ามพิมพ์สปอยล์เพื่อน!", "error");
            await addDoc(collection(db, "messages"), { text: `🚨 เห้ยยยย! **${currentUsername}** จะพิมพ์เฉลยสปอยล์เพื่อนทำไม! วาดต่อไปเงียบๆ เลยนะ! 🛑`, senderName: "🤖 System Bot", channel: channelStr, timestamp: serverTimestamp() });
            return;
        }
    }

    let isCorrect = false; let isAlmost = false;
    if (channelStr === 'game_draw' && currentDrawGame.isActive && currentDrawGame.drawerId !== currentUserId) {
        const guess = txt.toLowerCase(); const answer = currentDrawGame.word.toLowerCase();
        if (guess === answer) { isCorrect = true; } 
        else if (guess !== answer && answer.length >= 3 && (answer.includes(guess) && answer.length - guess.length <= 2)) { isAlmost = true; }
    }

    await addDoc(collection(db, "messages"), { text: txt, senderName: currentUsername, channel: channelStr, timestamp: serverTimestamp(), reactions: {}, replyTo: replyingTo }); 
    replyingTo = null; document.getElementById('reply-banner').classList.add('hidden'); 
    
    if(isCorrect) {
        await setDoc(doc(db, "appData", "drawGame"), { isActive: false }, { merge: true });
        await addDoc(collection(db, "messages"), { text: `🎉 ปรบมือ! **${currentUsername}** ทายถูกเป๊ะ!\nคำตอบคือ **"${currentDrawGame.word}"** เก่งมาก! 🏆`, senderName: "🤖 System Bot", channel: channelStr, timestamp: serverTimestamp() });
    } else if (isAlmost) {
        await addDoc(collection(db, "messages"), { text: `👀 **${currentUsername}** เกือบถูกแล้ว! พิมพ์ตกไปนิดเดียว พยายามอีกนิด!`, senderName: "🤖 System Bot", channel: channelStr, timestamp: serverTimestamp() });
    }
}

document.getElementById('send-btn').onclick = () => sendAnyMessage(chatInput, activeChannel); 
chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendAnyMessage(chatInput, activeChannel); };
document.getElementById('game-send-btn').onclick = () => sendAnyMessage(gameChatInput, 'game_draw'); 
gameChatInput.onkeypress = (e) => { if (e.key === 'Enter') sendAnyMessage(gameChatInput, 'game_draw'); };

document.getElementById('attach-btn').onclick = () => document.getElementById('file-input').click();
document.getElementById('file-input').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; chatInput.placeholder = "กำลังอัปโหลดไฟล์..."; chatInput.disabled = true; try { const fd = new FormData(); fd.append("image", f); const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: fd }); const r = await res.json(); if (r.success) { await addDoc(collection(db, "messages"), { text: "", imageUrl: r.data.url, senderName: currentUsername, channel: activeChannel, timestamp: serverTimestamp(), reactions: {}, replyTo: replyingTo }); replyingTo = null; document.getElementById('reply-banner').classList.add('hidden'); } } catch (err) { showToast("อัปโหลดพลาด", "error"); } finally { chatInput.placeholder = "ส่งข้อความถึง #ห้องแชท"; chatInput.disabled = false; chatInput.value = ""; chatInput.focus(); } };

// ==========================================
// 🎨 11. ระบบกระดานวาดรูป แก้กระตุก (WebP) + แก้บั๊กยางลบ
// ==========================================
const canvas = document.getElementById('whiteboard-canvas'), ctx = canvas.getContext('2d'), canvasContainer = document.getElementById('canvas-container'), wbStatus = document.getElementById('wb-status');
const gameCanvas = document.getElementById('game-whiteboard-canvas'), gameCtx = gameCanvas.getContext('2d'), gameCanvasContainer = document.getElementById('game-canvas-container');
let isDrawing = false; let isGameDrawing = false; let isEraserMode = false;
let wbSyncTimer = null; let gameWbSyncTimer = null;

function initCanvasSize() { if(canvas.width !== canvasContainer.clientWidth || canvas.height !== canvasContainer.clientHeight) { const temp = canvas.toDataURL(); canvas.width = canvasContainer.clientWidth; canvas.height = canvasContainer.clientHeight; if(temp !== "data:,") { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = temp; } } }
function initGameCanvasSize() { if(gameCanvas.width !== gameCanvasContainer.clientWidth || gameCanvas.height !== gameCanvasContainer.clientHeight) { const temp = gameCanvas.toDataURL(); gameCanvas.width = gameCanvasContainer.clientWidth; gameCanvas.height = gameCanvasContainer.clientHeight; if(temp !== "data:,") { const img = new Image(); img.onload = () => gameCtx.drawImage(img, 0, 0); img.src = temp; } } }

window.addEventListener('resize', () => { initCanvasSize(); initGameCanvasSize(); }); 
function getMousePos(e, c) { const r = c.getBoundingClientRect(); const x = e.touches ? e.touches[0].clientX : e.clientX, y = e.touches ? e.touches[0].clientY : e.clientY; return { x: x - r.left, y: y - r.top }; } 

function startDrawing(e) { if(e.type === 'touchstart') e.preventDefault(); isDrawing = true; draw(e); } 
function draw(e) { if (!isDrawing) return; if(e.type === 'touchmove') e.preventDefault(); const p = getMousePos(e, canvas); ctx.lineWidth = document.getElementById('wb-size').value; ctx.lineCap = 'round'; ctx.strokeStyle = document.getElementById('wb-color').value; ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x, p.y); } 
function stopDrawing() { if (!isDrawing) return; isDrawing = false; ctx.beginPath(); clearTimeout(wbSyncTimer); wbSyncTimer = setTimeout(() => syncWhiteboard(), 400); } 
canvas.onmousedown = startDrawing; canvas.onmousemove = draw; canvas.onmouseup = canvas.onmouseout = stopDrawing; canvas.addEventListener('touchstart', startDrawing, {passive: false}); canvas.addEventListener('touchmove', draw, {passive: false}); canvas.addEventListener('touchend', stopDrawing); 
document.getElementById('wb-clear').onclick = () => { if(confirm("ล้างกระดานทั้งหมด?")) { ctx.clearRect(0, 0, canvas.width, canvas.height); syncWhiteboard(true); showToast("ล้างกระดานแล้ว", "success"); } }; 
async function syncWhiteboard(isC = false) { if(!currentUserId) return; const imgData = isC ? "" : canvas.toDataURL("image/webp", 0.5); await setDoc(doc(db, "appData", "whiteboard"), { image: imgData, updatedBy: currentUsername, timestamp: serverTimestamp() }, { merge: true }); } 
onSnapshot(doc(db, "appData", "whiteboard"), (d) => { if (d.exists() && !isDrawing) { const val = d.data(); if (val.updatedBy && val.updatedBy !== currentUsername && !currentDrawGame.isActive) { wbStatus.innerHTML = `<i class="ph ph-pencil-simple mr-1.5"></i> ${val.updatedBy} เพิ่งอัปเดตกระดาน`; wbStatus.classList.remove('opacity-0'); setTimeout(() => { if(!currentDrawGame.isActive) wbStatus.classList.add('opacity-0'); }, 3000); } if(val.image) { const img = new Image(); img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); }; img.src = val.image; } else { ctx.clearRect(0, 0, canvas.width, canvas.height); } } });

document.getElementById('game-eraser-btn').onclick = () => { isEraserMode = !isEraserMode; document.getElementById('game-eraser-btn').classList.toggle('text-white'); document.getElementById('game-eraser-btn').classList.toggle('bg-[#35373c]'); };
function startGameDrawing(e) { if(!currentDrawGame.isActive || currentDrawGame.drawerId !== currentUserId) return; if(e.type === 'touchstart') e.preventDefault(); isGameDrawing = true; drawGame(e); } 
function drawGame(e) { if (!isGameDrawing) return; if(e.type === 'touchmove') e.preventDefault(); const p = getMousePos(e, gameCanvas); gameCtx.lineWidth = document.getElementById('game-size').value; gameCtx.lineCap = 'round'; gameCtx.globalCompositeOperation = isEraserMode ? 'destination-out' : 'source-over'; gameCtx.strokeStyle = document.getElementById('game-color').value; gameCtx.lineTo(p.x, p.y); gameCtx.stroke(); gameCtx.beginPath(); gameCtx.moveTo(p.x, p.y); } 
function stopGameDrawing() { if (!isGameDrawing) return; isGameDrawing = false; gameCtx.beginPath(); clearTimeout(gameWbSyncTimer); gameWbSyncTimer = setTimeout(() => syncGameWhiteboard(), 250); } 
gameCanvas.onmousedown = startGameDrawing; gameCanvas.onmousemove = drawGame; gameCanvas.onmouseup = gameCanvas.onmouseout = stopGameDrawing; gameCanvas.addEventListener('touchstart', startGameDrawing, {passive: false}); gameCanvas.addEventListener('touchmove', drawGame, {passive: false}); gameCanvas.addEventListener('touchmove', function(e){ if(isGameDrawing) e.preventDefault(); }, {passive: false}); gameCanvas.addEventListener('touchend', stopGameDrawing); 
document.getElementById('game-clear-btn').onclick = () => { gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height); syncGameWhiteboard(true); }; 
async function syncGameWhiteboard(isC = false) { const imgData = isC ? "" : gameCanvas.toDataURL("image/webp", 0.5); await setDoc(doc(db, "appData", "gameWhiteboard"), { image: imgData, updatedBy: currentUsername, timestamp: serverTimestamp() }, { merge: true }); } 

// 🌟 แก้บั๊กยางลบ
onSnapshot(doc(db, "appData", "gameWhiteboard"), (d) => { 
    if (d.exists() && !isGameDrawing) { 
        const val = d.data(); 
        if(val.image) { 
            const img = new Image(); 
            img.onload = () => { 
                gameCtx.globalCompositeOperation = 'source-over'; 
                gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height); 
                gameCtx.drawImage(img, 0, 0); 
            }; 
            img.src = val.image; 
        } else { 
            gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height); 
        } 
    } 
});

// ==========================================
// 🎙️ 12. ระบบเสียง & แชร์จอ (Agora) พร้อมปรับความชัด
// ==========================================
const joinBtn = document.getElementById('join-voice-btn'), leaveBtn = document.getElementById('leave-voice-btn'), muteBtn = document.getElementById('mute-btn'), ssBtn = document.getElementById('screen-share-btn'), ssStage = document.getElementById('screen-share-stage');
async function joinVoice() { 
    try { 
        joinBtn.innerHTML = "กำลังเชื่อมต่อ..."; 
        myNumericUid = Math.floor(Math.random() * 1000000); 
        rtcClient.on("user-published", async (u, t) => { 
            await rtcClient.subscribe(u, t); 
            if (t === "audio") {
                u.audioTrack.play(); 
                remoteAudioTracks[u.uid] = u.audioTrack; 
                
                let matchedUserId = null;
                for(let k in usersData) { if(usersData[k].agoraUid === u.uid) { matchedUserId = usersData[k].id; break; } }
                if(matchedUserId && userVolumes[matchedUserId] !== undefined) {
                    u.audioTrack.setVolume(parseInt(userVolumes[matchedUserId]));
                }
            }
            if (t === "video") { 
                ssStage.classList.remove('hidden'); 
                const ex = document.getElementById(`v-wrap-${u.uid}`); if(ex) ex.remove(); 
                let pc = document.createElement("div"); pc.id = `v-wrap-${u.uid}`; pc.style.cssText="width:100%;height:100%;"; pc.className = "rounded-lg overflow-hidden bg-black flex items-center justify-center"; 
                ssStage.appendChild(pc); u.videoTrack.play(pc, { fit: "contain" }); 
            } 
        }); 
        rtcClient.on("user-unpublished", async (u, t) => { 
            if (t === "audio") { delete remoteAudioTracks[u.uid]; } 
            if (t === "video") { 
                const pc = document.getElementById(`v-wrap-${u.uid}`); if (pc) pc.remove(); 
                
                // 🌟 เช็คว่าถ้าไม่มีกล่องวิดีโอ (v-wrap) เหลืออยู่เลย ค่อยซ่อนกรอบจอดำ
                const activeStreams = ssStage.querySelectorAll('div[id^="v-wrap-"]');
                if (activeStreams.length === 0) ssStage.classList.add('hidden'); 
            } 
        }); 
        rtcClient.enableAudioVolumeIndicator(); rtcClient.on("volume-indicator", vs => { document.querySelectorAll('.speaking-ring').forEach(i => i.classList.remove('speaking-ring')); vs.forEach(v => { if (v.level > 10) { let sId = null; if (v.uid === myNumericUid || v.uid === 0) { sId = currentUserId; } else { for (const k in usersData) { if (usersData[k].agoraUid === v.uid) { sId = usersData[k].id; break; } } } if (sId) { const a1 = document.getElementById(`img-avatar-${sId}`), a2 = document.getElementById(`img-sidebar-voice-${sId}`), a3 = document.getElementById(`img-grid-voice-${sId}`); if(a1) a1.classList.add('speaking-ring'); if(a2) a2.classList.add('speaking-ring'); if(a3) a3.classList.add('speaking-ring'); } } }); }); 
        await rtcClient.join(AGORA_APP_ID, "DOSH_VOICE", null, myNumericUid); 
        localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true, AGC: true }); 
        await rtcClient.publish(localTracks.audioTrack); 
        isMuted = false; 
        await updateDoc(doc(db, "users", currentUserId), { inVoice: true, agoraUid: myNumericUid, isMuted: false, isSharingScreen: false }); 
        localStorage.setItem('dosh_active_voice', 'true'); 
        joinBtn.classList.add('hidden'); document.getElementById('active-voice-ui').classList.remove('hidden'); muteBtn.classList.add('bg-[#2b2d31]'); muteBtn.classList.remove('bg-[#da373c]/20', 'text-[#da373c]'); document.getElementById('mute-icon').className = "ph ph-microphone text-[20px] md:text-[24px]"; 

        startBackgroundAudioMode(); amIInVoice = true;
        if(latestWPData && latestWPData.videoId) { initOrUpdatePlayer(latestWPData.videoId, latestWPData.time, latestWPData.state, latestWPData.updatedBy); }

    } catch (err) { console.error(err); localStorage.removeItem('dosh_active_voice'); showToast("เชื่อมต่อไมค์ไม่สำเร็จ", "error"); joinBtn.innerHTML = '<i class="ph-fill ph-phone-call text-[20px] md:text-[22px] mr-1.5 md:mr-2"></i> <span class="hidden md:inline">เข้าร่วมการแชทด้วยเสียง</span><span class="md:hidden">เข้าร่วมห้องเสียง</span>'; } 
}

ssBtn.onclick = async () => { 
    const sIco = document.getElementById('screen-icon'); 
    const ssWrapper = document.getElementById('screen-share-wrapper');
    const qualitySelect = document.getElementById('screen-quality');
    
    if (!isSharingScreen) { 
        try { 
            const selectedQuality = qualitySelect ? qualitySelect.value : "1080p_1";
            
            const res = await AgoraRTC.createScreenVideoTrack({ encoderConfig: selectedQuality, optimizationMode: "detail" }, "auto"); 
            if (Array.isArray(res)) { screenTrack = res[0]; screenAudioTrack = res[1]; await rtcClient.publish([screenTrack, screenAudioTrack]); } 
            else { screenTrack = res; await rtcClient.publish(screenTrack); } 
            
            isSharingScreen = true; 
            await updateDoc(doc(db, "users", currentUserId), { isSharingScreen: true }); 
            
            if (ssWrapper) ssWrapper.classList.replace('bg-[#2b2d31]', 'bg-[#23a559]'); 
            else ssBtn.classList.replace('bg-[#2b2d31]', 'bg-[#23a559]');
            
            if(sIco) sIco.className = "ph-fill ph-screencast text-[20px] md:text-[24px] text-white"; 
            
            if (qualitySelect) {
                qualitySelect.classList.replace('text-[#80848e]', 'text-white');
                qualitySelect.disabled = true;
            }
            
            ssStage.classList.remove('hidden'); 
            let pc = document.createElement("div"); pc.id = `v-wrap-local`; pc.style.cssText="width:100%;height:100%;"; pc.className = "rounded-lg overflow-hidden bg-black flex items-center justify-center"; ssStage.appendChild(pc); 
            screenTrack.play(pc, { fit: "contain" }); 
            
            // ผูกเหตุการณ์ตอนกด "Stop sharing" ตรงปุ่มแผงควบคุมของ Chrome
            screenTrack.on("track-ended", stopScreenShare); 
        } catch (err) { console.log(err); showToast("แชร์หน้าจอไม่สำเร็จ", "error"); } 
    } else { 
        await stopScreenShare(); 
    } 
};

// 🌟 ฟังก์ชันหยุดแชร์จอแบบลบจอดำให้หายเกลี้ยง! 
async function stopScreenShare() { 
    const ssWrapper = document.getElementById('screen-share-wrapper');
    const qualitySelect = document.getElementById('screen-quality');
    const sIco = document.getElementById('screen-icon');
    
    if (screenTrack) { await rtcClient.unpublish(screenTrack); screenTrack.stop(); screenTrack.close(); screenTrack = null; } 
    if (screenAudioTrack) { await rtcClient.unpublish(screenAudioTrack); screenAudioTrack.stop(); screenAudioTrack.close(); screenAudioTrack = null; } 
    
    isSharingScreen = false; 
    if(currentUserId) await updateDoc(doc(db, "users", currentUserId), { isSharingScreen: false }); 
    
    if (ssWrapper) ssWrapper.classList.replace('bg-[#23a559]', 'bg-[#2b2d31]'); 
    else ssBtn.classList.replace('bg-[#23a559]', 'bg-[#2b2d31]');
    
    if (sIco) sIco.className = "ph ph-screencast text-[20px] md:text-[24px] text-[#dbdee1]"; 
    
    if (qualitySelect) {
        qualitySelect.classList.replace('text-white', 'text-[#80848e]');
        qualitySelect.disabled = false;
    }
    
    const pc = document.getElementById(`v-wrap-local`); if (pc) pc.remove(); 
    
    // 🌟 เช็คว่าถ้าไม่มีกล่องวิดีโอ (v-wrap) เหลืออยู่เลย ค่อยซ่อนกรอบจอดำ
    const activeStreams = ssStage.querySelectorAll('div[id^="v-wrap-"]');
    if (activeStreams.length === 0) ssStage.classList.add('hidden'); 
    
    showToast("หยุดแชร์หน้าจอแล้ว", "info");
}

async function leaveVoice() { 
    if (isSharingScreen) await stopScreenShare(); if (localTracks.audioTrack) { localTracks.audioTrack.stop(); localTracks.audioTrack.close(); } 
    await rtcClient.leave(); if(currentUserId) { await updateDoc(doc(db, "users", currentUserId), { inVoice: false, agoraUid: null, isMuted: false, isSharingScreen: false }); } 
    localStorage.removeItem('dosh_active_voice'); document.querySelectorAll('.speaking-ring').forEach(i => i.classList.remove('speaking-ring')); 
    joinBtn.classList.remove('hidden'); joinBtn.innerHTML = '<i class="ph-fill ph-phone-call text-[20px] md:text-[22px] mr-1.5 md:mr-2"></i> <span class="hidden md:inline">เข้าร่วมการแชทด้วยเสียง</span><span class="md:hidden">เข้าร่วมห้องเสียง</span>'; 
    document.getElementById('active-voice-ui').classList.add('hidden'); 
    if ('mediaSession' in navigator) { navigator.mediaSession.playbackState = 'none'; } amIInVoice = false;
    if(ytPlayer && typeof ytPlayer.destroy === 'function') { ytPlayer.destroy(); ytPlayer = null; } document.getElementById('yt-wrapper').innerHTML = '<div id="yt-player-container"></div>'; document.getElementById('watch-party-stage').classList.add('hidden'); document.getElementById('watch-party-stage').classList.remove('flex');
}
joinBtn.onclick = joinVoice; leaveBtn.onclick = leaveVoice;
muteBtn.onclick = async () => { isMuted = !isMuted; localTracks.audioTrack.setEnabled(!isMuted); await updateDoc(doc(db, "users", currentUserId), { isMuted: isMuted }); const muteIcon = document.getElementById('mute-icon'); if (isMuted) { muteBtn.classList.remove('bg-[#2b2d31]'); muteBtn.classList.add('bg-[#da373c]/20', 'text-[#da373c]'); muteIcon.className = "ph-fill ph-microphone-slash text-[20px] md:text-[24px]"; } else { muteBtn.classList.add('bg-[#2b2d31]'); muteBtn.classList.remove('bg-[#da373c]/20', 'text-[#da373c]'); muteIcon.className = "ph ph-microphone text-[20px] md:text-[24px]"; } };

// ==========================================
// 📋 13. Task Board & Tour
// ==========================================
const zones = { 'todo': document.getElementById('todo'), 'in_progress': document.getElementById('in_progress'), 'done': document.getElementById('done') };
onSnapshot(collection(db, "tasks"), (snapshot) => { Object.values(zones).forEach(z => z.innerHTML = ''); snapshot.forEach((docSnap) => { const d = docSnap.data(), id = docSnap.id, s = d.status || 'todo'; let tC = "bg-[#1e1f22] text-[#dbdee1] border border-[#35373c]"; if(d.tag && d.tag.includes('Dev')) tC = "bg-blue-500/10 text-blue-400 border border-blue-500/20"; if(d.tag && d.tag.includes('Music')) tC = "bg-pink-500/10 text-pink-400 border border-pink-500/20"; if(d.tag && d.tag.includes('Video')) tC = "bg-purple-500/10 text-purple-400 border border-purple-500/20"; if(d.tag && d.tag.includes('Design')) tC = "bg-[#23a559]/10 text-[#23a559] border border-[#23a559]/20"; const cardHTML = `<div draggable="true" data-id="${id}" class="task-card bg-[#1e1f22] p-3 rounded-lg shadow-sm cursor-move hover:shadow-md hover:-translate-y-0.5 transition duration-200 mb-2 border-l-4 ${s === 'done' ? 'border-[#4e5058] opacity-50' : 'border-[#5865F2]'} group animate-[fadeIn_0.3s_ease-out]"><div class="flex space-x-2 mb-2.5"><span class="${tC} text-[10px] font-bold px-2 py-0.5 rounded-sm flex items-center"><i class="ph-fill ph-tag text-[10px] mr-1"></i>${d.tag}</span></div><p class="text-[13px] md:text-[14px] font-medium text-[#dbdee1] ${s === 'done' ? 'line-through text-[#80848e]' : ''} leading-snug">${d.title}</p></div>`; if (zones[s]) zones[s].insertAdjacentHTML('beforeend', cardHTML); }); document.querySelectorAll('.task-card').forEach(c => { c.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', c.getAttribute('data-id')); setTimeout(() => c.classList.add('opacity-30'), 0); }); c.addEventListener('dragend', () => c.classList.remove('opacity-30')); }); });
Object.keys(zones).forEach(s => { const z = zones[s]; z.addEventListener('dragover', (e) => { e.preventDefault(); z.classList.add('drop-zone-active'); }); z.addEventListener('dragleave', () => z.classList.remove('drop-zone-active')); z.addEventListener('drop', async (e) => { e.preventDefault(); z.classList.remove('drop-zone-active'); const tId = e.dataTransfer.getData('text/plain'); if (tId) await updateDoc(doc(db, "tasks", tId), { status: s }); }); });

const taskModal = document.getElementById('task-modal');
document.getElementById('add-task-btn').addEventListener('click', () => { document.getElementById('task-title-input').value = ''; taskModal.classList.remove('hidden'); }); document.getElementById('close-task-modal').addEventListener('click', () => { taskModal.classList.add('hidden'); }); document.getElementById('confirm-task-btn').addEventListener('click', async () => { const title = document.getElementById('task-title-input').value.trim(); const tag = document.getElementById('task-tag-input').value; if (!title) { showToast("กรุณากรอกชื่องานก่อนครับ!", "error"); return; } await addDoc(collection(db, "tasks"), { title: title, tag: tag, status: 'todo', timestamp: serverTimestamp() }); taskModal.classList.add('hidden'); showToast("เพิ่มงานใหม่ลงในกระดานแล้ว!", "success"); });

if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').then(r => console.log('✅ HIVE SW Active')).catch(e => console.log('❌ SW Fail:', e)); }); }

// 🌟 ระบบ Tour และเปลี่ยนชื่อเป็น HIVE
const tourOverlay = document.getElementById('tour-overlay'); const tourTooltip = document.getElementById('tour-tooltip'); const tourTitle = document.getElementById('tour-title'); const tourDesc = document.getElementById('tour-desc'); const tourStepCount = document.getElementById('tour-step-count'); const tourNextBtn = document.getElementById('tour-next-btn'); const tourSkipBtn = document.getElementById('tour-skip-btn');
const tourSteps = [ { target: null, title: "ยินดีต้อนรับสู่ HIVE! 🎉", desc: "Super App สำหรับทีมครีเอทีฟและมัลติมีเดีย จบครบทุกงานในเว็บเดียว! เดี๋ยวเราจะพาไปดูว่ามีเครื่องมืออะไรให้ใช้บ้าง", pos: "center" }, { target: ".nav-btn[data-view='chat']", title: "1. ห้องแชทอัจฉริยะ 💬", desc: "คุยงาน ส่งไฟล์ ซูมรูปภาพ พิมพ์คำสั่ง / บอท หรือแม้แต่ 'ตอบกลับข้อความ' ก็ทำได้ครบจบที่นี่!", pos: "right" }, { target: ".nav-btn[data-view='voice']", title: "2. ห้องนั่งเล่น (Voice Lounge) 🎙️", desc: "เปิดไมค์คุยงาน แชร์หน้าจอ (Screen Share) หรือจะเปิดคลิป YouTube รัน Watch Party ดูพร้อมกันทั้งแก๊งก็ยังได้!", pos: "right" }, { target: ".nav-btn[data-view='board']", title: "3. ระบบกระดานงาน (Task Board) 📋", desc: "สร้างงาน จัดหมวดหมู่ แล้วลากแปะ (Drag & Drop) เพื่ออัปเดตสถานะงานให้เพื่อนๆ ในทีมรู้ความคืบหน้าแบบ Real-time", pos: "right" }, { target: "#mini-profile-btn", title: "4. ปรับแต่งโปรไฟล์ 🪪", desc: "กดตรงนี้เพื่อตั้งค่า 'รูปภาพปก (Banner)' เปลี่ยนสีชื่อ และตั้งสถานะ (Custom Status) โชว์ความเท่ให้เพื่อนในทีมเห็น!", pos: "top" } ];
let currentTourStep = 0; let activeHighlightTarget = null;

function highlightElement(selector, pos) { 
    if (activeHighlightTarget) activeHighlightTarget.classList.remove('relative', 'z-[102]', 'ring-4', 'ring-[#5865F2]', 'ring-offset-4', 'ring-offset-[#0e0f11]', 'rounded-lg', 'bg-[#1a1b1e]'); 
    if (!selector) return; 
    const el = document.querySelector(selector); 
    if (el) { 
        if(window.innerWidth < 768) { sidebar.classList.add('open'); overlay.classList.add('active'); } 
        el.classList.add('relative', 'z-[102]', 'ring-4', 'ring-[#5865F2]', 'ring-offset-4', 'ring-offset-[#0e0f11]', 'rounded-lg', 'bg-[#1a1b1e]'); 
        activeHighlightTarget = el; 
        
        setTimeout(() => {
            const rect = el.getBoundingClientRect(); 
            let tTop, tLeft;
            
            if (pos === "top") {
                tTop = rect.top - tourTooltip.offsetHeight - 20;
                tLeft = rect.left;
            } else {
                tTop = rect.top + (rect.height / 2) - (tourTooltip.offsetHeight / 2); 
                tLeft = rect.right + 20; 
                if(window.innerWidth < 768 || tLeft + 340 > window.innerWidth) { 
                    tTop = rect.bottom + 20; 
                    tLeft = 20; 
                } 
            }
            
            if (tTop + tourTooltip.offsetHeight > window.innerHeight) { tTop = window.innerHeight - tourTooltip.offsetHeight - 20; }
            if (tTop < 20) tTop = 20; 
            
            tourTooltip.style.top = `${tTop}px`; 
            tourTooltip.style.left = `${tLeft}px`; 
        }, 10);
    } 
}

function showTourStep(index) { 
    const step = tourSteps[index]; tourTitle.innerHTML = step.title; tourDesc.innerHTML = step.desc; tourStepCount.textContent = `${index + 1}/${tourSteps.length}`; 
    if (index === tourSteps.length - 1) { tourNextBtn.innerHTML = `เริ่มใช้งาน HIVE! <i class="ph-fill ph-rocket-launch ml-1.5"></i>`; tourNextBtn.classList.replace('bg-[#5865F2]', 'bg-[#23a559]'); tourNextBtn.classList.replace('hover:bg-[#4752C4]', 'hover:bg-[#1e8a49]'); } 
    else { tourNextBtn.innerHTML = `ต่อไป <i class="ph-fill ph-caret-right ml-1.5"></i>`; } 
    
    if (step.pos === "center") { tourTooltip.style.top = "50%"; tourTooltip.style.left = "50%"; tourTooltip.style.transform = "translate(-50%, -50%)"; highlightElement(null); } 
    else { tourTooltip.style.transform = "none"; highlightElement(step.target, step.pos); } 
}

function startTour() { currentTourStep = 0; tourOverlay.classList.remove('hidden'); tourTooltip.classList.remove('hidden'); showTourStep(currentTourStep); } 
function endTour() { tourOverlay.classList.add('hidden'); tourTooltip.classList.add('hidden'); highlightElement(null); localStorage.setItem('dosh_tour_completed', 'true'); showToast("🎉 จบทัวร์แล้ว! ลุยงานกันเลย!", "success"); if(window.innerWidth < 768) { sidebar.classList.remove('open'); overlay.classList.remove('active'); } }

tourNextBtn.onclick = () => { currentTourStep++; if (currentTourStep >= tourSteps.length) { endTour(); } else { showTourStep(currentTourStep); } }; 
tourSkipBtn.onclick = endTour;

setTimeout(() => { if (!localStorage.getItem('dosh_tour_completed') && currentUserId) { startTour(); } }, 2000);

// ==========================================
// 🎬 14. ระบบ Splash Screen (แอนิเมชันเปิดแอป)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const splashScreen = document.getElementById('splash-screen');
    if (splashScreen) {
        setTimeout(() => {
            if (document.body.contains(splashScreen)) {
                splashScreen.classList.add('opacity-0');
                setTimeout(() => splashScreen.remove(), 500);
            }
        }, 2500); 
    }
});