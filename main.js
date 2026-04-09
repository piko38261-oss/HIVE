import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 🚨 1. ตั้งค่า Firebase & API ต่างๆ
// ==========================================
const firebaseConfig = { apiKey: "AIzaSyBNsG-gdNHZzIerTyd33fIwblwccktfU9I", authDomain: "apoko-hq.firebaseapp.com", projectId: "apoko-hq", storageBucket: "apoko-hq.firebasestorage.app", messagingSenderId: "122632343459", appId: "1:122632343459:web:c225aaff8464f1b0c35416" };
const app = initializeApp(firebaseConfig); const auth = getAuth(app); const db = getFirestore(app);
const IMGBB_API_KEY = "6b400d48dc08e690c88a8b32f3cef56a"; const AGORA_APP_ID = "8d7eec85ee1949d491e1dc191f265ed2"; 
const GEMINI_API_KEY = "AIzaSyCifkioB2z1Ho9LAGSFBYWtV-kM4bgtzhw"; 

// ==========================================
// ⚙️ 2. ตัวแปรสถานะ (Globals)
// ==========================================
const rtcClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
let localTracks = { audioTrack: null, videoTrack: null }, screenTrack = null, screenAudioTrack = null;
let isMuted = false, isDeafened = false, isSharingScreen = false, isVideoOn = false, myNumericUid = null, currentUserId = null, currentUsername = "Guest", currentUserRole = "Member"; 
let allMessages = [], usersData = {}, typingTimeout = null, isTyping = false, unreadCounts = {};
let replyingTo = null; let messageToDelete = null;

let channelsList = [];
let activeChannel = "general"; 
let viewedVoiceChannel = "voice_main"; 
let connectedVoiceChannel = null; 
let amIInVoice = false;

let remoteAudioTracks = {}; let remoteVideoTracks = {}; 
let userVolumes = JSON.parse(localStorage.getItem('dosh_volumes')) || {};

// 🌟 V35: คลังเก็บวิดีโอที่กำลังเปิดกล้องอยู่
const activeVideos = new Map(); 

const sfxMsg = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3'); sfxMsg.volume = 0.5;
const sfxPing = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); sfxPing.volume = 0.8;

// ==========================================
// 🎯 3. ประกาศตัวแปร DOM (UI Elements)
// ==========================================
const joinBtn = document.getElementById('join-voice-btn');
const leaveBtn = document.getElementById('leave-voice-btn'); 
const muteBtn = document.getElementById('mute-btn'); 
const ssBtn = document.getElementById('screen-share-btn'), ssStage = document.getElementById('screen-share-stage');
const camBtn = document.getElementById('camera-btn'), camIcon = document.getElementById('camera-icon');
const bottomMicBtn = document.getElementById('bottom-mic-btn'); 
const bottomMicIcon = document.getElementById('bottom-mic-icon');
const bottomLeaveBtn = document.getElementById('bottom-leave-btn');
const bottomDeafenBtn = document.getElementById('bottom-deafen-btn');
const bottomDeafenIcon = document.getElementById('bottom-deafen-icon');

const canvas = document.getElementById('whiteboard-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const canvasContainer = document.getElementById('canvas-container');
const wbStatus = document.getElementById('wb-status'); 

const gameCanvas = document.getElementById('game-whiteboard-canvas');
const gameCtx = gameCanvas ? gameCanvas.getContext('2d') : null;
const gameCanvasContainer = document.getElementById('game-canvas-container');

const chatInput = document.getElementById('chat-input');
const gameChatInput = document.getElementById('game-chat-input');
const cmdMenu = document.getElementById('slash-command-menu');

// ==========================================
// 🛠️ 4. ฟังก์ชันช่วยเหลือทั่วไป
// ==========================================
window.showToast = (msg, type = "success") => {
    const toastContainer = document.getElementById("toast-container");
    if (!toastContainer) return;
    const toast = document.createElement("div");
    const icon = type === "success" ? `<i class="ph-fill ph-check-circle text-[#23a559] text-[20px]"></i>` : (type === "error" ? `<i class="ph-fill ph-warning-circle text-[#da373c] text-[20px]"></i>` : `<i class="ph-fill ph-info text-[#5865F2] text-[20px]"></i>`);
    toast.className = `flex items-center gap-3 bg-[#1e1f22] border border-[#2b2d31] text-[#dbdee1] px-4 py-3 rounded-lg shadow-xl animate-[slideUpFade_0.3s_ease-out] z-[200]`;
    toast.innerHTML = `${icon} <span class="text-[13px] font-medium">${msg}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => { toast.classList.add("opacity-0", "translate-y-4", "transition-all", "duration-300"); setTimeout(() => toast.remove(), 300); }, 3000);
};

const lightbox = document.createElement('div'); lightbox.className = 'fixed inset-0 bg-black/95 z-[100] hidden flex items-center justify-center opacity-0 transition-opacity duration-300 cursor-zoom-out p-4'; lightbox.innerHTML = `<img id="lightbox-img" src="" class="max-w-full max-h-full object-contain rounded-lg shadow-2xl scale-95 transition-transform duration-300"><button class="absolute top-6 right-6 text-white hover:text-gray-300 transition"><i class="ph ph-x text-[32px]"></i></button>`; document.body.appendChild(lightbox);
window.openLightbox = (url) => { document.getElementById('lightbox-img').src = url; lightbox.classList.remove('hidden'); void lightbox.offsetWidth; lightbox.classList.remove('opacity-0'); document.getElementById('lightbox-img').classList.replace('scale-95', 'scale-100'); };
lightbox.onclick = () => { lightbox.classList.add('opacity-0'); document.getElementById('lightbox-img').classList.replace('scale-100', 'scale-95'); setTimeout(() => lightbox.classList.add('hidden'), 300); };
window.sendWave = () => { if(chatInput) { chatInput.value = '👋 โบกมือทักทาย!'; const sendBtn = document.getElementById('send-btn'); if(sendBtn) sendBtn.click(); }};

let bgAudio = null; let wakeLock = null;
async function startBackgroundAudioMode() {
    if (!bgAudio) { bgAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'); bgAudio.loop = true; bgAudio.volume = 0.01; }
    try { await bgAudio.play(); } catch(e) {}
    try { if ('wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); } } catch (e) {}
}
function stopBackgroundAudioMode() {
    if (bgAudio) { bgAudio.pause(); bgAudio.currentTime = 0; }
    if (wakeLock) { wakeLock.release().then(() => { wakeLock = null; }).catch(()=>{}); }
}

async function getWordFromAI(gameType = "draw") {
    try {
        let promptText = "สุ่มคำศัพท์ภาษาไทย 1 คำ สำหรับเกมทายภาพ ขอแปลกๆ สร้างสรรค์ ไม่ซ้ำเดิม ห้ามมีเครื่องหมายใดๆ";
        if (gameType === "spy") { promptText = "สุ่มคำศัพท์ภาษาไทย 1 คำ (เป็นหมวดของกิน, ของใช้, สัตว์ หรือสถานที่) สำหรับเล่นเกม Spyfall ขอคำที่คนทั่วไปรู้จักดี ห้ามมีคำอธิบาย ห้ามมีเครื่องหมายใดๆ ขอแค่คำศัพท์ 1 คำเท่านั้น"; }
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }], generationConfig: { temperature: 1.5 } }) });
        const data = await res.json(); return data.candidates[0].content.parts[0].text.replace(/[\r\n.]/g, "").trim();
    } catch (err) { const backup = ["ไดโนเสาร์", "ชาบู", "มนุษย์ต่างดาว", "แฮมเบอร์เกอร์", "หมูกระทะ", "โรงหนัง"]; return backup[Math.floor(Math.random() * backup.length)]; }
}

// ==========================================
// 📁 5. ระบบจัดการหมวดหมู่ & สลับหน้าจอ
// ==========================================
window.toggleCategory = (iconId, containerId) => {
    const icon = document.getElementById(iconId);
    const container = document.getElementById(containerId);
    if(icon && container) { icon.classList.toggle('-rotate-90'); container.classList.toggle('hidden'); }
};

onSnapshot(query(collection(db, "channels"), orderBy("createdAt", "asc")), (snap) => {
    if (snap.empty) {
        addDoc(collection(db, "channels"), { id: "general", name: "ประกาศทั่วไป", type: "text", createdAt: serverTimestamp() });
        addDoc(collection(db, "channels"), { id: "project", name: "อัปเดตงานโปรเจกต์", type: "text", createdAt: serverTimestamp() });
        addDoc(collection(db, "channels"), { id: "voice_main", name: "ห้องนั่งเล่นคุยงาน", type: "voice", createdAt: serverTimestamp() });
        return;
    }
    channelsList = [];
    snap.forEach(d => channelsList.push({ docId: d.id, ...d.data() }));
    renderChannelsUI();
});

function updateUnreadBadge(channel) { 
    const btn = document.querySelector(`.nav-btn[data-channel="${channel}"]`); 
    if (!btn) return; 
    let badge = btn.querySelector('.unread-badge'); 
    if (unreadCounts[channel] > 0) { 
        if (!badge) { 
            badge = document.createElement('span'); 
            badge.className = 'unread-badge bg-[#da373c] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto animate-[fadeIn_0.2s_ease-out] shadow-sm'; 
            btn.appendChild(badge); 
        } 
        badge.textContent = unreadCounts[channel] > 99 ? '99+' : unreadCounts[channel]; 
    } else { 
        if (badge) badge.remove(); 
    } 
}

function renderChannelsUI() {
    const textContainer = document.getElementById('text-channels-container');
    const voiceContainer = document.getElementById('voice-channels-container');
    if(!textContainer || !voiceContainer) return;
    textContainer.innerHTML = ''; voiceContainer.innerHTML = '';

    channelsList.forEach(ch => {
        const isTextActive = (ch.type === 'text' && activeChannel === ch.id) ? 'channel-active text-[#dbdee1] bg-[#404249]' : 'channel-inactive text-[#80848e] hover:bg-[#35373c] hover:text-[#dbdee1]';
        const isVoiceActive = (ch.type === 'voice' && viewedVoiceChannel === ch.id) ? 'channel-active text-[#dbdee1] bg-[#404249]' : 'channel-inactive text-[#80848e] hover:bg-[#35373c] hover:text-[#dbdee1]';
        
        const editBtn = `<button onclick="event.stopPropagation(); openChannelModal('${ch.type}', '${ch.docId}', '${ch.name}')" class="hidden group-hover:block ml-auto text-[#949ba4] hover:text-white p-1" title="เปลี่ยนชื่อ"><i class="ph-fill ph-pencil-simple"></i></button>`;

        if (ch.type === 'text') {
            textContainer.insertAdjacentHTML('beforeend', `
                <div class="flex items-center group rounded-md nav-btn ${isTextActive} cursor-pointer transition" data-channel="${ch.id}" onclick="switchChannel('chat', '${ch.id}', '${ch.name}')">
                    <div class="flex-1 flex items-center px-2 py-1.5 min-w-0">
                        <i class="ph ph-hash text-[18px] mr-1.5 flex-shrink-0"></i><span class="font-medium text-[15px] truncate">${ch.name}</span>
                    </div>
                    ${editBtn}
                </div>
            `);
            updateUnreadBadge(ch.id);
        } else if (ch.type === 'voice') {
            voiceContainer.insertAdjacentHTML('beforeend', `
                <div>
                    <div class="flex items-center group rounded-md ${isVoiceActive} cursor-pointer transition" onclick="switchChannel('voice', '${ch.id}', '${ch.name}')">
                        <div class="flex-1 flex items-center px-2 py-1.5 min-w-0">
                            <i class="ph-fill ph-speaker-high text-[18px] mr-1.5 flex-shrink-0"></i><span class="font-medium text-[15px] truncate">${ch.name}</span>
                        </div>
                        ${editBtn}
                    </div>
                    <div id="voice-users-${ch.id}" class="mt-1 space-y-0.5 pl-2"></div>
                </div>
            `);
        }
    });
    if(Object.keys(usersData).length > 0) renderUsersUI();
}

window.switchChannel = (view, channelId, channelName) => {
    if (isTyping && currentUserId) { isTyping = false; clearTimeout(typingTimeout); updateDoc(doc(db, "users", currentUserId), { isTyping: false }); } 
    
    document.querySelectorAll('[id^="view-"]').forEach(v => v.classList.add('hidden'));
    const targetView = document.getElementById(`view-${view.split('-')[0] === 'game' ? view : view}`);
    if(targetView) targetView.classList.remove('hidden');

    if (view === 'chat') {
        activeChannel = channelId;
        const headerTitle = document.getElementById('header-title');
        if(headerTitle) headerTitle.textContent = channelName;
        unreadCounts[activeChannel] = 0; 
        renderMessages();
    } else if (view === 'voice') {
        viewedVoiceChannel = channelId;
        const voiceTitle = document.getElementById('voice-room-title');
        if(voiceTitle) voiceTitle.textContent = channelName; 
        renderUsersUI(); 
        updateVoiceUI(); 
    }
    
    renderChannelsUI(); 
    
    const membersSidebar = document.getElementById('members-sidebar');
    if(membersSidebar) {
        membersSidebar.classList.remove('md:hidden'); 
        if (view === 'chat' || view === 'voice') { membersSidebar.classList.remove('hidden'); } 
        else { membersSidebar.classList.add('hidden'); }
    }
    
    const sidebarEl = document.getElementById('sidebar');
    const overlayEl = document.getElementById('overlay');
    if(sidebarEl) sidebarEl.classList.remove('open'); 
    if(overlayEl) overlayEl.classList.remove('active'); 
    
    if (view === 'game-draw') { setTimeout(initGameCanvasSize, 100); }
    if (view === 'whiteboard') setTimeout(initCanvasSize, 100); 

    // 🌟 ย้ายวิดีโออัตโนมัติตามหน้าจอที่เปิด
    renderAllVideos();
};

window.openChannelModal = (type, editDocId = null, currentName = "") => {
    const typeInput = document.getElementById('channel-action-type');
    const idInput = document.getElementById('channel-edit-id');
    const nameInput = document.getElementById('channel-name-input');
    const titleEl = document.getElementById('channel-modal-title');
    const modalEl = document.getElementById('channel-modal');
    
    if(typeInput) typeInput.value = type;
    if(idInput) idInput.value = editDocId || "";
    if(nameInput) nameInput.value = currentName;
    if(titleEl) titleEl.textContent = editDocId ? "เปลี่ยนชื่อห้อง" : "สร้างห้องใหม่";
    if(modalEl) modalEl.classList.remove('hidden');
};

window.saveChannel = async () => {
    const nameInput = document.getElementById('channel-name-input');
    const typeInput = document.getElementById('channel-action-type');
    const idInput = document.getElementById('channel-edit-id');
    const modalEl = document.getElementById('channel-modal');
    
    const name = nameInput ? nameInput.value.trim() : '';
    const type = typeInput ? typeInput.value : '';
    const editId = idInput ? idInput.value : '';
    if(!name) return;
    
    if (editId) {
        await updateDoc(doc(db, "channels", editId), { name });
        showToast("เปลี่ยนชื่อห้องเรียบร้อย", "success");
    } else {
        const newId = type + "_" + Date.now();
        await addDoc(collection(db, "channels"), { id: newId, name, type, createdAt: serverTimestamp() });
        showToast("สร้างห้องใหม่สำเร็จ!", "success");
    }
    if(modalEl) modalEl.classList.add('hidden');
};

// ==========================================
// 🟢 6. โหลดรายชื่อผู้ใช้งาน & เสียง 
// ==========================================
window.changeUserVolume = (uid, userId, vol) => {
    if (remoteAudioTracks[uid]) { remoteAudioTracks[uid].setVolume(parseInt(vol)); }
    userVolumes[userId] = vol; localStorage.setItem('dosh_volumes', JSON.stringify(userVolumes)); 
};

onSnapshot(collection(db, "users"), (snapshot) => {
    let rawUsers = [];
    snapshot.forEach(doc => rawUsers.push({ id: doc.id, ...doc.data() }));
    usersData = {};
    rawUsers.forEach(u => {
        const userName = u.username || 'Unknown';
        usersData[userName] = { avatar: u.photoURL || `https://ui-avatars.com/api/?name=${userName}`, banner: u.bannerURL || '', id: u.id, agoraUid: u.agoraUid, customStatus: u.customStatus || '', role: u.role, isSharingScreen: u.isSharingScreen, isVideoOn: u.isVideoOn, profileFrame: u.profileFrame || '', inVoice: u.inVoice, voiceChannel: u.voiceChannel, status: u.status, isMuted: u.isMuted }; 
    });
    renderUsersUI();
});

