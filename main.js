import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 🚨 1. ตั้งค่า Firebase & API ต่างๆ
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDRArTdFcrI7WuV0Bj72mpvnl3uiaRbMq0",
  authDomain: "hive-workspace-f373c.firebaseapp.com",
  projectId: "hive-workspace-f373c",
  storageBucket: "hive-workspace-f373c.firebasestorage.app",
  messagingSenderId: "724551925164",
  appId: "1:724551925164:web:4f355224d17e2b1e414e09",
  measurementId: "G-JE6XBR241G"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const IMGBB_API_KEY = "6b400d48dc08e690c88a8b32f3cef56a";
const AGORA_APP_ID = "8d7eec85ee1949d491e1dc191f265ed2"; 
const GEMINI_API_KEY = "AIzaSyCifkioB2z1Ho9LAGSFBYWtV-kM4bgtzhw"; 

// ==========================================
// ⚙️ 2. ประกาศตัวแปร DOM และ Globals ไว้บนสุด
// ==========================================
const rtcClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
let localTracks = { audioTrack: null, videoTrack: null }, screenTrack = null, screenAudioTrack = null;
let isMuted = false, isDeafened = false, isSharingScreen = false, isVideoOn = false, myNumericUid = null;
let currentUserId = null, currentUsername = "Guest", currentUserRole = "Member"; 
let allMessages = [], usersData = {}, typingTimeout = null, isTyping = false, unreadCounts = { general: 0, project: 0, game_draw: 0 };
let replyingTo = null, messageToDelete = null, mentionQuery = "";

let activeChannel = "general"; 
let connectedVoiceChannel = null; 
let amIInVoice = false;
let isAppInitialized = false; 

let remoteAudioTracks = {}, remoteVideoTracks = {}; 
let userVolumes = JSON.parse(localStorage.getItem('dosh_volumes')) || {};
let currentDrawGame = { isActive: false, drawerId: null, drawerName: "", word: "" };
let currentWatchParty = { isActive: false, videoId: "", hostName: "" };

let camLayoutPreference = localStorage.getItem('hive_cam_layout') || 'sidebar';
let denoiserExtension = null;
let denoiserProcessor = null;
let savedMicVolume = parseInt(localStorage.getItem('hive_my_mic_vol')) || 100;
let savedNoiseSetting = localStorage.getItem('hive_noise_setting') || 'ai';

const sfxMsg = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3'); sfxMsg.volume = 0.5;
const sfxPing = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); sfxPing.volume = 0.8;

const chatInput = document.getElementById('chat-input');
const gameChatInput = document.getElementById('game-chat-input');
const cmdMenu = document.getElementById('slash-command-menu');
const joinBtn = document.getElementById('join-voice-btn');
const leaveBtn = document.getElementById('leave-voice-btn'); 
const muteBtn = document.getElementById('mute-btn'); 
const ssBtn = document.getElementById('screen-share-btn'), ssStage = document.getElementById('screen-share-stage');
const camBtn = document.getElementById('camera-btn'), camIcon = document.getElementById('camera-icon');
const bottomMicBtn = document.getElementById('bottom-mic-btn'), bottomMicIcon = document.getElementById('bottom-mic-icon');
const bottomLeaveBtn = document.getElementById('bottom-leave-btn');
const bottomDeafenBtn = document.getElementById('bottom-deafen-btn'), bottomDeafenIcon = document.getElementById('bottom-deafen-icon');
const canvas = document.getElementById('whiteboard-canvas'); const ctx = canvas ? canvas.getContext('2d') : null;
const canvasContainer = document.getElementById('canvas-container'); const wbStatus = document.getElementById('wb-status'); 
const gameCanvas = document.getElementById('game-whiteboard-canvas'); const gameCtx = gameCanvas ? gameCanvas.getContext('2d') : null;
const gameCanvasContainer = document.getElementById('game-canvas-container');

// ==========================================
// 🛠️ 3. ฟังก์ชันช่วยเหลือทั่วไป
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

const lightbox = document.createElement('div');
lightbox.className = 'fixed inset-0 bg-black/95 z-[100] hidden flex items-center justify-center opacity-0 transition-opacity duration-300 cursor-zoom-out p-4';
lightbox.innerHTML = `<img id="lightbox-img" src="" class="max-w-full max-h-full object-contain rounded-lg shadow-2xl scale-95 transition-transform duration-300"><button class="absolute top-6 right-6 text-white hover:text-gray-300 transition"><i class="ph ph-x text-[32px]"></i></button>`;
document.body.appendChild(lightbox);
window.openLightbox = (url) => { document.getElementById('lightbox-img').src = url; lightbox.classList.remove('hidden'); void lightbox.offsetWidth; lightbox.classList.remove('opacity-0'); document.getElementById('lightbox-img').classList.replace('scale-95', 'scale-100'); };
lightbox.onclick = () => { lightbox.classList.add('opacity-0'); document.getElementById('lightbox-img').classList.replace('scale-100', 'scale-95'); setTimeout(() => lightbox.classList.add('hidden'), 300); };
window.sendWave = () => { if(chatInput) { chatInput.value = '👋 โบกมือทักทาย!'; const sendBtn = document.getElementById('send-btn'); if(sendBtn) sendBtn.click(); }};

let bgAudio = null, wakeLock = null;
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
        const randomSeed = Math.floor(Math.random() * 100000);
        let promptText = `สุ่มคำศัพท์ภาษาไทย 1 คำ สำหรับเกมทายภาพ (วาดรูป) ขอคำแปลกๆ สร้างสรรค์ ไม่ซ้ำเดิม (Seed: ${randomSeed}) ห้ามมีเครื่องหมายใดๆ ตอบมาแค่คำศัพท์เพียวๆ 1 คำ`;
        if (gameType === "spy") { 
            const categories = ["อาหาร", "ของใช้ในบ้าน", "สัตว์โลก", "สถานที่", "อาชีพ", "ยานพาหนะ", "ผลไม้", "เครื่องใช้ไฟฟ้า", "เครื่องแต่งกาย"];
            const randomCat = categories[Math.floor(Math.random() * categories.length)];
            promptText = `สุ่มคำศัพท์ภาษาไทย 1 คำ ในหมวดหมู่ "${randomCat}" สำหรับเล่นเกม Spyfall ขอคำที่คนทั่วไปรู้จักดี (Seed: ${randomSeed}) ห้ามมีเครื่องหมายใดๆ ตอบมาแค่คำศัพท์เพียวๆ 1 คำ`; 
        }
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }], generationConfig: { temperature: 1.5 } }) 
        });
        const data = await res.json(); 
        if (data.candidates && data.candidates[0]) {
            return data.candidates[0].content.parts[0].text.replace(/[\r\n.]/g, "").trim();
        }
        throw new Error("API Limit");
    } catch (err) { 
        const drawBackup = [
            "ไดโนเสาร์", "ชาบู", "มนุษย์ต่างดาว", "แฮมเบอร์เกอร์", "หมูกระทะ", "โรงหนัง", 
            "นางเงือก", "จรวด", "ผีดิบ", "กล้องถ่ายรูป", "แว่นตาว่ายน้ำ", "รถพยาบาล", 
            "นักบินอวกาศ", "ซูชิ", "ปลาหมึกย่าง", "ภูเขาไฟ", "เรือดำน้ำ", "เฮลิคอปเตอร์", 
            "ตู้เย็น", "ไดร์เป่าผม", "สายชาร์จ", "กระบองเพชร", "แมงมุม", "กิ้งก่า", "นกฮูก",
            "ปราสาท", "เตารีด", "กระเป๋าเดินทาง", "ไฟฉาย", "รองเท้าสเก็ต", "โดรน", "เรือใบ",
            "พิซซ่า", "ปฏิทิน", "ต้นไม้", "ภูเขา", "ร่ม", "กีตาร์", "กลองชุด", "ไมโครโฟน"
        ];
        const spyBackup = [
            "พิซซ่า", "โรงพยาบาล", "สวนสัตว์", "รถไฟ", "เครื่องบิน", "หมอ", "ตำรวจ", "ครู", 
            "สิงโต", "ช้าง", "พัดลม", "ทีวี", "ตู้เย็น", "ไมโครเวฟ", "ส้มตำ", "ชานมไข่มุก", 
            "วัด", "ทะเล", "น้ำตก", "ห้างสรรพสินค้า", "โรงเรียน", "มหาวิทยาลัย", "ร้านกาแฟ", "ตลาดนัด",
            "สระว่ายน้ำ", "สนามบิน", "โรงแรม", "สถานีตำรวจ", "ธนาคาร", "ร้านตัดผม", "ร้านอาหาร",
            "แมว", "สุนัข", "หมู", "กระต่าย", "กางเกงยีนส์", "รองเท้าผ้าใบ", "นาฬิกาข้อมือ"
        ];
        const backup = gameType === "spy" ? spyBackup : drawBackup;
        return backup[Math.floor(Math.random() * backup.length)]; 
    }
}

// ==========================================
// 🛡️ 4. ระบบ Auth & เริ่มต้นโหลดข้อมูล
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid; 
        currentUsername = user.displayName || user.email.split('@')[0];
        
        const myNameUI = document.getElementById('current-user-name');
        if(myNameUI) myNameUI.textContent = currentUsername;
        
        const myAvatarUI = document.getElementById('current-user-avatar');
        if(myAvatarUI) {
            myAvatarUI.src = (user.photoURL && user.photoURL !== "null" && user.photoURL !== "undefined" && user.photoURL.trim() !== "") 
                ? user.photoURL 
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUsername)}&background=5865F2&color=fff&rounded=true&bold=true`;
        }
        
        try { 
            const userDoc = await getDoc(doc(db, "users", currentUserId)); 
            if (userDoc.exists()) { 
                currentUserRole = userDoc.data().role; 
                const adminBtn = document.getElementById('admin-menu-btn'); 
                if (currentUserRole === 'Admin' && adminBtn) adminBtn.classList.remove('hidden'); 
            } 
        } catch (err) {}
        
        if (!isAppInitialized) {
            isAppInitialized = true;
            startDatabaseListeners(); 
        }
        
        const wasInVoice = localStorage.getItem('dosh_active_voice') === 'true';
        if (wasInVoice) { 
            await updateDoc(doc(db, "users", currentUserId), { status: 'online' }).catch(()=>{}); 
            setTimeout(() => { if(joinBtn) joinBtn.click(); }, 1500); 
        } else { 
            await updateDoc(doc(db, "users", currentUserId), { status: 'online', inVoice: false, agoraUid: null, isMuted: false, isSharingScreen: false, isVideoOn: false, isTyping: false }).catch(()=>{}); 
        }
    } else { 
        window.location.href = "index.html"; 
    }
});

const btnLogout = document.getElementById('logout-btn');
if(btnLogout) {
    btnLogout.addEventListener('click', async () => { 
        if (currentUserId) { try { await updateDoc(doc(db, "users", currentUserId), { status: 'offline', inVoice: false, agoraUid: null, isMuted: false, isSharingScreen: false, isVideoOn: false, isTyping: false }); } catch (e) {} } 
        localStorage.removeItem('dosh_active_voice'); 
        if (localTracks.audioTrack && leaveBtn) { leaveBtn.click(); } 
        signOut(auth); 
    });
}

// ==========================================
// 📡 5. ระบบดึงข้อมูลจากฐานข้อมูล 
// ==========================================
const zones = { 'todo': document.getElementById('todo'), 'in_progress': document.getElementById('in_progress'), 'done': document.getElementById('done') };

function startDatabaseListeners() {
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

    onSnapshot(collection(db, "users"), (snapshot) => {
        const membersList = document.getElementById('members-list'), voiceActiveList = document.getElementById('voice-active-users'), voiceGrid = document.getElementById('voice-grid'), typingIndicator = document.getElementById('typing-indicator');
        if(membersList) membersList.innerHTML = ''; if (voiceActiveList) voiceActiveList.innerHTML = ''; 
        let usersInVoiceCount = 0, peopleTyping = []; 
        const countEl = document.getElementById('member-count');
        if(countEl) countEl.textContent = snapshot.size; 
        usersData = {}; const currentVoiceCardIds = [];

        snapshot.forEach((docSnap) => {
            const u = docSnap.data(), id = docSnap.id, userName = u.username || 'Unknown';
            let userAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=5865F2&color=fff&bold=true`;
            if (u.photoURL && u.photoURL !== "undefined" && u.photoURL !== "null" && u.photoURL.trim() !== "") {
                userAvatar = u.photoURL;
            }
            const frameUrl = u.profileFrame || '';
            
            usersData[userName] = { 
                avatar: userAvatar, 
                banner: u.bannerURL || '', 
                id: id, 
                agoraUid: u.agoraUid, 
                customStatus: u.customStatus || '', 
                role: u.role, 
                inVoice: u.inVoice, 
                isSharingScreen: u.isSharingScreen, 
                isVideoOn: u.isVideoOn, 
                profileFrame: frameUrl,
                cardTheme: u.cardTheme || '',
                cardDeco: u.cardDeco || ''
            }; 
            if (u.isTyping && u.typingChannel === activeChannel && id !== currentUserId) peopleTyping.push(userName);
            
            const isOnline = u.status === 'online', statusColor = isOnline ? 'bg-[#23a559]' : 'bg-[#5c6069]';
            const roleDisplay = u.role === 'Admin' ? `<span class="text-[#da373c] font-extrabold ml-1.5 text-[9px] bg-[#da373c]/10 px-1.5 py-0.5 rounded uppercase">Admin</span>` : '';
            const nameStyle = u.role === 'Banned' ? 'line-through text-[#da373c]' : (isOnline ? 'text-[#d1d3d6]' : 'text-[#6d717a]');
            const muteIconSmall = u.isMuted ? '<i class="ph-fill ph-microphone-slash text-[#da373c] ml-auto text-[14px]"></i>' : '';
            const muteIconLarge = u.isMuted ? '<div class="absolute -bottom-1 -right-1 bg-[#111214] rounded-full p-1.5 border-2 border-[#1e1f22] shadow-sm flex items-center justify-center z-30"><i class="ph-fill ph-microphone-slash text-[#da373c] text-[14px]"></i></div>' : '';
            const screenBadgeSmall = u.isSharingScreen ? '<span class="ml-2 text-[9px] bg-[#5865F2] text-white px-1.5 py-0.5 rounded flex items-center font-bold tracking-wider"><i class="ph-fill ph-screencast mr-1"></i>LIVE</span>' : '';
            const customStatusText = u.customStatus ? `<p class="text-[11px] text-[#23a559] truncate mt-0.5">${u.customStatus}</p>` : `<p class="text-[11px] text-[#6d717a] truncate mt-0.5">${isOnline ? 'ออนไลน์' : 'ออฟไลน์'}</p>`;
            const renderFrameHtml = frameUrl ? `<img src="${frameUrl}" class="absolute w-[135%] h-[135%] max-w-none pointer-events-none z-10 drop-shadow-md">` : '';

            if (id === currentUserId) { 
                const myStatusUI = document.getElementById('current-user-status'); 
                if(myStatusUI) { myStatusUI.textContent = u.customStatus || 'ออนไลน์'; myStatusUI.className = u.customStatus ? 'text-[11px] text-[#23a559] truncate leading-none mt-0.5' : 'text-[11px] text-[#6d717a] truncate leading-none mt-0.5'; }
                const inputUI = document.getElementById('settings-username-input'); 
                if(inputUI) inputUI.value = currentUsername; 
                const myBottomFrame = document.getElementById('current-user-frame');
                if(myBottomFrame) { if (frameUrl) { myBottomFrame.src = frameUrl; myBottomFrame.classList.remove('hidden'); } else { myBottomFrame.classList.add('hidden'); } }
            }

            if(membersList) {
                membersList.insertAdjacentHTML('beforeend', `
                    <div onclick="showUserProfile('${userName}')" class="flex items-center space-x-3 cursor-pointer p-2 rounded-md hover:bg-[#2b2d31] transition group ${!isOnline ? 'opacity-50' : ''}">
                        <div class="relative flex-shrink-0 flex items-center justify-center w-8 h-8"><img src="${userAvatar}" class="w-8 h-8 rounded-full object-cover opacity-90 absolute z-0">${renderFrameHtml}<div class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${statusColor} rounded-full border-[3px] border-[#151619] z-20"></div></div>
                        <div class="overflow-hidden flex-1"><div class="flex items-center"><p class="text-[14px] font-medium truncate ${nameStyle}">${userName} ${roleDisplay}</p></div>${customStatusText}</div>
                    </div>`);
            }
                
            if (u.inVoice && voiceActiveList) {
                voiceActiveList.insertAdjacentHTML('beforeend', `
                <div class="flex items-center space-x-2.5 text-[13px] text-[#80848e] py-1 px-2 hover:bg-[#2b2d31] hover:text-[#dbdee1] rounded-md transition cursor-pointer ml-2">
                    <div class="relative flex-shrink-0 flex items-center justify-center w-6 h-6"><img src="${userAvatar}" class="w-6 h-6 rounded-full object-cover opacity-90 absolute z-0">${frameUrl ? `<img src="${frameUrl}" class="absolute w-[140%] h-[140%] max-w-none pointer-events-none z-10 drop-shadow-md">` : ''}</div>
                    <span class="truncate font-medium flex-1 flex items-center">${userName} ${screenBadgeSmall}</span>${muteIconSmall}
                </div>`);
            }
            
            if (u.inVoice && voiceGrid) { 
                usersInVoiceCount++; 
                const isMe = id === currentUserId;
                const savedVol = userVolumes[id] !== undefined ? userVolumes[id] : 100;
                const volSlider = (!isMe && u.agoraUid) ? `<div class="w-full mt-1.5 px-3 flex items-center space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onclick="event.stopPropagation()"><i class="ph ph-speaker-high text-[#80848e] text-[12px]"></i><input type="range" min="0" max="300" value="${savedVol}" class="w-full h-1 accent-[#5865F2] cursor-pointer" oninput="changeUserVolume('${u.agoraUid}', '${id}', this.value)" title="ปรับเสียง (สูงสุด 300%)"></div>` : `<div class="h-6"></div>`;

                currentVoiceCardIds.push(`voice-card-${id}`);
                let card = document.getElementById(`voice-card-${id}`);
                
                if (!card) {
                    voiceGrid.insertAdjacentHTML('beforeend', `
                        <div id="voice-card-${id}" class="bg-[#111214] rounded-2xl w-[140px] h-[160px] pt-4 pb-2 px-2 ${u.isVideoOn ? 'hidden' : 'flex'} flex-col items-center justify-center relative shadow-xl border border-[#1e1f22] animate-[fadeIn_0.3s_ease-out] hover:border-[#35373c] transition-colors group overflow-hidden">
                            <div class="relative mb-2 md:mb-3 flex-shrink-0 z-10 flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 transition-all duration-300"><img src="${userAvatar}" class="w-full h-full rounded-full object-cover bg-gray-900 border-4 border-[#151619] shadow-2xl absolute z-0">${frameUrl ? `<img src="${frameUrl}" class="absolute w-[130%] h-[130%] max-w-none pointer-events-none z-10 drop-shadow-xl">` : ''}<div id="mute-badge-${id}" class="z-20">${muteIconLarge}</div></div>
                            <p class="font-bold text-[#dbdee1] text-[13px] md:text-[15px] truncate w-full text-center px-2 z-10 drop-shadow-md mt-1">${userName}</p>
                            <div class="z-10 w-full">${volSlider}</div>
                        </div>
                    `);
                } else {
                    if (u.isVideoOn) { card.classList.add('hidden'); card.classList.remove('flex'); } 
                    else { card.classList.remove('hidden'); card.classList.add('flex'); }
                    const muteBadge = document.getElementById(`mute-badge-${id}`);
                    if (muteBadge) muteBadge.innerHTML = muteIconLarge;
                }
            }
        });

        if(voiceGrid) {
            Array.from(voiceGrid.children).forEach(child => { if (child.id.startsWith('voice-card-') && !currentVoiceCardIds.includes(child.id)) { child.remove(); } });
            if (usersInVoiceCount === 0) { if (!document.getElementById('empty-voice')) { voiceGrid.innerHTML = `<div id="empty-voice" class="w-full flex flex-col items-center justify-center mt-20 md:mt-32 text-[#6d717a]"><div class="w-20 h-20 md:w-24 md:h-24 bg-[#111214] rounded-full flex items-center justify-center mb-4 border border-[#1e1f22]"><i class="ph ph-users-three text-[40px] opacity-40"></i></div><p class="font-bold text-base text-[#949ba4]">ไม่มีใครอยู่ในห้องเสียง</p></div>`; } } else { const empty = document.getElementById('empty-voice'); if (empty) empty.remove(); }
        }
        if (typingIndicator) { if (peopleTyping.length > 0) { typingIndicator.innerHTML = `<i class="ph-fill ph-chat-teardrop-dots mr-1.5 animate-bounce"></i> ${peopleTyping.join(', ')} กำลังพิมพ์...`; typingIndicator.classList.remove('opacity-0'); } else { typingIndicator.classList.add('opacity-0'); } }
        renderMessages();
    });

    onSnapshot(doc(db, "appData", "whiteboard"), (d) => { 
        if (d.exists() && !isDrawing) { 
            const val = d.data(); 
            if (val.updatedBy && val.updatedBy !== currentUsername && !currentDrawGame.isActive) { 
                if(wbStatus) { wbStatus.innerHTML = `<i class="ph ph-pencil-simple mr-1.5"></i> ${val.updatedBy} เพิ่งอัปเดตกระดาน`; wbStatus.classList.remove('opacity-0'); setTimeout(() => { if(!currentDrawGame.isActive) wbStatus.classList.add('opacity-0'); }, 3000); }
            } 
            if(val.image) { 
                const img = new Image(); img.onload = () => { if(ctx && canvas) { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); } }; img.src = val.image; 
            } else { 
                if(ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height); 
            } 
        } 
    });

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

    onSnapshot(doc(db, "appData", "drawGame"), (d) => {
        if(d.exists()) {
            currentDrawGame = d.data();
            const display = document.getElementById('game-word-display');
            const toolbar = document.getElementById('game-toolbar');
            if(currentDrawGame.isActive) {
                if(currentDrawGame.drawerId === currentUsername) { 
                    if(display) display.innerHTML = `🎨 คำปริศนาของคุณคือ: <span class="text-yellow-400 ml-2 font-bold tracking-wider">${currentDrawGame.word}</span>`; 
                    if(toolbar) toolbar.classList.remove('hidden'); 
                } else { 
                    let hiddenWord = currentDrawGame.word ? currentDrawGame.word.replace(/./g, '_ ') : ''; 
                    if(display) display.innerHTML = `🤔 <span class="text-yellow-400 mr-2 font-bold">${currentDrawGame.drawerName}</span> กำลังวาด... | <span class="tracking-widest ml-2">${hiddenWord}</span>`; 
                    if(toolbar) toolbar.classList.add('hidden'); 
                }
            } else { 
                if(display) display.innerHTML = `<i class="ph-fill ph-check-circle mr-2 text-[#23a559]"></i> เกมจบแล้ว รอเริ่มรอบใหม่`; 
                if(toolbar) toolbar.classList.add('hidden'); 
            }
        }
    });

    onSnapshot(doc(db, "appData", "spyGame"), (d) => { if(d.exists()) { currentSpyData = d.data(); renderSpyGame(); } });

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
} 

