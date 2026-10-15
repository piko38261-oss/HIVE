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
                voiceBannerURL: u.voiceBannerURL || '', 
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
             const bannerStyle = u.voiceBannerURL ? `background-image: url('${u.voiceBannerURL}'); background-size: cover; background-position: center;` : '';
             const bannerOverlay = u.voiceBannerURL ? `bg-black/50 backdrop-blur-[2px]` : `hover:bg-[#2b2d31]`;

                 voiceActiveList.insertAdjacentHTML('beforeend', `
                    <div class="flex items-center space-x-2.5 text-[13px] text-[#dbdee1] py-1.5 px-2.5 rounded-lg transition cursor-pointer ml-2 relative overflow-hidden shadow-sm border border-white/5 mb-1" style="${bannerStyle}">
                      <div class="absolute inset-0 ${bannerOverlay} z-0"></div>
                         <div class="relative flex-shrink-0 flex items-center justify-center w-7 h-7 z-10">
                           <img src="${userAvatar}" class="w-7 h-7 rounded-full object-cover opacity-95 absolute z-0">
                              ${frameUrl ? `<img src="${frameUrl}" class="absolute w-[140%] h-[140%] max-w-none pointer-events-none z-10 drop-shadow-md">` : ''}
                         </div>
                     <span class="truncate font-bold flex-1 flex items-center z-10 drop-shadow">${userName} ${screenBadgeSmall}</span>
                 <span class="z-10">${muteIconSmall}</span>
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
            
            const closeBtn = document.getElementById('close-profile-card');
            if(closeBtn) closeBtn.classList.replace('z-20', 'z-40');

            const bannerWrap = document.getElementById('profile-card-banner')?.parentElement;
            if(bannerWrap) bannerWrap.classList.add('overflow-hidden', 'rounded-t-2xl', 'md:rounded-t-3xl');

            cardBox.querySelectorAll('.card-deco-overlay').forEach(el => el.remove());

            const decoItem = shopDecos.find(d => d.id === u.cardDeco);
            if(decoItem && decoItem.topSvg) {
                cardBox.insertAdjacentHTML('beforeend', `
                    <img src="${decoItem.topSvg}" class="card-deco-overlay absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[78%] w-[106%] max-w-none pointer-events-none z-30 drop-shadow-[0_6px_12px_rgba(0,0,0,0.8)]">
                    <img src="${decoItem.bottomSvg}" class="card-deco-overlay absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[82%] w-[106%] max-w-none pointer-events-none z-30 drop-shadow-[0_6px_12px_rgba(0,0,0,0.8)]">
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
    {
        name: 'มหาเวทดาราจักร (Astral Halo)',
        desc: 'วงแหวนเวท 2 ชั้นหมุนสวนทางกัน',
        url: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
                <defs>
                    <linearGradient id="astralGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#38bdf8"/><stop offset="50%" stop-color="#a855f7"/><stop offset="100%" stop-color="#f472b6"/>
                    </linearGradient>
                </defs>
                <g>
                    <circle cx="50" cy="50" r="46" fill="none" stroke="url(#astralGrad)" stroke-width="2.5" stroke-dasharray="10 4 2 4"/>
                    <polygon points="50,2 53,9 47,9" fill="#38bdf8"/><polygon points="50,98 53,91 47,91" fill="#f472b6"/>
                    <polygon points="2,50 9,53 9,47" fill="#a855f7"/><polygon points="98,50 91,53 91,47" fill="#a855f7"/>
                    <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="10s" repeatCount="indefinite"/>
                </g>
                <g>
                    <circle cx="50" cy="50" r="41" fill="none" stroke="#fde047" stroke-width="2" stroke-dasharray="6 6"/>
                    <circle cx="50" cy="9" r="3" fill="#ffffff"/><circle cx="50" cy="91" r="3" fill="#ffffff"/>
                    <animateTransform attributeName="transform" type="rotate" from="360 50 50" to="0 50 50" dur="6s" repeatCount="indefinite"/>
                </g>
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
                        <stop offset="0%" stop-color="#991b1b"/><stop offset="50%" stop-color="#ef4444"/><stop offset="100%" stop-color="#facc15"/>
                    </linearGradient>
                </defs>
                <g>
                    <circle cx="50" cy="50" r="44" fill="none" stroke="url(#fireGrad)" stroke-width="4.5" stroke-dasharray="14 4"/>
                    <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="8s" repeatCount="indefinite"/>
                </g>
                <circle cx="50" cy="50" r="40" fill="none" stroke="#facc15" stroke-width="1.5"/>
                <path d="M26,20 Q12,6 6,14 Q12,26 22,28 Z" fill="url(#fireGrad)" stroke="#fef08a" stroke-width="1"/>
                <path d="M74,20 Q88,6 94,14 Q88,26 78,28 Z" fill="url(#fireGrad)" stroke="#fef08a" stroke-width="1"/>
                <polygon points="4,44 11,38 9,52" fill="#ef4444" stroke="#facc15" stroke-width="0.8"/>
                <polygon points="96,44 89,38 91,52" fill="#ef4444" stroke="#facc15" stroke-width="0.8"/>
                <polygon points="7,62 13,56 12,68" fill="#ef4444" stroke="#facc15" stroke-width="0.8"/>
                <polygon points="93,62 87,56 88,68" fill="#ef4444" stroke="#facc15" stroke-width="0.8"/>
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
                <g>
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#06b6d4" stroke-width="3" stroke-dasharray="22 8 4 8"/>
                    <circle cx="50" cy="50" r="41" fill="none" stroke="#ec4899" stroke-width="1.5" stroke-dasharray="8 12"/>
                    <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="5s" repeatCount="indefinite"/>
                </g>
                <polygon points="14,30 6,8 28,16" fill="#090d16" stroke="#06b6d4" stroke-width="2"/>
                <polygon points="14,25 10,13 23,18" fill="#ec4899"/>
                <polygon points="86,30 94,8 72,16" fill="#090d16" stroke="#06b6d4" stroke-width="2"/>
                <polygon points="86,25 90,13 77,18" fill="#ec4899"/>
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
                <circle cx="50" cy="50" r="44" fill="none" stroke="#09090b" stroke-width="6"/>
                <g>
                    <circle cx="50" cy="50" r="44" fill="none" stroke="#dc2626" stroke-width="3" stroke-dasharray="9 5"/>
                    <animateTransform attributeName="transform" type="rotate" from="360 50 50" to="0 50 50" dur="7s" repeatCount="indefinite"/>
                </g>
                <path d="M4,35 Q12,50 4,65 Q10,50 4,35 Z" fill="#dc2626"/>
                <path d="M96,35 Q88,50 96,65 Q90,50 96,35 Z" fill="#dc2626"/>
                <path d="M32,10 Q50,0 68,10 Q50,20 32,10 Z" fill="#18181b" stroke="#dc2626" stroke-width="2"/>
                <path d="M36,10 Q50,3 64,10 Q50,17 36,10 Z" fill="#fef2f2"/>
                <ellipse cx="50" cy="10" rx="3.5" ry="5" fill="#dc2626">
                    <animate attributeName="cx" values="50;45;55;50" dur="3.5s" repeatCount="indefinite"/>
                </ellipse>
                <ellipse cx="50" cy="10" rx="1.2" ry="4" fill="#000000">
                    <animate attributeName="cx" values="50;45;55;50" dur="3.5s" repeatCount="indefinite"/>
                </ellipse>
                <polygon points="38,87 43,97 47,89" fill="#dc2626"/>
                <polygon points="62,87 57,97 53,89" fill="#dc2626"/>
            </svg>
        `)
    }
];

const shopBanners = [
    { name: 'Pastel Yellow (เหลืองพาสเทล)', url: svgToUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200"><rect width="600" height="200" fill="#fef08a"/></svg>`) },
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 105">
                <path d="M25,85 Q30,40 55,30 Q45,60 48,85 Z" fill="#18181b" stroke="#a1a1aa" stroke-width="1.5"/>
                <path d="M45,85 Q52,35 75,28 Q65,58 66,85 Z" fill="#18181b" stroke="#a1a1aa" stroke-width="1.5"/>
                <path d="M65,85 Q75,40 95,35 Q85,62 84,85 Z" fill="#18181b" stroke="#a1a1aa" stroke-width="1.5"/>
                <path d="M95,80 Q130,40 180,45 Q230,40 275,75 L295,85 L260,88 Q230,65 180,65 Q130,65 95,80 Z" fill="#9ca3af" stroke="#18181b" stroke-width="2"/>
                <path d="M140,85 Q150,30 185,25 Q220,30 230,85" fill="#d4d4d8" stroke="#27272a" stroke-width="1.5"/>
                <ellipse cx="185" cy="56" rx="22" ry="28" fill="#f4f4f5" stroke="#18181b" stroke-width="2.5"/>
                <circle cx="176" cy="48" r="6" fill="#09090b"/><circle cx="176" cy="48" r="2" fill="#ffffff"/>
                <circle cx="194" cy="48" r="6" fill="#09090b"/><circle cx="194" cy="48" r="2" fill="#ffffff"/>
                <ellipse cx="185" cy="68" rx="10" ry="12" fill="#09090b" stroke="#27272a" stroke-width="2"/>
                <path d="M177,60 L193,60 M177,74 L193,74" stroke="#f4f4f5" stroke-width="2" stroke-dasharray="2 2"/>
                <path d="M260,82 Q285,65 305,82 L295,90 L260,86 Z" fill="#d4d4d8" stroke="#18181b" stroke-width="2"/>
            </svg>
        `),
        bottomSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 85">
                <path d="M30,15 Q180,70 330,12 Q305,50 180,55 Q65,52 30,15 Z" fill="#18181b" stroke="#52525b" stroke-width="2"/>
                <path d="M70,25 L55,55 M100,32 L90,62 M135,38 L130,66 M170,40 L170,68 M205,38 L210,66 M240,32 L255,62 M275,25 L295,52" stroke="#27272a" stroke-width="3" stroke-linecap="round"/>
                <path d="M75,28 Q180,58 295,20" fill="none" stroke="#71717a" stroke-width="2" stroke-dasharray="10 6"/>
            </svg>
        `)
    },
    {
        id: 'all_seeing_eyes',
        name: 'จับจ้องไม่คลาดสายตา',
        price: 'FREE (VIP)',
        isNew: false,
        topSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 105">
                <path d="M10,95 Q8,38 60,32 Q110,12 180,18 Q250,12 300,32 Q352,38 350,95 Q335,84 320,82 L40,82 Q25,84 10,95 Z" fill="#050505" stroke="#27272a" stroke-width="2"/>
                <path d="M120,52 Q180,22 240,52 Q180,77 120,52 Z" fill="#ffffff" stroke="#000" stroke-width="3"/>
                <ellipse cx="180" cy="50" rx="14" ry="16" fill="#09090b">
                    <animate attributeName="cx" values="180;174;186;180" dur="4s" repeatCount="indefinite"/>
                </ellipse>
                <circle cx="176" cy="46" r="4" fill="#ffffff">
                    <animate attributeName="cx" values="176;170;182;176" dur="4s" repeatCount="indefinite"/>
                </circle>
                <path d="M45,58 Q75,38 105,58 Q75,76 45,58 Z" fill="#ffffff"/><circle cx="75" cy="58" r="8" fill="#09090b"/><circle cx="73" cy="56" r="2.5" fill="#fff"/>
                <path d="M255,58 Q285,38 315,58 Q285,76 255,58 Z" fill="#ffffff"/><circle cx="285" cy="58" r="8" fill="#09090b"/><circle cx="283" cy="56" r="2.5" fill="#fff"/>
                <path d="M85,32 Q110,19 135,32 Q110,45 85,32 Z" fill="#ffffff"/><circle cx="110" cy="32" r="6" fill="#09090b"/>
                <path d="M225,32 Q250,19 275,32 Q250,45 225,32 Z" fill="#ffffff"/><circle cx="250" cy="32" r="6" fill="#09090b"/>
            </svg>
        `),
        bottomSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 85">
                <path d="M12,8 Q10,60 90,60 Q180,74 270,60 Q350,60 348,8 Q335,16 320,15 L40,15 Q25,16 12,8 Z" fill="#050505" stroke="#27272a" stroke-width="2"/>
                <path d="M70,35 Q105,20 140,35 Q105,50 70,35 Z" fill="#e4e4e7"/><circle cx="105" cy="35" r="7" fill="#09090b"/>
                <path d="M150,46 Q180,32 210,46 Q180,60 150,46 Z" fill="#e4e4e7"/><circle cx="180" cy="46" r="7" fill="#09090b"/>
                <path d="M225,35 Q260,20 295,35 Q260,50 225,35 Z" fill="#e4e4e7"/><circle cx="260" cy="35" r="7" fill="#09090b"/>
            </svg>
        `)
    },
    {
        id: 'abyss_dragon',
        name: 'เพลิงมังกรทมิฬ',
        price: 'FREE (VIP)',
        isNew: false,
        topSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 105">
                <path d="M10,92 Q35,22 110,42 L95,16 L145,38 Q180,12 215,38 L265,16 L250,42 Q325,22 350,92 Q335,82 320,82 L40,82 Q25,82 10,92 Z" fill="#450a0a" stroke="#ef4444" stroke-width="2"/>
                <polygon points="160,42 180,16 200,42 180,68" fill="#f97316"/>
                <circle cx="145" cy="56" r="6" fill="#fef08a"/><circle cx="215" cy="56" r="6" fill="#fef08a"/>
            </svg>
        `),
        bottomSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 85">
                <path d="M15,12 Q90,68 180,62 Q270,68 345,12 Q285,42 180,40 Q75,42 15,12 Z" fill="#450a0a" stroke="#ef4444" stroke-width="2"/>
            </svg>
        `)
    },
    {
        id: 'celestial_seraph',
        name: 'มหาเทวทูตสวรรค์นิรันดร์',
        price: 'LEGENDARY',
        isNew: false,
        topSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 105">
                <defs>
                    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#fef08a"/><stop offset="50%" stop-color="#eab308"/><stop offset="100%" stop-color="#a16207"/>
                    </linearGradient>
                    <linearGradient id="wingGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#ffffff"/><stop offset="70%" stop-color="#fef9c3"/><stop offset="100%" stop-color="#fde047"/>
                    </linearGradient>
                </defs>
                <circle cx="180" cy="54" r="36" fill="none" stroke="url(#goldGrad)" stroke-width="2" stroke-dasharray="6 4">
                    <animateTransform attributeName="transform" type="rotate" from="0 180 54" to="360 180 54" dur="12s" repeatCount="indefinite"/>
                </circle>
                <path d="M160,73 Q90,12 10,28 Q45,52 30,62 Q80,52 145,80 Z" fill="url(#wingGrad)" stroke="#eab308" stroke-width="1.5"/>
                <path d="M155,80 Q95,38 25,56 Q60,73 45,82 Q95,70 150,86 Z" fill="url(#wingGrad)" stroke="#ca8a04" stroke-width="1.5"/>
                <path d="M200,73 Q270,12 350,28 Q315,52 330,62 Q280,52 215,80 Z" fill="url(#wingGrad)" stroke="#eab308" stroke-width="1.5"/>
                <path d="M205,80 Q265,38 335,56 Q300,73 315,82 Q265,70 210,86 Z" fill="url(#wingGrad)" stroke="#ca8a04" stroke-width="1.5"/>
                <polygon points="180,14 188,40 215,48 188,56 180,82 172,56 145,48 172,40" fill="url(#goldGrad)" stroke="#ffffff" stroke-width="1.5">
                    <animate attributeName="opacity" values="1;0.75;1" dur="2s" repeatCount="indefinite"/>
                </polygon>
                <circle cx="180" cy="48" r="7" fill="#ffffff"/>
            </svg>
        `),
        bottomSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 85">
                <defs>
                    <linearGradient id="goldGradB" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#ca8a04"/><stop offset="50%" stop-color="#fef08a"/><stop offset="100%" stop-color="#ca8a04"/>
                    </linearGradient>
                </defs>
                <path d="M12,12 Q90,60 180,60 Q270,60 348,12 Q310,45 250,48 Q180,68 110,48 Q50,45 12,12 Z" fill="url(#goldGradB)" stroke="#ffffff" stroke-width="1.5"/>
                <polygon points="180,26 192,46 180,68 168,46" fill="#ffffff" stroke="#eab308" stroke-width="2"/>
            </svg>
        `)
    },
    {
        id: 'cyber_overdrive',
        name: 'จักรกลสังหารไซเบอร์ (Mecha Overdrive)',
        price: 'LEGENDARY',
        isNew: false,
        topSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 105">
                <polygon points="10,90 35,22 95,52 125,32 150,75 25,90" fill="#090d16" stroke="#06b6d4" stroke-width="2.5"/>
                <polygon points="350,90 325,22 265,52 235,32 210,75 335,90" fill="#090d16" stroke="#06b6d4" stroke-width="2.5"/>
                <polyline points="35,35 70,62 115,48" fill="none" stroke="#ec4899" stroke-width="2"/>
                <polyline points="325,35 290,62 245,48" fill="none" stroke="#ec4899" stroke-width="2"/>
                <polygon points="135,82 155,28 205,28 225,82" fill="#111827" stroke="#06b6d4" stroke-width="2.5"/>
                <rect x="150" y="46" width="60" height="10" rx="5" fill="#000000" stroke="#06b6d4" stroke-width="1"/>
                <circle cx="180" cy="51" r="5" fill="#ec4899">
                    <animate attributeName="cx" values="158;202;158" dur="1.6s" repeatCount="indefinite"/>
                </circle>
                <polygon points="168,28 180,8 192,28" fill="#06b6d4">
                    <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite"/>
                </polygon>
            </svg>
        `),
        bottomSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 85">
                <polygon points="15,12 65,60 140,50 180,68 220,50 295,60 345,12 300,28 180,38 60,28" fill="#090d16" stroke="#06b6d4" stroke-width="2"/>
                <polygon points="155,38 180,72 205,38" fill="#ec4899">
                    <animate attributeName="opacity" values="0.6;1;0.6" dur="0.5s" repeatCount="indefinite"/>
                </polygon>
            </svg>
        `)
    },
    {
        id: 'cosmic_singularity',
        name: 'จักรวาลหลุมดำมรณะ (Cosmic Void)',
        price: 'LEGENDARY',
        isNew: false,
        topSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 105">
                <defs>
                    <radialGradient id="voidCore" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stop-color="#000000"/><stop offset="55%" stop-color="#090514"/><stop offset="75%" stop-color="#a855f7"/><stop offset="90%" stop-color="#ec4899"/><stop offset="100%" stop-color="transparent"/>
                    </radialGradient>
                </defs>
                <path d="M10,92 Q30,32 100,48 Q140,18 180,22 Q220,18 260,48 Q330,32 350,92 Q270,65 180,72 Q90,65 10,92 Z" fill="#3b0764" stroke="#f472b6" stroke-width="1.5"/>
                <ellipse cx="180" cy="52" rx="65" ry="16" fill="none" stroke="#fde047" stroke-width="2.5" stroke-dasharray="18 8">
                    <animateTransform attributeName="transform" type="rotate" from="0 180 52" to="360 180 52" dur="10s" repeatCount="indefinite"/>
                </ellipse>
                <circle cx="180" cy="52" r="28" fill="url(#voidCore)" stroke="#ffffff" stroke-width="1"/>
                <circle cx="180" cy="52" r="15" fill="#000000" stroke="#f472b6" stroke-width="2"/>
            </svg>
        `),
        bottomSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 85">
                <path d="M15,12 Q90,68 180,62 Q270,68 345,12 Q290,45 180,45 Q70,45 15,12 Z" fill="#2e1065" stroke="#a855f7" stroke-width="2"/>
                <ellipse cx="180" cy="45" rx="45" ry="10" fill="#000000" stroke="#f472b6" stroke-width="1.5"/>
            </svg>
        `)
    },
    {
        id: 'thunder_shogun',
        name: 'จอมทัพอสนีบาต (Thunder Raijin)',
        price: 'LEGENDARY',
        isNew: false,
        topSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 105">
                <path d="M12,92 Q5,48 50,45 Q75,18 125,35 Q180,12 235,35 Q285,18 310,45 Q355,48 348,92 Q265,72 180,78 Q95,72 12,92 Z" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
                <path d="M115,68 Q85,22 55,16 Q75,48 95,72 Z" fill="#facc15" stroke="#ca8a04" stroke-width="2"/>
                <path d="M245,68 Q275,22 305,16 Q285,48 265,72 Z" fill="#facc15" stroke="#ca8a04" stroke-width="2"/>
                <circle cx="180" cy="50" r="22" fill="#1e1b4b" stroke="#facc15" stroke-width="3"/>
                <g>
                    <circle cx="180" cy="39" r="4.5" fill="#38bdf8"/><circle cx="170" cy="56" r="4.5" fill="#38bdf8"/><circle cx="190" cy="56" r="4.5" fill="#38bdf8"/>
                    <animateTransform attributeName="transform" type="rotate" from="0 180 50" to="360 180 50" dur="4s" repeatCount="indefinite"/>
                </g>
                <polyline points="40,28 65,52 52,55 85,84" fill="none" stroke="#7dd3fc" stroke-width="3" stroke-linecap="round">
                    <animate attributeName="opacity" values="1;0.1;1;0.8;0;1" dur="1.2s" repeatCount="indefinite"/>
                </polyline>
                <polyline points="320,28 295,52 308,55 275,84" fill="none" stroke="#7dd3fc" stroke-width="3" stroke-linecap="round">
                    <animate attributeName="opacity" values="0.1;1;0;1;0.8;0.1" dur="1.2s" repeatCount="indefinite"/>
                </polyline>
            </svg>
        `),
        bottomSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 85">
                <path d="M15,12 Q95,68 180,62 Q265,68 345,12 Q280,45 180,42 Q80,45 15,12 Z" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
                <polyline points="60,30 115,52 140,35 180,58 220,35 245,52 300,30" fill="none" stroke="#facc15" stroke-width="2.5">
                    <animate attributeName="opacity" values="1;0.3;1" dur="0.9s" repeatCount="indefinite"/>
                </polyline>
            </svg>
        `)
    },
    {
        id: 'orange_cat_hug',
        name: 'เหมียวส้มเกาะการ์ด (Nekobread)',
        price: 'LEGENDARY',
        isNew: true,
        topSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 105">
                <path d="M275,6 L278,14 L286,17 L278,20 L275,28 L272,20 L264,17 L272,14 Z" fill="#fef08a" stroke="#ca8a04" stroke-width="1">
                    <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite"/>
                </path>
                <path d="M292,14 L294,20 L300,22 L294,24 L292,30 L290,24 L284,22 L290,20 Z" fill="#ffffff" stroke="#ca8a04" stroke-width="1">
                    <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite"/>
                </path>
                <path d="M10,102 C2,88 4,72 14,65 C6,54 14,44 24,44 C20,24 30,16 50,19 C72,22 95,30 115,27 C155,22 205,22 245,27 C265,30 288,22 310,19 C330,16 340,24 336,44 C346,44 354,54 346,65 C356,72 358,88 350,102 Q342,82 325,80 L35,80 Q18,82 10,102 Z" fill="#fdba74" stroke="#9a3412" stroke-width="2.5" stroke-linejoin="round"/>
                <path d="M32,40 Q35,25 50,27 Q62,29 66,40 Z" fill="#fda4af" stroke="#e11d48" stroke-width="1"/>
                <path d="M328,40 Q325,25 310,27 Q298,29 294,40 Z" fill="#fda4af" stroke="#e11d48" stroke-width="1"/>
                <path d="M166,24 L168,36 M180,23 L180,38 M194,24 L192,36" stroke="#ea580c" stroke-width="4.5" stroke-linecap="round"/>
                <path d="M16,54 L34,56 M12,66 L30,67 M344,54 L326,56 M348,66 L330,67" stroke="#ea580c" stroke-width="4" stroke-linecap="round"/>
                <path d="M32,80 Q58,56 102,58 Q140,46 180,46 Q220,46 258,58 Q302,56 328,80 Q305,86 282,80 Q260,87 238,80 Q215,87 195,81 Q180,86 165,81 Q145,87 122,80 Q100,87 78,80 Q55,86 32,80 Z" fill="#fffbeb" stroke="#d97706" stroke-width="2"/>
                <circle cx="152" cy="48" r="5" fill="#78350f"/>
                <circle cx="208" cy="48" r="5" fill="#78350f"/>
                <path d="M168,50 Q174,57 180,50 Q186,57 192,50" fill="none" stroke="#78350f" stroke-width="2.8" stroke-linecap="round"/>
                <ellipse cx="130" cy="52" rx="12" ry="6" fill="#fda4af" opacity="0.7"/>
                <ellipse cx="230" cy="52" rx="12" ry="6" fill="#fda4af" opacity="0.7"/>
                <ellipse cx="86" cy="78" rx="22" ry="13" transform="rotate(-8 86 78)" fill="#fffbeb" stroke="#9a3412" stroke-width="2"/>
                <path d="M76,83 Q79,76 80,74 M86,85 Q88,77 88,75" stroke="#d97706" stroke-width="1.8" stroke-linecap="round"/>
                <ellipse cx="274" cy="78" rx="22" ry="13" transform="rotate(8 274 78)" fill="#fffbeb" stroke="#9a3412" stroke-width="2"/>
                <path d="M284,83 Q281,76 280,74 M274,85 Q272,77 272,75" stroke="#d97706" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M14,64 L17,71 L24,74 L17,77 L14,84 L11,77 L4,74 L11,71 Z" fill="#ffffff" stroke="#eab308" stroke-width="1"/>
            </svg>
        `),
        bottomSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 85">
                <path d="M12,4 C0,22 6,52 42,60 C110,74 225,60 312,70 C332,73 338,60 320,52 C240,42 120,54 52,42 C26,38 20,18 26,6 Z" fill="#fdba74" stroke="#9a3412" stroke-width="2.5" stroke-linejoin="round"/>
                <path d="M296,49 C310,50 320,52 325,56 C333,62 327,72 310,70 C302,69 296,68 292,67 Q299,58 296,49 Z" fill="#fffbeb" stroke="#9a3412" stroke-width="2"/>
                <path d="M45,42 L41,58 M75,45 L72,62 M105,47 L102,64 M135,48 L133,65 M165,48 L163,65 M195,48 L193,64 M225,48 L223,64 M255,48 L253,65 M282,49 L280,66" stroke="#ea580c" stroke-width="6" stroke-linecap="round"/>
                <path d="M38,56 L41,64 L49,67 L41,70 L38,78 L35,70 L27,67 L35,64 Z" fill="#fef08a" stroke="#ca8a04" stroke-width="1">
                    <animate attributeName="opacity" values="1;0.2;1" dur="1.8s" repeatCount="indefinite"/>
                </path>
                <path d="M342,34 L344,40 L350,42 L344,44 L342,50 L340,44 L334,42 L340,40 Z" fill="#ffffff" stroke="#ca8a04" stroke-width="1"/>
            </svg>
        `)
    },
    {
        id: 'solar_stained_glass',
        name: 'มงกุฎสุริยันกระจกสี (Solar Cathedral)',
        price: 'LEGENDARY',
        isNew: true,
        topSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 110">
                <defs>
                    <linearGradient id="sunGold" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#fef08a"/><stop offset="50%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#92400e"/>
                    </linearGradient>
                    <linearGradient id="stainedGlass" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#ea580c"/><stop offset="25%" stop-color="#f59e0b"/><stop offset="50%" stop-color="#fef08a"/><stop offset="75%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#ea580c"/>
                    </linearGradient>
                </defs>
                <g stroke="url(#sunGold)" stroke-width="2" fill="#fde047">
                    <line x1="90" y1="55" x2="48" y2="12"/><polygon points="48,12 58,16 52,22"/>
                    <line x1="72" y1="65" x2="25" y2="28"/><polygon points="25,28 35,30 30,37"/>
                    <line x1="270" y1="55" x2="312" y2="12"/><polygon points="312,12 302,16 308,22"/>
                    <line x1="288" y1="65" x2="335" y2="28"/><polygon points="335,28 325,30 330,37"/>
                </g>
                <path d="M24,84 Q85,14 180,14 Q275,14 336,84 Z" fill="url(#stainedGlass)" stroke="url(#sunGold)" stroke-width="3.5"/>
                <path d="M68,84 L100,38 M106,84 L132,24 M144,84 L160,18 M216,84 L200,18 M254,84 L228,24 M292,84 L260,38" stroke="#78350f" stroke-width="2"/>
                <path d="M46,84 Q110,30 180,30 Q250,30 314,84" fill="none" stroke="url(#sunGold)" stroke-width="3"/>
                <path d="M10,108 L10,90 Q10,82 20,82 L340,82 Q350,82 350,90 L350,108" fill="none" stroke="url(#sunGold)" stroke-width="5"/>
                <path d="M14,108 L14,91 Q14,85 22,85 L338,85 Q346,85 346,91 L346,108" fill="none" stroke="#fef08a" stroke-width="1.5"/>
                <path d="M110,50 Q145,70 180,56 Q215,70 250,50" fill="none" stroke="#fef08a" stroke-width="1.5" stroke-dasharray="3 3"/>
                <circle cx="132" cy="59" r="3" fill="#ffffff"/><circle cx="228" cy="59" r="3" fill="#ffffff"/>
                <circle cx="154" cy="62" r="3.5" fill="#ffffff"/><circle cx="206" cy="62" r="3.5" fill="#ffffff"/>
                <circle cx="180" cy="40" r="24" fill="#451a03" stroke="url(#sunGold)" stroke-width="4"/>
                <circle cx="180" cy="40" r="18" fill="#fbbf24" stroke="#fef08a" stroke-width="1.5"/>
                <path d="M166,34 A16,16 0 1,0 194,34 A14,12 0 1,1 166,34 Z" fill="#d97706"/>
                <polygon points="180,24 183,36 195,39 183,42 180,54 177,42 165,39 177,36" fill="#ffffff"/>
                <polygon points="180,68 185,75 180,82 175,75" fill="#f97316" stroke="#fef08a" stroke-width="1.2"/>
            </svg>
        `),
        bottomSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 85">
                <defs>
                    <linearGradient id="sunGoldB" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#92400e"/><stop offset="50%" stop-color="#fef08a"/><stop offset="100%" stop-color="#92400e"/>
                    </linearGradient>
                </defs>
                <path d="M42,15 Q180,82 318,15 Z" fill="#ea580c" stroke="url(#sunGoldB)" stroke-width="3.5"/>
                <path d="M75,15 Q180,66 285,15 Z" fill="#f59e0b" stroke="#fef08a" stroke-width="2"/>
                <line x1="115" y1="15" x2="138" y2="55" stroke="#78350f" stroke-width="2"/>
                <line x1="245" y1="15" x2="222" y2="55" stroke="#78350f" stroke-width="2"/>
                <path d="M10,0 L10,10 Q10,16 20,16 L340,16 Q350,16 350,10 L350,0" fill="none" stroke="url(#sunGoldB)" stroke-width="5"/>
                <polygon points="5,2 10,9 5,16 0,9" fill="#f97316" stroke="#fef08a" stroke-width="1.2"/>
                <polygon points="355,2 360,9 355,16 350,9" fill="#f97316" stroke="#fef08a" stroke-width="1.2"/>
                <circle cx="108" cy="34" r="11" fill="#271206" stroke="#fef08a" stroke-width="2.5"/>
                <circle cx="108" cy="34" r="4" fill="#ffffff"/>
                <circle cx="252" cy="34" r="11" fill="#271206" stroke="#fef08a" stroke-width="2.5"/>
                <circle cx="252" cy="34" r="4" fill="#ffffff"/>
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
        topSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 105">
                <defs>
                    <linearGradient id="hellFlame" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stop-color="#be123c"/><stop offset="60%" stop-color="#f43f5e"/><stop offset="100%" stop-color="#fda4af"/>
                    </linearGradient>
                    <linearGradient id="skullBone" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#d1d5db"/><stop offset="60%" stop-color="#6b7280"/><stop offset="100%" stop-color="#1f2937"/>
                    </linearGradient>
                </defs>
                <path d="M6,102 Q2,65 18,58 Q14,38 35,50 Q42,28 65,45 Q80,18 105,38 Q125,10 148,30 Q165,4 180,20 Q195,4 212,30 Q235,10 255,38 Q280,18 295,45 Q318,28 325,50 Q346,38 342,58 Q358,65 354,102 Q345,84 335,82 L25,82 Q15,84 6,102 Z" fill="url(#hellFlame)" opacity="0.9">
                    <animate attributeName="opacity" values="0.95;0.75;0.95" dur="1.4s" repeatCount="indefinite"/>
                </path>
                <path d="M10,100 L12,76 L348,76 L350,100 L342,83 L18,83 Z" fill="#4b5563" stroke="#111827" stroke-width="2"/>
                <g fill="url(#skullBone)" stroke="#111827" stroke-width="1.8">
                    <ellipse cx="95" cy="64" rx="13" ry="14"/><rect x="89" y="72" width="12" height="6" rx="2"/>
                    <ellipse cx="265" cy="64" rx="13" ry="14"/><rect x="259" y="72" width="12" height="6" rx="2"/>
                    <ellipse cx="120" cy="60" rx="15" ry="16"/><rect x="113" y="70" width="14" height="7" rx="2"/>
                    <ellipse cx="240" cy="60" rx="15" ry="16"/><rect x="233" y="70" width="14" height="7" rx="2"/>
                    <ellipse cx="148" cy="56" rx="17" ry="19"/><rect x="139" y="68" width="18" height="9" rx="2"/>
                    <ellipse cx="212" cy="56" rx="17" ry="19"/><rect x="203" y="68" width="18" height="9" rx="2"/>
                </g>
                <path d="M160,58 C156,38 164,26 172,28 L176,38 L184,26 C194,26 204,38 200,58 L194,78 L166,78 Z" fill="url(#skullBone)" stroke="#09090b" stroke-width="2.2"/>
                <path d="M172,72 L172,78 M180,72 L180,79 M188,72 L188,78" stroke="#09090b" stroke-width="2"/>
                <g fill="#f43f5e">
                    <circle cx="91" cy="64" r="2.5"/><circle cx="99" cy="64" r="2.5"/>
                    <circle cx="115" cy="60" r="3"/><circle cx="125" cy="60" r="3"/>
                    <circle cx="142" cy="57" r="3.5"/><circle cx="153" cy="57" r="3.5"/>
                    <circle cx="207" cy="57" r="3.5"/><circle cx="218" cy="57" r="3.5"/>
                    <circle cx="235" cy="60" r="3"/><circle cx="245" cy="60" r="3"/>
                    <circle cx="261" cy="64" r="2.5"/><circle cx="269" cy="64" r="2.5"/>
                    <circle cx="171" cy="56" r="4.5"/><circle cx="189" cy="56" r="4.5"/>
                    <animate attributeName="opacity" values="1;0.4;1" dur="1.1s" repeatCount="indefinite"/>
                </g>
                <polygon points="178,62 182,62 180,68" fill="#09090b"/>
            </svg>
        `),
        bottomSvg: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 75">
                <defs>
                    <linearGradient id="hellFlameB" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#be123c"/><stop offset="55%" stop-color="#f43f5e"/><stop offset="100%" stop-color="#fda4af"/>
                    </linearGradient>
                </defs>
                <path d="M8,2 Q4,28 22,25 Q25,48 42,30 Q55,54 72,32 Q90,58 110,32 Q130,54 150,31 Q172,60 185,32 Q205,54 225,31 Q248,62 262,32 Q285,54 302,30 Q322,50 335,25 Q356,28 352,2 Q342,15 330,14 L30,14 Q18,15 8,2 Z" fill="url(#hellFlameB)">
                    <animate attributeName="opacity" values="0.95;0.7;0.95" dur="1.2s" repeatCount="indefinite"/>
                </path>
            </svg>
        `)
    }
    
];

const shopThemes = [
    { name: 'Dark Obsidian (ค่าเริ่มต้น)', bg: 'rgba(17, 18, 20, 0.90)' },
    { name: 'Royal Purple (ม่วงจักรพรรดิ)', bg: 'linear-gradient(145deg, rgba(46,16,101,0.95) 0%, rgba(17,18,20,0.95) 100%)' },
    { name: 'Crimson Blood (แดงแอดมิน)', bg: 'linear-gradient(145deg, rgba(127,29,29,0.95) 0%, rgba(17,18,20,0.95) 100%)' },
    { name: 'Cyber Ocean (น้ำเงินนีออน)', bg: 'linear-gradient(145deg, rgba(12,74,110,0.95) 0%, rgba(17,18,20,0.95) 100%)' },
    { name: 'Emerald Forest (เขียวมรกต)', bg: 'linear-gradient(145deg, rgba(6,78,59,0.95) 0%, rgba(17,18,20,0.95) 100%)' },
    { name: 'Sunset Gold (ทองอัสดง)', bg: 'linear-gradient(145deg, rgba(120,53,15,0.95) 0%, rgba(17,18,20,0.95) 100%)' },
    { name: 'Cyber Grid (ลายตารางไซเบอร์)', bg: 'linear-gradient(rgba(6, 182, 212, 0.12) 1px, transparent 1px) 0 0 / 18px 18px, linear-gradient(90deg, rgba(6, 182, 212, 0.12) 1px, transparent 1px) 0 0 / 18px 18px, linear-gradient(145deg, #082f49 0%, #090d16 100%)' },
    { name: 'Luxury Diamond (ลายเพชรทองคำ)', bg: 'repeating-linear-gradient(135deg, rgba(234, 179, 8, 0.08) 0px, rgba(234, 179, 8, 0.08) 2px, transparent 2px, transparent 12px), repeating-linear-gradient(45deg, rgba(234, 179, 8, 0.08) 0px, rgba(234, 179, 8, 0.08) 2px, transparent 2px, transparent 12px), linear-gradient(145deg, #422006 0%, #111214 100%)' },
    { name: 'Crimson Hazard (ลายเฉียงแอดมิน)', bg: 'repeating-linear-gradient(-45deg, rgba(239, 68, 68, 0.10) 0px, rgba(239, 68, 68, 0.10) 10px, transparent 10px, transparent 20px), radial-gradient(circle at top right, rgba(220, 38, 38, 0.35), transparent 60%), linear-gradient(145deg, #450a0a 0%, #111214 100%)' },
    { name: 'Starry Pink (ลายจุดพิกเซลชมพู)', bg: 'radial-gradient(rgba(244, 114, 182, 0.22) 1.5px, transparent 1.5px) 0 0 / 14px 14px, linear-gradient(145deg, #500724 0%, #111214 100%)' },
    { name: 'Royal Carbon (ลายคาร์บอนม่วง)', bg: 'repeating-linear-gradient(45deg, rgba(168, 85, 247, 0.07) 0px, rgba(168, 85, 247, 0.07) 6px, transparent 6px, transparent 12px), linear-gradient(145deg, #3b0764 0%, #111214 100%)' },
    { name: 'Emerald Matrix (ลายดิจิทัลเรืองแสง)', bg: 'radial-gradient(rgba(16, 185, 129, 0.22) 1px, transparent 1px) 0 0 / 12px 12px, radial-gradient(circle at bottom left, rgba(5, 150, 105, 0.3), transparent 70%), linear-gradient(145deg, #022c22 0%, #111214 100%)' },
    { name: 'Synthwave Retro (ลายคลื่นเรโทร)', bg: 'repeating-linear-gradient(0deg, rgba(236, 72, 153, 0.10) 0px, rgba(236, 72, 153, 0.10) 1px, transparent 1px, transparent 6px), radial-gradient(circle at 50% 0%, rgba(168, 85, 247, 0.45), transparent 70%), linear-gradient(180deg, #2e1065 0%, #090d16 100%)' },
    { name: 'Checkerboard Dark (ลายหมากรุกโมเดิร์น)', bg: 'repeating-conic-gradient(rgba(255, 255, 255, 0.03) 0% 25%, transparent 0% 50%) 0 0 / 24px 24px, linear-gradient(145deg, #1e1b4b 0%, #0f172a 100%)' }
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

// 🌟 แยกฟังก์ชัน equipVoiceBanner ให้อยู่นอกสุดอย่างถูกต้อง
window.equipVoiceBanner = async (bannerUrlValue, bannerName) => {
    if (!currentUserId) return;
    try {
        await updateDoc(doc(db, "users", currentUserId), {
            voiceBannerURL: bannerUrlValue
        });
        showToast(`ตั้งค่าแบนเนอร์ห้องเสียง "${bannerName}" เรียบร้อย! ✨`, "success");
    } catch (e) {
        showToast("เกิดข้อผิดพลาดในการตั้งค่าแบนเนอร์ห้องเสียง", "error");
    }
};

// 🌟 ประกาศตัวแปร shopVoiceBanners ไว้ข้างนอกฟังก์ชัน renderHiveShop
const shopVoiceBanners = [
    { name: 'ถอดแบนเนอร์ห้องเสียง', url: '' },
    { 
        name: 'Inferno Fire Banner (ไฟโลกันตร์)', 
        url: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 375">
                <defs>
                    <linearGradient id="bgFire" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stop-color="#450a0a"/><stop offset="50%" stop-color="#7f1d1d"/><stop offset="100%" stop-color="#18181b"/>
                    </linearGradient>
                    <linearGradient id="flameGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stop-color="#ea580c"/><stop offset="50%" stop-color="#f97316"/><stop offset="100%" stop-color="#fde047"/>
                    </linearGradient>
                </defs>
                <rect width="1200" height="375" fill="url(#bgFire)"/>
                <g fill="url(#flameGrad)">
                    <path d="M1200,375 Q1150,250 1180,180 Q1120,220 1100,120 Q1060,200 1020,150 Q980,280 1050,375 Z" opacity="0.9">
                        <animate attributeName="d" values="M1200,375 Q1150,250 1180,180 Q1120,220 1100,120 Q1060,200 1020,150 Q980,280 1050,375 Z;M1200,375 Q1160,230 1170,160 Q1130,200 1090,100 Q1050,180 1010,130 Q970,260 1050,375 Z;M1200,375 Q1150,250 1180,180 Q1120,220 1100,120 Q1060,200 1020,150 Q980,280 1050,375 Z" dur="1.8s" repeatCount="indefinite"/>
                    </path>
                </g>
                <g fill="#fef08a">
                    <circle cx="1050" cy="200" r="4"><animate attributeName="cy" values="200;80;20" dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0;1" dur="1.5s" repeatCount="indefinite"/></circle>
                    <circle cx="1120" cy="160" r="3" fill="#ea580c"><animate attributeName="cy" values="160;60;10" dur="1.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0;1" dur="1.2s" repeatCount="indefinite"/></circle>
                </g>
            </svg>
        `) 
    },
    { 
        name: 'Thunder Raijin (อสนีบาตฟาดสายฟ้า)', 
        url: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 375">
                <defs>
                    <linearGradient id="bgThunder" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#0f172a"/><stop offset="50%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#020617"/>
                    </linearGradient>
                    <linearGradient id="boltGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#facc15"/>
                    </linearGradient>
                </defs>
                <rect width="1200" height="375" fill="url(#bgThunder)"/>
                <!-- เส้นสายฟ้าวิ่งบริเวณมุมขวา -->
                <g stroke="url(#boltGrad)" stroke-width="4" fill="none" stroke-linejoin="round">
                    <polyline points="1050,0 1010,140 1060,150 1000,375">
                        <animate attributeName="opacity" values="1;0.1;1;0.8;0;1" dur="0.8s" repeatCount="indefinite"/>
                    </polyline>
                    <polyline points="1150,20 1100,180 1140,190 1080,350" stroke="#38bdf8" stroke-width="2">
                        <animate attributeName="opacity" values="0.2;1;0;0.9;0.3" dur="1.1s" repeatCount="indefinite"/>
                    </polyline>
                </g>
                <!-- ประกายออร่าไฟฟ้าช็อต -->
                <circle cx="1030" cy="140" r="25" fill="#38bdf8" opacity="0.2">
                    <animate attributeName="r" values="15;35;15" dur="0.8s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0.4;0;0.4" dur="0.8s" repeatCount="indefinite"/>
                </circle>
            </svg>
        `) 
    },
    { 
        name: 'Cyberpunk Neon Wave (นีออนไซเบอร์)', 
        url: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 375">
                <defs>
                    <linearGradient id="bgCyber" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#2e1065"/><stop offset="50%" stop-color="#831843"/><stop offset="100%" stop-color="#090d16"/>
                    </linearGradient>
                    <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#ec4899"/><stop offset="50%" stop-color="#06b6d4"/><stop offset="100%" stop-color="#a855f7"/>
                    </linearGradient>
                </defs>
                <rect width="1200" height="375" fill="url(#bgCyber)"/>
                <!-- คลื่นนีออนพริ้วไหว -->
                <path d="M0,250 Q300,320 600,220 T1200,200 L1200,375 L0,375 Z" fill="#06b6d4" opacity="0.25">
                    <animate attributeName="d" values="M0,250 Q300,320 600,220 T1200,200 L1200,375 L0,375 Z;M0,220 Q300,180 600,280 T1200,240 L1200,375 L0,375 Z;M0,250 Q300,320 600,220 T1200,200 L1200,375 L0,375 Z" dur="4s" repeatCount="indefinite"/>
                </path>
                <path d="M0,280 Q400,180 800,280 T1200,250 L1200,375 L0,375 Z" fill="url(#neonGrad)" opacity="0.35">
                    <animate attributeName="d" values="M0,280 Q400,180 800,280 T1200,250 L1200,375 L0,375 Z;M0,240 Q400,320 800,200 T1200,270 L1200,375 L0,375 Z;M0,280 Q400,180 800,280 T1200,250 L1200,375 L0,375 Z" dur="3s" repeatCount="indefinite"/>
                </path>
            </svg>
        `) 
    },
    { 
        name: 'Cosmic Void (ห้วงอวกาศหลุมดำ)', 
        url: svgToUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 375">
                <defs>
                    <radialGradient id="spaceBg" cx="80%" cy="50%" r="60%">
                        <stop offset="0%" stop-color="#3b0764"/><stop offset="50%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#050505"/>
                    </radialGradient>
                    <radialGradient id="blackHole" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stop-color="#000000"/><stop offset="70%" stop-color="#a855f7"/><stop offset="100%" stop-color="transparent"/>
                    </radialGradient>
                </defs>
                <rect width="1200" height="375" fill="url(#spaceBg)"/>
                <!-- วงแหวนกาแล็กซีหมุนรอบหลุมดำ -->
                <g transform="translate(1050, 187)">
                    <ellipse cx="0" cy="0" rx="120" ry="35" fill="none" stroke="#f472b6" stroke-width="4" stroke-dasharray="25 10" transform="rotate(-25)">
                        <animateTransform attributeName="transform" type="rotate" from="-25 0 0" to="335 0 0" dur="8s" repeatCount="indefinite"/>
                    </ellipse>
                    <ellipse cx="0" cy="0" rx="90" ry="25" fill="none" stroke="#38bdf8" stroke-width="3" transform="rotate(15)">
                        <animateTransform attributeName="transform" type="rotate" from="15 0 0" to="-345 0 0" dur="5s" repeatCount="indefinite"/>
                    </ellipse>
                    <circle cx="0" cy="0" r="35" fill="url(#blackHole)" stroke="#ffffff" stroke-width="1.5"/>
                </g>
                <!-- ดวงดาวระยิบระยับ -->
                <g fill="#ffffff">
                    <circle cx="200" cy="80" r="2"><animate attributeName="opacity" values="0.2;1;0.2" dur="1.5s" repeatCount="indefinite"/></circle>
                    <circle cx="500" cy="120" r="1.5"><animate attributeName="opacity" values="1;0.2;1" dur="2s" repeatCount="indefinite"/></circle>
                    <circle cx="800" cy="60" r="2.5"><animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite"/></circle>
                    <circle cx="350" cy="280" r="2"><animate attributeName="opacity" values="0.8;0.1;0.8" dur="1.8s" repeatCount="indefinite"/></circle>
                </g>
            </svg>
        `) 
    },
    { name: 'Cyberpunk City (GIF)', url: 'https://media.giphy.com/media/l0HlHFRbmaZtBRhXG/giphy.gif' },
    { name: 'Galaxy Nebula (GIF)', url: 'https://media.giphy.com/media/3o7buijTqhjxjbEqjK/giphy.gif' }
];

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
        const mainBannersHTML = shopBanners.map(b => `
            <div class="bg-[#2b2d31] border border-white/5 hover:border-purple-500 rounded-2xl overflow-hidden flex flex-col transition shadow-md">
                <div class="h-24 bg-black relative">
                    <img src="${b.url}" class="w-full h-full object-cover">
                    <span class="absolute top-2 right-2 bg-black/60 text-pink-400 text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm">PRESET</span>
                </div>
                <div class="p-3.5 flex items-center justify-between">
                    <span class="font-bold text-white text-[13px] truncate mr-2">${b.name}</span>
                    <button onclick="equipShopItem('banner', '${b.url}', '${b.name}')" class="bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition flex-shrink-0">
                        ใช้ภาพปกนี้
                    </button>
                </div>
            </div>
        `).join('');

        const voiceBannersHTML = shopVoiceBanners.map(b => `
            <div class="bg-[#2b2d31] border border-white/5 hover:border-[#23a559] rounded-2xl overflow-hidden flex flex-col transition shadow-md">
                <div class="h-24 bg-black relative flex items-center justify-center">
                    ${b.url ? `<img src="${b.url}" class="w-full h-full object-cover">` : `<span class="text-xs text-gray-400">ไม่มีแบนเนอร์</span>`}
                    <span class="absolute top-2 right-2 bg-[#23a559]/80 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm">VOICE BANNER</span>
                </div>
                <div class="p-3.5 flex items-center justify-between">
                    <span class="font-bold text-white text-[13px] truncate mr-2">${b.name}</span>
                    <button onclick="equipVoiceBanner('${b.url}', '${b.name}')" class="bg-[#23a559] hover:bg-[#1e8e4c] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition flex-shrink-0">
                        ตั้งเป็นแบนเนอร์ห้องเสียง
                    </button>
                </div>
            </div>
        `).join('');

        bannersGrid.innerHTML = voiceBannersHTML + mainBannersHTML;
    }

    if (themesGrid) {
        const decoCardsHTML = shopDecos.map(d => `
            <div onclick="equipShopItem('deco', '${d.id}', '${d.name}')" class="bg-[#18191c] hover:bg-[#1e1f24] border border-white/10 hover:border-white/30 rounded-2xl p-5 flex flex-col justify-between relative cursor-pointer transition-all duration-300 group min-h-[300px] shadow-xl">
                ${d.isNew ? `<span class="absolute top-4 left-4 bg-white text-black text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow z-30">NEW</span>` : ''}
                
                <div class="my-auto mx-auto w-[155px] h-[165px] bg-[#232428] rounded-xl relative shadow-2xl border border-white/5 flex flex-col group-hover:scale-105 transition-transform duration-300 mt-10 mb-7">
                    ${d.topSvg ? `<img src="${d.topSvg}" class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[78%] w-[106%] max-w-none pointer-events-none z-20">` : ''}
                    ${d.bottomSvg ? `<img src="${d.bottomSvg}" class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[82%] w-[106%] max-w-none pointer-events-none z-20">` : ''}
                    
                    <div class="h-12 bg-[#35373c] rounded-t-xl w-full"></div>
                    <div class="px-3 pt-5 pb-3 flex-1 flex flex-col relative">
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
                    <div class="pr-2">
                        <p class="font-bold text-white text-[14px] leading-snug">${d.name}</p>
                        <p class="font-extrabold text-[#dbdee1] text-[12px] mt-0.5">${d.price}</p>
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