function renderUsersUI() {
    const membersList = document.getElementById('members-list');
    const voiceGrid = document.getElementById('voice-grid');
    if(!membersList || !voiceGrid) return;
    
    membersList.innerHTML = ''; 
    channelsList.forEach(ch => { const list = document.getElementById(`voice-users-${ch.id}`); if(list) list.innerHTML = ''; });
    
    let usersInViewedVoiceCount = 0; 
    const countEl = document.getElementById('member-count');
    if(countEl) countEl.textContent = Object.keys(usersData).length; 
    const currentVoiceCardIds = [];

    Object.keys(usersData).forEach(userName => {
        const u = usersData[userName];
        const isOnline = u.status === 'online';
        const statusColor = isOnline ? 'bg-[#23a559]' : 'bg-[#5c6069]';
        const roleDisplay = u.role === 'Admin' ? `<span class="text-[#da373c] font-extrabold ml-1.5 text-[9px] bg-[#da373c]/10 px-1.5 py-0.5 rounded uppercase">Admin</span>` : '';
        const nameStyle = u.role === 'Banned' ? 'line-through text-[#da373c]' : (isOnline ? 'text-[#d1d3d6]' : 'text-[#6d717a]');
        const muteIconSmall = u.isMuted ? '<i class="ph-fill ph-microphone-slash text-[#da373c] ml-auto text-[14px]"></i>' : '';
        const muteIconLarge = u.isMuted ? '<div class="absolute -bottom-1 -right-1 bg-[#111214] rounded-full p-1.5 border-2 border-[#1e1f22] shadow-sm flex items-center justify-center z-30"><i class="ph-fill ph-microphone-slash text-[#da373c] text-[14px]"></i></div>' : '';
        const screenBadgeSmall = u.isSharingScreen ? '<span class="ml-2 text-[9px] bg-[#5865F2] text-white px-1.5 py-0.5 rounded flex items-center font-bold tracking-wider"><i class="ph-fill ph-screencast mr-1"></i>LIVE</span>' : '';
        const renderFrameHtml = u.profileFrame ? `<img src="${u.profileFrame}" class="absolute w-[135%] h-[135%] max-w-none pointer-events-none z-10 drop-shadow-md">` : '';

        // ข้อมูลตัวเราเอง
        if (u.id === currentUserId) { 
            const myStatusUI = document.getElementById('current-user-status'); 
            if(myStatusUI) { myStatusUI.textContent = u.customStatus || 'ออนไลน์'; myStatusUI.className = u.customStatus ? 'text-[11px] text-[#23a559] truncate mt-0.5' : 'text-[11px] text-[#6d717a] truncate mt-0.5'; }
            
            const myNameUI = document.getElementById('current-user-name'); 
            if(myNameUI) myNameUI.textContent = currentUsername;
            
            const inputUI = document.getElementById('settings-username-input'); 
            if(inputUI) inputUI.value = currentUsername; 
            
            const myAvatarUI = document.getElementById('current-user-avatar');
            if(myAvatarUI) myAvatarUI.src = u.avatar;

            const myBottomFrame = document.getElementById('current-user-frame');
            if (myBottomFrame) { if (u.profileFrame) { myBottomFrame.src = u.profileFrame; myBottomFrame.classList.remove('hidden'); } else { myBottomFrame.classList.add('hidden'); } }
        }

        // แถบขวา รายชื่อออนไลน์
        membersList.insertAdjacentHTML('beforeend', `
            <div onclick="showUserProfile('${userName}')" class="flex items-center space-x-3 cursor-pointer p-2 rounded-md hover:bg-[#2b2d31] transition group ${!isOnline ? 'opacity-50' : ''}">
                <div class="relative flex-shrink-0 flex items-center justify-center w-8 h-8"><img src="${u.avatar}" class="w-8 h-8 rounded-full object-cover opacity-90 absolute z-0">${renderFrameHtml}<div class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${statusColor} rounded-full border-[3px] border-[#151619] z-20"></div></div>
                <div class="overflow-hidden flex-1"><div class="flex items-center"><p class="text-[14px] font-medium truncate ${nameStyle}">${userName} ${roleDisplay}</p></div><p class="text-[11px] text-[#6d717a] truncate mt-0.5">${u.customStatus || (isOnline ? 'ออนไลน์' : 'ออฟไลน์')}</p></div>
            </div>`);
            
        // ถ้าอยู่ในห้องเสียง
        if (u.inVoice && u.voiceChannel) {
            const voiceSubList = document.getElementById(`voice-users-${u.voiceChannel}`);
            if(voiceSubList) {
                voiceSubList.insertAdjacentHTML('beforeend', `
                <div class="flex items-center space-x-2.5 text-[13px] text-[#80848e] py-1 px-2 hover:bg-[#2b2d31] hover:text-[#dbdee1] rounded-md transition cursor-pointer ml-2">
                    <div class="relative flex-shrink-0 flex items-center justify-center w-6 h-6"><img src="${u.avatar}" class="w-6 h-6 rounded-full object-cover opacity-90 absolute z-0">${u.profileFrame ? `<img src="${u.profileFrame}" class="absolute w-[140%] h-[140%] max-w-none pointer-events-none z-10 drop-shadow-md">` : ''}</div>
                    <span class="truncate font-medium flex-1 flex items-center">${userName} ${screenBadgeSmall}</span>${muteIconSmall}
                </div>`);
            }
            
            // วาดการ์ดกลางห้องใหญ่
            if (u.voiceChannel === viewedVoiceChannel) {
                usersInViewedVoiceCount++; 
                const isMe = u.id === currentUserId;
                const savedVol = userVolumes[u.id] !== undefined ? userVolumes[u.id] : 100;
                const volSlider = (!isMe && u.agoraUid) ? `<div class="w-full mt-1.5 px-3 flex items-center space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onclick="event.stopPropagation()"><i class="ph ph-speaker-high text-[#80848e] text-[12px]"></i><input type="range" min="0" max="300" value="${savedVol}" class="w-full h-1 accent-[#5865F2] cursor-pointer" oninput="changeUserVolume('${u.agoraUid}', '${u.id}', this.value)" title="ปรับเสียง (สูงสุด 300%)"></div>` : `<div class="h-6"></div>`;

                currentVoiceCardIds.push(`voice-card-${u.id}`);
                let card = document.getElementById(`voice-card-${u.id}`);
                if (!card) {
                    voiceGrid.insertAdjacentHTML('beforeend', `
                        <div id="voice-card-${u.id}" class="bg-[#111214] rounded-2xl w-[140px] h-[160px] sm:w-[160px] sm:h-[180px] md:w-[190px] md:h-[210px] pt-4 pb-2 px-2 flex flex-col items-center justify-center relative shadow-xl border border-[#1e1f22] animate-[fadeIn_0.3s_ease-out] hover:border-[#35373c] transition-colors group overflow-hidden">
                            <div class="relative mb-2 md:mb-3 flex-shrink-0 z-10 flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 transition-all duration-300"><img src="${u.avatar}" class="w-full h-full rounded-full object-cover bg-gray-900 border-4 border-[#151619] shadow-2xl absolute z-0">${u.profileFrame ? `<img src="${u.profileFrame}" class="absolute w-[130%] h-[130%] max-w-none pointer-events-none z-10 drop-shadow-xl">` : ''}<div id="mute-badge-${u.id}" class="z-20">${muteIconLarge}</div></div>
                            <p class="font-bold text-[#dbdee1] text-[13px] md:text-[15px] truncate w-full text-center px-2 z-10 drop-shadow-md mt-1">${userName}</p>
                            <div class="z-10 w-full">${volSlider}</div>
                        </div>
                    `);
                } else {
                    const muteBadge = document.getElementById(`mute-badge-${u.id}`);
                    if (muteBadge) muteBadge.innerHTML = muteIconLarge;
                }
            }
        }
    });

    Array.from(voiceGrid.children).forEach(child => { if (child.id.startsWith('voice-card-') && !currentVoiceCardIds.includes(child.id)) { child.remove(); } });
    if (usersInViewedVoiceCount === 0) { 
        if (!document.getElementById('empty-voice')) { 
            voiceGrid.innerHTML = `<div id="empty-voice" class="w-full flex flex-col items-center justify-center mt-20 md:mt-32 text-[#6d717a]"><div class="w-20 h-20 md:w-24 md:h-24 bg-[#111214] rounded-full flex items-center justify-center mb-4 border border-[#1e1f22]"><i class="ph ph-users-three text-[40px] opacity-40"></i></div><p class="font-bold text-base text-[#949ba4]">ไม่มีใครอยู่ในห้องเสียง</p></div>`; 
        } 
    } else { 
        const empty = document.getElementById('empty-voice'); if (empty) empty.remove(); 
    }
}