// ==========================================
// 🧭 6. ระบบสลับหน้าจอ (Navigation & Views)
// ==========================================
const views = { 
    chat: document.getElementById('view-chat'), 
    board: document.getElementById('view-board'), 
    voice: document.getElementById('view-voice'), 
    whiteboard: document.getElementById('view-whiteboard'), 
    'game-draw': document.getElementById('view-game-draw'), 
    'game-spy': document.getElementById('view-game-spy'),
    shop: document.getElementById('view-shop')
};
const membersSidebar = document.getElementById('members-sidebar'), sidebar = document.getElementById('sidebar'), overlay = document.getElementById('overlay');
document.querySelectorAll('.open-menu, #open-members-voice').forEach(btn => btn.onclick = () => { if(sidebar) sidebar.classList.add('open'); if(overlay) overlay.classList.add('active'); }); 
const btnCloseMenu = document.getElementById('close-menu'); if(btnCloseMenu) btnCloseMenu.onclick = () => { if(sidebar) sidebar.classList.remove('open'); if(overlay) overlay.classList.remove('active'); }; 
const btnOpenMembers = document.getElementById('open-members'); if(btnOpenMembers) btnOpenMembers.onclick = () => { if(membersSidebar) membersSidebar.classList.remove('translate-x-full'); if(overlay) overlay.classList.add('active'); }; 
const btnCloseMembers = document.getElementById('close-members'); if(btnCloseMembers) btnCloseMembers.onclick = () => { if(membersSidebar) membersSidebar.classList.add('translate-x-full'); if(overlay) overlay.classList.remove('active'); }; 
if(overlay) overlay.onclick = () => { if(sidebar) sidebar.classList.remove('open'); if(membersSidebar) membersSidebar.classList.add('translate-x-full'); if(overlay) overlay.classList.remove('active'); };

function updateUnreadBadge(channel) { 
    const btn = document.querySelector(`.nav-btn[data-channel="${channel}"]`); 
    if (!btn) return; 
    let badge = btn.querySelector('.unread-badge'); 
    if (unreadCounts[channel] > 0) { 
        if (!badge) { badge = document.createElement('span'); badge.className = 'unread-badge bg-[#da373c] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto animate-[fadeIn_0.2s_ease-out] shadow-sm'; btn.appendChild(badge); } 
        badge.textContent = unreadCounts[channel] > 99 ? '99+' : unreadCounts[channel]; 
    } else { if (badge) badge.remove(); } 
}

document.querySelectorAll('.nav-btn').forEach(btn => { 
    btn.onclick = (e) => { 
        e.preventDefault(); 
        const view = btn.getAttribute('data-view'); 
        if(!view) return; 
        if (isTyping && currentUserId) { isTyping = false; clearTimeout(typingTimeout); updateDoc(doc(db, "users", currentUserId), { isTyping: false }); } 
        
        document.querySelectorAll('.nav-btn').forEach(b => { b.classList.remove('channel-active', 'text-[#dbdee1]', 'bg-[#404249]'); b.classList.add('channel-inactive', 'text-[#80848e]'); }); 
        btn.classList.remove('channel-inactive', 'text-[#80848e]'); btn.classList.add('channel-active', 'text-[#dbdee1]', 'bg-[#404249]'); 
        Object.values(views).forEach(v => { if(v) v.classList.add('hidden'); }); 
        if(views[view]) views[view].classList.remove('hidden'); 
        
        if(view === 'whiteboard') setTimeout(initCanvasSize, 50);
        if(view === 'game-draw') setTimeout(initGameCanvasSize, 50);
        if(view === 'shop') renderHiveShop();
        
        if(membersSidebar) membersSidebar.classList.remove('md:hidden'); 
        if (view === 'chat' || view === 'voice') { 
            if(membersSidebar) membersSidebar.classList.remove('hidden'); 
            if (view === 'chat') { 
                activeChannel = btn.getAttribute('data-channel'); 
                const headerTitle = document.getElementById('chat-header-title');
                if(headerTitle) headerTitle.textContent = btn.getAttribute('data-name'); 
                unreadCounts[activeChannel] = 0; updateUnreadBadge(activeChannel); renderMessages(); 
            } 
        } else { 
            if(membersSidebar) membersSidebar.classList.add('hidden'); 
        } 
        
        if (view === 'game-draw') { activeChannel = 'game_draw'; unreadCounts[activeChannel] = 0; updateUnreadBadge(activeChannel); renderMessages(); }
        if(sidebar) sidebar.classList.remove('open'); 
        if(overlay) overlay.classList.remove('active'); 
    }; 
});

// ==========================================
// 🪪 7. โปรไฟล์การ์ด & โปรไฟล์ Settings
// ==========================================
window.showUserProfile = (userName) => { 
    const u = usersData[userName]; if(!u) return; 
    const pName = document.getElementById('profile-card-name'); if(pName) pName.textContent = userName; 
    const pAvatar = document.getElementById('profile-card-avatar'); if(pAvatar) pAvatar.src = u.avatar; 
    const bannerImg = document.getElementById('profile-card-banner'); 
    if(bannerImg) { if (u.banner) { bannerImg.src = u.banner; bannerImg.classList.remove('hidden'); } else { bannerImg.classList.add('hidden'); } }
    const pStatus = document.getElementById('profile-card-status'); if(pStatus) pStatus.textContent = u.customStatus || 'ไม่ได้ตั้งสถานะ'; 
    
    let badges = ''; 
    if(u.role === 'Admin') badges += '<span class="inline-flex items-center bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-[12px] text-white shadow-inner mr-2"><div class="w-2.5 h-2.5 rounded-full bg-[#da373c] mr-2 shadow-[0_0_8px_#da373c]"></div> Admin</span>'; 
    else badges += '<span class="inline-flex items-center bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-[12px] text-white shadow-inner mr-2"><div class="w-2.5 h-2.5 rounded-full bg-[#5865F2] mr-2 shadow-[0_0_8px_#5865F2]"></div> Member</span>'; 
    if (u.avatar.toLowerCase().includes('.gif') || u.banner.toLowerCase().includes('.gif') || u.profileFrame || u.cardTheme || u.cardDeco) { 
        badges += '<span class="inline-flex items-center bg-gradient-to-r from-pink-500 to-purple-500 border border-white/20 px-3 py-1.5 rounded-lg text-[12px] text-white font-bold shadow-[0_0_15px_rgba(236,72,153,0.5)] animate-pulse"><i class="ph-fill ph-sparkle mr-1.5"></i> VIP</span>'; 
    }
    const pBadges = document.getElementById('profile-card-badges'); if(pBadges) pBadges.innerHTML = badges; 
    
    const activitySection = document.getElementById('profile-card-activity');
    if (activitySection) {
        if (currentWatchParty && currentWatchParty.isActive && currentWatchParty.videoId && u && u.inVoice) {
            activitySection.classList.remove('hidden');
            const activityImg = document.getElementById('profile-activity-img');
            if (activityImg) activityImg.src = `https://img.youtube.com/vi/${currentWatchParty.videoId}/mqdefault.jpg`;
            const activityTitle = document.getElementById('profile-activity-title');
            const activityDetail = document.getElementById('profile-activity-detail');
            if (currentWatchParty.hostName === userName) {
                if(activityTitle) activityTitle.textContent = "กำลังแชร์ YouTube";
                if(activityDetail) activityDetail.innerHTML = `เป็นโฮสต์เปิดคลิปให้เพื่อนดู`;
            } else {
                if(activityTitle) activityTitle.textContent = "กำลังดู Watch Party";
                if(activityDetail) activityDetail.innerHTML = `เปิดคลิปโดย ${currentWatchParty.hostName}`;
            }
        } else {
            activitySection.classList.add('hidden'); 
        }
    }
    
    const frameImg = document.getElementById('profile-card-frame');
    if(frameImg) { if (u.profileFrame) { frameImg.src = u.profileFrame; frameImg.classList.remove('hidden'); } else { frameImg.classList.add('hidden'); } }
    
    const pModal = document.getElementById('profile-card-modal'); 
    if(pModal) {
        const cardBox = pModal.firstElementChild;
        if(cardBox) {
            cardBox.style.background = u.cardTheme || 'rgba(17, 18, 20, 0.92)';
            cardBox.classList.remove('overflow-hidden');
            const bannerWrap = document.getElementById('profile-card-banner')?.parentElement;
            if(bannerWrap) bannerWrap.classList.add('overflow-hidden', 'rounded-t-2xl', 'md:rounded-t-3xl');

            cardBox.querySelectorAll('.card-deco-overlay').forEach(el => el.remove());

            const decoItem = shopDecos.find(d => d.id === u.cardDeco);
            if(decoItem && decoItem.topSvg) {
                cardBox.insertAdjacentHTML('beforeend', `
                    <img src="${decoItem.topSvg}" class="card-deco-overlay absolute -top-11 left-1/2 -translate-x-1/2 w-[108%] max-w-none pointer-events-none z-30 drop-shadow-[0_6px_12px_rgba(0,0,0,0.8)]">
                    <img src="${decoItem.bottomSvg}" class="card-deco-overlay absolute -bottom-8 left-1/2 -translate-x-1/2 w-[106%] max-w-none pointer-events-none z-30 drop-shadow-[0_6px_12px_rgba(0,0,0,0.8)]">
                `);
            }
        }
        pModal.classList.remove('hidden'); 
    }
};

const btnCloseProfile = document.getElementById('close-profile-card');
if(btnCloseProfile) btnCloseProfile.onclick = () => { const p = document.getElementById('profile-card-modal'); if(p) p.classList.add('hidden'); }; 

const pModalWrap = document.getElementById('profile-card-modal');
if(pModalWrap) { pModalWrap.addEventListener('click', (e) => { if (e.target === pModalWrap) pModalWrap.classList.add('hidden'); }); }

document.querySelectorAll('.settings-tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.settings-tab-btn').forEach(b => {
            b.classList.remove('active', 'bg-[#404249]', 'text-[#dbdee1]');
            b.classList.add('text-[#80848e]');
        });
        document.querySelectorAll('.settings-tab-content').forEach(c => c.classList.add('hidden'));
        btn.classList.add('active', 'bg-[#404249]', 'text-[#dbdee1]');
        btn.classList.remove('text-[#80848e]');
        const targetId = btn.getAttribute('data-tab');
        document.getElementById(targetId).classList.remove('hidden');
    };
});

const settingsModal = document.getElementById('settings-modal'), avatarInput = document.getElementById('settings-avatar-input'), bannerInput = document.getElementById('settings-banner-input');
let cropper = null, currentCropType = ''; 

const frameOptions = [
    { id: '', name: 'ไม่มี', url: '' },
    { id: 'neon', name: 'นีออนม่วง', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='46' fill='none' stroke='%23a855f7' stroke-width='6'/></svg>" },
    { id: 'gold', name: 'ทองคำ VIP', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='44' fill='none' stroke='%23eab308' stroke-width='8'/></svg>" },
    { id: 'cow', name: 'ลายวัว', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='46' fill='none' stroke='%23ffffff' stroke-width='8'/><circle cx='50' cy='50' r='46' fill='none' stroke='%23111111' stroke-width='8' stroke-dasharray='15 20'/></svg>" },
    { id: 'fire', name: 'ไฟลุก', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='none' stroke='%23ef4444' stroke-width='4'/><circle cx='50' cy='50' r='48' fill='none' stroke='%23f97316' stroke-width='2' stroke-dasharray='5 5'/></svg>" },
    { id: 'cyber', name: 'ไซเบอร์', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect x='5' y='5' width='90' height='90' rx='45' fill='none' stroke='%2306b6d4' stroke-width='4'/><path d='M 10 50 L 90 50' stroke='%2306b6d4' stroke-width='1' opacity='0.5'/></svg>" }
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
        div.innerHTML = `<div class="w-14 h-14 rounded-xl flex items-center justify-center relative mb-2 transition-all ${ringClass}"><img src="${avatarSrc}" class="w-8 h-8 rounded-full opacity-80 absolute z-0 object-cover">${imgHTML}</div><span class="text-[10px] ${isSelected ? 'text-[#dbdee1]' : 'text-gray-500 group-hover:text-gray-300'} font-bold">${f.name}</span>`;
        div.onclick = () => { const selFrame = document.getElementById('settings-selected-frame'); if(selFrame) selFrame.value = f.url; renderFrameOptions(f.url); };
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
    
    const camLayoutSelect = document.getElementById('settings-cam-layout');
    if(camLayoutSelect) camLayoutSelect.value = camLayoutPreference;

    getMicrophones();

    if(settingsModal) settingsModal.classList.remove('hidden'); 
    if(sidebar) sidebar.classList.remove('open'); 
    if(overlay) overlay.classList.remove('active'); 
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

    if (file.type === 'image/gif') { 
        showToast("ว้าว! ตรวจพบรูปเคลื่อนไหว (GIF) กำลังอัปโหลดแบบ VIP!", "info"); 
        uploadImageRaw(file, type); 
        e.target.value = ""; 
        return; 
    }

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
const closeCropModal = () => { const cropModal = document.getElementById('crop-modal'); if(cropModal) cropModal.classList.add('hidden'); if (cropper) { cropper.destroy(); cropper = null; } };
const btnCloseCrop = document.getElementById('close-crop-btn'); if(btnCloseCrop) btnCloseCrop.onclick = closeCropModal; 
const btnCancelCrop = document.getElementById('cancel-crop-btn'); if(btnCancelCrop) btnCancelCrop.onclick = closeCropModal;

async function uploadImage(file, type) { 
    showToast(`กำลังบีบอัดและอัปโหลด${type === 'avatar' ? 'โปรไฟล์' : 'ภาพปก'}... ⏳`, "info"); 
    const wrap = document.getElementById(`settings-${type}-wrapper`);
    if(wrap) wrap.classList.add('opacity-50', 'pointer-events-none'); 

    try { 
        const compressedBlob = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const c = document.createElement('canvas');
                    let width = img.width, height = img.height;
                    const maxWidth = type === 'avatar' ? 400 : 1200;
                    const maxHeight = type === 'avatar' ? 400 : 600;
                    if (width > height) { if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; } } 
                    else { if (height > maxHeight) { width = Math.round((width * maxHeight) / height); height = maxHeight; } }
                    c.width = width; c.height = height;
                    const context = c.getContext('2d');
                    context.drawImage(img, 0, 0, width, height);
                    c.toBlob((blob) => { resolve(blob || file); }, 'image/webp', 0.8);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });

        const fd = new FormData(); 
        fd.append("image", compressedBlob, `hive_${type}_${Date.now()}.webp`); 
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: fd }); 
        const r = await res.json(); 
        
        if (r.success) { 
            if(type === 'avatar') { 
                await updateProfile(auth.currentUser, { photoURL: r.data.url }); 
                await updateDoc(doc(db, "users", currentUserId), { photoURL: r.data.url }); 
                const p1 = document.getElementById('settings-avatar-preview'); if(p1) p1.src = r.data.url; 
                const p2 = document.getElementById('current-user-avatar'); if(p2) p2.src = r.data.url; 
            } else { 
                await updateDoc(doc(db, "users", currentUserId), { bannerURL: r.data.url }); 
                const p1 = document.getElementById('settings-banner-preview'); 
                if(p1) { p1.src = r.data.url; p1.classList.remove('hidden'); }
            } 
            showToast("อัปโหลดสำเร็จ!", "success"); 
        } else { showToast("อัปโหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", "error"); }
    } catch(err) { showToast("เกิดข้อผิดพลาดในการอัปโหลด", "error"); } 
    finally { if(wrap) wrap.classList.remove('opacity-50', 'pointer-events-none'); } 
}

async function uploadImageRaw(file, type) { 
    showToast(`กำลังอัปโหลดไฟล์ GIF ${type === 'avatar' ? 'โปรไฟล์' : 'ภาพปก'}... ⏳`, "info"); 
    const wrap = document.getElementById(`settings-${type}-wrapper`);
    if(wrap) wrap.classList.add('opacity-50', 'pointer-events-none'); 

    try { 
        const fd = new FormData(); 
        fd.append("image", file); 
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: fd }); 
        const r = await res.json(); 
        
        if (r.success) { 
            if(type === 'avatar') { 
                await updateProfile(auth.currentUser, { photoURL: r.data.url }); 
                await updateDoc(doc(db, "users", currentUserId), { photoURL: r.data.url }); 
                const p1 = document.getElementById('settings-avatar-preview'); if(p1) p1.src = r.data.url; 
                const p2 = document.getElementById('current-user-avatar'); if(p2) p2.src = r.data.url; 
            } else { 
                await updateDoc(doc(db, "users", currentUserId), { bannerURL: r.data.url }); 
                const p1 = document.getElementById('settings-banner-preview'); 
                if(p1) { p1.src = r.data.url; p1.classList.remove('hidden'); }
            } 
            showToast("อัปโหลดภาพเคลื่อนไหวสำเร็จ!", "success"); 
        } else { showToast("อัปโหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", "error"); }
    } catch(err) { showToast("เกิดข้อผิดพลาดในการอัปโหลดไฟล์ GIF", "error"); } 
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

        const camLayoutSelect = document.getElementById('settings-cam-layout');
        if (camLayoutSelect) {
            camLayoutPreference = camLayoutSelect.value;
            localStorage.setItem('hive_cam_layout', camLayoutPreference);
        }

        try { 
            await updateProfile(auth.currentUser, { displayName: newName }); 
            await updateDoc(doc(db, "users", currentUserId), { username: newName, customStatus: newStatus, profileFrame: newFrame }); 
            currentUsername = newName; 
            const myNameUI = document.getElementById('current-user-name');
            if(myNameUI) myNameUI.textContent = currentUsername; 
            showToast("บันทึกการตั้งค่าแล้ว!", "success"); 
            if(settingsModal) settingsModal.classList.add('hidden'); 
        } catch(e) { showToast("เกิดข้อผิดพลาดในการบันทึก", "error"); } 
    };
}

// ==========================================
// 💬 8. ระบบ Chat & Mentions
// ==========================================
function handleMentionInput(e) {
    const input = e.target;
    const val = input.value; const cursorPos = input.selectionStart;
    const textBeforeCursor = val.substring(0, cursorPos);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_ก-๙]*)$/);
    const mentionPopup = document.getElementById('mention-popup');
    if(!mentionPopup) return;
    if (match) { mentionQuery = match[1].toLowerCase(); showMentionPopup(input, match[0]); } else { mentionPopup.classList.add('hidden'); }
}

function showMentionPopup(inputEl, fullMatch) {
    const mentionPopup = document.getElementById('mention-popup');
    if(!mentionPopup) return;
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
document.addEventListener('click', (e) => { 
    const mentionPopup = document.getElementById('mention-popup');
    if (mentionPopup && !mentionPopup.contains(e.target) && e.target !== chatInput && e.target !== gameChatInput) mentionPopup.classList.add('hidden'); 
});

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
if(btnCancelDelete) btnCancelDelete.onclick = () => { messageToDelete = null; if(deleteModal) deleteModal.classList.add('hidden'); }; 

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
if(btnCancelReply) btnCancelReply.onclick = () => { replyingTo = null; const rBanner = document.getElementById('reply-banner'); if(rBanner) rBanner.classList.add('hidden'); };

function scrollToBottom(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return; const images = container.querySelectorAll('img'); let loadedCount = 0;
    if (images.length > 0) { images.forEach(img => { if (img.complete) { loadedCount++; } else { img.onload = () => { loadedCount++; if (loadedCount === images.length) container.scrollTop = container.scrollHeight; }; } }); }
    container.scrollTop = container.scrollHeight;
}

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

        let msgAvatarUrl = usersData[m.senderName] ? usersData[m.senderName].avatar : `https://ui-avatars.com/api/?name=${encodeURIComponent(m.senderName)}&background=5865F2&color=fff&rounded=true&bold=true`;
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
            const replyAvatar = usersData[m.replyTo.senderName] ? usersData[m.replyTo.senderName].avatar : `https://ui-avatars.com/api/?name=${encodeURIComponent(m.replyTo.senderName)}`;
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
    chatInput.addEventListener('keyup', () => { 
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
    };
});

async function sendAnyMessage(inputEl, channelStr) {
    const txt = inputEl.value.trim(); if (!txt) return; inputEl.value = ''; 
    clearTimeout(typingTimeout); isTyping = false; updateDoc(doc(db, "users", currentUserId), { isTyping: false }); 
    if(cmdMenu) cmdMenu.classList.add('hidden'); 
    const mentionPopup = document.getElementById('mention-popup');
    if(mentionPopup) mentionPopup.classList.add('hidden');
    
    if(txt.startsWith('/') && channelStr !== 'game_draw') {
        let botReply = "";
        if(txt === '/roll') { const roll = Math.floor(Math.random() * 100) + 1; botReply = `🎲 **${currentUsername}** ทอยลูกเต๋าได้แต้ม **${roll}** (จาก 100)`; } 
        else if(txt === '/coin') { const coin = Math.random() < 0.5 ? "หัว" : "ก้อย"; botReply = `🪙 **${currentUsername}** โยนเหรียญออก **${coin}**`; } 
        else if(txt === '/clear') { if(currentUserRole !== 'Admin') { showToast("คุณไม่ใช่ Admin ไม่มีสิทธิ์", "error"); return; } const msgs = allMessages.filter(m => m.channel === channelStr); for(let m of msgs) await deleteDoc(doc(db, "messages", m.id)); botReply = `🧹 แอดมินล้างห้องแชทเรียบร้อยแล้ว`; } 
        else if(txt === '/draw') { 
            await addDoc(collection(db, "messages"), { text: `⏳ บอทกำลังปลุก AI ให้หาคำศัพท์ยากๆ แป๊บนึงนะ...`, senderName: "🤖 System Bot", channel: activeChannel, timestamp: serverTimestamp() });
            const randomWord = await getWordFromAI("draw");
            if(gameCanvas && gameCtx) gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
            await setDoc(doc(db, "appData", "gameWhiteboard"), { image: "", updatedBy: "System", timestamp: serverTimestamp() }, { merge: true });
            await setDoc(doc(db, "appData", "drawGame"), { isActive: true, drawerId: currentUsername, drawerName: currentUsername, word: randomWord, channel: activeChannel, timestamp: serverTimestamp() });
            botReply = `🎨 **${currentUsername}** ท้าประลองเกมทายภาพ!\nรีบสลับหน้าจอไปดูที่แท็บ **"🎮 ทายคำจากภาพ"** แล้วพิมพ์คำตอบเลย! (AI เป็นคนคิดคำนะรอบนี้)`; 
        } else { showToast("ไม่รู้จักคำสั่งนี้", "error"); return; }
        await addDoc(collection(db, "messages"), { text: botReply, senderName: "🤖 System Bot", channel: channelStr, timestamp: serverTimestamp() }); return;
    }
    
    let isCorrect = false, isAlmost = false;
    if (channelStr === 'game_draw' && currentDrawGame && currentDrawGame.isActive && currentDrawGame.drawerId !== currentUsername) {
        const guess = txt.toLowerCase(); 
        const answer = currentDrawGame.word ? currentDrawGame.word.toLowerCase() : "";
        if (guess === answer) { isCorrect = true; } 
        else if (guess !== answer && answer.length >= 3 && (answer.includes(guess) && answer.length - guess.length <= 2)) { isAlmost = true; }
    }
    
    await addDoc(collection(db, "messages"), { text: txt, senderName: currentUsername, channel: channelStr, timestamp: serverTimestamp(), reactions: {}, replyTo: replyingTo }); 
    replyingTo = null; 
    const rBanner = document.getElementById('reply-banner');
    if(rBanner) rBanner.classList.add('hidden'); 
    
    if(isCorrect) {
        await setDoc(doc(db, "appData", "drawGame"), { isActive: false }, { merge: true });
        await addDoc(collection(db, "messages"), { text: `🎉 ปรบมือ! **${currentUsername}** ทายถูกเป๊ะ!\nคำตอบคือ **"${currentDrawGame.word}"** เก่งมาก! 🏆`, senderName: "🤖 System Bot", channel: channelStr, timestamp: serverTimestamp() });
    } else if (isAlmost) { 
        await addDoc(collection(db, "messages"), { text: `👀 **${currentUsername}** เกือบถูกแล้ว! พิมพ์ตกไปนิดเดียว พยายามอีกนิด!`, senderName: "🤖 System Bot", channel: channelStr, timestamp: serverTimestamp() }); 
    }
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
// 🎨 9. ระบบวาดรูป และ เกมทายภาพ
// ==========================================
let isDrawing = false, isGameDrawing = false, isEraserMode = false, wbSyncTimer = null, gameWbSyncTimer = null;

function resizeCanvasToDisplaySize(targetCanvas) {
    if(!targetCanvas) return;
    const parent = targetCanvas.parentElement;
    if(!parent) return;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    if (width > 0 && height > 0 && (targetCanvas.width !== width || targetCanvas.height !== height)) {
        const tempImg = targetCanvas.toDataURL();
        targetCanvas.width = width;
        targetCanvas.height = height;
        if(tempImg !== "data:,") { 
            const img = new Image(); 
            img.onload = () => { 
                const context = targetCanvas.getContext('2d');
                if(context) context.drawImage(img, 0, 0, width, height); 
            }; 
            img.src = tempImg; 
        }
    }
}

function initCanvasSize() { resizeCanvasToDisplaySize(canvas); }
function initGameCanvasSize() { resizeCanvasToDisplaySize(gameCanvas); }
window.addEventListener('resize', () => { initCanvasSize(); initGameCanvasSize(); });

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
    canvas.addEventListener('touchstart', startDrawing, {passive: false}); canvas.addEventListener('touchmove', draw, {passive: false}); canvas.addEventListener('touchend', stopDrawing); 
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

const btnGameEraser = document.getElementById('game-eraser-btn');
if(btnGameEraser) {
    btnGameEraser.onclick = () => { 
        isEraserMode = !isEraserMode; 
        btnGameEraser.classList.toggle('text-white'); 
        btnGameEraser.classList.toggle('bg-[#35373c]'); 
    }; 
}

function startGameDrawing(e) { if(!currentDrawGame.isActive || currentDrawGame.drawerId !== currentUsername) return; if(e.type === 'touchstart') e.preventDefault(); isGameDrawing = true; drawGame(e); } 
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
    gameCanvas.addEventListener('touchstart', startGameDrawing, {passive: false}); gameCanvas.addEventListener('touchmove', drawGame, {passive: false}); gameCanvas.addEventListener('touchend', stopGameDrawing); 
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

const btnStartGameDraw = document.getElementById('start-game-btn');
if(btnStartGameDraw) {
    btnStartGameDraw.onclick = async () => {
        const originalText = btnStartGameDraw.innerHTML; 
        btnStartGameDraw.innerHTML = `<i class="ph-fill ph-spinner animate-spin mr-1.5 text-[16px]"></i> AI กำลังคิดคำ...`; 
        btnStartGameDraw.disabled = true;
        
        const randomWord = await getWordFromAI("draw"); 
        if(gameCtx && gameCanvas) gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height); 
        
        await setDoc(doc(db, "appData", "gameWhiteboard"), { image: "", updatedBy: "System", timestamp: serverTimestamp() }, { merge: true });
        await setDoc(doc(db, "appData", "drawGame"), { isActive: true, drawerId: currentUsername, drawerName: currentUsername, word: randomWord, channel: "game_draw", timestamp: serverTimestamp() });
        await addDoc(collection(db, "messages"), { text: `🎨 **${currentUsername}** เริ่มเกมทายภาพแล้ว! (คำศัพท์รอบนี้สุ่มโดย AI 🧠)`, senderName: "🤖 System Bot", channel: "game_draw", timestamp: serverTimestamp() });
        
        btnStartGameDraw.innerHTML = originalText; 
        btnStartGameDraw.disabled = false;
    };
}