// ==========================================
// 📺 7. Watch Party
// ==========================================
let ytPlayer = null; let ignoreNextYtEvent = false; let lastSyncTime = 0; let pendingVideoData = null; let latestWPData = null; 
if (window.YT && window.YT.Player) { if (pendingVideoData && amIInVoice) { initOrUpdatePlayer(pendingVideoData.vid, pendingVideoData.time, pendingVideoData.state, pendingVideoData.host); pendingVideoData = null; } } else { window.onYouTubeIframeAPIReady = function() { if(pendingVideoData && amIInVoice) { initOrUpdatePlayer(pendingVideoData.vid, pendingVideoData.time, pendingVideoData.state, pendingVideoData.host); pendingVideoData = null; } }; }
function extractVideoID(url) { const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/; const match = url.match(regExp); return (match && match[2].length === 11) ? match[2] : null; }
const toggleWpBtn = document.getElementById('toggle-wp-input-btn');
if(toggleWpBtn) toggleWpBtn.onclick = () => { const wpControls = document.getElementById('wp-controls'); if(wpControls) wpControls.classList.toggle('hidden'); };
const startWpBtn = document.getElementById('start-wp-btn');
if(startWpBtn) {
    startWpBtn.onclick = async () => { const linkInput = document.getElementById('wp-link-input'); const url = linkInput ? linkInput.value : ''; const vid = extractVideoID(url); if(!vid) return showToast("ลิงก์ YouTube ไม่ถูกต้อง", "error"); await setDoc(doc(db, "appData", "watchParty"), { videoId: vid, state: 1, time: 0, updatedBy: currentUsername, timestamp: serverTimestamp() }); if(linkInput) linkInput.value = ""; const wpControls = document.getElementById('wp-controls'); if(wpControls) wpControls.classList.add('hidden'); showToast("เริ่มสตรีมคลิป YouTube!", "success"); };
}
const closeWpBtn = document.getElementById('close-wp-btn');
if(closeWpBtn) {
    closeWpBtn.onclick = async () => { if(confirm("ต้องการปิดคลิปใช่ไหม?")) { await setDoc(doc(db, "appData", "watchParty"), { videoId: "", state: -1, time: 0, updatedBy: currentUsername, timestamp: serverTimestamp() }); showToast("ปิดสตรีมเรียบร้อย", "success"); } };
}
async function onPlayerStateChange(event) { if(ignoreNextYtEvent) { ignoreNextYtEvent = false; return; } if(event.data === 1 || event.data === 2) { const now = Date.now(); if (now - lastSyncTime < 1000) return; lastSyncTime = now; if(ytPlayer && typeof ytPlayer.getCurrentTime === 'function') { const time = ytPlayer.getCurrentTime(); const vid = ytPlayer.getVideoData().video_id; await setDoc(doc(db, "appData", "watchParty"), { videoId: vid, state: event.data, time: time, updatedBy: currentUsername, timestamp: serverTimestamp() }); } } }
function initOrUpdatePlayer(vid, time, state, host) { if (!amIInVoice) return; if(typeof window.YT === 'undefined' || typeof window.YT.Player === 'undefined') { pendingVideoData = { vid, time, state, host }; return; } const wpStage = document.getElementById('watch-party-stage'); if(wpStage) { wpStage.classList.remove('hidden'); wpStage.classList.add('flex'); } const wpHost = document.getElementById('wp-host'); if(host && wpHost) wpHost.textContent = host; if(!ytPlayer) { ytPlayer = new window.YT.Player('yt-player-container', { height: '100%', width: '100%', videoId: vid, playerVars: { 'autoplay': 1, 'controls': 1, 'rel': 0, 'modestbranding': 1, 'origin': window.location.origin }, events: { 'onReady': (e) => { e.target.seekTo(time, true); if(state === 1) e.target.playVideo(); else e.target.pauseVideo(); }, 'onStateChange': onPlayerStateChange, 'onError': (e) => { showToast("คลิปถูกบล็อกนอกเว็บ YouTube", "error"); } } }); } else { if (typeof ytPlayer.getVideoData !== 'function') return; const currentVid = ytPlayer.getVideoData().video_id; if(currentVid !== vid) { ignoreNextYtEvent = true; ytPlayer.loadVideoById(vid, time); } else { if(host !== currentUsername) { ignoreNextYtEvent = true; const currentTime = ytPlayer.getCurrentTime(); if(Math.abs(currentTime - time) > 2) ytPlayer.seekTo(time, true); if(state === 1 && ytPlayer.getPlayerState() !== 1) ytPlayer.playVideo(); if(state === 2 && ytPlayer.getPlayerState() !== 2) ytPlayer.pauseVideo(); } } } }
onSnapshot(doc(db, "appData", "watchParty"), (d) => { if(d.exists()) { const wp = d.data(); latestWPData = wp; if(wp.videoId) { if (amIInVoice) { initOrUpdatePlayer(wp.videoId, wp.time, wp.state, wp.updatedBy); } } else { const wpStage = document.getElementById('watch-party-stage'); if(wpStage) { wpStage.classList.add('hidden'); wpStage.classList.remove('flex'); } if(ytPlayer && typeof ytPlayer.destroy === 'function') { ytPlayer.destroy(); ytPlayer = null; } const ytWrapper = document.getElementById('yt-wrapper'); if(ytWrapper) ytWrapper.innerHTML = '<div id="yt-player-container"></div>'; pendingVideoData = null; latestWPData = null; } } });

const overlay = document.getElementById('overlay'); const sidebar = document.getElementById('sidebar'); const membersSidebar = document.getElementById('members-sidebar');
document.querySelectorAll('.open-menu, #open-members-voice').forEach(btn => btn.onclick = () => { if(sidebar) sidebar.classList.add('open'); if(overlay) overlay.classList.add('active'); }); 
const btnCloseMenu = document.getElementById('close-menu');
if(btnCloseMenu) btnCloseMenu.onclick = () => { if(sidebar) sidebar.classList.remove('open'); if(overlay) overlay.classList.remove('active'); }; 
const btnOpenMembers = document.getElementById('open-members');
if(btnOpenMembers) btnOpenMembers.onclick = () => { if(membersSidebar) membersSidebar.classList.remove('translate-x-full'); if(overlay) overlay.classList.add('active'); }; 
const btnCloseMembers = document.getElementById('close-members');
if(btnCloseMembers) btnCloseMembers.onclick = () => { if(membersSidebar) membersSidebar.classList.add('translate-x-full'); if(overlay) overlay.classList.remove('active'); }; 
if(overlay) overlay.onclick = () => { if(sidebar) sidebar.classList.remove('open'); if(membersSidebar) membersSidebar.classList.add('translate-x-full'); if(overlay) overlay.classList.remove('active'); };

window.showUserProfile = (userName) => { 
    const u = usersData[userName]; if(!u) return; 
    
    const pName = document.getElementById('profile-card-name'); if(pName) pName.textContent = userName; 
    const pAvatar = document.getElementById('profile-card-avatar'); if(pAvatar) pAvatar.src = u.avatar; 
    
    const bannerImg = document.getElementById('profile-card-banner'); 
    if(bannerImg) {
        if (u.banner) { bannerImg.src = u.banner; bannerImg.classList.remove('hidden'); } 
        else { bannerImg.classList.add('hidden'); } 
    }
    
    const pStatus = document.getElementById('profile-card-status');
    if(pStatus) pStatus.textContent = u.customStatus || 'ไม่ได้ตั้งสถานะ'; 
    
    let badges = ''; 
    if(u.role === 'Admin') badges += '<span class="inline-flex items-center bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-[12px] text-white shadow-inner mr-2"><div class="w-2.5 h-2.5 rounded-full bg-[#da373c] mr-2 shadow-[0_0_8px_#da373c]"></div> Admin</span>'; 
    else badges += '<span class="inline-flex items-center bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-[12px] text-white shadow-inner mr-2"><div class="w-2.5 h-2.5 rounded-full bg-[#5865F2] mr-2 shadow-[0_0_8px_#5865F2]"></div> Member</span>'; 
    if (u.avatar.toLowerCase().includes('.gif') || u.banner.toLowerCase().includes('.gif') || u.profileFrame) { 
        badges += '<span class="inline-flex items-center bg-gradient-to-r from-pink-500 to-purple-500 border border-white/20 px-3 py-1.5 rounded-lg text-[12px] text-white font-bold shadow-[0_0_15px_rgba(236,72,153,0.5)] animate-pulse"><i class="ph-fill ph-sparkle mr-1.5"></i> VIP</span>'; 
    }
    const pBadges = document.getElementById('profile-card-badges');
    if(pBadges) pBadges.innerHTML = badges; 
    
    const frameImg = document.getElementById('profile-card-frame');
    if(frameImg) {
        if (u.profileFrame) { frameImg.src = u.profileFrame; frameImg.classList.remove('hidden'); } 
        else { frameImg.classList.add('hidden'); }
    }
    const pModal = document.getElementById('profile-card-modal');
    if(pModal) pModal.classList.remove('hidden'); 
}

const btnCloseProfile = document.getElementById('close-profile-card');
if(btnCloseProfile) btnCloseProfile.onclick = () => { const p = document.getElementById('profile-card-modal'); if(p) p.classList.add('hidden'); }; 

const pModalWrap = document.getElementById('profile-card-modal');
if(pModalWrap) {
    pModalWrap.addEventListener('click', (e) => { 
        if (e.target === pModalWrap) pModalWrap.classList.add('hidden'); 
    });
}

// ==========================================
// 🎨 8. โปรไฟล์ Settings 
// ==========================================
const settingsModal = document.getElementById('settings-modal');
const avatarInput = document.getElementById('settings-avatar-input');
const bannerInput = document.getElementById('settings-banner-input');
let cropper = null; let currentCropType = ''; 

const frameOptions = [
    { id: '', name: 'ไม่มี', url: '' },
    { id: 'neon', name: 'นีออนม่วง', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='46' fill='none' stroke='%23a855f7' stroke-width='6'/></svg>" },
    { id: 'gold', name: 'ทองคำ VIP', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='44' fill='none' stroke='%23eab308' stroke-width='8'/></svg>" },
    { id: 'cow', name: 'ลายวัว (ชั่วคราว)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='46' fill='none' stroke='%23ffffff' stroke-width='8'/><circle cx='50' cy='50' r='46' fill='none' stroke='%23111111' stroke-width='8' stroke-dasharray='15 20'/></svg>" }
];

window.renderFrameOptions = (currentUrl) => {
    const container = document.getElementById('frame-selector');
    if(!container) return;
    container.innerHTML = '';
    
    frameOptions.forEach(f => {
        const isSelected = (currentUrl || '') === f.url;
        const ringClass = isSelected ? 'ring-2 ring-[#5865F2] bg-[#35373c]' : 'hover:ring-1 ring-gray-500 bg-[#1e1f22]';
        let imgHTML = f.url ? `<img src="${f.url}" class="absolute w-[130%] h-[130%] max-w-none z-10 pointer-events-none drop-shadow-md">` : '';
        const curAvatar = document.getElementById('current-user-avatar');
        const avatarSrc = curAvatar ? curAvatar.src : '';
        
        const div = document.createElement('div');
        div.className = "flex flex-col items-center cursor-pointer group flex-shrink-0";
        div.innerHTML = `
            <div class="w-14 h-14 rounded-xl flex items-center justify-center relative mb-2 transition-all ${ringClass}">
                <img src="${avatarSrc}" class="w-8 h-8 rounded-full opacity-80 absolute z-0 object-cover">
                ${imgHTML}
            </div>
            <span class="text-[10px] ${isSelected ? 'text-[#dbdee1]' : 'text-gray-500 group-hover:text-gray-300'} font-bold">${f.name}</span>
        `;
        div.onclick = () => { 
            const selFrame = document.getElementById('settings-selected-frame');
            if(selFrame) selFrame.value = f.url; 
            renderFrameOptions(f.url); 
        };
        container.appendChild(div);
    });
};

const openSettingsHandler = (e) => { 
    e.preventDefault(); 
    const preview = document.getElementById('settings-avatar-preview');
    const curAvatar = document.getElementById('current-user-avatar');
    if(preview && curAvatar) preview.src = curAvatar.src; 
    
    const myCurrentFrame = usersData[currentUsername] ? usersData[currentUsername].profileFrame : '';
    const selFrame = document.getElementById('settings-selected-frame');
    if(selFrame) selFrame.value = myCurrentFrame || '';
    renderFrameOptions(myCurrentFrame);
    
    if(settingsModal) settingsModal.classList.remove('hidden'); 
    
    const sidebarEl = document.getElementById('sidebar');
    const overlayEl = document.getElementById('overlay');
    if(sidebarEl) sidebarEl.classList.remove('open'); 
    if(overlayEl) overlayEl.classList.remove('active'); 
};
const btnOpenSettings = document.getElementById('open-settings-btn');
const btnMiniProfile = document.getElementById('mini-profile-btn');

if (btnOpenSettings) btnOpenSettings.onclick = openSettingsHandler;
if (btnMiniProfile) btnMiniProfile.onclick = openSettingsHandler;

const btnCloseSettings = document.getElementById('close-settings-btn');
if(btnCloseSettings) btnCloseSettings.onclick = () => { if(settingsModal) settingsModal.classList.add('hidden'); }; 

const wrapperAvatar = document.getElementById('settings-avatar-wrapper');
if(wrapperAvatar) wrapperAvatar.onclick = () => { if(avatarInput) avatarInput.click(); }; 

const wrapperBanner = document.getElementById('settings-banner-wrapper');
if(wrapperBanner) wrapperBanner.onclick = () => { if(bannerInput) bannerInput.click(); };

function handleImageSelect(e, type) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type === 'image/gif') { showToast("ว้าว! ตรวจพบรูปเคลื่อนไหว (GIF) กำลังอัปโหลดแบบ VIP!", "info"); uploadImage(file, type); e.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = (event) => {
        const cropTarget = document.getElementById('crop-image-target');
        if(cropTarget) cropTarget.src = event.target.result;
        const cropModal = document.getElementById('crop-modal');
        if(cropModal) cropModal.classList.remove('hidden');
        currentCropType = type;
        if (cropper) { cropper.destroy(); }
        const aspectRatio = type === 'avatar' ? 1 / 1 : 16 / 5; 
        if(cropTarget) cropper = new Cropper(cropTarget, { aspectRatio: aspectRatio, viewMode: 2, dragMode: 'move', background: false });
    };
    reader.readAsDataURL(file); e.target.value = ""; 
}
if(avatarInput) avatarInput.onchange = (e) => handleImageSelect(e, 'avatar');
if(bannerInput) bannerInput.onchange = (e) => handleImageSelect(e, 'banner');

const btnConfirmCrop = document.getElementById('confirm-crop-btn');
if(btnConfirmCrop) {
    btnConfirmCrop.onclick = () => {
        if (!cropper) return;
        const canvasCropped = cropper.getCroppedCanvas({ width: currentCropType === 'avatar' ? 400 : 1200, height: currentCropType === 'avatar' ? 400 : 375, fillColor: '#1e1f22' });
        canvasCropped.toBlob((blob) => { const croppedFile = new File([blob], `hive_${currentCropType}_${Date.now()}.png`, { type: 'image/png' }); closeCropModal(); uploadImage(croppedFile, currentCropType); }, 'image/png');
    };
}
const closeCropModal = () => { 
    const cropModal = document.getElementById('crop-modal');
    if(cropModal) cropModal.classList.add('hidden'); 
    if (cropper) { cropper.destroy(); cropper = null; } 
};
const btnCloseCrop = document.getElementById('close-crop-btn');
if(btnCloseCrop) btnCloseCrop.onclick = closeCropModal; 
const btnCancelCrop = document.getElementById('cancel-crop-btn');
if(btnCancelCrop) btnCancelCrop.onclick = closeCropModal;

async function uploadImage(file, type) { 
    showToast(`กำลังอัปโหลด${type === 'avatar' ? 'โปรไฟล์' : 'ภาพปก'}... ⏳`, "info"); 
    const wrap = document.getElementById(`settings-${type}-wrapper`);
    if(wrap) wrap.classList.add('opacity-50', 'pointer-events-none'); 
    try { 
        const fd = new FormData(); fd.append("image", file); 
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: fd }); 
        const r = await res.json(); 
        if (r.success) { 
            if(type === 'avatar') { 
                await updateProfile(auth.currentUser, { photoURL: r.data.url }); await updateDoc(doc(db, "users", currentUserId), { photoURL: r.data.url }); 
                const p1 = document.getElementById('settings-avatar-preview'); if(p1) p1.src = r.data.url; 
                const p2 = document.getElementById('current-user-avatar'); if(p2) p2.src = r.data.url; 
            } else { 
                await updateDoc(doc(db, "users", currentUserId), { bannerURL: r.data.url }); 
                const p1 = document.getElementById('settings-banner-preview'); if(p1) { p1.src = r.data.url; p1.classList.remove('hidden'); }
            } 
            showToast("อัปโหลดสำเร็จ!", "success"); 
        } 
    } catch(err) { showToast("เกิดข้อผิดพลาดในการอัปโหลด", "error"); } 
    finally { if(wrap) wrap.classList.remove('opacity-50', 'pointer-events-none'); } 
}