// ==========================================
// 🕵️‍♂️ 10. เกมจับสปาย (Who is the Spy?)
// ==========================================
let currentSpyData = { status: 'waiting', players: {}, votes: {} };
const lobbyUI = document.getElementById('spy-lobby-ui'); const playUI = document.getElementById('spy-play-ui'); const voteUI = document.getElementById('spy-vote-ui'); const playersListUI = document.getElementById('spy-players-list'); const joinSpyBtn = document.getElementById('spy-join-btn'); const startSpyBtn = document.getElementById('spy-start-btn'); const secretWordUI = document.getElementById('spy-secret-word');

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
// 🎙️ 11. ระบบเสียง (Agora WebRTC) & AI
// ==========================================
window.changeUserVolume = (targetAgoraUid, targetDbId, volumeValue) => {
    const vol = parseInt(volumeValue);
    userVolumes[targetDbId] = vol;
    localStorage.setItem('dosh_volumes', JSON.stringify(userVolumes));
    if (remoteAudioTracks[targetAgoraUid]) {
        remoteAudioTracks[targetAgoraUid].setVolume(vol);
    }
};

async function getMicrophones() {
    const micSelect = document.getElementById('audio-input-select');
    if (!micSelect) return;
    try {
        const mics = await AgoraRTC.getMicrophones();
        micSelect.innerHTML = '';
        mics.forEach(mic => {
            const option = document.createElement('option');
            option.value = mic.deviceId;
            option.text = mic.label || `Microphone ${micSelect.length + 1}`;
            micSelect.appendChild(option);
        });
        const savedMic = localStorage.getItem('hive_selected_mic');
        if (savedMic) micSelect.value = savedMic;
    } catch (error) {
        micSelect.innerHTML = '<option value="">กรุณาอนุญาตการเข้าถึงไมค์ก่อน</option>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const micSelect = document.getElementById('audio-input-select');
    if(micSelect) {
        micSelect.onchange = async (e) => {
            const deviceId = e.target.value;
            localStorage.setItem('hive_selected_mic', deviceId);
            if (localTracks.audioTrack) {
                await localTracks.audioTrack.setDevice(deviceId);
                showToast("เปลี่ยนไมโครโฟนแล้ว", "success");
            }
        };
    }

    const micVolInput = document.getElementById('audio-input-volume');
    const micVolDisplay = document.getElementById('mic-vol-display');
    if(micVolInput) {
        micVolInput.value = savedMicVolume;
        if(micVolDisplay) micVolDisplay.textContent = savedMicVolume + '%';
        micVolInput.oninput = (e) => {
            const vol = parseInt(e.target.value);
            if(micVolDisplay) micVolDisplay.textContent = vol + '%';
            savedMicVolume = vol;
            localStorage.setItem('hive_my_mic_vol', vol);
            if (localTracks.audioTrack) localTracks.audioTrack.setVolume(vol); 
        };
    }

    const noiseRadios = document.querySelectorAll('input[name="noise_setting"]');
    noiseRadios.forEach(radio => {
        if(radio.value === savedNoiseSetting) radio.checked = true;
        radio.onchange = async (e) => {
            savedNoiseSetting = e.target.value;
            localStorage.setItem('hive_noise_setting', savedNoiseSetting);
            document.querySelectorAll('input[name="noise_setting"]').forEach(r => {
                const label = r.closest('label');
                if(r.checked) {
                    label.classList.add('border-[#5865F2]/30', 'bg-[#5865F2]/10');
                    label.classList.remove('border-transparent', 'hover:bg-[#2b2d31]');
                } else {
                    label.classList.remove('border-[#5865F2]/30', 'bg-[#5865F2]/10');
                    label.classList.add('border-transparent', 'hover:bg-[#2b2d31]');
                }
            });
            if (denoiserProcessor) {
                if (savedNoiseSetting === 'none') {
                    await denoiserProcessor.disable();
                    showToast("ปิดระบบตัดเสียงรบกวนแล้ว", "info");
                } else {
                    await denoiserProcessor.enable();
                    showToast("เปิด AI ตัดเสียงรบกวนแล้ว", "success");
                }
            }
        };
    });
});

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
                let matchedUserId = null, matchedUserName = "Unknown";
                for(let k in usersData) { if(usersData[k].agoraUid === u.uid) { matchedUserId = usersData[k].id; matchedUserName = k; break; } }
                if (matchedUserId) {
                    const uData = usersData[matchedUserName];
                    if (uData && uData.isSharingScreen && ssStage) {
                        ssStage.classList.remove('hidden'); 
                        const ex = document.getElementById(`v-wrap-${u.uid}`); if(ex) ex.remove(); 
                        let pc = document.createElement("div"); pc.id = `v-wrap-${u.uid}`; pc.style.cssText="width:100%;height:100%;"; pc.className = "rounded-lg overflow-hidden bg-black flex items-center justify-center"; 
                        ssStage.appendChild(pc); u.videoTrack.play(pc, { fit: "contain" }); 
                    } else {
                        const targetContainerId = (camLayoutPreference === 'center') ? 'camera-stage' : 'sidebar-video-grid';
                        const container = document.getElementById(targetContainerId);
                        const ex = document.getElementById(`cam-wrap-${u.uid}`); if(ex) ex.remove();
                        let camCard = document.createElement("div"); 
                        camCard.id = `cam-wrap-${u.uid}`; 
                        
                        if (camLayoutPreference === 'center') {
                            const camStage = document.getElementById('camera-stage');
                            camStage.classList.remove('hidden'); camStage.classList.add('flex');
                            camCard.className = "w-[300px] md:w-[400px] aspect-video bg-black rounded-xl overflow-hidden relative border border-[#35373c] shadow-lg animate-[fadeIn_0.3s_ease-out]";
                        } else {
                            camCard.className = "w-full aspect-video bg-black rounded overflow-hidden relative border border-[#23a559] mb-1 animate-[fadeIn_0.3s_ease-out]";
                            const sidebarLiveContainer = document.getElementById('sidebar-live-container');
                            if(sidebarLiveContainer) { sidebarLiveContainer.classList.remove('hidden'); sidebarLiveContainer.classList.add('active'); sidebarLiveContainer.style.display = 'block'; }
                        }

                        camCard.innerHTML = `<div id="player-${u.uid}" class="absolute inset-0 w-full h-full bg-black"></div><div class="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-[10px] md:text-[12px] font-bold text-white z-10 backdrop-blur-sm"><i class="ph-fill ph-video-camera text-[#dbdee1] mr-1"></i>${matchedUserName}</div>`;
                        container.appendChild(camCard); 
                        u.videoTrack.play(`player-${u.uid}`, { fit: "cover" });
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
                const camWrap = document.getElementById(`cam-wrap-${u.uid}`); 
                if (camWrap) camWrap.remove();
                const camStage = document.getElementById('camera-stage');
                if(camStage && camStage.children.length === 0) { camStage.classList.add('hidden'); camStage.classList.remove('flex'); }
                const sidebarGrid = document.getElementById('sidebar-video-grid');
                const container = document.getElementById('sidebar-live-container');
                if(container && sidebarGrid && sidebarGrid.children.length === 0) {
                    container.classList.add('hidden'); container.classList.remove('active'); container.style.display = 'none';
                }
            } 
        }); 
        
        await rtcClient.join(AGORA_APP_ID, "DOSH_VOICE", null, myNumericUid); 
        
        try {
            const savedMic = localStorage.getItem('hive_selected_mic');
            const micConfig = { AEC: true, ANS: true, AGC: true };
            if (savedMic) micConfig.microphoneId = savedMic;
            localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack(micConfig); 
            if (savedMicVolume !== 100) localTracks.audioTrack.setVolume(savedMicVolume);

            try {
                if (!denoiserExtension) {
                    denoiserExtension = new window.AIDenoiser.AIDenoiserExtension({
                        assetsPath: "https://cdn.jsdelivr.net/npm/agora-extension-ai-denoiser@1.1.0/external/"
                    });
                    AgoraRTC.registerExtension(denoiserExtension);
                }
                denoiserProcessor = denoiserExtension.createProcessor();
                localTracks.audioTrack.pipe(denoiserProcessor).pipe(localTracks.audioTrack.processorDestination);
                if (savedNoiseSetting === 'ai') await denoiserProcessor.enable();
            } catch (aiErr) {}

            await rtcClient.publish(localTracks.audioTrack); 
            await localTracks.audioTrack.setMuted(isMuted);
        } catch (micErr) { 
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
        
        await updateDoc(doc(db, "users", currentUserId), { inVoice: true, voiceChannel: "DOSH_VOICE", agoraUid: myNumericUid, isMuted: isMuted, isSharingScreen: false, isVideoOn: false }); 
        localStorage.setItem('dosh_active_voice', 'true'); 
        amIInVoice = true; 

        if (ytPlayer && typeof ytPlayer.unMute === 'function') ytPlayer.unMute();
        if(joinBtn) joinBtn.classList.add('hidden'); 
        const activeUI = document.getElementById('active-voice-ui'); if(activeUI) activeUI.classList.remove('hidden'); 
        if(bottomLeaveBtn) bottomLeaveBtn.classList.remove('hidden');
        startBackgroundAudioMode(); 
    } catch (err) { 
        localStorage.removeItem('dosh_active_voice'); 
        showToast("เชื่อมต่อห้องเสียงไม่สำเร็จ กรุณาลองใหม่", "error"); 
        if(currentUserId) await updateDoc(doc(db, "users", currentUserId), { inVoice: false, voiceChannel: null, agoraUid: null });
        amIInVoice = false; 
        if(joinBtn) joinBtn.classList.remove('hidden');
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
                
                const targetContainerId = (camLayoutPreference === 'center') ? 'camera-stage' : 'sidebar-video-grid';
                const container = document.getElementById(targetContainerId);
                const ex = document.getElementById(`cam-wrap-local`); if(ex) ex.remove();
                let camCard = document.createElement("div"); 
                camCard.id = `cam-wrap-local`; 
                
                if (camLayoutPreference === 'center') {
                    const camStage = document.getElementById('camera-stage');
                    camStage.classList.remove('hidden'); camStage.classList.add('flex');
                    camCard.className = "w-[300px] md:w-[400px] aspect-video bg-black rounded-xl overflow-hidden relative border border-[#23a559] shadow-lg animate-[fadeIn_0.3s_ease-out]";
                } else {
                    camCard.className = "w-full aspect-video bg-black rounded overflow-hidden relative border border-[#23a559] mb-1 animate-[fadeIn_0.3s_ease-out]";
                    const sidebarLiveContainer = document.getElementById('sidebar-live-container');
                    if(sidebarLiveContainer) { sidebarLiveContainer.classList.remove('hidden'); sidebarLiveContainer.classList.add('active'); sidebarLiveContainer.style.display = 'block'; }
                }
                
                camCard.innerHTML = `<div id="player-local" class="absolute inset-0 w-full h-full bg-black"></div><div class="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-[10px] md:text-[12px] font-bold text-white z-10 backdrop-blur-sm"><i class="ph-fill ph-video-camera text-[#23a559] mr-1"></i>คุณ (${currentUsername})</div>`;
                container.prepend(camCard); 
                localTracks.videoTrack.play(`player-local`, { fit: "cover" });
                showToast("เปิดกล้องแล้ว!", "success");
            } catch(e) { showToast("ไม่สามารถเข้าถึงกล้องได้ หรือไม่มีกล้องครับ", "error"); }
        } else { await stopCamera(); }
    };
}

async function stopCamera() {
    if (localTracks.videoTrack) { await rtcClient.unpublish(localTracks.videoTrack); localTracks.videoTrack.stop(); localTracks.videoTrack.close(); localTracks.videoTrack = null; }
    isVideoOn = false; if(currentUserId) await updateDoc(doc(db, "users", currentUserId), { isVideoOn: false });
    if(camBtn) { camBtn.classList.add('bg-[#2b2d31]'); camBtn.classList.remove('bg-[#23a559]', 'text-white'); }
    if(camIcon) camIcon.className = "ph ph-video-camera text-[20px] md:text-[24px]";
    const camWrap = document.getElementById(`cam-wrap-local`); if (camWrap) camWrap.remove();
    const camStage = document.getElementById('camera-stage');
    if(camStage && camStage.children.length === 0) { camStage.classList.add('hidden'); camStage.classList.remove('flex'); }
    const sidebarGrid = document.getElementById('sidebar-video-grid');
    const container = document.getElementById('sidebar-live-container');
    if(container && sidebarGrid && sidebarGrid.children.length === 0) {
        container.classList.add('hidden'); container.classList.remove('active'); container.style.display = 'none';
    }
}

async function stopScreenShare() { 
    const ssWrapper = document.getElementById('screen-share-wrapper'); const qualitySelect = document.getElementById('screen-quality'); const sIco = document.getElementById('screen-icon');
    if (screenTrack) { await rtcClient.unpublish(screenTrack); screenTrack.stop(); screenTrack.close(); screenTrack = null; } 
    if (screenAudioTrack) { await rtcClient.unpublish(screenAudioTrack); screenAudioTrack.stop(); screenAudioTrack.close(); screenAudioTrack = null; } 
    isSharingScreen = false; if(currentUserId) await updateDoc(doc(db, "users", currentUserId), { isSharingScreen: false }); 
    if (ssWrapper) ssWrapper.classList.replace('bg-[#23a559]', 'bg-[#2b2d31]');
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
                else if (selectedVal === "1080p_60") encoderConfig = { width: 1920, height: 1080, frameRate: 60, bitrateMax: 4500 }; 
                const res = await AgoraRTC.createScreenVideoTrack({ encoderConfig: encoderConfig, optimizationMode: "motion" }, "auto"); 
                if (Array.isArray(res)) { screenTrack = res[0]; screenAudioTrack = res[1]; await rtcClient.publish([screenTrack, screenAudioTrack]); } else { screenTrack = res; await rtcClient.publish(screenTrack); } 
                isSharingScreen = true; await updateDoc(doc(db, "users", currentUserId), { isSharingScreen: true }); 
                if (ssWrapper) ssWrapper.classList.replace('bg-[#2b2d31]', 'bg-[#23a559]');
                if(sIco) sIco.className = "ph-fill ph-screencast text-[20px] md:text-[24px] text-white"; 
                if (qualitySelect) { qualitySelect.classList.replace('text-[#80848e]', 'text-white'); qualitySelect.disabled = true; }
                if(ssStage) {
                    ssStage.classList.remove('hidden'); let pc = document.createElement("div"); pc.id = `v-wrap-local`; pc.style.cssText="width:100%;height:100%;"; pc.className = "rounded-lg overflow-hidden bg-black flex items-center justify-center"; ssStage.appendChild(pc); screenTrack.play(pc, { fit: "contain" }); 
                }
                screenTrack.on("track-ended", stopScreenShare); 
            } catch (err) { showToast("แชร์หน้าจอไม่สำเร็จ", "error"); } 
        } else { await stopScreenShare(); } 
    };
}

async function leaveVoice() { 
    if (isSharingScreen) await stopScreenShare(); 
    if (isVideoOn) await stopCamera(); 
    if (localTracks.audioTrack) { localTracks.audioTrack.stop(); localTracks.audioTrack.close(); localTracks.audioTrack = null; } 
    await rtcClient.leave(); 
    connectedVoiceChannel = null;
    if(currentUserId) await updateDoc(doc(db, "users", currentUserId), { inVoice: false, voiceChannel: null, agoraUid: null, isMuted: false, isSharingScreen: false, isVideoOn: false }); 
    localStorage.removeItem('dosh_active_voice'); 
    amIInVoice = false; 

    if (ytPlayer && typeof ytPlayer.mute === 'function') ytPlayer.mute();
    if(joinBtn) {
        joinBtn.innerHTML = `<div class="w-16 h-16 md:w-20 md:h-20 bg-white/20 rounded-full flex items-center justify-center mb-3 md:mb-4 group-hover:bg-white/30 transition-colors"><i class="ph-fill ph-phone-call text-[28px] md:text-[36px] animate-bounce"></i></div><span>กดเพื่อเข้าร่วมห้องเสียง</span><span class="text-[10px] md:text-[12px] font-normal text-green-100 mt-1.5 md:mt-2 opacity-80 text-center">เปิดไมค์พูดคุยและเปิดกล้องกับเพื่อนๆ</span>`;
        joinBtn.classList.remove('hidden');
    }
    const activeUI = document.getElementById('active-voice-ui'); if(activeUI) activeUI.classList.add('hidden'); 
    if(bottomLeaveBtn) bottomLeaveBtn.classList.add('hidden');
    const sidebarLiveContainer = document.getElementById('sidebar-live-container');
    if(sidebarLiveContainer) { sidebarLiveContainer.classList.add('hidden'); sidebarLiveContainer.classList.remove('active'); sidebarLiveContainer.style.display = 'none'; }
    const sidebarGrid = document.getElementById('sidebar-video-grid'); if(sidebarGrid) sidebarGrid.innerHTML = ''; 
    stopBackgroundAudioMode();
}

if(joinBtn) joinBtn.onclick = () => joinVoice(); 
if(leaveBtn) leaveBtn.onclick = () => leaveVoice();
if(bottomLeaveBtn) bottomLeaveBtn.onclick = () => leaveVoice();

async function toggleMute() {
    if (!localTracks.audioTrack) { showToast("ไม่พบไมโครโฟน! คุณอยู่ในโหมดฟังอย่างเดียว", "error"); return; }
    isMuted = !isMuted; 
    await localTracks.audioTrack.setMuted(isMuted);
    if(currentUserId) await updateDoc(doc(db, "users", currentUserId), { isMuted: isMuted });
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
// 📋 12. Task Board & Service Worker
// ==========================================
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
        const tInput = document.getElementById('task-title-input'); if(tInput) tInput.value = ''; 
        const tModal = document.getElementById('task-modal'); if(tModal) tModal.classList.remove('hidden'); 
    }); 
}
const btnCloseTask = document.getElementById('close-task-modal');
if(btnCloseTask) {
    btnCloseTask.addEventListener('click', () => { 
        const tModal = document.getElementById('task-modal'); if(tModal) tModal.classList.add('hidden'); 
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
        const tModal = document.getElementById('task-modal'); if(tModal) tModal.classList.add('hidden'); 
        showToast("เพิ่มงานใหม่ลงในกระดานแล้ว!", "success"); 
    });
}

if ('serviceWorker' in navigator) { 
    window.addEventListener('load', () => { 
        navigator.serviceWorker.register('sw.js').then(() => console.log('✅ HIVE SW Active')).catch(e => console.log('❌ SW Fail:', e)); 
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data && event.data.command === 'leave_voice') leaveVoice();
        });
    }); 
}

// ==========================================
// 🍿 13. ระบบ Watch Party
// ==========================================
const toggleWpBtn = document.getElementById('toggle-wp-input-btn');
const wpControls = document.getElementById('wp-controls');
const startWpBtn = document.getElementById('start-wp-btn');
const wpLinkInput = document.getElementById('wp-link-input');
const wpStage = document.getElementById('watch-party-stage');
const ytContainer = document.getElementById('yt-player-container');
const closeWpBtn = document.getElementById('close-wp-btn');
const wpHost = document.getElementById('wp-host');

let ytPlayer = null, syncInterval = null, isSettingState = false, lastVideoId = "";

if (toggleWpBtn && wpControls) toggleWpBtn.onclick = () => wpControls.classList.toggle('hidden');

if (startWpBtn) {
    startWpBtn.onclick = async () => {
        const url = wpLinkInput.value.trim();
        if (!url) { showToast("กรุณาใส่ลิงก์ YouTube ด้วยครับ", "error"); return; }
        let videoId = "";
        if (url.includes("v=")) videoId = url.split("v=")[1].split("&")[0];
        else if (url.includes("youtu.be/")) videoId = url.split("youtu.be/")[1].split("?")[0];
        if (!videoId) { showToast("รูปแบบลิงก์ YouTube ไม่ถูกต้อง", "error"); return; }

        try {
            await setDoc(doc(db, "appData", "watchParty"), { 
                videoId: videoId, hostName: currentUsername, isActive: true, currentTime: 0, isPlaying: true, updatedAt: serverTimestamp() 
            });
            wpControls.classList.add('hidden');
            wpLinkInput.value = '';
        } catch(err) { showToast("เกิดข้อผิดพลาดในการเริ่มสตรีม", "error"); }
    };
}

if (closeWpBtn) {
    closeWpBtn.onclick = async () => {
        try { await setDoc(doc(db, "appData", "watchParty"), { isActive: false }, { merge: true }); } catch(err) {}
    };
}

async function broadcastPlayerState() {
    if (!ytPlayer || isSettingState) return;
    try {
        const currentTime = ytPlayer.getCurrentTime();
        const playerState = ytPlayer.getPlayerState();
        const isPlaying = (playerState === YT.PlayerState.PLAYING);
        await setDoc(doc(db, "appData", "watchParty"), { currentTime: currentTime, isPlaying: isPlaying, updatedAt: serverTimestamp() }, { merge: true });
    } catch(e) {}
}

onSnapshot(doc(db, "appData", "watchParty"), (d) => {
    if (d.exists()) {
        const data = d.data();
        currentWatchParty = data;
        if (data.isActive && data.videoId) {
            if(wpStage) { wpStage.classList.remove('hidden'); wpStage.classList.add('flex'); }
            if(wpHost) wpHost.textContent = data.hostName;

            if (!ytPlayer || lastVideoId !== data.videoId) {
                lastVideoId = data.videoId;
                ytContainer.innerHTML = `<div id="actual-yt-player" class="w-full h-full"></div>`;
                if (window.YT && window.YT.Player) {
                    ytPlayer = new YT.Player('actual-yt-player', {
                        height: '100%', width: '100%', videoId: data.videoId, playerVars: { 'autoplay': 1, 'controls': 1 },
                        events: {
                            'onReady': () => {
                                ytPlayer.seekTo(data.currentTime || 0);
                                if (data.isPlaying) ytPlayer.playVideo(); else ytPlayer.pauseVideo();
                                if (!amIInVoice) ytPlayer.mute(); else ytPlayer.unMute();
                                if (syncInterval) clearInterval(syncInterval);
                                syncInterval = setInterval(() => {
                                    if (ytPlayer && typeof ytPlayer.getPlayerState === 'function' && ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) broadcastPlayerState();
                                }, 2000);
                            },
                            'onStateChange': (event) => {
                                if (event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.PAUSED) broadcastPlayerState();
                            }
                        }
                    });
                }
            } else if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
                if (!amIInVoice && !ytPlayer.isMuted()) ytPlayer.mute();
                else if (amIInVoice && ytPlayer.isMuted()) ytPlayer.unMute();

                const localTime = ytPlayer.getCurrentTime();
                const remoteTime = data.currentTime || 0;
                if (Math.abs(localTime - remoteTime) > 1.5) {
                    isSettingState = true;
                    ytPlayer.seekTo(remoteTime);
                    setTimeout(() => { isSettingState = false; }, 1000);
                }
                const localState = ytPlayer.getPlayerState();
                if (data.isPlaying && localState !== YT.PlayerState.PLAYING) ytPlayer.playVideo();
                else if (!data.isPlaying && localState === YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
            }
        } else {
            if(wpStage) { wpStage.classList.add('hidden'); wpStage.classList.remove('flex'); }
            if(ytContainer) ytContainer.innerHTML = '';
            ytPlayer = null; lastVideoId = "";
            if (syncInterval) clearInterval(syncInterval);
        }
    }
});