const btnSaveSettings = document.getElementById('save-settings-btn');
if(btnSaveSettings) {
    btnSaveSettings.onclick = async () => { 
        const nameInput = document.getElementById('settings-username-input');
        const statusInput = document.getElementById('settings-custom-status');
        const frameInput = document.getElementById('settings-selected-frame');

        const newName = nameInput ? nameInput.value.trim() || currentUsername : currentUsername; 
        const newStatus = statusInput ? statusInput.value.trim() : ""; 
        const newFrame = frameInput ? frameInput.value : ""; 

        try { 
            await updateProfile(auth.currentUser, { displayName: newName }); 
            await updateDoc(doc(db, "users", currentUserId), { username: newName, customStatus: newStatus, profileFrame: newFrame }); 
            currentUsername = newName; 
            const myNameUI = document.getElementById('current-user-name');
            if(myNameUI) myNameUI.textContent = currentUsername; 
            showToast("บันทึกการตั้งค่าโปรไฟล์และกรอบรูปแล้ว!", "success"); 
            if(settingsModal) settingsModal.classList.add('hidden'); 
        } catch(e) { showToast("เกิดข้อผิดพลาดในการบันทึก", "error"); } 
    };
}

// ==========================================
// 🛡️ 9. ระบบ Auth
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid; currentUsername = user.displayName || user.email.split('@')[0];
        const myNameUI = document.getElementById('current-user-name');
        if(myNameUI) myNameUI.textContent = currentUsername;
        const myAvatarUI = document.getElementById('current-user-avatar');
        if(myAvatarUI) myAvatarUI.src = user.photoURL || `https://ui-avatars.com/api/?name=${currentUsername}&background=5865F2&color=fff&rounded=true&bold=true`;
        
        try { const userDoc = await getDoc(doc(db, "users", currentUserId)); if (userDoc.exists()) { currentUserRole = userDoc.data().role; const adminBtn = document.getElementById('admin-menu-btn'); if (currentUserRole === 'Admin' && adminBtn) adminBtn.classList.remove('hidden'); } } catch (err) {}
        
        const wasInVoice = localStorage.getItem('dosh_active_voice') === 'true';
        if (wasInVoice) { 
            await updateDoc(doc(db, "users", currentUserId), { status: 'online' }).catch(e=>console.log(e)); 
            setTimeout(() => { if(joinBtn) joinBtn.click(); }, 1500); 
        } 
        else { await updateDoc(doc(db, "users", currentUserId), { status: 'online', inVoice: false, voiceChannel: null, agoraUid: null, isMuted: false, isSharingScreen: false, isVideoOn: false, isTyping: false }).catch(e=>console.log(e)); }
    } else { window.location.href = "index.html"; }
});

const btnLogout = document.getElementById('logout-btn');
if(btnLogout) {
    btnLogout.addEventListener('click', async () => { 
        if (currentUserId) { try { await updateDoc(doc(db, "users", currentUserId), { status: 'offline', inVoice: false, voiceChannel: null, agoraUid: null, isMuted: false, isSharingScreen: false, isVideoOn: false, isTyping: false }); } catch (e) {} } 
        localStorage.removeItem('dosh_active_voice'); 
        if (localTracks.audioTrack && leaveBtn) { leaveBtn.click(); } 
        signOut(auth); 
    });
}

// ==========================================
// 💬 10. ระบบ Chat & Mentions
// ==========================================
const mentionPopup = document.createElement('div');
mentionPopup.id = 'mention-popup';
mentionPopup.className = 'hidden absolute bg-[#2b2d31] border border-[#1e1f22] rounded-lg shadow-2xl z-[100] w-48 max-h-40 overflow-y-auto py-1 animate-[slideUpFade_0.1s_ease-out]';
document.body.appendChild(mentionPopup);
let currentActiveInput = null; let mentionQuery = '';

function handleMentionInput(e) {
    const input = e.target; currentActiveInput = input;
    const val = input.value; const cursorPos = input.selectionStart;
    const textBeforeCursor = val.substring(0, cursorPos);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_ก-๙]*)$/);
    if (match) { mentionQuery = match[1].toLowerCase(); showMentionPopup(input, match[0]); } else { mentionPopup.classList.add('hidden'); }
}

function showMentionPopup(inputEl, fullMatch) {
    mentionPopup.innerHTML = ''; const rect = inputEl.getBoundingClientRect();
    mentionPopup.style.left = `${rect.left}px`; mentionPopup.style.top = `${rect.top - 160}px`; 
    const matchedUsers = Object.keys(usersData).filter(name => name.toLowerCase().includes(mentionQuery));
    if (matchedUsers.length === 0) { mentionPopup.classList.add('hidden'); return; }
    mentionPopup.classList.remove('hidden');
    matchedUsers.forEach(name => {
        const u = usersData[name]; const item = document.createElement('div'); item.className = 'flex items-center px-3 py-2 hover:bg-[#35373c] cursor-pointer transition'; item.innerHTML = `<img src="${u.avatar}" class="w-6 h-6 rounded-full mr-2 object-cover opacity-90"><span class="text-[13px] font-bold text-[#dbdee1]">${name}</span>`;
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
if(chatInput) chatInput.addEventListener('input', handleMentionInput); 
if(gameChatInput) gameChatInput.addEventListener('input', handleMentionInput); 
document.addEventListener('click', (e) => { if (!mentionPopup.contains(e.target) && e.target !== chatInput && e.target !== gameChatInput) mentionPopup.classList.add('hidden'); });

if(chatInput) {
    chatInput.addEventListener('input', () => { 
        if (!currentUserId) return; 
        if (!isTyping) { isTyping = true; updateDoc(doc(db, "users", currentUserId), { isTyping: true, typingChannel: activeChannel }); } 
        clearTimeout(typingTimeout); typingTimeout = setTimeout(() => { isTyping = false; updateDoc(doc(db, "users", currentUserId), { isTyping: false }); }, 2000); 
    });
}

const deleteModal = document.getElementById('delete-confirm-modal'); 
window.deleteChatMsg = (msgId) => { messageToDelete = msgId; if(deleteModal) deleteModal.classList.remove('hidden'); }; 

const btnCancelDelete = document.getElementById('cancel-delete-btn');
if(btnCancelDelete) {
    btnCancelDelete.onclick = () => { messageToDelete = null; if(deleteModal) deleteModal.classList.add('hidden'); }; 
}
const btnConfirmDelete = document.getElementById('confirm-delete-btn');
if(btnConfirmDelete) {
    btnConfirmDelete.onclick = async () => { 
        if (messageToDelete) { 
            try { await deleteDoc(doc(db, "messages", messageToDelete)); showToast("ลบข้อความสำเร็จ", "success"); } 
            catch (err) { showToast("เกิดข้อผิดพลาดในการลบ", "error"); } 
            messageToDelete = null; if(deleteModal) deleteModal.classList.add('hidden'); 
        } 
    };
}

window.setReply = (msgId, senderName, rawText) => { 
    replyingTo = { msgId, senderName, text: rawText.substring(0, 40) + (rawText.length > 40 ? '...' : '') }; 
    const rName = document.getElementById('reply-to-name'); if(rName) rName.textContent = `@${senderName}`; 
    const rText = document.getElementById('reply-to-text'); if(rText) rText.textContent = replyingTo.text; 
    const rBanner = document.getElementById('reply-banner'); if(rBanner) rBanner.classList.remove('hidden'); 
    if(chatInput) chatInput.focus(); 
}; 
const btnCancelReply = document.getElementById('cancel-reply-btn');
if(btnCancelReply) {
    btnCancelReply.onclick = () => { replyingTo = null; const rBanner = document.getElementById('reply-banner'); if(rBanner) rBanner.classList.add('hidden'); };
}

function scrollToBottom(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return; const images = container.querySelectorAll('img'); let loadedCount = 0;
    if (images.length > 0) { images.forEach(img => { if (img.complete) { loadedCount++; } else { img.onload = () => { loadedCount++; if (loadedCount === images.length) container.scrollTop = container.scrollHeight; }; } }); }
    container.scrollTop = container.scrollHeight;
}

let isInitialLoad = true;
onSnapshot(query(collection(db, "messages"), orderBy("timestamp", "asc")), (snapshot) => { 
    allMessages = []; snapshot.forEach((docSnap) => { allMessages.push({ id: docSnap.id, ...docSnap.data() }); }); renderMessages(); 
    if (activeChannel === 'game_draw') scrollToBottom('game-chat-container'); else scrollToBottom('chat-container');
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
    chatContainer.innerHTML = ''; const filteredMessages = allMessages.filter(msg => msg.channel === activeChannel); let lastSender = null; 
    
    filteredMessages.forEach((m) => {
        let timeString = m.timestamp ? m.timestamp.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : "...";
        let formattedText = m.text ? m.text.replace(/\*\*(.*?)\*\*/g, '<span class="font-bold text-[#e4e5e7]">$1</span>') : '';

        let isMentioned = false;
        formattedText = formattedText.replace(/@([a-zA-Z0-9_ก-๙]+)/g, (match, username) => {
            if (username === currentUsername) { isMentioned = true; return `<span class="bg-[#5865F2]/40 text-[#dbdee1] font-bold px-1.5 py-0.5 rounded-md border border-[#5865F2]/50">@${username}</span>`; } else if (usersData[username]) { return `<span class="text-[#5865F2] font-bold hover:underline cursor-pointer" onclick="showUserProfile('${username}')">@${username}</span>`; } return match;
        });

        const rowHighlight = isMentioned ? "bg-[#5865F2]/10 border-l-[3px] border-[#5865F2] hover:bg-[#5865F2]/20" : "hover:bg-[#2b2d31]/50 border-l-[3px] border-transparent";

        if (m.senderName === "🤖 System Bot") {
            if (formattedText.includes("ยินดีต้อนรับสมาชิกใหม่")) {
                let cleanName = formattedText.split('**')[1] || "ใครบางคน";
                chatContainer.insertAdjacentHTML('beforeend', `<div class="chat-msg-row flex space-x-3 hover:bg-[#2b2d31]/50 border-l-[3px] border-transparent px-2 md:px-4 py-2.5 mt-2 -mx-2 md:-mx-4 group transition duration-150 items-start"><div class="w-8 md:w-10 flex justify-center mt-1"><i class="ph-bold ph-arrow-right text-[#23a559] text-[18px]"></i></div><div class="min-w-0 flex-1"><p class="text-[#949ba4] text-[14px] leading-relaxed"><span class="text-[#dbdee1] font-bold">${cleanName}</span> เพิ่งสไลด์เข้ามาในเซิร์ฟเวอร์! <span class="text-[10px] text-[#5c6069] ml-2 font-medium">${timeString}</span></p><button onclick="sendWave()" class="mt-2.5 flex items-center space-x-2 bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] px-3 py-1.5 rounded-md text-[13px] font-bold transition shadow-sm"><span class="text-[16px]">👋</span> <span>โบกมือทักทาย!</span></button></div></div>`);
                lastSender = "system_bot_join"; return;
            } else if (formattedText.includes("กระโดดเข้ามา") || formattedText.includes("ออกจากห้องนั่งเล่น")) { return; }
            chatContainer.insertAdjacentHTML('beforeend', `<div class="chat-msg-row flex space-x-3 md:space-x-4 hover:bg-[#2b2d31]/50 px-2 md:px-4 py-3 mt-4 -mx-2 md:-mx-4 group transition duration-150 relative items-center border-l-[3px] border-transparent hover:border-[#5865F2]"><div class="w-8 md:w-10 h-8 md:h-10 rounded-full bg-[#5865F2] flex items-center justify-center flex-shrink-0 shadow-lg"><i class="ph-fill ph-robot text-white text-[20px]"></i></div><div class="min-w-0 flex-1 pb-1"><div class="flex items-baseline space-x-2"><span class="font-extrabold text-[12px] text-[#5865F2] uppercase tracking-wider">System</span><span class="text-[10px] md:text-[11px] text-[#6d717a] font-medium">${timeString}</span></div><p class="text-[#949ba4] mt-1 text-[13px] md:text-[14px] leading-relaxed">${formattedText}</p></div></div>`);
            lastSender = "system_bot"; return; 
        }

        let msgAvatarUrl = usersData[m.senderName] ? usersData[m.senderName].avatar : `https://ui-avatars.com/api/?name=${m.senderName}&background=5865F2&color=fff&rounded=true&bold=true`;
        let msgFrameUrl = usersData[m.senderName] ? usersData[m.senderName].profileFrame : '';
        let frameHTML = msgFrameUrl ? `<img src="${msgFrameUrl}" class="absolute w-[135%] h-[135%] max-w-none pointer-events-none z-10 drop-shadow-sm">` : '';

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
            chatContainer.insertAdjacentHTML('beforeend', `<div class="chat-msg-row flex flex-col ${rowHighlight} px-2 md:px-4 py-2 mt-4 -mx-2 md:-mx-4 group transition duration-150 relative">${replyBlockHTML}<div class="flex space-x-3 md:space-x-4">
                <div class="relative flex-shrink-0 flex items-center justify-center w-8 h-8 md:w-10 md:h-10 cursor-pointer" onclick="showUserProfile('${m.senderName}')">
                    <img src="${msgAvatarUrl}" class="w-full h-full rounded-full object-cover opacity-95 hover:opacity-80 transition absolute z-0">
                    ${frameHTML}
                </div>
                <div class="min-w-0 flex-1 pb-0.5 pr-10"><div class="flex items-baseline space-x-2"><span onclick="showUserProfile('${m.senderName}')" class="font-medium text-[14px] md:text-[15px] text-[#e4e5e7] tracking-wide hover:underline cursor-pointer">${m.senderName}</span><span class="text-[10px] md:text-[11px] text-[#80848e] font-medium">${timeString}</span></div>${contentHTML}${reactsHTML}</div></div>${actionMenuUI}</div>`);
        }
        lastSender = m.senderName;
    });
    chatContainer.insertAdjacentHTML('beforeend', '<div class="h-4 w-full flex-shrink-0"></div>'); 
    setTimeout(() => { chatContainer.scrollTop = chatContainer.scrollHeight; }, 150);
}

if(chatInput) {
    chatInput.addEventListener('keyup', (e) => { 
        if(cmdMenu) {
            if(chatInput.value.startsWith('/')) { cmdMenu.classList.remove('hidden'); } 
            else { cmdMenu.classList.add('hidden'); } 
        }
    });
}

document.querySelectorAll('#command-list li').forEach(li => { 
    li.onclick = () => { 
        if(chatInput) {
            chatInput.value = li.getAttribute('data-cmd') + " "; 
            chatInput.focus(); 
        }
        if(cmdMenu) cmdMenu.classList.add('hidden'); 
    } 
});

async function sendAnyMessage(inputEl, channelStr) {
    const txt = inputEl.value.trim(); if (!txt) return; inputEl.value = ''; 
    clearTimeout(typingTimeout); isTyping = false; updateDoc(doc(db, "users", currentUserId), { isTyping: false }); 
    if(cmdMenu) cmdMenu.classList.add('hidden'); 
    if(mentionPopup) mentionPopup.classList.add('hidden');
    
    if(txt.startsWith('/') && channelStr !== 'game_draw') {
        let botReply = "";
        if(txt === '/roll') { const roll = Math.floor(Math.random() * 100) + 1; botReply = `🎲 **${currentUsername}** ทอยลูกเต๋าได้แต้ม **${roll}** (จาก 100)`; } 
        else if(txt === '/coin') { const coin = Math.random() < 0.5 ? "หัว" : "ก้อย"; botReply = `🪙 **${currentUsername}** โยนเหรียญออก **${coin}**`; } 
        else if(txt === '/clear') { if(currentUserRole !== 'Admin') { showToast("คุณไม่ใช่ Admin ไม่มีสิทธิ์", "error"); return; } const msgs = allMessages.filter(m => m.channel === channelStr); for(let m of msgs) await deleteDoc(doc(db, "messages", m.id)); botReply = `🧹 แอดมินล้างห้องแชทเรียบร้อยแล้ว`; } 
        else if(txt === '/draw') { 
            await addDoc(collection(db, "messages"), { text: `⏳ บอทกำลังปลุก AI ให้หาคำศัพท์ยากๆ แป๊บนึงนะ...`, senderName: "🤖 System Bot", channel: activeChannel, timestamp: serverTimestamp() });
            const randomWord = await getWordFromAI("draw");
            if(canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            await setDoc(doc(db, "appData", "whiteboard"), { image: "", updatedBy: "System", timestamp: serverTimestamp() }, { merge: true });
            await setDoc(doc(db, "appData", "drawGame"), { isActive: true, drawerId: currentUserId, drawerName: currentUsername, word: randomWord, channel: activeChannel, timestamp: serverTimestamp() });
            botReply = `🎨 **${currentUsername}** ท้าประลองเกมทายภาพ!\nรีบสลับหน้าจอไปดูที่แท็บ **"🎮 ทายคำจากภาพ"** แล้วพิมพ์คำตอบเลย! (AI เป็นคนคิดคำนะรอบนี้)`; 
        } else { showToast("ไม่รู้จักคำสั่งนี้", "error"); return; }
        await addDoc(collection(db, "messages"), { text: botReply, senderName: "🤖 System Bot", channel: channelStr, timestamp: serverTimestamp() }); return;
    }
    let isCorrect = false; let isAlmost = false;
    if (channelStr === 'game_draw' && currentDrawGame.isActive && currentDrawGame.drawerId !== currentUserId) {
        const guess = txt.toLowerCase(); const answer = currentDrawGame.word.toLowerCase();
        if (guess === answer) { isCorrect = true; } else if (guess !== answer && answer.length >= 3 && (answer.includes(guess) && answer.length - guess.length <= 2)) { isAlmost = true; }
    }
    await addDoc(collection(db, "messages"), { text: txt, senderName: currentUsername, channel: channelStr, timestamp: serverTimestamp(), reactions: {}, replyTo: replyingTo }); 
    replyingTo = null; 
    const rBanner = document.getElementById('reply-banner');
    if(rBanner) rBanner.classList.add('hidden'); 
    
    if(isCorrect) {
        await setDoc(doc(db, "appData", "drawGame"), { isActive: false }, { merge: true });
        await addDoc(collection(db, "messages"), { text: `🎉 ปรบมือ! **${currentUsername}** ทายถูกเป๊ะ!\nคำตอบคือ **"${currentDrawGame.word}"** เก่งมาก! 🏆`, senderName: "🤖 System Bot", channel: channelStr, timestamp: serverTimestamp() });
    } else if (isAlmost) { await addDoc(collection(db, "messages"), { text: `👀 **${currentUsername}** เกือบถูกแล้ว! พิมพ์ตกไปนิดเดียว พยายามอีกนิด!`, senderName: "🤖 System Bot", channel: channelStr, timestamp: serverTimestamp() }); }
}

const btnSend = document.getElementById('send-btn');
if(btnSend) btnSend.onclick = () => { if(chatInput) sendAnyMessage(chatInput, activeChannel); }; 
if(chatInput) chatInput.onkeypress = (e) => { if (e.key === 'Enter' && chatInput) sendAnyMessage(chatInput, activeChannel); }; 

const btnGameSend = document.getElementById('game-send-btn');
if(btnGameSend) btnGameSend.onclick = () => { if(gameChatInput) sendAnyMessage(gameChatInput, 'game_draw'); }; 
if(gameChatInput) gameChatInput.onkeypress = (e) => { if (e.key === 'Enter' && gameChatInput) sendAnyMessage(gameChatInput, 'game_draw'); }; 

const btnAttach = document.getElementById('attach-btn');
const fileInput = document.getElementById('file-input');
if(btnAttach) btnAttach.onclick = () => { if(fileInput) fileInput.click(); };

if(fileInput) {
    fileInput.onchange = async (e) => { 
        const f = e.target.files[0]; if (!f) return; 
        if(chatInput) { chatInput.placeholder = "กำลังอัปโหลดไฟล์..."; chatInput.disabled = true; }
        try { 
            const fd = new FormData(); fd.append("image", f); 
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: fd }); 
            const r = await res.json(); 
            if (r.success) { 
                await addDoc(collection(db, "messages"), { text: "", imageUrl: r.data.url, senderName: currentUsername, channel: activeChannel, timestamp: serverTimestamp(), reactions: {}, replyTo: replyingTo }); 
                replyingTo = null; 
                const rBanner = document.getElementById('reply-banner');
                if(rBanner) rBanner.classList.add('hidden'); 
            } 
        } catch (err) { showToast("อัปโหลดพลาด", "error"); } 
        finally { 
            if(chatInput) { chatInput.placeholder = "ส่งข้อความถึง #ห้องแชท"; chatInput.disabled = false; chatInput.value = ""; chatInput.focus(); }
        } 
    };
}

// ==========================================
// 🎨 11. ระบบกระดานวาดรูป
// ==========================================
let isDrawing = false; let isGameDrawing = false; let isEraserMode = false; let wbSyncTimer = null; let gameWbSyncTimer = null;

function initCanvasSize() { 
    if(canvas && canvasContainer) {
        if(canvas.width !== canvasContainer.clientWidth || canvas.height !== canvasContainer.clientHeight) { 
            const temp = canvas.toDataURL(); canvas.width = canvasContainer.clientWidth; canvas.height = canvasContainer.clientHeight; 
            if(temp !== "data:,") { const img = new Image(); img.onload = () => { if(ctx) ctx.drawImage(img, 0, 0); }; img.src = temp; } 
        } 
    }
}
function initGameCanvasSize() { 
    if(gameCanvas && gameCanvasContainer) {
        if(gameCanvas.width !== gameCanvasContainer.clientWidth || gameCanvas.height !== gameCanvasContainer.clientHeight) { 
            const temp = gameCanvas.toDataURL(); gameCanvas.width = gameCanvasContainer.clientWidth; gameCanvas.height = gameCanvasContainer.clientHeight; 
            if(temp !== "data:,") { const img = new Image(); img.onload = () => { if(gameCtx) gameCtx.drawImage(img, 0, 0); }; img.src = temp; } 
        }
    }
}
window.addEventListener('resize', () => { initCanvasSize(); initGameCanvasSize(); renderAllVideos(); }); 

function getMousePos(e, c) { const r = c.getBoundingClientRect(); const x = e.touches ? e.touches[0].clientX : e.clientX, y = e.touches ? e.touches[0].clientY : e.clientY; return { x: x - r.left, y: y - r.top }; } 
function startDrawing(e) { if(e.type === 'touchstart') e.preventDefault(); isDrawing = true; draw(e); } 
function draw(e) { 
    if (!isDrawing || !ctx || !canvas) return; 
    if(e.type === 'touchmove') e.preventDefault(); 
    const p = getMousePos(e, canvas); 
    const wbSize = document.getElementById('wb-size');
    const wbColor = document.getElementById('wb-color');
    if(wbSize) ctx.lineWidth = wbSize.value; 
    ctx.lineCap = 'round'; 
    if(wbColor) ctx.strokeStyle = wbColor.value; 
    ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x, p.y); 
} 
function stopDrawing() { 
    if (!isDrawing || !ctx) return; 
    isDrawing = false; ctx.beginPath(); 
    clearTimeout(wbSyncTimer); wbSyncTimer = setTimeout(() => syncWhiteboard(), 400); 
} 

if(canvas) {
    canvas.onmousedown = startDrawing; canvas.onmousemove = draw; canvas.onmouseup = canvas.onmouseout = stopDrawing; 
    canvas.addEventListener('touchstart', startDrawing, {passive: false}); canvas.addEventListener('touchmove', draw, {passive: false}); canvas.addEventListener('touchmove', function(e){ if(isDrawing) e.preventDefault(); }, {passive: false}); canvas.addEventListener('touchend', stopDrawing); 
}

const btnWbClear = document.getElementById('wb-clear');
if(btnWbClear) {
    btnWbClear.onclick = () => { 
        if(confirm("ล้างกระดานทั้งหมด?")) { 
            if(ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height); 
            syncWhiteboard(true); showToast("ล้างกระดานแล้ว", "success"); 
        } 
    }; 
}

async function syncWhiteboard(isC = false) { 
    if(!currentUserId || !canvas) return; 
    const imgData = isC ? "" : canvas.toDataURL("image/webp", 0.5); 
    await setDoc(doc(db, "appData", "whiteboard"), { image: imgData, updatedBy: currentUsername, timestamp: serverTimestamp() }, { merge: true }); 
} 

onSnapshot(doc(db, "appData", "whiteboard"), (d) => { 
    if (d.exists() && !isDrawing) { 
        const val = d.data(); 
        if (val.updatedBy && val.updatedBy !== currentUsername && !currentDrawGame.isActive) { 
            if(wbStatus) {
                wbStatus.innerHTML = `<i class="ph ph-pencil-simple mr-1.5"></i> ${val.updatedBy} เพิ่งอัปเดตกระดาน`; 
                wbStatus.classList.remove('opacity-0'); 
                setTimeout(() => { if(!currentDrawGame.isActive) wbStatus.classList.add('opacity-0'); }, 3000); 
            }
        } 
        if(val.image) { 
            const img = new Image(); img.onload = () => { if(ctx && canvas) { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); } }; img.src = val.image; 
        } else { 
            if(ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height); 
        } 
    } 
});