// ==========================================
// 🛍️ 14. ระบบร้านค้าตกแต่งโปรไฟล์ (HIVE Shop)
// ==========================================
// ฟังก์ชันแปลงโค้ด SVG เป็น URL (รองรับ Animation และป้องกันเครื่องหมายคำพูดพัง)
const svgToUrl = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim()).replace(/'/g, '%27')}`;

const shopFrames = [
    { name: 'ถอดกรอบรูป', desc: 'ใช้โปรไฟล์แบบคลีนๆ', url: '' },
    { name: 'นีออนม่วง', desc: 'วงแหวนพลังงานสีม่วง', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='46' fill='none' stroke='%23a855f7' stroke-width='6'/></svg>" },
    { name: 'ทองคำ VIP', desc: 'กรอบทองคำสุดหรูหรา', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='44' fill='none' stroke='%23eab308' stroke-width='8'/></svg>" },
    { name: 'เพลิงโลกันตร์', desc: 'ออร่าไฟลุกโชนรอบโปรไฟล์', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='none' stroke='%23ef4444' stroke-width='4'/><circle cx='50' cy='50' r='48' fill='none' stroke='%23f97316' stroke-width='2' stroke-dasharray='5 5'/></svg>" },
    { name: 'ไซเบอร์พังก์', desc: 'กรอบฟ้าเทคโนโลยีอนาคต', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect x='5' y='5' width='90' height='90' rx='45' fill='none' stroke='%2306b6d4' stroke-width='4'/><circle cx='50' cy='50' r='48' fill='none' stroke='%23ec4899' stroke-width='2' stroke-dasharray='12 8'/></svg>" },
    { name: 'มรกตพิทักษ์', desc: 'วงแหวนเวทมนตร์สีเขียว', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='none' stroke='%2310b981' stroke-width='5' stroke-dasharray='20 5'/><circle cx='50' cy='50' r='41' fill='none' stroke='%2334d399' stroke-width='2'/></svg>" },
    { name: 'ซากุระบาน', desc: 'กรอบสีชมพูพาสเทลสดใส', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='none' stroke='%23f472b6' stroke-width='6' stroke-dasharray='8 4'/><circle cx='50' cy='50' r='45' fill='none' stroke='%23fbcfe8' stroke-width='2'/></svg>" },
    { name: 'ราชันย์มงกุฎทอง', desc: 'กรอบมงกุฎสำหรับผู้นำ', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='44' fill='none' stroke='%23facc15' stroke-width='5'/><polygon points='35,12 42,4 50,10 58,4 65,12' fill='%23facc15'/></svg>" },

    // ==========================================================
    // 🔥 4 กรอบโปรไฟล์ระดับ LEGENDARY (มี Animation เคลื่อนไหว)
    // ==========================================================
    {
        name: 'มหาเวทดาราจักร (Astral Halo)',
        desc: 'วงแหวนเวท 2 ชั้นหมุนสวนทางกัน',
        url: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
                <defs>
                    <linearGradient id="astralGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#38bdf8"/>
                        <stop offset="50%" stop-color="#a855f7"/>
                        <stop offset="100%" stop-color="#f472b6"/>
                    </linearGradient>
                </defs>
                <!-- วงแหวนรูนชั้นนอกหมุนตามเข็ม -->
                <g>
                    <circle cx="50" cy="50" r="46" fill="none" stroke="url(#astralGrad)" stroke-width="2.5" stroke-dasharray="10 4 2 4"/>
                    <polygon points="50,2 53,9 47,9" fill="#38bdf8"/>
                    <polygon points="50,98 53,91 47,91" fill="#f472b6"/>
                    <polygon points="2,50 9,53 9,47" fill="#a855f7"/>
                    <polygon points="98,50 91,53 91,47" fill="#a855f7"/>
                    <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="10s" repeatCount="indefinite"/>
                </g>
                <!-- วงแหวนพลังงานชั้นในหมุนทวนเข็ม -->
                <g>
                    <circle cx="50" cy="50" r="41" fill="none" stroke="#fde047" stroke-width="2" stroke-dasharray="6 6"/>
                    <circle cx="50" cy="9" r="3" fill="#ffffff"/>
                    <circle cx="50" cy="91" r="3" fill="#ffffff"/>
                    <animateTransform attributeName="transform" type="rotate" from="360 50 50" to="0 50 50" dur="6s" repeatCount="indefinite"/>
                </g>
                <!-- อัญมณีดาราจักรด้านบน & ล่าง -->
                <polygon points="50,1 55,8 50,15 45,8" fill="#38bdf8" stroke="#ffffff" stroke-width="1">
                    <animate attributeName="opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite"/>
                </polygon>
                <polygon points="50,87 54,93 50,99 46,93" fill="#f472b6" stroke="#ffffff" stroke-width="1"/>
            </svg>
        `)
    },
    {
        name: 'ราชันย์มังกรเพลิง (Dragon Lord)',
        desc: 'เขามังกรทองคำและเกล็ดเพลิงโลกันตร์',
        url: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
                <defs>
                    <linearGradient id="fireGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stop-color="#991b1b"/>
                        <stop offset="50%" stop-color="#ef4444"/>
                        <stop offset="100%" stop-color="#facc15"/>
                    </linearGradient>
                </defs>
                <!-- วงแหวนเพลิงหมุนวน -->
                <g>
                    <circle cx="50" cy="50" r="44" fill="none" stroke="url(#fireGrad)" stroke-width="4.5" stroke-dasharray="14 4"/>
                    <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="8s" repeatCount="indefinite"/>
                </g>
                <circle cx="50" cy="50" r="40" fill="none" stroke="#facc15" stroke-width="1.5"/>
                <!-- เขามังกรคู่ด้านบน -->
                <path d="M26,20 Q12,6 6,14 Q12,26 22,28 Z" fill="url(#fireGrad)" stroke="#fef08a" stroke-width="1"/>
                <path d="M74,20 Q88,6 94,14 Q88,26 78,28 Z" fill="url(#fireGrad)" stroke="#fef08a" stroke-width="1"/>
                <!-- ครีบหนามมังกรด้านข้าง -->
                <polygon points="4,44 11,38 9,52" fill="#ef4444" stroke="#facc15" stroke-width="0.8"/>
                <polygon points="96,44 89,38 91,52" fill="#ef4444" stroke="#facc15" stroke-width="0.8"/>
                <polygon points="7,62 13,56 12,68" fill="#ef4444" stroke="#facc15" stroke-width="0.8"/>
                <polygon points="93,62 87,56 88,68" fill="#ef4444" stroke="#facc15" stroke-width="0.8"/>
                <!-- ลูกแก้วหัวใจมังกรด้านล่าง -->
                <circle cx="50" cy="91" r="6" fill="#ef4444" stroke="#fef08a" stroke-width="2">
                    <animate attributeName="r" values="5.5;7;5.5" dur="1.2s" repeatCount="indefinite"/>
                </circle>
                <polygon points="50,86 52,91 50,96 48,91" fill="#fef08a"/>
            </svg>
        `)
    },
    {
        name: 'ไซเบอร์โอเวอร์โหลด (Mecha HUD)',
        desc: 'เกราะหูจักรกลพร้อมเรดาร์สแกนเป้าหมาย',
        url: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
                <!-- วงแหวน HUD สแกนเนอร์หมุน -->
                <g>
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#06b6d4" stroke-width="3" stroke-dasharray="22 8 4 8"/>
                    <circle cx="50" cy="50" r="41" fill="none" stroke="#ec4899" stroke-width="1.5" stroke-dasharray="8 12"/>
                    <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="5s" repeatCount="indefinite"/>
                </g>
                <!-- หูจักรกล (Mecha Ears) ด้านบนซ้าย-ขวา -->
                <polygon points="14,30 6,8 28,16" fill="#090d16" stroke="#06b6d4" stroke-width="2"/>
                <polygon points="14,25 10,13 23,18" fill="#ec4899"/>
                <polygon points="86,30 94,8 72,16" fill="#090d16" stroke="#06b6d4" stroke-width="2"/>
                <polygon points="86,25 90,13 77,18" fill="#ec4899"/>
                <!-- ศูนย์เล็งเทคโนโลยีด้านล่าง -->
                <polygon points="36,89 50,97 64,89 58,85 42,85" fill="#090d16" stroke="#06b6d4" stroke-width="1.5"/>
                <circle cx="50" cy="90" r="3" fill="#22d3ee">
                    <animate attributeName="opacity" values="1;0.2;1" dur="0.7s" repeatCount="indefinite"/>
                </circle>
            </svg>
        `)
    },
    {
        name: 'เนตรอสูรจันทราสีเลือด (Blood Demon)',
        desc: 'ผนึกคำสาปสีเลือดและดวงตาปีศาจขยับได้',
        url: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
                <!-- ออร่าทมิฬและวงแหวนผนึกหมุนวน -->
                <circle cx="50" cy="50" r="44" fill="none" stroke="#09090b" stroke-width="6"/>
                <g>
                    <circle cx="50" cy="50" r="44" fill="none" stroke="#dc2626" stroke-width="3" stroke-dasharray="9 5"/>
                    <animateTransform attributeName="transform" type="rotate" from="360 50 50" to="0 50 50" dur="7s" repeatCount="indefinite"/>
                </g>
                <!-- กรงเล็บอสูรด้านข้าง -->
                <path d="M4,35 Q12,50 4,65 Q10,50 4,35 Z" fill="#dc2626"/>
                <path d="M96,35 Q88,50 96,65 Q90,50 96,35 Z" fill="#dc2626"/>
                <!-- ดวงตาปีศาจด้านบน (กรอกตาซ้าย-ขวา) -->
                <path d="M32,10 Q50,0 68,10 Q50,20 32,10 Z" fill="#18181b" stroke="#dc2626" stroke-width="2"/>
                <path d="M36,10 Q50,3 64,10 Q50,17 36,10 Z" fill="#fef2f2"/>
                <ellipse cx="50" cy="10" rx="3.5" ry="5" fill="#dc2626">
                    <animate attributeName="cx" values="50;45;55;50" dur="3.5s" repeatCount="indefinite"/>
                </ellipse>
                <ellipse cx="50" cy="10" rx="1.2" ry="4" fill="#000000">
                    <animate attributeName="cx" values="50;45;55;50" dur="3.5s" repeatCount="indefinite"/>
                </ellipse>
                <!-- เขี้ยวอสูรด้านล่าง -->
                <polygon points="38,87 43,97 47,89" fill="#dc2626"/>
                <polygon points="62,87 57,97 53,89" fill="#dc2626"/>
            </svg>
        `)
    }
];

const shopBanners = [
    { name: 'Cyberpunk City (GIF)', url: 'https://media.giphy.com/media/l0HlHFRbmaZtBRhXG/giphy.gif' },
    { name: 'Pixel Chill Night (GIF)', url: 'https://media.giphy.com/media/RMwgs5kZqkRyhF24KK/giphy.gif' },
    { name: 'Galaxy Nebula (GIF)', url: 'https://media.giphy.com/media/3o7buijTqhjxjbEqjK/giphy.gif' }
];

const shopDecos = [
    {
        id: '',
        name: 'ถอดเอฟเฟกต์การ์ด',
        price: 'ค่าเริ่มต้น',
        isNew: false,
        topSvg: '',
        bottomSvg: ''
    },
    {
        id: 'cursed_spirit',
        name: 'ภูตวิญญาณ',
        price: 'FREE (VIP)',
        isNew: false,
        topSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 90">
                <path d="M25,75 Q30,30 55,20 Q45,50 48,75 Z" fill="#18181b" stroke="#a1a1aa" stroke-width="1.5"/>
                <path d="M45,75 Q52,25 75,18 Q65,48 66,75 Z" fill="#18181b" stroke="#a1a1aa" stroke-width="1.5"/>
                <path d="M65,75 Q75,30 95,25 Q85,52 84,75 Z" fill="#18181b" stroke="#a1a1aa" stroke-width="1.5"/>
                <path d="M95,70 Q130,30 180,35 Q230,30 275,65 L295,75 L260,78 Q230,55 180,55 Q130,55 95,70 Z" fill="#9ca3af" stroke="#18181b" stroke-width="2"/>
                <path d="M140,75 Q150,20 185,15 Q220,20 230,75" fill="#d4d4d8" stroke="#27272a" stroke-width="1.5"/>
                <ellipse cx="185" cy="46" rx="22" ry="28" fill="#f4f4f5" stroke="#18181b" stroke-width="2.5"/>
                <circle cx="176" cy="38" r="6" fill="#09090b"/><circle cx="176" cy="38" r="2" fill="#ffffff"/>
                <circle cx="194" cy="38" r="6" fill="#09090b"/><circle cx="194" cy="38" r="2" fill="#ffffff"/>
                <ellipse cx="185" cy="58" rx="10" ry="12" fill="#09090b" stroke="#27272a" stroke-width="2"/>
                <path d="M177,50 L193,50 M177,64 L193,64" stroke="#f4f4f5" stroke-width="2" stroke-dasharray="2 2"/>
                <path d="M260,72 Q285,55 305,72 L295,80 L260,76 Z" fill="#d4d4d8" stroke="#18181b" stroke-width="2"/>
            </svg>
        `),
        bottomSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 70">
                <path d="M40,15 Q180,65 320,10 Q300,45 180,50 Q70,48 40,15 Z" fill="#18181b" stroke="#52525b" stroke-width="2"/>
                <path d="M70,25 L55,50 M100,32 L90,58 M135,38 L130,62 M170,40 L170,65 M205,38 L210,62 M240,32 L255,58 M275,25 L295,48" stroke="#27272a" stroke-width="3" stroke-linecap="round"/>
                <path d="M80,26 Q180,55 290,18" fill="none" stroke="#71717a" stroke-width="2" stroke-dasharray="10 6"/>
            </svg>
        `)
    },
    {
        id: 'all_seeing_eyes',
        name: 'จับจ้องไม่คลาดสายตา',
        price: 'FREE (VIP)',
        isNew: false,
        topSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 90">
                <path d="M15,85 Q10,30 60,25 Q110,5 180,10 Q250,5 300,25 Q350,30 345,85 Z" fill="#050505" stroke="#27272a" stroke-width="2"/>
                <path d="M120,45 Q180,15 240,45 Q180,70 120,45 Z" fill="#ffffff" stroke="#000" stroke-width="3"/>
                <ellipse cx="180" cy="43" rx="14" ry="16" fill="#09090b">
                    <animate attributeName="cx" values="180;174;186;180" dur="4s" repeatCount="indefinite"/>
                </ellipse>
                <circle cx="176" cy="39" r="4" fill="#ffffff">
                    <animate attributeName="cx" values="176;170;182;176" dur="4s" repeatCount="indefinite"/>
                </circle>
                <path d="M45,50 Q75,30 105,50 Q75,68 45,50 Z" fill="#ffffff"/><circle cx="75" cy="50" r="8" fill="#09090b"/><circle cx="73" cy="48" r="2.5" fill="#fff"/>
                <path d="M255,50 Q285,30 315,50 Q285,68 255,50 Z" fill="#ffffff"/><circle cx="285" cy="50" r="8" fill="#09090b"/><circle cx="283" cy="48" r="2.5" fill="#fff"/>
                <path d="M85,25 Q110,12 135,25 Q110,38 85,25 Z" fill="#ffffff"/><circle cx="110" cy="25" r="6" fill="#09090b"/>
                <path d="M225,25 Q250,12 275,25 Q250,38 225,25 Z" fill="#ffffff"/><circle cx="250" cy="25" r="6" fill="#09090b"/>
                <path d="M20,70 Q38,58 55,70 Q38,82 20,70 Z" fill="#ffffff"/><circle cx="38" cy="70" r="5" fill="#09090b"/>
                <path d="M305,70 Q322,58 340,70 Q322,82 305,70 Z" fill="#ffffff"/><circle cx="322" cy="70" r="5" fill="#09090b"/>
            </svg>
        `),
        bottomSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 70">
                <path d="M20,5 Q15,55 90,55 Q180,68 270,55 Q345,55 340,5 Z" fill="#050505" stroke="#27272a" stroke-width="2"/>
                <path d="M70,30 Q105,15 140,30 Q105,45 70,30 Z" fill="#e4e4e7"/><circle cx="105" cy="30" r="7" fill="#09090b"/>
                <path d="M150,42 Q180,28 210,42 Q180,56 150,42 Z" fill="#e4e4e7"/><circle cx="180" cy="42" r="7" fill="#09090b"/>
                <path d="M225,30 Q260,15 295,30 Q260,45 225,30 Z" fill="#e4e4e7"/><circle cx="260" cy="30" r="7" fill="#09090b"/>
            </svg>
        `)
    },
    {
        id: 'abyss_dragon',
        name: 'เพลิงมังกรทมิฬ',
        price: 'FREE (VIP)',
        isNew: false,
        topSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 90">
                <path d="M15,80 Q40,15 110,35 L95,10 L145,30 Q180,5 215,30 L265,10 L250,35 Q320,15 345,80 Z" fill="#450a0a" stroke="#ef4444" stroke-width="2"/>
                <polygon points="160,35 180,10 200,35 180,60" fill="#f97316"/>
                <circle cx="145" cy="48" r="6" fill="#fef08a"/><circle cx="215" cy="48" r="6" fill="#fef08a"/>
            </svg>
        `),
        bottomSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 70">
                <path d="M25,10 Q90,60 180,55 Q270,60 335,10 Q280,40 180,38 Q80,40 25,10 Z" fill="#450a0a" stroke="#ef4444" stroke-width="2"/>
            </svg>
        `)
    },

    // ====================================================
    // 🌟 4 ธีมการ์ดใหม่ระดับ LEGENDARY (อลังการ + มี Animation)
    // ====================================================
    {
        id: 'celestial_seraph',
        name: 'มหาเทวทูตสวรรค์นิรันดร์',
        price: 'LEGENDARY',
        isNew: true,
        topSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 90">
                <defs>
                    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#fef08a"/>
                        <stop offset="50%" stop-color="#eab308"/>
                        <stop offset="100%" stop-color="#a16207"/>
                    </linearGradient>
                    <linearGradient id="wingGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#ffffff"/>
                        <stop offset="70%" stop-color="#fef9c3"/>
                        <stop offset="100%" stop-color="#fde047"/>
                    </linearGradient>
                </defs>
                <!-- วงแหวนสวรรค์ด้านหลัง -->
                <circle cx="180" cy="48" r="36" fill="none" stroke="url(#goldGrad)" stroke-width="2" stroke-dasharray="6 4">
                    <animateTransform attributeName="transform" type="rotate" from="0 180 48" to="360 180 48" dur="12s" repeatCount="indefinite"/>
                </circle>
                <!-- ปีกเทวทูต 3 ชั้น ฝั่งซ้าย -->
                <path d="M160,65 Q90,5 10,20 Q45,45 30,55 Q80,45 145,72 Z" fill="url(#wingGrad)" stroke="#eab308" stroke-width="1.5"/>
                <path d="M155,72 Q95,30 25,48 Q60,65 45,74 Q95,62 150,78 Z" fill="url(#wingGrad)" stroke="#ca8a04" stroke-width="1.5"/>
                <path d="M160,76 Q110,55 60,72 Q95,82 155,82 Z" fill="url(#goldGrad)"/>
                <!-- ปีกเทวทูต 3 ชั้น ฝั่งขวา -->
                <path d="M200,65 Q270,5 350,20 Q315,45 330,55 Q280,45 215,72 Z" fill="url(#wingGrad)" stroke="#eab308" stroke-width="1.5"/>
                <path d="M205,72 Q265,30 335,48 Q300,65 315,74 Q265,62 210,78 Z" fill="url(#wingGrad)" stroke="#ca8a04" stroke-width="1.5"/>
                <path d="M200,76 Q250,55 300,72 Q265,82 205,82 Z" fill="url(#goldGrad)"/>
                <!-- ตราสัญลักษณ์ดาราสวรรค์ตรงกลาง -->
                <polygon points="180,6 188,32 215,40 188,48 180,74 172,48 145,40 172,32" fill="url(#goldGrad)" stroke="#ffffff" stroke-width="1.5">
                    <animate attributeName="opacity" values="1;0.75;1" dur="2s" repeatCount="indefinite"/>
                </polygon>
                <circle cx="180" cy="40" r="7" fill="#ffffff"/>
                <!-- ละอองดาวศักดิ์สิทธิ์ -->
                <circle cx="65" cy="20" r="2.5" fill="#fef08a"><animate attributeName="opacity" values="0;1;0" dur="1.8s" repeatCount="indefinite"/></circle>
                <circle cx="295" cy="20" r="2.5" fill="#fef08a"><animate attributeName="opacity" values="1;0;1" dur="2.2s" repeatCount="indefinite"/></circle>
                <circle cx="125" cy="14" r="2" fill="#ffffff"/><circle cx="235" cy="14" r="2" fill="#ffffff"/>
            </svg>
        `),
        bottomSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 70">
                <defs>
                    <linearGradient id="goldGradB" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#ca8a04"/>
                        <stop offset="50%" stop-color="#fef08a"/>
                        <stop offset="100%" stop-color="#ca8a04"/>
                    </linearGradient>
                </defs>
                <path d="M15,10 Q90,55 180,55 Q270,55 345,10 Q310,42 250,45 Q180,65 110,45 Q50,42 15,10 Z" fill="url(#goldGradB)" stroke="#ffffff" stroke-width="1.5"/>
                <polygon points="180,22 192,42 180,64 168,42" fill="#ffffff" stroke="#eab308" stroke-width="2"/>
                <circle cx="110" cy="36" r="4" fill="#fef08a"/><circle cx="250" cy="36" r="4" fill="#fef08a"/>
            </svg>
        `)
    },
    {
        id: 'cyber_overdrive',
        name: 'จักรกลสังหารไซเบอร์ (Mecha Overdrive)',
        price: 'LEGENDARY',
        isNew: true,
        topSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 90">
                <defs>
                    <linearGradient id="cyberNeon" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#06b6d4"/>
                        <stop offset="50%" stop-color="#ec4899"/>
                        <stop offset="100%" stop-color="#06b6d4"/>
                    </linearGradient>
                </defs>
                <!-- เกราะเขาจักรกลซ้าย-ขวา -->
                <polygon points="10,80 35,15 95,45 125,25 150,65 25,80" fill="#090d16" stroke="#06b6d4" stroke-width="2.5"/>
                <polygon points="350,80 325,15 265,45 235,25 210,65 335,80" fill="#090d16" stroke="#06b6d4" stroke-width="2.5"/>
                <!-- ลายเส้นวงจรเรืองแสง -->
                <polyline points="35,28 70,55 115,40" fill="none" stroke="#ec4899" stroke-width="2"/>
                <polyline points="325,28 290,55 245,40" fill="none" stroke="#ec4899" stroke-width="2"/>
                <!-- แกนพลังงาน Reactor ตรงกลาง -->
                <polygon points="135,72 155,20 205,20 225,72" fill="#111827" stroke="url(#cyberNeon)" stroke-width="2.5"/>
                <!-- เลนส์สแกนเนอร์วิ่งไปมา -->
                <rect x="150" y="38" width="60" height="10" rx="5" fill="#000000" stroke="#06b6d4" stroke-width="1"/>
                <circle cx="180" cy="43" r="5" fill="#ec4899">
                    <animate attributeName="cx" values="158;202;158" dur="1.6s" repeatCount="indefinite"/>
                </circle>
                <!-- ใบมีดพลังงานคู่ด้านบน -->
                <polygon points="168,20 180,2 192,20" fill="#06b6d4">
                    <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite"/>
                </polygon>
            </svg>
        `),
        bottomSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 70">
                <!-- เกราะช่วงล่าง + ไอพ่นพลาสม่า -->
                <polygon points="20,10 65,55 140,45 180,62 220,45 295,55 340,10 300,25 180,35 60,25" fill="#090d16" stroke="#06b6d4" stroke-width="2"/>
                <polygon points="155,35 180,66 205,35" fill="#ec4899">
                    <animate attributeName="opacity" values="0.6;1;0.6" dur="0.5s" repeatCount="indefinite"/>
                </polygon>
                <line x1="75" y1="38" x2="130" y2="33" stroke="#06b6d4" stroke-width="3"/>
                <line x1="285" y1="38" x2="230" y2="33" stroke="#06b6d4" stroke-width="3"/>
            </svg>
        `)
    },
    {
        id: 'cosmic_singularity',
        name: 'จักรวาลหลุมดำมรณะ (Cosmic Void)',
        price: 'LEGENDARY',
        isNew: true,
        topSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 90">
                <defs>
                    <radialGradient id="voidCore" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stop-color="#000000"/>
                        <stop offset="55%" stop-color="#090514"/>
                        <stop offset="75%" stop-color="#a855f7"/>
                        <stop offset="90%" stop-color="#ec4899"/>
                        <stop offset="100%" stop-color="transparent"/>
                    </radialGradient>
                    <linearGradient id="nebula" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#3b0764"/>
                        <stop offset="30%" stop-color="#7e22ce"/>
                        <stop offset="50%" stop-color="#f472b6"/>
                        <stop offset="70%" stop-color="#7e22ce"/>
                        <stop offset="100%" stop-color="#3b0764"/>
                    </linearGradient>
                </defs>
                <!-- คลื่นเนบิวลาโอบล้อมขอบบน -->
                <path d="M10,82 Q30,25 100,40 Q140,10 180,15 Q220,10 260,40 Q330,25 350,82 Q270,55 180,62 Q90,55 10,82 Z" fill="url(#nebula)" opacity="0.9" stroke="#f472b6" stroke-width="1.5"/>
                <!-- วงแหวน Accretion Disk หมุนรอบหลุมดำ -->
                <ellipse cx="180" cy="45" rx="65" ry="16" fill="none" stroke="#fde047" stroke-width="2.5" stroke-dasharray="18 8">
                    <animateTransform attributeName="transform" type="rotate" from="0 180 45" to="360 180 45" dur="10s" repeatCount="indefinite"/>
                </ellipse>
                <!-- ใจกลางหลุมดำ (Black Hole) -->
                <circle cx="180" cy="45" r="28" fill="url(#voidCore)" stroke="#ffffff" stroke-width="1"/>
                <circle cx="180" cy="45" r="15" fill="#000000" stroke="#f472b6" stroke-width="2"/>
                <!-- ดวงดาวและอุกกาบาตลอยรอบๆ -->
                <circle cx="55" cy="42" r="3" fill="#ffffff"><animate attributeName="r" values="1.5;3.5;1.5" dur="2s" repeatCount="indefinite"/></circle>
                <circle cx="305" cy="42" r="3" fill="#ffffff"><animate attributeName="r" values="3.5;1.5;3.5" dur="2s" repeatCount="indefinite"/></circle>
                <circle cx="95" cy="25" r="2" fill="#fde047"/><circle cx="265" cy="25" r="2" fill="#fde047"/>
            </svg>
        `),
        bottomSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 70">
                <path d="M20,8 Q90,62 180,58 Q270,62 340,8 Q290,42 180,42 Q70,42 20,8 Z" fill="#2e1065" stroke="#a855f7" stroke-width="2"/>
                <ellipse cx="180" cy="42" rx="45" ry="10" fill="#000000" stroke="#f472b6" stroke-width="1.5"/>
                <circle cx="110" cy="35" r="2.5" fill="#ffffff"/><circle cx="180" cy="42" r="4" fill="#fde047"/><circle cx="250" cy="35" r="2.5" fill="#ffffff"/>
            </svg>
        `)
    },
    {
        id: 'thunder_shogun',
        name: 'จอมทัพอสนีบาต (Thunder Raijin)',
        price: 'LEGENDARY',
        isNew: true,
        topSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 90">
                <!-- เมฆพายุทมิฬ -->
                <path d="M15,82 Q5,40 50,38 Q75,12 125,28 Q180,5 235,28 Q285,12 310,38 Q355,40 345,82 Q265,62 180,68 Q95,62 15,82 Z" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
                <!-- เขาโอนิทองคำคู่ -->
                <path d="M115,60 Q85,15 55,10 Q75,42 95,65 Z" fill="#facc15" stroke="#ca8a04" stroke-width="2"/>
                <path d="M245,60 Q275,15 305,10 Q285,42 265,65 Z" fill="#facc15" stroke="#ca8a04" stroke-width="2"/>
                <!-- กลองสายฟ้าไรจินตรงกลาง -->
                <circle cx="180" cy="42" r="22" fill="#1e1b4b" stroke="#facc15" stroke-width="3"/>
                <g>
                    <circle cx="180" cy="31" r="4.5" fill="#38bdf8"/>
                    <circle cx="170" cy="48" r="4.5" fill="#38bdf8"/>
                    <circle cx="190" cy="48" r="4.5" fill="#38bdf8"/>
                    <animateTransform attributeName="transform" type="rotate" from="0 180 42" to="360 180 42" dur="4s" repeatCount="indefinite"/>
                </g>
                <!-- สายฟ้าฟาด (กระพริบ) -->
                <polyline points="40,22 65,45 52,48 85,78" fill="none" stroke="#7dd3fc" stroke-width="3" stroke-linecap="round">
                    <animate attributeName="opacity" values="1;0.1;1;0.8;0;1" dur="1.2s" repeatCount="indefinite"/>
                </polyline>
                <polyline points="320,22 295,45 308,48 275,78" fill="none" stroke="#7dd3fc" stroke-width="3" stroke-linecap="round">
                    <animate attributeName="opacity" values="0.1;1;0;1;0.8;0.1" dur="1.2s" repeatCount="indefinite"/>
                </polyline>
            </svg>
        `),
        bottomSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 70">
                <path d="M20,12 Q95,62 180,56 Q265,62 340,12 Q280,42 180,40 Q80,42 20,12 Z" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
                <polyline points="60,28 115,48 140,32 180,55 220,32 245,48 300,28" fill="none" stroke="#facc15" stroke-width="2.5">
                    <animate attributeName="opacity" values="1;0.3;1" dur="0.9s" repeatCount="indefinite"/>
                </polyline>
            </svg>
        `)
    },
    // ====================================================
    // 🐱☀️💀 3 ธีมการ์ดโปรไฟล์ใหม่ตามแบบต้นฉบับ
    // ====================================================
    {
        id: 'orange_cat_hug',
        name: 'เหมียวส้มเกาะการ์ด (Nekobread)',
        price: 'LEGENDARY',
        isNew: true,
        // 🐱 ด้านบน: แมวส้มขนฟูเกาะขอบการ์ด + อุ้งเท้าห้อย + ดาววิบวับ
        topSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 105">
                <!-- ประกายดาวด้านบนขวา & ซ้าย -->
                <path d="M265,8 L268,16 L276,19 L268,22 L265,30 L262,22 L254,19 L262,16 Z" fill="#fef08a" stroke="#ca8a04" stroke-width="1">
                    <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite"/>
                </path>
                <path d="M282,16 L284,22 L290,24 L284,26 L282,32 L280,26 L274,24 L280,22 Z" fill="#ffffff" stroke="#ca8a04" stroke-width="1">
                    <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite"/>
                </path>
                <!-- ลำตัวและหัวแมวส้มขนฟู -->
                <path d="M22,98 C10,85 12,68 22,62 C14,52 22,42 32,42 C28,22 36,15 55,18 C75,21 95,28 115,25 C155,20 205,20 245,25 C265,28 285,21 305,18 C324,15 332,22 328,42 C338,42 346,52 338,62 C348,68 350,85 338,98 Q325,75 300,72 L60,72 Q35,75 22,98 Z" fill="#fdba74" stroke="#9a3412" stroke-width="2.5" stroke-linejoin="round"/>
                <!-- หูชมพูด้านใน ซ้าย-ขวา -->
                <path d="M40,38 Q42,24 56,26 Q68,28 72,38 Z" fill="#fda4af" stroke="#e11d48" stroke-width="1"/>
                <path d="M320,38 Q318,24 304,26 Q292,28 288,38 Z" fill="#fda4af" stroke="#e11d48" stroke-width="1"/>
                <!-- ลายสลิดสีส้มเข้มบนหน้าผากและข้างแก้ม -->
                <path d="M166,22 L168,34 M180,21 L180,36 M194,22 L192,34" stroke="#ea580c" stroke-width="4.5" stroke-linecap="round"/>
                <path d="M24,52 L42,54 M20,64 L38,65 M336,52 L318,54 M340,64 L322,65" stroke="#ea580c" stroke-width="4" stroke-linecap="round"/>
                <!-- ขนหน้าอกสีครีมฟูๆ ทับขอบการ์ด -->
                <path d="M45,72 Q65,52 105,54 Q140,42 180,42 Q220,42 255,54 Q295,52 315,72 Q295,78 275,72 Q255,79 235,72 Q215,79 195,73 Q180,78 165,73 Q145,79 125,72 Q105,79 85,72 Q65,78 45,72 Z" fill="#fffbeb" stroke="#d97706" stroke-width="2"/>
                <!-- ตา แก้มแดง และปาก :3 -->
                <circle cx="152" cy="44" r="5" fill="#78350f"/>
                <circle cx="208" cy="44" r="5" fill="#78350f"/>
                <path d="M168,46 Q174,53 180,46 Q186,53 192,46" fill="none" stroke="#78350f" stroke-width="2.8" stroke-linecap="round"/>
                <ellipse cx="130" cy="48" rx="12" ry="6" fill="#fda4af" opacity="0.7"/>
                <ellipse cx="230" cy="48" rx="12" ry="6" fill="#fda4af" opacity="0.7"/>
                <path d="M126,46 L124,50 M130,46 L128,50 M134,46 L132,50 M226,46 L224,50 M230,46 L228,50 M234,46 L232,50" stroke="#f43f5e" stroke-width="1.2" stroke-linecap="round"/>
                <!-- อุ้งเท้าคู่หน้าเกาะขอบการ์ด -->
                <ellipse cx="92" cy="68" rx="22" ry="13" transform="rotate(-10 92 68)" fill="#fffbeb" stroke="#9a3412" stroke-width="2"/>
                <path d="M82,73 Q85,66 86,64 M92,75 Q94,67 94,65" stroke="#d97706" stroke-width="1.8" stroke-linecap="round"/>
                <ellipse cx="268" cy="68" rx="22" ry="13" transform="rotate(10 268 68)" fill="#fffbeb" stroke="#9a3412" stroke-width="2"/>
                <path d="M278,73 Q275,66 274,64 M268,75 Q266,67 266,65" stroke="#d97706" stroke-width="1.8" stroke-linecap="round"/>
                <!-- ประกายดาวฝั่งซ้าย -->
                <path d="M22,60 L25,67 L32,70 L25,73 L22,80 L19,73 L12,70 L19,67 Z" fill="#ffffff" stroke="#eab308" stroke-width="1">
                    <animate attributeName="transform" type="scale" values="1;1.15;1" dur="2s" repeatCount="indefinite"/>
                </path>
            </svg>
        `),
        // 🐱 ด้านล่าง: หางแมวส้มลายสลิดพันรอบขอบล่าง + ดาววิบวับ
        bottomSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 85">
                <g>
                    <!-- โครงหางแมวยาวโค้ง -->
                    <path d="M24,8 C5,25 10,55 45,62 C110,75 220,62 305,72 C325,75 332,62 315,54 C235,44 120,56 55,44 C32,40 28,22 36,10 Z" fill="#fdba74" stroke="#9a3412" stroke-width="2.5" stroke-linejoin="round"/>
                    <!-- ปลายหางสีครีม -->
                    <path d="M292,51 C305,52 315,54 320,58 C328,64 322,74 305,72 C298,71 292,70 288,69 Q295,60 292,51 Z" fill="#fffbeb" stroke="#9a3412" stroke-width="2"/>
                    <!-- ลายปล้องบนหาง -->
                    <path d="M48,44 L44,60 M75,47 L72,64 M105,49 L102,66 M135,50 L133,67 M165,50 L163,67 M195,50 L193,66 M225,50 L223,66 M255,50 L253,67 M280,51 L278,68" stroke="#ea580c" stroke-width="6" stroke-linecap="round"/>
                </g>
                <!-- ประกายดาวด้านล่าง -->
                <path d="M42,58 L45,66 L53,69 L45,72 L42,80 L39,72 L31,69 L39,66 Z" fill="#fef08a" stroke="#ca8a04" stroke-width="1">
                    <animate attributeName="opacity" values="1;0.2;1" dur="1.8s" repeatCount="indefinite"/>
                </path>
                <path d="M335,38 L337,44 L343,46 L337,48 L335,54 L333,48 L327,46 L333,44 Z" fill="#ffffff" stroke="#ca8a04" stroke-width="1">
                    <animate attributeName="opacity" values="0.2;1;0.2" dur="1.8s" repeatCount="indefinite"/>
                </path>
            </svg>
        `)
    },
    {
        id: 'solar_stained_glass',
        name: 'มงกุฎสุริยันกระจกสี (Solar Cathedral)',
        price: 'LEGENDARY',
        isNew: true,
        // ☀️ ด้านบน: ซุ้มกระจกสีทองคำ + หอกแสงสุริยัน + ตราดวงอาทิตย์และสายมุก
        topSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 110">
                <defs>
                    <linearGradient id="sunGold" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#fef08a"/>
                        <stop offset="50%" stop-color="#f59e0b"/>
                        <stop offset="100%" stop-color="#92400e"/>
                    </linearGradient>
                    <linearGradient id="stainedGlass" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#ea580c"/>
                        <stop offset="25%" stop-color="#f59e0b"/>
                        <stop offset="50%" stop-color="#fef08a"/>
                        <stop offset="75%" stop-color="#f59e0b"/>
                        <stop offset="100%" stop-color="#ea580c"/>
                    </linearGradient>
                </defs>
                <!-- หอกรัศมีทองคำซ้าย-ขวา -->
                <g stroke="url(#sunGold)" stroke-width="2" fill="#fde047">
                    <line x1="95" y1="45" x2="55" y2="8"/><polygon points="55,8 64,12 58,18"/>
                    <line x1="80" y1="55" x2="35" y2="24"/><polygon points="35,24 45,26 40,33"/>
                    <line x1="265" y1="45" x2="305" y2="8"/><polygon points="305,8 296,12 302,18"/>
                    <line x1="280" y1="55" x2="325" y2="24"/><polygon points="325,24 315,26 320,33"/>
                </g>
                <!-- ซุ้มโค้งกระจกสีด้านหลัง -->
                <path d="M35,72 Q90,10 180,10 Q270,10 325,72 Z" fill="url(#stainedGlass)" stroke="url(#sunGold)" stroke-width="3.5"/>
                <!-- เส้นแบ่งช่องกระจกสี -->
                <path d="M75,72 L105,32 M110,72 L135,20 M145,72 L160,15 M215,72 L200,15 M250,72 L225,20 M285,72 L255,32" stroke="#78350f" stroke-width="2"/>
                <path d="M55,72 Q115,25 180,25 Q245,25 305,72" fill="none" stroke="url(#sunGold)" stroke-width="3"/>
                <!-- กรอบเสาทองคำครอบขอบบนของการ์ด -->
                <path d="M18,105 L18,75 Q18,66 28,66 L332,66 Q342,66 342,75 L342,105" fill="none" stroke="url(#sunGold)" stroke-width="5"/>
                <path d="M23,105 L23,77 Q23,71 30,71 L330,71 Q337,71 337,77 L337,105" fill="none" stroke="#fef08a" stroke-width="1.5"/>
                <!-- สายสร้อยไข่มุกประดับซุ้ม -->
                <path d="M115,42 Q145,62 180,48 Q215,62 245,42" fill="none" stroke="#fef08a" stroke-width="1.5" stroke-dasharray="3 3"/>
                <circle cx="135" cy="51" r="3" fill="#ffffff"/><circle cx="225" cy="51" r="3" fill="#ffffff"/>
                <circle cx="155" cy="54" r="3.5" fill="#ffffff"/><circle cx="205" cy="54" r="3.5" fill="#ffffff"/>
                <!-- ตราสัญลักษณ์สุริยัน-จันทราตรงกลาง -->
                <circle cx="180" cy="34" r="24" fill="#451a03" stroke="url(#sunGold)" stroke-width="4"/>
                <circle cx="180" cy="34" r="18" fill="#fbbf24" stroke="#fef08a" stroke-width="1.5"/>
                <path d="M166,28 A16,16 0 1,0 194,28 A14,12 0 1,1 166,28 Z" fill="#d97706"/>
                <polygon points="180,18 183,30 195,33 183,36 180,48 177,36 165,33 177,30" fill="#ffffff">
                    <animateTransform attributeName="transform" type="scale" values="1;1.1;1" additive="sum" dur="2s" repeatCount="indefinite"/>
                </polygon>
                <!-- อัญมณีห้อยกลางหน้าผาก -->
                <polygon points="180,58 185,65 180,72 175,65" fill="#f97316" stroke="#fef08a" stroke-width="1.2"/>
            </svg>
        `),
        // ☀️ ด้านล่าง: ฐานกระจกสีทองคำ + ตราดวงดาวและมุกคู่
        bottomSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 85">
                <defs>
                    <linearGradient id="sunGoldB" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#92400e"/>
                        <stop offset="50%" stop-color="#fef08a"/>
                        <stop offset="100%" stop-color="#92400e"/>
                    </linearGradient>
                </defs>
                <!-- โค้งกระจกสีด้านล่าง -->
                <path d="M55,18 Q180,82 305,18 Z" fill="#ea580c" stroke="url(#sunGoldB)" stroke-width="3.5"/>
                <path d="M85,18 Q180,66 275,18 Z" fill="#f59e0b" stroke="#fef08a" stroke-width="2"/>
                <line x1="120" y1="18" x2="140" y2="55" stroke="#78350f" stroke-width="2"/>
                <line x1="240" y1="18" x2="220" y2="55" stroke="#78350f" stroke-width="2"/>
                <!-- ขอบทองคำรับตัวการ์ด + อัญมณีข้าง -->
                <path d="M18,2 L18,14 Q18,20 26,20 L334,20 Q342,20 342,14 L342,2" fill="none" stroke="url(#sunGoldB)" stroke-width="4.5"/>
                <polygon points="10,2 16,10 10,18 4,10" fill="#f97316" stroke="#fef08a" stroke-width="1.2"/>
                <polygon points="350,2 356,10 350,18 344,10" fill="#f97316" stroke="#fef08a" stroke-width="1.2"/>
                <!-- ตรา मุกคู่ซ้าย-ขวา และตราหลักตรงกลาง -->
                <circle cx="112" cy="34" r="11" fill="#271206" stroke="#fef08a" stroke-width="2.5"/>
                <circle cx="112" cy="34" r="4" fill="#ffffff"/>
                <circle cx="248" cy="34" r="11" fill="#271206" stroke="#fef08a" stroke-width="2.5"/>
                <circle cx="248" cy="34" r="4" fill="#ffffff"/>
                <circle cx="180" cy="46" r="20" fill="#f59e0b" stroke="#fef08a" stroke-width="3.5"/>
                <polygon points="180,29 185,41 197,46 185,51 180,63 175,51 163,46 175,41" fill="#ffffff" stroke="#b45309" stroke-width="1"/>
            </svg>
        `)
    },
    {
        id: 'hellfire_skulls',
        name: 'บัลลังก์กะโหลกเพลิงทมิฬ (Skull Inferno)',
        price: 'LEGENDARY',
        isNew: true,
        // 💀 ด้านบน: เปลวเพลิงสีแดงอมชมพู + กะโหลก 7 หัวเรียงกัน ดวงตาเรืองแสง
        topSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 105">
                <defs>
                    <linearGradient id="hellFlame" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stop-color="#be123c"/>
                        <stop offset="60%" stop-color="#f43f5e"/>
                        <stop offset="100%" stop-color="#fda4af"/>
                    </linearGradient>
                    <linearGradient id="skullBone" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#d1d5db"/>
                        <stop offset="60%" stop-color="#6b7280"/>
                        <stop offset="100%" stop-color="#1f2937"/>
                    </linearGradient>
                </defs>
                <!-- เปลวเพลิงนรกด้านหลัง (กระพริบไหว) -->
                <path d="M12,95 Q8,60 22,55 Q18,35 38,48 Q45,25 65,42 Q80,15 105,35 Q125,8 148,28 Q165,2 180,18 Q195,2 212,28 Q235,8 255,35 Q280,15 295,42 Q315,25 322,48 Q342,35 338,55 Q352,60 348,95 Q335,72 320,70 L40,70 Q25,72 12,95 Z" fill="url(#hellFlame)" opacity="0.9">
                    <animate attributeName="opacity" values="0.95;0.75;0.95" dur="1.4s" repeatCount="indefinite"/>
                </path>
                <!-- คานกระดูกหินทมิฬเกาะขอบการ์ด -->
                <path d="M16,92 L20,66 L340,66 L344,92 L334,72 L26,72 Z" fill="#4b5563" stroke="#111827" stroke-width="2"/>
                <!-- กะโหลกซ้ายสุด & ขวาสุด (คู่ที่ 3) -->
                <g fill="url(#skullBone)" stroke="#111827" stroke-width="1.8">
                    <ellipse cx="95" cy="54" rx="13" ry="14"/><rect x="89" y="62" width="12" height="6" rx="2"/>
                    <ellipse cx="265" cy="54" rx="13" ry="14"/><rect x="259" y="62" width="12" height="6" rx="2"/>
                    <!-- กะโหลกคู่ที่ 2 -->
                    <ellipse cx="120" cy="50" rx="15" ry="16"/><rect x="113" y="60" width="14" height="7" rx="2"/>
                    <ellipse cx="240" cy="50" rx="15" ry="16"/><rect x="233" y="60" width="14" height="7" rx="2"/>
                    <!-- กะโหลกคู่ใน (คู่ที่ 1) -->
                    <ellipse cx="148" cy="46" rx="17" ry="19"/><rect x="139" y="58" width="18" height="9" rx="2"/>
                    <ellipse cx="212" cy="46" rx="17" ry="19"/><rect x="203" y="58" width="18" height="9" rx="2"/>
                </g>
                <!-- กะโหลกจอมมารตรงกลาง (มีรอยบากเขาแตก) -->
                <path d="M160,48 C156,28 164,16 172,18 L176,28 L184,16 C194,16 204,28 200,48 L194,68 L166,68 Z" fill="url(#skullBone)" stroke="#09090b" stroke-width="2.2"/>
                <path d="M172,62 L172,68 M180,62 L180,69 M188,62 L188,68" stroke="#09090b" stroke-width="2"/>
                <!-- ดวงตาเรืองแสงสีแดงของกะโหลกทั้ง 7 -->
                <g fill="#f43f5e">
                    <circle cx="91" cy="54" r="2.5"/><circle cx="99" cy="54" r="2.5"/>
                    <circle cx="115" cy="50" r="3"/><circle cx="125" cy="50" r="3"/>
                    <circle cx="142" cy="47" r="3.5"/><circle cx="153" cy="47" r="3.5"/>
                    <circle cx="207" cy="47" r="3.5"/><circle cx="218" cy="47" r="3.5"/>
                    <circle cx="235" cy="50" r="3"/><circle cx="245" cy="50" r="3"/>
                    <circle cx="261" cy="54" r="2.5"/><circle cx="269" cy="54" r="2.5"/>
                    <!-- ตากะโหลกกลางพร้อมไฟลุก -->
                    <circle cx="171" cy="46" r="4.5"/><circle cx="189" cy="46" r="4.5"/>
                    <animate attributeName="opacity" values="1;0.4;1" dur="1.1s" repeatCount="indefinite"/>
                </g>
                <polygon points="178,52 182,52 180,58" fill="#09090b"/>
            </svg>
        `),
        // 💀 ด้านล่าง: เปลวไฟนรกสีแดงอมชมพูเกาะรอบขอบล่างการ์ด
        bottomSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 75">
                <defs>
                    <linearGradient id="hellFlameB" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#be123c"/>
                        <stop offset="55%" stop-color="#f43f5e"/>
                        <stop offset="100%" stop-color="#fda4af"/>
                    </linearGradient>
                </defs>
                <path d="M12,5 Q5,32 22,28 Q25,52 42,34 Q55,58 72,36 Q90,62 110,36 Q130,58 150,35 Q172,64 185,36 Q205,58 225,35 Q248,66 262,36 Q285,58 302,34 Q322,55 335,28 Q352,32 348,5 Q335,24 315,22 L45,22 Q25,24 12,5 Z" fill="url(#hellFlameB)">
                    <animate attributeName="opacity" values="0.95;0.7;0.95" dur="1.2s" repeatCount="indefinite"/>
                </path>
            </svg>
        `)
    }
];