const btnGameEraser = document.getElementById('game-eraser-btn');
if(btnGameEraser) {
    btnGameEraser.onclick = () => { 
        isEraserMode = !isEraserMode; 
        btnGameEraser.classList.toggle('text-white'); 
        btnGameEraser.classList.toggle('bg-[#35373c]'); 
    }; 
}

function startGameDrawing(e) { if(!currentDrawGame.isActive || currentDrawGame.drawerId !== currentUserId) return; if(e.type === 'touchstart') e.preventDefault(); isGameDrawing = true; drawGame(e); } 
function drawGame(e) { 
    if (!isGameDrawing || !gameCtx || !gameCanvas) return; 
    if(e.type === 'touchmove') e.preventDefault(); 
    const p = getMousePos(e, gameCanvas); 
    const gSize = document.getElementById('game-size');
    const gColor = document.getElementById('game-color');
    if(gSize) gameCtx.lineWidth = gSize.value; 
    gameCtx.lineCap = 'round'; gameCtx.globalCompositeOperation = isEraserMode ? 'destination-out' : 'source-over'; 
    if(gColor) gameCtx.strokeStyle = gColor.value; 
    gameCtx.lineTo(p.x, p.y); gameCtx.stroke(); gameCtx.beginPath(); gameCtx.moveTo(p.x, p.y); 
} 
function stopGameDrawing() { 
    if (!isGameDrawing || !gameCtx) return; 
    isGameDrawing = false; gameCtx.beginPath(); 
    clearTimeout(gameWbSyncTimer); gameWbSyncTimer = setTimeout(() => syncGameWhiteboard(), 250); 
} 

if(gameCanvas) {
    gameCanvas.onmousedown = startGameDrawing; gameCanvas.onmousemove = drawGame; gameCanvas.onmouseup = gameCanvas.onmouseout = stopGameDrawing; 
    gameCanvas.addEventListener('touchstart', startGameDrawing, {passive: false}); gameCanvas.addEventListener('touchmove', drawGame, {passive: false}); gameCanvas.addEventListener('touchmove', function(e){ if(isGameDrawing) e.preventDefault(); }, {passive: false}); gameCanvas.addEventListener('touchend', stopGameDrawing); 
}

const btnGameClear = document.getElementById('game-clear-btn');
if(btnGameClear) {
    btnGameClear.onclick = () => { if(gameCtx && gameCanvas) gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height); syncGameWhiteboard(true); }; 
}

async function syncGameWhiteboard(isC = false) { 
    if(!gameCanvas) return;
    const imgData = isC ? "" : gameCanvas.toDataURL("image/webp", 0.5); 
    await setDoc(doc(db, "appData", "gameWhiteboard"), { image: imgData, updatedBy: currentUsername, timestamp: serverTimestamp() }, { merge: true }); 
} 

onSnapshot(doc(db, "appData", "gameWhiteboard"), (d) => { 
    if (d.exists() && !isGameDrawing) { 
        const val = d.data(); 
        if(val.image) { 
            const img = new Image(); img.onload = () => { if(gameCtx && gameCanvas) { gameCtx.globalCompositeOperation = 'source-over'; gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height); gameCtx.drawImage(img, 0, 0); } }; img.src = val.image; 
        } else { 
            if(gameCtx && gameCanvas) gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height); 
        } 
    } 
});

// ==========================================
// 🕵️‍♂️ 11.5 เกมจับสปาย (Who is the Spy?)
// ==========================================
let currentSpyData = { status: 'waiting', players: {}, votes: {} };
const lobbyUI = document.getElementById('spy-lobby-ui'); const playUI = document.getElementById('spy-play-ui'); const voteUI = document.getElementById('spy-vote-ui'); const playersListUI = document.getElementById('spy-players-list'); const joinSpyBtn = document.getElementById('spy-join-btn'); const startSpyBtn = document.getElementById('spy-start-btn'); const secretWordUI = document.getElementById('spy-secret-word');

onSnapshot(doc(db, "appData", "spyGame"), (d) => { if(d.exists()) { currentSpyData = d.data(); renderSpyGame(); } });

function renderSpyGame() {
    if(!playersListUI) return;
    playersListUI.innerHTML = ''; const playerIds = Object.keys(currentSpyData.players || {}); let amIJoined = playerIds.includes(currentUserId);
    playerIds.forEach(uid => { const p = currentSpyData.players[uid]; playersListUI.insertAdjacentHTML('beforeend', `<div class="bg-[#111214] px-4 py-2 rounded-full text-[14px] font-bold text-[#dbdee1] flex items-center border border-[#1e1f22] shadow-sm"><img src="${p.avatar}" class="w-6 h-6 rounded-full mr-2.5 object-cover">${p.name}</div>`); });
    if (playerIds.length === 0) { playersListUI.innerHTML = '<span class="text-[#6d717a] text-[13px] my-auto">ยังไม่มีผู้เล่น... เป็นคนแรกเลยสิ!</span>'; }

    if (currentSpyData.status === 'waiting' || !currentSpyData.status) {
        if(lobbyUI) lobbyUI.classList.remove('hidden'); if(playUI) playUI.classList.add('hidden'); if(voteUI) voteUI.classList.add('hidden');
        if (amIJoined) { if(joinSpyBtn) { joinSpyBtn.innerHTML = "ออกจากการรอ"; joinSpyBtn.className = "flex-1 bg-gradient-to-r from-[#da373c] to-[#b52a2e] hover:from-[#b52a2e] hover:to-[#961c1f] text-white px-6 py-3.5 rounded-xl font-bold shadow-[0_4px_15px_rgba(218,55,60,0.4)] transition-transform transform hover:-translate-y-0.5 text-[15px]"; } if (playerIds.length >= 3) { if(startSpyBtn) startSpyBtn.classList.remove('hidden'); } else { if(startSpyBtn) startSpyBtn.classList.add('hidden'); } } else { if(joinSpyBtn) { joinSpyBtn.innerHTML = "✋ เข้าร่วมวง"; joinSpyBtn.className = "flex-1 bg-gradient-to-r from-[#5865F2] to-[#4752C4] hover:from-[#4752C4] hover:to-[#3b44a8] text-white px-6 py-3.5 rounded-xl font-bold shadow-[0_4px_15px_rgba(88,101,242,0.4)] transition-transform transform hover:-translate-y-0.5 text-[15px]"; } if(startSpyBtn) startSpyBtn.classList.add('hidden'); }
    } else if (currentSpyData.status === 'playing') {
        if(lobbyUI) lobbyUI.classList.add('hidden'); if(voteUI) voteUI.classList.add('hidden');
        if (amIJoined) { if(playUI) playUI.classList.remove('hidden'); const myRole = currentSpyData.players[currentUserId].role; if (myRole === 'spy') { if(secretWordUI) { secretWordUI.textContent = "🕵️‍♂️ คุณคือสปาย!"; secretWordUI.className = "text-3xl font-extrabold text-[#da373c] tracking-wide drop-shadow-md"; } } else { if(secretWordUI) { secretWordUI.textContent = currentSpyData.normalWord; secretWordUI.className = "text-3xl font-extrabold text-[#23a559] tracking-wide drop-shadow-md"; } } } else { if(lobbyUI) { lobbyUI.classList.remove('hidden'); lobbyUI.innerHTML = `<h3 class="text-white font-bold mt-4 text-xl">⏳ เกมกำลังดำเนินอยู่...</h3><p class="text-[#80848e] text-[14px] mt-2">รอผู้เล่นรอบนี้โหวตให้เสร็จก่อนนะครับ</p>`; } if(joinSpyBtn) joinSpyBtn.classList.add('hidden'); if(startSpyBtn) startSpyBtn.classList.add('hidden'); }
    } else if (currentSpyData.status === 'voting') {
        if(lobbyUI) lobbyUI.classList.add('hidden'); if(playUI) playUI.classList.add('hidden');
        if (amIJoined) { if(voteUI) voteUI.classList.remove('hidden'); renderVoteUI(); } else { if(lobbyUI) { lobbyUI.classList.remove('hidden'); lobbyUI.innerHTML = `<h3 class="text-white font-bold mt-4 text-xl">🚨 กำลังโหวตจับสปาย...</h3><p class="text-[#80848e] text-[14px] mt-2">ลุ้นระทึก! ไปรอดูผลในช่องแชทได้เลย</p>`; } if(joinSpyBtn) joinSpyBtn.classList.add('hidden'); if(startSpyBtn) startSpyBtn.classList.add('hidden'); }
    }
}

function renderVoteUI() {
    const voteListUI = document.getElementById('spy-vote-list'); const voteStatusUI = document.getElementById('spy-vote-status'); 
    if(!voteListUI) return;
    voteListUI.innerHTML = '';
    const players = currentSpyData.players || {}; const votes = currentSpyData.votes || {}; const playerIds = Object.keys(players); const voteCount = Object.keys(votes).length; const playerTotal = playerIds.length;
    if(voteStatusUI) voteStatusUI.textContent = `โหวตไปแล้ว ${voteCount} / ${playerTotal} คน`; const haveIVoted = !!votes[currentUserId];
    playerIds.forEach(uid => {
        const p = players[uid]; if (uid === currentUserId) return; 
        let btnHTML = '';
        if (haveIVoted) { btnHTML = `<button disabled class="flex items-center p-3 rounded-xl bg-[#111214] border border-[#1e1f22] opacity-50 cursor-not-allowed"><img src="${p.avatar}" class="w-8 h-8 rounded-full mr-3 grayscale"><span class="text-[14px] font-bold text-gray-500">${p.name}</span></button>`; } else { btnHTML = `<button onclick="voteSpy('${uid}')" class="flex items-center p-3 rounded-xl bg-[#1e1f22] border border-[#35373c] hover:border-[#da373c] hover:bg-[#da373c]/10 transition-all group shadow-sm transform hover:-translate-y-0.5"><img src="${p.avatar}" class="w-8 h-8 rounded-full mr-3"><span class="text-[14px] font-bold text-[#dbdee1] group-hover:text-white">${p.name}</span></button>`; }
        voteListUI.insertAdjacentHTML('beforeend', btnHTML);
    });
    if (voteCount === playerTotal && voteCount > 0) { if (currentSpyData.host === currentUsername) { calculateSpyResult(votes, players); } }
}

window.voteSpy = async (targetUid) => {
    if (currentSpyData.votes && currentSpyData.votes[currentUserId]) return; 
    const newVotes = JSON.parse(JSON.stringify(currentSpyData.votes || {})); newVotes[currentUserId] = targetUid;
    await setDoc(doc(db, "appData", "spyGame"), { votes: newVotes }, { merge: true }); showToast("ส่งโหวตลับเรียบร้อย รอลุ้นผล!", "success");
};

async function calculateSpyResult(votes, players) {
    let counts = {}; for(let voterUid in votes) { const targetUid = votes[voterUid]; counts[targetUid] = (counts[targetUid] || 0) + 1; }
    let maxVotes = 0; let votedOutUids = [];
    for(let uid in counts) { if (counts[uid] > maxVotes) { maxVotes = counts[uid]; votedOutUids = [uid]; } else if (counts[uid] === maxVotes) { votedOutUids.push(uid); } }
    let spyName = "ไม่มี"; let spyUid = null; for(let uid in players) { if(players[uid].role === 'spy') { spyName = players[uid].name; spyUid = uid; } }
    let resultMsg = "";
    if (votedOutUids.length > 1) { resultMsg = `💥 **สปายชนะ!** เสียงโหวตแตก! ชาวบ้านทะเลาะกันเอง สปายรอดตัวไปได้! สปายตัวจริงคือ **${spyName}** 🕵️‍♂️ (คำศัพท์คือ: ${currentSpyData.normalWord})`; } else { const votedOutUid = votedOutUids[0]; if (votedOutUid === spyUid) { resultMsg = `🎉 **ชาวบ้านชนะ!** ทุกคนโหวตจับสปายถูกตัว! สปายตัวจริงคือ **${spyName}** 🕵️‍♂️ (คำศัพท์คือ: ${currentSpyData.normalWord})`; } else { const votedName = players[votedOutUid] ? players[votedOutUid].name : "แพะรับบาป"; resultMsg = `💥 **สปายชนะ!** ชาวบ้านโหวตพลาดไปประหาร **${votedName}**! สปายตัวจริงที่แอบเนียนอยู่คือ **${spyName}** 🕵️‍♂️ (คำศัพท์คือ: ${currentSpyData.normalWord})`; } }
    setTimeout(async () => { await setDoc(doc(db, "appData", "spyGame"), { status: 'waiting', players: {}, votes: {} }, { merge: true }); await addDoc(collection(db, "messages"), { text: resultMsg, senderName: "🤖 System Bot", channel: "general", timestamp: serverTimestamp() }); }, 2000);
}

if(joinSpyBtn) {
    joinSpyBtn.onclick = async () => { const pList = JSON.parse(JSON.stringify(currentSpyData.players || {})); if (pList[currentUserId]) { delete pList[currentUserId]; } else { pList[currentUserId] = { name: currentUsername, avatar: document.getElementById('current-user-avatar').src, role: 'normal' }; } await setDoc(doc(db, "appData", "spyGame"), { ...currentSpyData, players: pList, status: 'waiting' }); };
}
if(startSpyBtn) {
    startSpyBtn.onclick = async () => { startSpyBtn.innerHTML = `<i class="ph-fill ph-spinner animate-spin"></i> กำลังสุ่มคำ...`; startSpyBtn.disabled = true; const word = await getWordFromAI("spy"); const pList = JSON.parse(JSON.stringify(currentSpyData.players || {})); const uids = Object.keys(pList); const spyIndex = Math.floor(Math.random() * uids.length); uids.forEach((uid, idx) => { pList[uid].role = (idx === spyIndex) ? 'spy' : 'normal'; }); await setDoc(doc(db, "appData", "spyGame"), { status: 'playing', players: pList, normalWord: word, host: currentUsername, votes: {}, timestamp: serverTimestamp() }); await addDoc(collection(db, "messages"), { text: `🕵️‍♂️ **${currentUsername}** เริ่มเกมจับสปายแล้ว! (AI แจกคำศัพท์ให้ทุกคนเรียบร้อย) ใครเป็นสปายเนียนๆ ไว้ล่ะ!`, senderName: "🤖 System Bot", channel: "general", timestamp: serverTimestamp() }); startSpyBtn.disabled = false; startSpyBtn.innerHTML = `🚀 เริ่มเกมเลย!`; };
}
const spyEndBtn = document.getElementById('spy-end-btn');
if(spyEndBtn) {
    spyEndBtn.onclick = async () => { if(confirm("เปิดโหวตลับจับสปายเลยใช่ไหม? (ห้ามแอบคุยกันนะ!)")) { await setDoc(doc(db, "appData", "spyGame"), { status: 'voting', votes: {} }, { merge: true }); await addDoc(collection(db, "messages"), { text: `🚨 **หมดเวลาคุย!** ถึงเวลาโหวตลับแล้ว รีบไปกดโหวตในหน้าเกมเลยว่าใครน่าสงสัยที่สุด!`, senderName: "🤖 System Bot", channel: "general", timestamp: serverTimestamp() }); } };
}

// ==========================================
// 🎙️ 12. ระบบเสียง & วิดีโอ (🌟 V35: Video Rearranger)
// ==========================================

// ฟังก์ชันจัดระเบียบวิดีโอ (แยกมือถือ vs คอม)
window.renderAllVideos = () => {
    const isMobile = window.innerWidth < 768;
    const voiceView = document.getElementById('view-voice');
    const isVoiceViewActive = voiceView && !voiceView.classList.contains('hidden');

    const centerStage = document.getElementById('camera-stage');
    const sidebarGrid = document.getElementById('sidebar-video-grid');
    
    if(!centerStage || !sidebarGrid) return;

    // เลือกจุดหมาย: ถ้าเป็นมือถือ หรือ กำลังเปิดหน้าห้องเสียง ให้เอาไว้ตรงกลาง
    let targetContainer = isMobile ? centerStage : (isVoiceViewActive ? centerStage : sidebarGrid);

    // ย้ายวิดีโอทั้งหมดไปจุดหมาย
    activeVideos.forEach((videoData, uid) => {
        let camCard = document.getElementById(`cam-card-${uid}`);
        if (!camCard) {
            camCard = document.createElement("div");
            camCard.id = `cam-card-${uid}`;
            camCard.innerHTML = `<div id="player-${uid}" class="absolute inset-0 w-full h-full bg-black"></div><div class="absolute bottom-1 left-1 bg-black/70 px-2 py-0.5 rounded text-[10px] font-bold text-white z-10"><i class="ph-fill ph-video-camera text-[#23a559] mr-1"></i>${videoData.username}</div>`;
        }

        // จัดสไตล์ตามจุดหมาย
        if (targetContainer === centerStage) {
            camCard.className = "w-[160px] sm:w-[240px] aspect-video bg-black rounded-xl overflow-hidden relative shadow-lg border border-[#35373c] animate-[fadeIn_0.3s_ease-out] flex-shrink-0";
        } else {
            camCard.className = "w-full aspect-video bg-black rounded overflow-hidden relative border border-[#35373c] mb-1 animate-[fadeIn_0.3s_ease-out]";
        }

        if (camCard.parentNode !== targetContainer) {
            targetContainer.appendChild(camCard);
            // สั่งให้วิดีโอเล่นหลังจากย้ายมาลงใน DOM แล้ว
            if(videoData.track) videoData.track.play(`player-${uid}`, { fit: "cover" });
        }
    });

    // ซ่อน/โชว์ คอนเทนเนอร์ตรงกลาง
    if (centerStage.children.length > 0) {
        centerStage.classList.remove('hidden');
        centerStage.classList.add('flex');
    } else {
        centerStage.classList.add('hidden');
        centerStage.classList.remove('flex');
    }

    // ซ่อน/โชว์ คอนเทนเนอร์แถบขวา (Sidebar)
    const sidebarLiveContainer = document.getElementById('sidebar-live-container');
    if(sidebarLiveContainer) {
        if (sidebarGrid.children.length > 0) {
            sidebarLiveContainer.classList.remove('hidden'); sidebarLiveContainer.classList.add('active'); sidebarLiveContainer.style.display = 'block';
        } else {
            sidebarLiveContainer.classList.add('hidden'); sidebarLiveContainer.classList.remove('active'); sidebarLiveContainer.style.display = 'none';
        }
    }
};

function updateVoiceUI() {
    const activeUI = document.getElementById('active-voice-ui');
    if(!joinBtn || !activeUI) return;
    
    if (amIInVoice) {
        if(bottomLeaveBtn) bottomLeaveBtn.classList.remove('hidden');
        
        if (viewedVoiceChannel === connectedVoiceChannel) {
            joinBtn.classList.add('hidden');
            activeUI.classList.remove('hidden');
        } else {
            joinBtn.innerHTML = '<i class="ph-fill ph-arrows-left-right text-[22px] mr-2"></i> ย้ายมาห้องนี้';
            joinBtn.classList.remove('hidden');
            activeUI.classList.add('hidden');
        }
    } else {
        if(bottomLeaveBtn) bottomLeaveBtn.classList.add('hidden');
        joinBtn.innerHTML = '<i class="ph-fill ph-phone-call text-[22px] mr-2 animate-pulse"></i> เข้าร่วมห้องเสียง';
        joinBtn.classList.remove('hidden');
        activeUI.classList.add('hidden');
    }
}

if(joinBtn) {
    joinBtn.onclick = async () => {
        if (amIInVoice) {
            if (connectedVoiceChannel === viewedVoiceChannel) return; 
            await leaveVoice(true); 
        }
        await joinVoice(); 
    };
}

async function joinVoice() { 
    try { 
        if(joinBtn) joinBtn.innerHTML = "กำลังเชื่อมต่อ..."; 
        myNumericUid = Math.floor(Math.random() * 1000000); 
        
        rtcClient.on("user-published", async (u, t) => { 
            await rtcClient.subscribe(u, t); 
            if (t === "audio") {
                u.audioTrack.play(); 
                remoteAudioTracks[u.uid] = u.audioTrack; 
                let matchedUserId = null;
                for(let k in usersData) { if(usersData[k].agoraUid === u.uid) { matchedUserId = usersData[k].id; break; } }
                if(matchedUserId && userVolumes[matchedUserId] !== undefined) { u.audioTrack.setVolume(parseInt(userVolumes[matchedUserId])); }
            }
            if (t === "video") { 
                remoteVideoTracks[u.uid] = u.videoTrack;
                let matchedUserId = null; let matchedUserName = "Unknown";
                for(let k in usersData) { if(usersData[k].agoraUid === u.uid) { matchedUserId = usersData[k].id; matchedUserName = k; break; } }
                if (matchedUserId) {
                    const uData = usersData[matchedUserName];
                    if (uData && uData.isSharingScreen && ssStage) {
                        ssStage.classList.remove('hidden'); 
                        const ex = document.getElementById(`v-wrap-${u.uid}`); if(ex) ex.remove(); 
                        let pc = document.createElement("div"); pc.id = `v-wrap-${u.uid}`; pc.style.cssText="width:100%;height:100%;"; pc.className = "rounded-lg overflow-hidden bg-black flex items-center justify-center"; 
                        ssStage.appendChild(pc); u.videoTrack.play(pc, { fit: "contain" }); 
                    } else {
                        // 🌟 V35: จัดการวิดีโอผ่านระบบอัจฉริยะ
                        activeVideos.set(u.uid, { track: u.videoTrack, username: matchedUserName });
                        renderAllVideos();
                    }
                }
            } 
        }); 
        
        rtcClient.on("user-unpublished", async (u, t) => { 
            if (t === "audio") { delete remoteAudioTracks[u.uid]; } 
            if (t === "video") { 
                delete remoteVideoTracks[u.uid];
                const pc = document.getElementById(`v-wrap-${u.uid}`); if (pc) pc.remove(); 
                if(ssStage) {
                    const activeStreams = ssStage.querySelectorAll('div[id^="v-wrap-"]');
                    if (activeStreams.length === 0) ssStage.classList.add('hidden'); 
                }
                
                // 🌟 V35: จัดการวิดีโอผ่านระบบอัจฉริยะ
                activeVideos.delete(u.uid);
                const camCard = document.getElementById(`cam-card-${u.uid}`); if (camCard) camCard.remove();
                renderAllVideos();
            } 
        }); 
        
        connectedVoiceChannel = viewedVoiceChannel; 
        await rtcClient.join(AGORA_APP_ID, connectedVoiceChannel, null, myNumericUid); 
        
        let micConnected = false;
        try {
            localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true, AGC: true }); 
            await rtcClient.publish(localTracks.audioTrack); 
            micConnected = true;
            await localTracks.audioTrack.setMuted(isMuted);
        } catch (micErr) { 
            console.warn("ไม่สามารถเข้าถึงไมค์ได้", micErr); 
            isMuted = true; 
            showToast("เข้าร่วมแบบ 'ฟังอย่างเดียว' (เบราว์เซอร์บล็อกไมค์ / ไม่พบไมค์)", "info");
        }
        
        const muteIcon = document.getElementById('mute-icon'); 
        if (isMuted) {
            if(bottomMicIcon) bottomMicIcon.className = "ph-fill ph-microphone-slash text-[18px] text-[#da373c]";
            if(muteBtn) { muteBtn.classList.remove('bg-[#2b2d31]'); muteBtn.classList.add('bg-[#da373c]/20', 'text-[#da373c]'); }
            if(muteIcon) muteIcon.className = "ph-fill ph-microphone-slash text-[20px] md:text-[24px]"; 
        } else {
            if(bottomMicIcon) bottomMicIcon.className = "ph-fill ph-microphone text-[18px] text-[#dbdee1]";
            if(muteBtn) { muteBtn.classList.add('bg-[#2b2d31]'); muteBtn.classList.remove('bg-[#da373c]/20', 'text-[#da373c]'); }
            if(muteIcon) muteIcon.className = "ph ph-microphone text-[20px] md:text-[24px]"; 
        }
        
        await updateDoc(doc(db, "users", currentUserId), { inVoice: true, voiceChannel: connectedVoiceChannel, agoraUid: myNumericUid, isMuted: isMuted, isSharingScreen: false, isVideoOn: false }); 
        localStorage.setItem('dosh_active_voice', 'true'); 
        
        amIInVoice = true; 
        updateVoiceUI(); 
        startBackgroundAudioMode(); 
        
    } catch (err) { 
        console.error("Join Voice Error:", err); 
        localStorage.removeItem('dosh_active_voice'); 
        showToast("เชื่อมต่อห้องเสียงไม่สำเร็จ กรุณาลองใหม่", "error"); 
        if(currentUserId) { await updateDoc(doc(db, "users", currentUserId), { inVoice: false, voiceChannel: null, agoraUid: null }); }
        amIInVoice = false; updateVoiceUI();
    } 
}

if(camBtn) {
    camBtn.onclick = async () => {
        if (isSharingScreen) { showToast("กรุณาปิดแชร์หน้าจอก่อนเปิดกล้องครับ", "error"); return; }
        if (!isVideoOn) {
            try {
                localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack();
                await rtcClient.publish(localTracks.videoTrack);
                isVideoOn = true;
                if(currentUserId) await updateDoc(doc(db, "users", currentUserId), { isVideoOn: true });
                camBtn.classList.remove('bg-[#2b2d31]'); camBtn.classList.add('bg-[#23a559]', 'text-white');
                if(camIcon) camIcon.className = "ph-fill ph-video-camera text-[20px] md:text-[24px]";
                
                // 🌟 V35: นำกล้องตัวเองเข้าระบบอัจฉริยะ
                activeVideos.set('local', { track: localTracks.videoTrack, username: `คุณ (${currentUsername})` });
                renderAllVideos();

                showToast("เปิดกล้องแล้ว!", "success");
            } catch(e) { console.log(e); showToast("ไม่สามารถเข้าถึงกล้องได้ หรือไม่มีกล้องครับ", "error"); }
        } else { await stopCamera(); }
    };
}