const shopThemes = [
    // 🎨 ธีมสีพื้นและไล่เฉดสี
    { name: 'Dark Obsidian (ค่าเริ่มต้น)', bg: 'rgba(17, 18, 20, 0.90)' },
    { name: 'Royal Purple (ม่วงจักรพรรดิ)', bg: 'linear-gradient(145deg, rgba(46,16,101,0.95) 0%, rgba(17,18,20,0.95) 100%)' },
    { name: 'Crimson Blood (แดงแอดมิน)', bg: 'linear-gradient(145deg, rgba(127,29,29,0.95) 0%, rgba(17,18,20,0.95) 100%)' },
    { name: 'Cyber Ocean (น้ำเงินนีออน)', bg: 'linear-gradient(145deg, rgba(12,74,110,0.95) 0%, rgba(17,18,20,0.95) 100%)' },
    { name: 'Emerald Forest (เขียวมรกต)', bg: 'linear-gradient(145deg, rgba(6,78,59,0.95) 0%, rgba(17,18,20,0.95) 100%)' },
    { name: 'Sunset Gold (ทองอัสดง)', bg: 'linear-gradient(145deg, rgba(120,53,15,0.95) 0%, rgba(17,18,20,0.95) 100%)' },

    // ✨ ธีมแบบมีลวดลายกราฟิก
    { 
        name: 'Cyber Grid (ลายตารางไซเบอร์)', 
        bg: 'linear-gradient(rgba(6, 182, 212, 0.12) 1px, transparent 1px) 0 0 / 18px 18px, linear-gradient(90deg, rgba(6, 182, 212, 0.12) 1px, transparent 1px) 0 0 / 18px 18px, linear-gradient(145deg, #082f49 0%, #090d16 100%)' 
    },
    { 
        name: 'Luxury Diamond (ลายเพชรทองคำ)', 
        bg: 'repeating-linear-gradient(135deg, rgba(234, 179, 8, 0.08) 0px, rgba(234, 179, 8, 0.08) 2px, transparent 2px, transparent 12px), repeating-linear-gradient(45deg, rgba(234, 179, 8, 0.08) 0px, rgba(234, 179, 8, 0.08) 2px, transparent 2px, transparent 12px), linear-gradient(145deg, #422006 0%, #111214 100%)' 
    },
    { 
        name: 'Crimson Hazard (ลายเฉียงแอดมิน)', 
        bg: 'repeating-linear-gradient(-45deg, rgba(239, 68, 68, 0.10) 0px, rgba(239, 68, 68, 0.10) 10px, transparent 10px, transparent 20px), radial-gradient(circle at top right, rgba(220, 38, 38, 0.35), transparent 60%), linear-gradient(145deg, #450a0a 0%, #111214 100%)' 
    },
    { 
        name: 'Starry Pink (ลายจุดพิกเซลชมพู)', 
        bg: 'radial-gradient(rgba(244, 114, 182, 0.22) 1.5px, transparent 1.5px) 0 0 / 14px 14px, linear-gradient(145deg, #500724 0%, #111214 100%)' 
    },
    { 
        name: 'Royal Carbon (ลายคาร์บอนม่วง)', 
        bg: 'repeating-linear-gradient(45deg, rgba(168, 85, 247, 0.07) 0px, rgba(168, 85, 247, 0.07) 6px, transparent 6px, transparent 12px), linear-gradient(145deg, #3b0764 0%, #111214 100%)' 
    },
    { 
        name: 'Emerald Matrix (ลายดิจิทัลเรืองแสง)', 
        bg: 'radial-gradient(rgba(16, 185, 129, 0.22) 1px, transparent 1px) 0 0 / 12px 12px, radial-gradient(circle at bottom left, rgba(5, 150, 105, 0.3), transparent 70%), linear-gradient(145deg, #022c22 0%, #111214 100%)' 
    },
    { 
        name: 'Synthwave Retro (ลายคลื่นเรโทร)', 
        bg: 'repeating-linear-gradient(0deg, rgba(236, 72, 153, 0.10) 0px, rgba(236, 72, 153, 0.10) 1px, transparent 1px, transparent 6px), radial-gradient(circle at 50% 0%, rgba(168, 85, 247, 0.45), transparent 70%), linear-gradient(180deg, #2e1065 0%, #090d16 100%)' 
    },
    { 
        name: 'Checkerboard Dark (ลายหมากรุกโมเดิร์น)', 
        bg: 'repeating-conic-gradient(rgba(255, 255, 255, 0.03) 0% 25%, transparent 0% 50%) 0 0 / 24px 24px, linear-gradient(145deg, #1e1b4b 0%, #0f172a 100%)' 
    }
    
];