async function stopCamera() {
    if (localTracks.videoTrack) { await rtcClient.unpublish(localTracks.videoTrack); localTracks.videoTrack.stop(); localTracks.videoTrack.close(); localTracks.videoTrack = null; }
    isVideoOn = false; if(currentUserId) await updateDoc(doc(db, "users", currentUserId), { isVideoOn: false });
    if(camBtn) { camBtn.classList.add('bg-[#2b2d31]'); camBtn.classList.remove('bg-[#23a559]', 'text-white'); }
    if(camIcon) camIcon.className = "ph ph-video-camera text-[20px] md:text-[24px]";
    
    activeVideos.delete('local');
    const camCard = document.getElementById(`cam-card-local`); if (camCard) camCard.remove();
    renderAllVideos();
}

async function stopScreenShare() { 
    const ssWrapper = document.getElementById('screen-share-wrapper'); const qualitySelect = document.getElementById('screen-quality'); const sIco = document.getElementById('screen-icon');
    if (screenTrack) { await rtcClient.unpublish(screenTrack); screenTrack.stop(); screenTrack.close(); screenTrack = null; } 
    if (screenAudioTrack) { await rtcClient.unpublish(screenAudioTrack); screenAudioTrack.stop(); screenAudioTrack.close(); screenAudioTrack = null; } 
    isSharingScreen = false; if(currentUserId) await updateDoc(doc(db, "users", currentUserId), { isSharingScreen: false }); 
    if (ssWrapper) ssWrapper.classList.replace('bg-[#23a559]', 'bg-[#2b2d31]'); else if(ssBtn) ssBtn.classList.replace('bg-[#23a559]', 'bg-[#2b2d31]');
    if (sIco) sIco.className = "ph ph-screencast text-[20px] md:text-[24px] text-[#dbdee1]"; 
    if (qualitySelect) { qualitySelect.classList.replace('text-white', 'text-[#80848e]'); qualitySelect.disabled = false; }
    const pc = document.getElementById(`v-wrap-local`); if (pc) pc.remove(); 
    if(ssStage) {
        const activeStreams = ssStage.querySelectorAll('div[id^="v-wrap-"]'); if (activeStreams.length === 0) ssStage.classList.add('hidden'); 
    }
    showToast("หยุดแชร์หน้าจอแล้ว", "info");
}

if(ssBtn) {
    ssBtn.onclick = async () => { 
        if (isVideoOn) { showToast("กรุณาปิดกล้องก่อนแชร์หน้าจอครับ", "error"); return; }
        const sIco = document.getElementById('screen-icon'); const ssWrapper = document.getElementById('screen-share-wrapper'); const qualitySelect = document.getElementById('screen-quality');
        if (!isSharingScreen) { 
            try { 
                const selectedVal = qualitySelect ? qualitySelect.value : "1080p_1";
                let encoderConfig = { width: 1920, height: 1080, frameRate: 30, bitrateMax: 3000 };
                if (selectedVal.includes("720")) encoderConfig = { width: 1280, height: 720, frameRate: 30, bitrateMax: 2000 };
                else if (selectedVal.includes("480")) encoderConfig = { width: 853, height: 480, frameRate: 30, bitrateMax: 1000 };
                else if (selectedVal.includes("360")) encoderConfig = { width: 640, height: 360, frameRate: 30, bitrateMax: 800 };
                else if (selectedVal === "1080p_60") encoderConfig = { width: 1920, height: 1080, frameRate: 60, bitrateMax: 4500 }; 
                const res = await AgoraRTC.createScreenVideoTrack({ encoderConfig: encoderConfig, optimizationMode: "motion" }, "auto"); 
                if (Array.isArray(res)) { screenTrack = res[0]; screenAudioTrack = res[1]; await rtcClient.publish([screenTrack, screenAudioTrack]); } else { screenTrack = res; await rtcClient.publish(screenTrack); } 
                isSharingScreen = true; await updateDoc(doc(db, "users", currentUserId), { isSharingScreen: true }); 
                if (ssWrapper) ssWrapper.classList.replace('bg-[#2b2d31]', 'bg-[#23a559]'); else if(ssBtn) ssBtn.classList.replace('bg-[#2b2d31]', 'bg-[#23a559]');
                if(sIco) sIco.className = "ph-fill ph-screencast text-[20px] md:text-[24px] text-white"; 
                if (qualitySelect) { qualitySelect.classList.replace('text-[#80848e]', 'text-white'); qualitySelect.disabled = true; }
                if(ssStage) {
                    ssStage.classList.remove('hidden'); let pc = document.createElement("div"); pc.id = `v-wrap-local`; pc.style.cssText="width:100%;height:100%;"; pc.className = "rounded-lg overflow-hidden bg-black flex items-center justify-center"; ssStage.appendChild(pc); screenTrack.play(pc, { fit: "contain" }); 
                }
                screenTrack.on("track-ended", stopScreenShare); 
            } catch (err) { console.log(err); showToast("แชร์หน้าจอไม่สำเร็จ", "error"); } 
        } else { await stopScreenShare(); } 
    };
}

async function leaveVoice(isSwitching = false) { 
    if (isSharingScreen) await stopScreenShare(); 
    if (isVideoOn) await stopCamera(); 
    if (localTracks.audioTrack) { localTracks.audioTrack.stop(); localTracks.audioTrack.close(); localTracks.audioTrack = null; } 
    await rtcClient.leave(); 
    connectedVoiceChannel = null;
    if(currentUserId) { await updateDoc(doc(db, "users", currentUserId), { inVoice: false, voiceChannel: null, agoraUid: null, isMuted: false, isSharingScreen: false, isVideoOn: false }); } 
    localStorage.removeItem('dosh_active_voice'); 
    
    amIInVoice = false; 
    if(!isSwitching) updateVoiceUI(); 
    
    activeVideos.clear(); // ล้างวิดีโอตอนกดออก
    const centerStage = document.getElementById('camera-stage'); if(centerStage) centerStage.innerHTML = '';
    renderAllVideos(); stopBackgroundAudioMode();
}

if(leaveBtn) leaveBtn.onclick = () => leaveVoice(false);
if(bottomLeaveBtn) bottomLeaveBtn.onclick = () => leaveVoice(false);

async function toggleMute() {
    if (!localTracks.audioTrack) { showToast("ไม่พบไมโครโฟน! คุณอยู่ในโหมดฟังอย่างเดียว", "error"); return; }
    isMuted = !isMuted; 
    await localTracks.audioTrack.setMuted(isMuted);
    if(currentUserId) { await updateDoc(doc(db, "users", currentUserId), { isMuted: isMuted }); }
    
    const muteIcon = document.getElementById('mute-icon'); 
    if (isMuted) { 
        if(muteBtn) { muteBtn.classList.remove('bg-[#2b2d31]'); muteBtn.classList.add('bg-[#da373c]/20', 'text-[#da373c]'); }
        if(muteIcon) muteIcon.className = "ph-fill ph-microphone-slash text-[20px] md:text-[24px]"; 
        if(bottomMicIcon) bottomMicIcon.className = "ph-fill ph-microphone-slash text-[18px] text-[#da373c]";
    } else { 
        if(muteBtn) { muteBtn.classList.add('bg-[#2b2d31]'); muteBtn.classList.remove('bg-[#da373c]/20', 'text-[#da373c]'); }
        if(muteIcon) muteIcon.className = "ph ph-microphone text-[20px] md:text-[24px]"; 
        if(bottomMicIcon) bottomMicIcon.className = "ph-fill ph-microphone text-[18px] text-[#dbdee1]";
    } 
}
if(muteBtn) muteBtn.onclick = toggleMute;
if(bottomMicBtn) bottomMicBtn.onclick = toggleMute;

function toggleDeafen() {
    isDeafened = !isDeafened;
    for (let uid in remoteAudioTracks) {
        if (remoteAudioTracks[uid]) {
            if (isDeafened) { remoteAudioTracks[uid].setVolume(0); } 
            else {
                let matchedUserId = null;
                for(let k in usersData) { if(usersData[k].agoraUid == uid) { matchedUserId = usersData[k].id; break; } }
                let vol = 100; if(matchedUserId && userVolumes[matchedUserId] !== undefined) vol = parseInt(userVolumes[matchedUserId]);
                remoteAudioTracks[uid].setVolume(vol);
            }
        }
    }
    if (isDeafened) { if(bottomDeafenIcon) bottomDeafenIcon.className = "ph-fill ph-speaker-slash text-[18px] text-[#da373c]"; showToast("ปิดเสียงเข้า (หูหนวก) แล้ว", "info"); } 
    else { if(bottomDeafenIcon) bottomDeafenIcon.className = "ph-fill ph-headphones text-[18px] text-[#dbdee1]"; showToast("เปิดเสียงหูฟังตามปกติ", "success"); }
}
if(bottomDeafenBtn) bottomDeafenBtn.onclick = toggleDeafen;

// ==========================================
// 📋 13. Task Board 
// ==========================================
const zones = { 'todo': document.getElementById('todo'), 'in_progress': document.getElementById('in_progress'), 'done': document.getElementById('done') };
onSnapshot(collection(db, "tasks"), (snapshot) => { 
    Object.values(zones).forEach(z => { if(z) z.innerHTML = ''; }); 
    snapshot.forEach((docSnap) => { 
        const d = docSnap.data(), id = docSnap.id, s = d.status || 'todo'; 
        let tC = "bg-[#1e1f22] text-[#dbdee1] border border-[#35373c]"; 
        if(d.tag && d.tag.includes('Dev')) tC = "bg-blue-500/10 text-blue-400 border border-blue-500/20"; 
        if(d.tag && d.tag.includes('Music')) tC = "bg-pink-500/10 text-pink-400 border border-pink-500/20"; 
        if(d.tag && d.tag.includes('Video')) tC = "bg-purple-500/10 text-purple-400 border border-purple-500/20"; 
        if(d.tag && d.tag.includes('Design')) tC = "bg-[#23a559]/10 text-[#23a559] border border-[#23a559]/20"; 
        const cardHTML = `<div draggable="true" data-id="${id}" class="task-card bg-[#1e1f22] p-3 rounded-lg shadow-sm cursor-move hover:shadow-md hover:-translate-y-0.5 transition duration-200 mb-2 border-l-4 ${s === 'done' ? 'border-[#4e5058] opacity-50' : 'border-[#5865F2]'} group animate-[fadeIn_0.3s_ease-out]"><div class="flex space-x-2 mb-2.5"><span class="${tC} text-[10px] font-bold px-2 py-0.5 rounded-sm flex items-center"><i class="ph-fill ph-tag text-[10px] mr-1"></i>${d.tag}</span></div><p class="text-[13px] md:text-[14px] font-medium text-[#dbdee1] ${s === 'done' ? 'line-through text-[#80848e]' : ''} leading-snug">${d.title}</p></div>`; 
        if (zones[s]) zones[s].insertAdjacentHTML('beforeend', cardHTML); 
    }); 
    document.querySelectorAll('.task-card').forEach(c => { 
        c.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', c.getAttribute('data-id')); setTimeout(() => c.classList.add('opacity-30'), 0); }); 
        c.addEventListener('dragend', () => c.classList.remove('opacity-30')); 
    }); 
});
Object.keys(zones).forEach(s => { 
    const z = zones[s]; 
    if(z) {
        z.addEventListener('dragover', (e) => { e.preventDefault(); z.classList.add('drop-zone-active'); }); 
        z.addEventListener('dragleave', () => z.classList.remove('drop-zone-active')); 
        z.addEventListener('drop', async (e) => { e.preventDefault(); z.classList.remove('drop-zone-active'); const tId = e.dataTransfer.getData('text/plain'); if (tId) await updateDoc(doc(db, "tasks", tId), { status: s }); }); 
    }
});

const btnAddTask = document.getElementById('add-task-btn');
if(btnAddTask) {
    btnAddTask.addEventListener('click', () => { 
        const tInput = document.getElementById('task-title-input');
        if(tInput) tInput.value = ''; 
        const tModal = document.getElementById('task-modal');
        if(tModal) tModal.classList.remove('hidden'); 
    }); 
}
const btnCloseTask = document.getElementById('close-task-modal');
if(btnCloseTask) {
    btnCloseTask.addEventListener('click', () => { 
        const tModal = document.getElementById('task-modal');
        if(tModal) tModal.classList.add('hidden'); 
    }); 
}
const btnConfirmTask = document.getElementById('confirm-task-btn');
if(btnConfirmTask) {
    btnConfirmTask.addEventListener('click', async () => { 
        const tInput = document.getElementById('task-title-input');
        const title = tInput ? tInput.value.trim() : ''; 
        const tagInput = document.getElementById('task-tag-input');
        const tag = tagInput ? tagInput.value : ''; 
        if (!title) { showToast("กรุณากรอกชื่องานก่อนครับ!", "error"); return; } 
        await addDoc(collection(db, "tasks"), { title: title, tag: tag, status: 'todo', timestamp: serverTimestamp() }); 
        const tModal = document.getElementById('task-modal');
        if(tModal) tModal.classList.add('hidden'); 
        showToast("เพิ่มงานใหม่ลงในกระดานแล้ว!", "success"); 
    });
}

if ('serviceWorker' in navigator) { 
    window.addEventListener('load', () => { 
        navigator.serviceWorker.register('sw.js').then(r => console.log('✅ HIVE SW Active')).catch(e => console.log('❌ SW Fail:', e)); 
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data && event.data.command === 'leave_voice') { leaveVoice(); }
        });
    }); 
}