window.equipShopItem = async (type, value, itemName) => {
    if (!currentUserId) return;
    try {
        if (type === 'frame') await updateDoc(doc(db, "users", currentUserId), { profileFrame: value });
        else if (type === 'banner') await updateDoc(doc(db, "users", currentUserId), { bannerURL: value });
        else if (type === 'theme') await updateDoc(doc(db, "users", currentUserId), { cardTheme: value });
        else if (type === 'deco') await updateDoc(doc(db, "users", currentUserId), { cardDeco: value });
        showToast(`สวมใส่ "${itemName}" เรียบร้อยแล้ว! ✨`, "success");
    } catch (e) {
        showToast("เกิดข้อผิดพลาดในการสวมใส่ไอเทม", "error");
    }
};

function renderHiveShop() {
    const framesGrid = document.getElementById('shop-frames-grid');
    const bannersGrid = document.getElementById('shop-banners-grid');
    const themesGrid = document.getElementById('shop-themes-grid');
    const myAvatar = document.getElementById('current-user-avatar')?.src || 'https://ui-avatars.com/api/?name=U';

    if (framesGrid) {
        framesGrid.innerHTML = shopFrames.map(f => `
            <div class="bg-[#2b2d31] border border-white/5 hover:border-[#5865F2] rounded-2xl p-4 flex flex-col items-center text-center transition group shadow-md">
                <div class="relative w-16 h-16 flex items-center justify-center mb-3 mt-1">
                    <img src="${myAvatar}" class="w-14 h-14 rounded-full object-cover">
                    ${f.url ? `<img src="${f.url}" class="absolute w-[130%] h-[130%] max-w-none pointer-events-none drop-shadow-md">` : ''}
                </div>
                <p class="font-bold text-white text-[14px]">${f.name}</p>
                <p class="text-[11px] text-[#949ba4] mb-4">${f.desc}</p>
                <button onclick="equipShopItem('frame', &quot;${f.url}&quot;, '${f.name}')" class="mt-auto w-full bg-[#5865F2] hover:bg-[#4752C4] text-white text-[12px] font-bold py-2 rounded-xl transition">
                    สวมใส่ทันที
                </button>
            </div>
        `).join('');
    }

    if (bannersGrid) {
        bannersGrid.innerHTML = shopBanners.map(b => `
            <div class="bg-[#2b2d31] border border-white/5 hover:border-purple-500 rounded-2xl overflow-hidden flex flex-col transition shadow-md">
                <div class="h-24 bg-black relative">
                    <img src="${b.url}" class="w-full h-full object-cover">
                    <span class="absolute top-2 right-2 bg-black/60 text-pink-400 text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm">GIF</span>
                </div>
                <div class="p-3.5 flex items-center justify-between">
                    <span class="font-bold text-white text-[13px] truncate mr-2">${b.name}</span>
                    <button onclick="equipShopItem('banner', '${b.url}', '${b.name}')" class="bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition flex-shrink-0">
                        ใช้ภาพปกนี้
                    </button>
                </div>
            </div>
        `).join('');
    }

    if (themesGrid) {
        const decoCardsHTML = shopDecos.map(d => `
            <div onclick="equipShopItem('deco', '${d.id}', '${d.name}')" class="bg-[#18191c] hover:bg-[#1e1f24] border border-white/10 hover:border-white/30 rounded-2xl p-5 flex flex-col justify-between relative cursor-pointer transition-all duration-300 group min-h-[290px] shadow-xl">
                ${d.isNew ? `<span class="absolute top-4 left-4 bg-white text-black text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow">NEW</span>` : ''}
                
                <div class="my-auto mx-auto w-[155px] h-[165px] bg-[#232428] rounded-xl relative shadow-2xl border border-white/5 flex flex-col group-hover:scale-105 transition-transform duration-300 mt-8 mb-6">
                    ${d.topSvg ? `<img src="${d.topSvg}" class="absolute -top-7 left-1/2 -translate-x-1/2 w-[114%] max-w-none pointer-events-none z-20">` : ''}
                    ${d.bottomSvg ? `<img src="${d.bottomSvg}" class="absolute -bottom-5 left-1/2 -translate-x-1/2 w-[112%] max-w-none pointer-events-none z-20">` : ''}
                    
                    <div class="h-12 bg-[#35373c] rounded-t-xl w-full"></div>
                    <div class="px-3 pt-5 pb-3 flex-1 flex flex-col relative">
                        <!-- 🌟 เปลี่ยนโลโก้เป็นตัว H โทนสีเทาของการ์ดจำลอง -->
                        <div class="w-10 h-10 rounded-full bg-[#35373c] border-[4px] border-[#232428] absolute -top-5 left-3 flex items-center justify-center">
                            <span class="font-extrabold text-[#80848e] text-[16px] leading-none select-none">H</span>
                            <div class="w-3 h-3 rounded-full bg-[#232428] absolute -bottom-0.5 -right-0.5"></div>
                        </div>
                        <div class="w-16 h-2.5 bg-[#35373c] rounded-full mt-2"></div>
                        <div class="w-24 h-2 bg-[#2b2d31] rounded-full mt-2"></div>
                        <div class="w-10 h-2 bg-[#2b2d31] rounded-full mt-auto"></div>
                        <div class="w-28 h-2 bg-[#2b2d31] rounded-full mt-1.5"></div>
                    </div>
                </div>

                <div class="flex items-end justify-between mt-2 z-10">
                    <div>
                        <p class="font-bold text-white text-[15px]">${d.name}</p>
                        <p class="font-extrabold text-[#dbdee1] text-[13px] mt-0.5">${d.price}</p>
                    </div>
                    <span class="bg-[#5865F2] group-hover:bg-[#4752C4] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition flex-shrink-0">
                        สวมใส่
                    </span>
                </div>
            </div>
        `).join('');

        const themeCardsHTML = shopThemes.map(t => `
            <div class="rounded-2xl p-4 border border-white/10 flex flex-col justify-between h-28 shadow-lg" style="background: ${t.bg}">
                <div>
                    <span class="text-[10px] uppercase tracking-wider font-extrabold text-white/60">Card Background</span>
                    <p class="font-bold text-white text-[14px] mt-0.5">${t.name}</p>
                </div>
                <button onclick="equipShopItem('theme', '${t.bg}', '${t.name}')" class="self-end bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold px-4 py-1.5 rounded-lg backdrop-blur-md transition border border-white/10">
                    ใช้พื้นหลังนี้
                </button>
            </div>
        `).join('');

        themesGrid.innerHTML = decoCardsHTML + themeCardsHTML;
    }
}
// === END OF FILE ===