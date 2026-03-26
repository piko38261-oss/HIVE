import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 🚨 1. ตั้งค่า Firebase & API ต่างๆ
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBNsG-gdNHZzIerTyd33fIwblwccktfU9I",
    authDomain: "apoko-hq.firebaseapp.com",
    projectId: "apoko-hq",
    storageBucket: "apoko-hq.firebasestorage.app",
    messagingSenderId: "122632343459",
    appId: "1:122632343459:web:c225aaff8464f1b0c35416"
};
const app = initializeApp(firebaseConfig); const auth = getAuth(app); const db = getFirestore(app);
const IMGBB_API_KEY = "6b400d48dc08e690c88a8b32f3cef56a"; const AGORA_APP_ID = "8d7eec85ee1949d491e1dc191f265ed2"; 

const rtcClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
let localTracks = { audioTrack: null }, screenTrack = null, screenAudioTrack = null;
let isMuted = false, isSharingScreen = false, myNumericUid = null, currentUserId = null, currentUsername = "Guest", activeChannel = "general", currentUserRole = "Member"; 
let allMessages = [], usersData = {}, typingTimeout = null, isTyping = false;

const sfxMsg = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
sfxMsg.volume = 0.5;

// 🔍 ระบบ Lightbox (ซูมรูปภาพ)
const lightbox = document.createElement('div');
lightbox.className = 'fixed inset-0 bg-black/95 z-[100] hidden flex items-center justify-center opacity-0 transition-opacity duration-300 cursor-zoom-out p-4';
lightbox.innerHTML = `<img id="lightbox-img" src="" class="max-w-full max-h-full object-contain rounded-lg shadow-2xl scale-95 transition-transform duration-300"><button class="absolute top-6 right-6 text-white hover:text-gray-300 transition"><i class="ph ph-x text-[32px]"></i></button>`;
document.body.appendChild(lightbox);

window.openLightbox = (url) => {
    document.getElementById('lightbox-img').src = url;
    lightbox.classList.remove('hidden'); void lightbox.offsetWidth;
    lightbox.classList.remove('opacity-0'); document.getElementById('lightbox-img').classList.replace('scale-95', 'scale-100');
};
lightbox.onclick = () => {
    lightbox.classList.add('opacity-0'); document.getElementById('lightbox-img').classList.replace('scale-100', 'scale-95');
    setTimeout(() => lightbox.classList.add('hidden'), 300);
};

// ==========================================
// 🌟 2. ระบบ Navigation & UI
// ==========================================
const views = { chat: document.getElementById('view-chat'), board: document.getElementById('view-board'), voice: document.getElementById('view-voice'), whiteboard: document.getElementById('view-whiteboard') };
const membersSidebar = document.getElementById('members-sidebar'), sidebar = document.getElementById('sidebar'), overlay = document.getElementById('overlay');

document.querySelectorAll('.open-menu, #open-members-voice').forEach(btn => btn.onclick = () => { sidebar.classList.add('open'); overlay.classList.add('active'); });
document.getElementById('close-menu').onclick = () => { sidebar.classList.remove('open'); overlay.classList.remove('active'); };
document.getElementById('open-members').onclick = () => { membersSidebar.classList.remove('translate-x-full'); overlay.classList.add('active'); };
document.getElementById('close-members').onclick = () => { membersSidebar.classList.add('translate-x-full'); overlay.classList.remove('active'); };
overlay.onclick = () => { sidebar.classList.remove('open'); membersSidebar.classList.add('translate-x-full'); overlay.classList.remove('active'); };

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.onclick = (e) => {
        e.preventDefault(); const view = btn.getAttribute('data-view'); if(!view) return; 
        if (isTyping && currentUserId) { isTyping = false; clearTimeout(typingTimeout); updateDoc(doc(db, "users", currentUserId), { isTyping: false }); }
        document.querySelectorAll('.nav-btn').forEach(b => { b.classList.remove('channel-active', 'text-[#e4e5e7]'); b.classList.add('channel-inactive', 'text-[#80848e]'); });
        btn.classList.remove('channel-inactive', 'text-[#80848e]'); btn.classList.add('channel-active', 'text-[#e4e5e7]');
        Object.values(views).forEach(v => v.classList.add('hidden')); views[view].classList.remove('hidden');
        if (view === 'chat' || view === 'voice') { membersSidebar.classList.remove('hidden', 'md:hidden'); if (view === 'chat') { activeChannel = btn.getAttribute('data-channel'); document.getElementById('chat-header-title').textContent = btn.getAttribute('data-name'); renderMessages(); } } else { membersSidebar.classList.add('hidden', 'md:hidden'); }
        if (view === 'whiteboard') setTimeout(initCanvasSize, 100);
        sidebar.classList.remove('open'); overlay.classList.remove('active');
    };
});

// ==========================================
// 🟢 3. โหลดรายชื่อผู้ใช้งาน
// ==========================================
onSnapshot(collection(db, "users"), (snapshot) => {
    const membersList = document.getElementById('members-list'), voiceActiveList = document.getElementById('voice-active-users'), voiceGrid = document.getElementById('voice-grid'), typingIndicator = document.getElementById('typing-indicator');
    membersList.innerHTML = ''; if (voiceActiveList) voiceActiveList.innerHTML = ''; let voiceGridHTML = '', usersInVoiceCount = 0, peopleTyping = [];
    document.getElementById('member-count').textContent = snapshot.size; usersData = {}; 

    snapshot.forEach((docSnap) => {
        const u = docSnap.data(), id = docSnap.id, userName = u.username || 'Unknown';
        const userAvatar = u.photoURL || `https://ui-avatars.com/api/?name=${userName}&background=5865F2&color=fff&rounded=true&bold=true`;
        usersData[userName] = { avatar: userAvatar, id: id, agoraUid: u.agoraUid }; 
        if (u.isTyping && u.typingChannel === activeChannel && id !== currentUserId) peopleTyping.push(userName);

        const isOnline = u.status === 'online', statusColor = isOnline ? 'bg-[#23a559]' : 'bg-[#5c6069]';
        const roleDisplay = u.role === 'Admin' ? `<span class="text-[#da373c] font-extrabold ml-1.5 text-[9px] md:text-[10px] bg-[#da373c]/10 px-1.5 py-0.5 rounded uppercase">Admin</span>` : '';
        const nameStyle = u.role === 'Banned' ? 'line-through text-[#da373c]' : (isOnline ? 'text-[#d1d3d6]' : 'text-[#6d717a]');
        const muteIconSmall = u.isMuted ? '<i class="ph-fill ph-microphone-slash text-[#da373c] ml-auto text-[14px]"></i>' : '';
        const muteIconLarge = u.isMuted ? '<div class="absolute -bottom-1 -right-1 bg-[#151619] rounded-full p-1.5 border-2 border-[#0e0f11] shadow-sm flex items-center justify-center"><i class="ph-fill ph-microphone-slash text-[#da373c] text-[14px]"></i></div>' : '';
        const screenBadgeSmall = u.isSharingScreen ? '<span class="ml-2 text-[9px] bg-[#5865F2] text-white px-1.5 py-0.5 rounded flex items-center font-bold tracking-wider"><i class="ph-fill ph-screencast mr-1"></i>LIVE</span>' : '';
        const screenBadgeGrid = u.isSharingScreen ? '<div class="absolute top-0 right-0 bg-[#5865F2] text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg rounded-tr-xl flex items-center animate-pulse"><i class="ph-fill ph-screencast mr-1"></i>LIVE</div>' : '';

        membersList.insertAdjacentHTML('beforeend', `<div class="flex items-center space-x-3 cursor-pointer p-2 rounded-md hover:bg-[#1c1d21] hover:text-[#e4e5e7] transition group ${!isOnline ? 'opacity-50' : ''}"><div class="relative flex-shrink-0"><img id="img-avatar-${id}" src="${userAvatar}" class="w-8 h-8 rounded-full object-cover opacity-90"><div class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${statusColor} rounded-full border-[3px] border-[#151619]"></div></div><div class="overflow-hidden flex-1 flex items-center"><p class="text-[14px] font-medium truncate ${nameStyle}">${userName} ${roleDisplay}</p></div></div>`);
        if (u.inVoice && voiceActiveList) voiceActiveList.insertAdjacentHTML('beforeend', `<div class="flex items-center space-x-2.5 text-[13px] text-[#80848e] py-1 px-2 hover:bg-[#1c1d21] hover:text-[#dbdee1] rounded-md transition cursor-pointer ml-2"><div class="relative flex-shrink-0"><img id="img-sidebar-voice-${id}" src="${userAvatar}" class="w-6 h-6 rounded-full object-cover opacity-90"></div><span class="truncate font-medium flex-1 flex items-center">${userName} ${screenBadgeSmall}</span>${muteIconSmall}</div>`);
        if (u.inVoice) { usersInVoiceCount++; voiceGridHTML += `<div class="bg-[#151619] rounded-xl p-4 md:p-6 flex flex-col items-center justify-center relative shadow-lg border border-[#1e1f22] h-auto min-h-[130px] animate-[fadeIn_0.3s_ease-out]">${screenBadgeGrid}<div class="relative mb-2 flex-shrink-0"><img id="img-grid-voice-${id}" src="${userAvatar}" class="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover bg-gray-900 border-[3px] border-transparent shadow-md">${muteIconLarge}</div><p class="font-bold text-[#e4e5e7] text-[13px] md:text-[15px] truncate w-full text-center mt-auto">${userName}</p></div>`; }
    });

    if (typingIndicator) { if (peopleTyping.length > 0) { typingIndicator.innerHTML = `<i class="ph-fill ph-chat-teardrop-dots mr-1.5 animate-bounce"></i> ${peopleTyping.join(', ')} กำลังพิมพ์...`; typingIndicator.classList.remove('opacity-0'); } else { typingIndicator.classList.add('opacity-0'); } }
    if (voiceGrid) { if (usersInVoiceCount > 0) { voiceGrid.innerHTML = voiceGridHTML; } else { voiceGrid.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center mt-20 md:mt-32 text-[#6d717a]"><div class="w-20 h-20 md:w-24 md:h-24 bg-[#151619] rounded-full flex items-center justify-center mb-4 border border-[#1e1f22]"><i class="ph ph-users-three text-[40px] opacity-40"></i></div><p class="font-bold text-base text-[#949ba4]">ไม่มีใครอยู่ในห้องเสียง</p></div>`; } }
    renderMessages();
});

// ==========================================
// 🎨 4. ตั้งค่ารูปโปรไฟล์ 
// ==========================================
const settingsModal = document.getElementById('settings-modal'), avatarInput = document.getElementById('settings-avatar-input'), statusTxt = document.getElementById('settings-status');
document.getElementById('open-settings-btn').onclick = document.getElementById('mini-profile-btn').onclick = (e) => { e.preventDefault(); document.getElementById('settings-avatar-preview').src = document.getElementById('current-user-avatar').src; document.getElementById('settings-username-display').textContent = currentUsername; settingsModal.classList.remove('hidden'); sidebar.classList.remove('open'); overlay.classList.remove('active'); };
document.getElementById('close-settings-btn').onclick = () => { settingsModal.classList.add('hidden'); statusTxt.textContent = ""; };
document.getElementById('settings-avatar-wrapper').onclick = () => avatarInput.click();

avatarInput.onchange = async (e) => {
    const f = e.target.files[0]; if(!f) return;
    statusTxt.className = "text-yellow-500 text-[12px] font-medium h-4 transition-all"; statusTxt.textContent = "กำลังอัปโหลดรูปภาพ... ⏳";
    document.getElementById('settings-avatar-wrapper').classList.add('opacity-50', 'pointer-events-none');
    try { const fd = new FormData(); fd.append("image", f); const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: fd }); const r = await res.json(); if (r.success) { await updateProfile(auth.currentUser, { photoURL: r.data.url }); await updateDoc(doc(db, "users", currentUserId), { photoURL: r.data.url }); document.getElementById('settings-avatar-preview').src = r.data.url; document.getElementById('current-user-avatar').src = r.data.url; statusTxt.className = "text-[#23a559] text-[12px] font-medium h-4 transition-all"; statusTxt.textContent = "เปลี่ยนรูปโปรไฟล์สำเร็จ! ✅"; setTimeout(() => statusTxt.textContent = "", 3000); } } catch(err) { statusTxt.className = "text-[#da373c] text-[12px] font-medium h-4 transition-all"; statusTxt.textContent = "เกิดข้อผิดพลาดในการอัปโหลด ❌"; } finally { document.getElementById('settings-avatar-wrapper').classList.remove('opacity-50', 'pointer-events-none'); avatarInput.value = ""; }
};

// ==========================================
// 🛡️ 5. Authentication & Auto-Reconnect
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid; currentUsername = user.displayName || user.email.split('@')[0];
        document.getElementById('current-user-name').textContent = currentUsername;
        document.getElementById('current-user-avatar').src = user.photoURL || `https://ui-avatars.com/api/?name=${currentUsername}&background=5865F2&color=fff&rounded=true&bold=true`;
        
        try { const userDoc = await getDoc(doc(db, "users", currentUserId)); if (userDoc.exists()) { currentUserRole = userDoc.data().role; if (currentUserRole === 'Admin') document.getElementById('admin-menu-btn').classList.remove('hidden'); } } catch (err) {}
        
        if ("Notification" in window && Notification.permission === "default") { Notification.requestPermission(); }

        const wasInVoice = localStorage.getItem('dosh_active_voice') === 'true';
        if (wasInVoice) { await updateDoc(doc(db, "users", currentUserId), { status: 'online' }).catch(e=>console.log(e)); setTimeout(() => { joinVoice(); document.querySelectorAll('.nav-btn').forEach(b => { b.classList.remove('channel-active', 'text-[#e4e5e7]'); b.classList.add('channel-inactive', 'text-[#80848e]'); if (b.getAttribute('data-view') === 'voice') { b.classList.remove('channel-inactive', 'text-[#80848e]'); b.classList.add('channel-active', 'text-[#e4e5e7]'); } }); Object.values(views).forEach(v => v.classList.add('hidden')); views['voice'].classList.remove('hidden'); membersSidebar.classList.remove('hidden', 'md:hidden'); }, 1500); } else { await updateDoc(doc(db, "users", currentUserId), { status: 'online', inVoice: false, agoraUid: null, isMuted: false, isSharingScreen: false, isTyping: false }).catch(e=>console.log(e)); }
    } else { window.location.href = "index.html"; }
});

document.getElementById('logout-btn').addEventListener('click', async () => { if (currentUserId) { try { await updateDoc(doc(db, "users", currentUserId), { status: 'offline', inVoice: false, agoraUid: null, isMuted: false, isSharingScreen: false, isTyping: false }); } catch (e) {} } localStorage.removeItem('dosh_active_voice'); if (localTracks.audioTrack) { await leaveVoice(); } signOut(auth); });
window.addEventListener('beforeunload', () => { if (currentUserId && localStorage.getItem('dosh_active_voice') !== 'true') { updateDoc(doc(db, "users", currentUserId), { inVoice: false, agoraUid: null, isMuted: false, isSharingScreen: false, isTyping: false }); } });

// ==========================================
// 💬 6. ระบบแชท + System Bot + แจ้งเตือน
// ==========================================
const chatInput = document.getElementById('chat-input');
chatInput.addEventListener('input', () => { if (!currentUserId) return; if (!isTyping) { isTyping = true; updateDoc(doc(db, "users", currentUserId), { isTyping: true, typingChannel: activeChannel }); } clearTimeout(typingTimeout); typingTimeout = setTimeout(() => { isTyping = false; updateDoc(doc(db, "users", currentUserId), { isTyping: false }); }, 2000); });

window.deleteChatMsg = async (msgId) => { if(confirm('🗑️ ยืนยันการลบข้อความนี้ใช่ไหม? (แอดมินลบได้เท่านั้น)')) await deleteDoc(doc(db, "messages", msgId)); };

let isInitialLoad = true;
onSnapshot(query(collection(db, "messages"), orderBy("timestamp", "asc")), (snapshot) => { 
    allMessages = []; 
    snapshot.forEach((docSnap) => { allMessages.push({ id: docSnap.id, ...docSnap.data() }); }); 
    renderMessages(); 

    if (!isInitialLoad) {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const m = change.doc.data();
                if (m.senderName !== currentUsername && m.channel === activeChannel) {
                    sfxMsg.play().catch(()=>{}); 
                    if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
                        new Notification(`💬 DOSH: ข้อความใหม่จาก ${m.senderName}`, {
                            body: m.text || "ส่งรูปภาพ 🖼️", icon: usersData[m.senderName] ? usersData[m.senderName].avatar : `https://ui-avatars.com/api/?name=${m.senderName}`
                        });
                    }
                }
            }
        });
    }
    isInitialLoad = false;
});

window.toggleReaction = async (msgId, emoji) => {
    if (!currentUserId) return; const msgRef = doc(db, "messages", msgId); const msgDoc = await getDoc(msgRef); if (!msgDoc.exists()) return;
    const data = msgDoc.data(); let reactions = data.reactions || {}; let usersReacted = reactions[emoji] || [];
    if (usersReacted.includes(currentUserId)) { usersReacted = usersReacted.filter(id => id !== currentUserId); } else { usersReacted.push(currentUserId); }
    if (usersReacted.length === 0) { delete reactions[emoji]; } else { reactions[emoji] = usersReacted; }
    await updateDoc(msgRef, { reactions: reactions });
};

function renderMessages() {
    const chatContainer = document.getElementById('chat-container'); chatContainer.innerHTML = ''; 
    const filteredMessages = allMessages.filter(msg => msg.channel === activeChannel);
    if(filteredMessages.length === 0) return chatContainer.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-[#6d717a]"><div class="w-14 h-14 bg-[#151619] rounded-full flex items-center justify-center mb-3"><i class="ph ph-chat-teardrop-dots text-[28px]"></i></div><p class="font-bold text-base">เริ่มพิมพ์ข้อความทักทายได้เลย!</p></div>`;
    
    let lastSender = null; 
    filteredMessages.forEach((m) => {
        let timeString = m.timestamp ? m.timestamp.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : "...";
        
        // 🌟 แปลงระบบข้อความ **ตัวหนา** แบบ Markdown
        let formattedText = m.text ? m.text.replace(/\*\*(.*?)\*\*/g, '<span class="font-bold text-[#e4e5e7]">$1</span>') : '';

        // 🤖 🌟 เช็คว่าถ้าเป็นข้อความจาก System Bot ให้โชว์หน้าตาแบบหุ่นยนต์สุดล้ำ!
        if (m.senderName === "🤖 System Bot") {
            chatContainer.insertAdjacentHTML('beforeend', `
            <div class="chat-msg-row flex space-x-3 md:space-x-4 hover:bg-[#151619]/60 px-2 md:px-4 py-3 mt-4 -mx-2 md:-mx-4 group transition duration-150 relative items-center border-l-[3px] border-transparent hover:border-[#5865F2]">
                <div class="w-8 md:w-10 h-8 md:h-10 rounded-full bg-[#5865F2]/10 flex items-center justify-center flex-shrink-0 border border-[#5865F2]/20">
                    <i class="ph-fill ph-robot text-[#5865F2] text-[20px] md:text-[24px]"></i>
                </div>
                <div class="min-w-0 flex-1 pb-1">
                    <div class="flex items-baseline space-x-2">
                        <span class="font-extrabold text-[12px] text-white bg-[#5865F2] px-1.5 py-0.5 rounded uppercase tracking-wider">System</span>
                        <span class="text-[10px] md:text-[11px] text-[#6d717a]">${timeString}</span>
                    </div>
                    <p class="text-[#949ba4] mt-1 text-[13px] md:text-[14px] leading-relaxed">${formattedText}</p>
                </div>
            </div>`);
            lastSender = "system_bot"; // รีเซ็ตการรวมข้อความ
            return; // ข้ามการทำ UI แบบคนปกติไปเลย
        }

        // =======================================
        // การทำงานของแชทคนธรรมดา (ด้านล่างนี้)
        // =======================================
        let msgAvatarUrl = usersData[m.senderName] ? usersData[m.senderName].avatar : `https://ui-avatars.com/api/?name=${m.senderName}&background=5865F2&color=fff&rounded=true&bold=true`;
        let contentHTML = formattedText ? `<p class="text-[#d1d3d6] mt-0.5 leading-relaxed text-[14px] md:text-[15px]">${formattedText}</p>` : '';
        if (m.imageUrl) contentHTML += `<img src="${m.imageUrl}" onclick="openLightbox('${m.imageUrl}')" onload="document.getElementById('chat-container').scrollTop = document.getElementById('chat-container').scrollHeight;" class="mt-2 rounded-lg max-w-[80%] md:max-w-sm shadow-sm cursor-zoom-in hover:opacity-80 transition">`;
        
        let reactsHTML = '';
        if (m.reactions && Object.keys(m.reactions).length > 0) {
            reactsHTML = `<div class="flex flex-wrap gap-1.5 mt-2">`;
            Object.entries(m.reactions).forEach(([emoji, usersArr]) => {
                const count = usersArr.length, hasReacted = usersArr.includes(currentUserId);
                const activeStyle = hasReacted ? 'bg-[#5865F2]/20 border-[#5865F2]/50 text-[#dbdee1]' : 'bg-[#1e1f22] border-[#2b2d31] text-[#80848e] hover:bg-[#2b2d31]';
                if (count > 0) reactsHTML += `<div class="border rounded-md px-1.5 py-0.5 text-[12px] flex items-center cursor-pointer transition ${activeStyle}" onclick="toggleReaction('${m.id}', '${emoji}')">${emoji} <span class="ml-1 font-bold ${hasReacted ? 'text-[#5865F2]' : ''}">${count}</span></div>`;
            });
            reactsHTML += `</div>`;
        }

        const adminDeleteBtn = (currentUserRole === 'Admin') 
            ? `<div class="w-px h-4 bg-[#35373c] mx-1"></div><button onclick="deleteChatMsg('${m.id}')" class="reaction-btn hover:bg-[#da373c]/20 text-[#da373c] rounded p-1 text-[16px]" title="ลบข้อความ"><i class="ph-fill ph-trash"></i></button>` 
            : '';

        const actionMenuUI = `<div class="reaction-bar absolute -top-3 right-4 bg-[#151619] border border-[#1e1f22] rounded-lg p-1 shadow-xl flex items-center space-x-1 z-20">
            <button class="reaction-btn hover:bg-[#2b2d31] rounded p-1 text-[16px]" onclick="toggleReaction('${m.id}', '👍')">👍</button>
            <button class="reaction-btn hover:bg-[#2b2d31] rounded p-1 text-[16px]" onclick="toggleReaction('${m.id}', '❤️')">❤️</button>
            <button class="reaction-btn hover:bg-[#2b2d31] rounded p-1 text-[16px]" onclick="toggleReaction('${m.id}', '😂')">😂</button>
            <button class="reaction-btn hover:bg-[#2b2d31] rounded p-1 text-[16px]" onclick="toggleReaction('${m.id}', '🔥')">🔥</button>
            <button class="reaction-btn hover:bg-[#2b2d31] rounded p-1 text-[16px]" onclick="toggleReaction('${m.id}', '😮')">😮</button>
            <button class="reaction-btn hover:bg-[#2b2d31] rounded p-1 text-[16px]" onclick="toggleReaction('${m.id}', '✅')">✅</button>
            ${adminDeleteBtn}
        </div>`;

        if (lastSender === m.senderName) {
            chatContainer.insertAdjacentHTML('beforeend', `<div class="chat-msg-row flex space-x-3 md:space-x-4 hover:bg-[#151619]/60 px-2 md:px-4 py-1 -mx-2 md:-mx-4 group transition duration-150 relative"><div class="w-8 md:w-10 flex-shrink-0 text-right"><span class="text-[9px] md:text-[10px] text-[#5c6069] opacity-0 group-hover:opacity-100 transition leading-relaxed">${timeString}</span></div><div class="min-w-0 flex-1 pb-1 pr-20">${contentHTML}${reactsHTML}</div>${actionMenuUI}</div>`);
        } else {
            chatContainer.insertAdjacentHTML('beforeend', `<div class="chat-msg-row flex space-x-3 md:space-x-4 hover:bg-[#151619]/60 px-2 md:px-4 py-2 mt-4 -mx-2 md:-mx-4 group transition duration-150 relative"><img src="${msgAvatarUrl}" class="w-8 h-8 md:w-10 md:h-10 rounded-full flex-shrink-0 object-cover opacity-95"><div class="min-w-0 flex-1 pb-1 pr-20"><div class="flex items-baseline space-x-2"><span class="font-medium text-[14px] md:text-[15px] text-[#e4e5e7] tracking-wide">${m.senderName}</span><span class="text-[10px] md:text-[11px] text-[#6d717a]">${timeString}</span></div>${contentHTML}${reactsHTML}</div>${actionMenuUI}</div>`);
        }
        lastSender = m.senderName;
    });
    
    chatContainer.insertAdjacentHTML('beforeend', '<div class="h-4 w-full flex-shrink-0"></div>');
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function sendMessage() { const txt = chatInput.value.trim(); if (!txt) return; chatInput.value = ''; clearTimeout(typingTimeout); isTyping = false; updateDoc(doc(db, "users", currentUserId), { isTyping: false }); await addDoc(collection(db, "messages"), { text: txt, senderName: currentUsername, channel: activeChannel, timestamp: serverTimestamp(), reactions: {} }); }
document.getElementById('send-btn').onclick = sendMessage; chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
document.getElementById('attach-btn').onclick = () => document.getElementById('file-input').click();
document.getElementById('file-input').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; chatInput.placeholder = "กำลังอัปโหลดไฟล์..."; chatInput.disabled = true; try { const fd = new FormData(); fd.append("image", f); const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: fd }); const r = await res.json(); if (r.success) await addDoc(collection(db, "messages"), { text: "", imageUrl: r.data.url, senderName: currentUsername, channel: activeChannel, timestamp: serverTimestamp(), reactions: {} }); } catch (err) { alert("อัปโหลดพลาด"); } finally { chatInput.placeholder = "ส่งข้อความถึง #ห้องแชท"; chatInput.disabled = false; chatInput.value = ""; chatInput.focus(); } };

// ==========================================
// 🎨 7. ระบบกระดานไอเดีย (Shared Whiteboard)
// ==========================================
const canvas = document.getElementById('whiteboard-canvas'), ctx = canvas.getContext('2d'), canvasContainer = document.getElementById('canvas-container'), wbStatus = document.getElementById('wb-status');
let isDrawing = false;
function initCanvasSize() { if(canvas.width !== canvasContainer.clientWidth || canvas.height !== canvasContainer.clientHeight) { const temp = canvas.toDataURL(); canvas.width = canvasContainer.clientWidth; canvas.height = canvasContainer.clientHeight; if(temp !== "data:,") { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = temp; } } }
window.addEventListener('resize', initCanvasSize);
function getMousePos(e) { const r = canvas.getBoundingClientRect(); const x = e.touches ? e.touches[0].clientX : e.clientX, y = e.touches ? e.touches[0].clientY : e.clientY; return { x: x - r.left, y: y - r.top }; }
function startDrawing(e) { if(e.type === 'touchstart') e.preventDefault(); isDrawing = true; draw(e); }
function draw(e) { if (!isDrawing) return; if(e.type === 'touchmove') e.preventDefault(); const p = getMousePos(e); ctx.lineWidth = document.getElementById('wb-size').value; ctx.lineCap = 'round'; ctx.strokeStyle = document.getElementById('wb-color').value; ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
function stopDrawing() { if (!isDrawing) return; isDrawing = false; ctx.beginPath(); syncWhiteboard(); }
canvas.onmousedown = startDrawing; canvas.onmousemove = draw; canvas.onmouseup = canvas.onmouseout = stopDrawing; canvas.addEventListener('touchstart', startDrawing, {passive: false}); canvas.addEventListener('touchmove', draw, {passive: false}); canvas.addEventListener('touchend', stopDrawing);
document.getElementById('wb-clear').onclick = () => { if(confirm("ล้างกระดานทั้งหมด?")) { ctx.clearRect(0, 0, canvas.width, canvas.height); syncWhiteboard(true); } };
async function syncWhiteboard(isC = false) { if(!currentUserId) return; await setDoc(doc(db, "appData", "whiteboard"), { image: isC ? "" : canvas.toDataURL(), updatedBy: currentUsername, timestamp: serverTimestamp() }, { merge: true }); }
onSnapshot(doc(db, "appData", "whiteboard"), (d) => { if (d.exists() && !isDrawing) { const val = d.data(); if (val.updatedBy && val.updatedBy !== currentUsername) { wbStatus.innerHTML = `<i class="ph ph-pencil-simple mr-1.5"></i> ${val.updatedBy} เพิ่งอัปเดตกระดาน`; wbStatus.classList.remove('opacity-0'); setTimeout(() => wbStatus.classList.add('opacity-0'), 3000); } if(val.image) { const img = new Image(); img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); }; img.src = val.image; } else { ctx.clearRect(0, 0, canvas.width, canvas.height); } } });

// ==========================================
// 🎙️ 8. ระบบห้องคุยเสียง (Voice & Screen Share)
// ==========================================
const joinBtn = document.getElementById('join-voice-btn'), leaveBtn = document.getElementById('leave-voice-btn'), muteBtn = document.getElementById('mute-btn'), ssBtn = document.getElementById('screen-share-btn'), ssStage = document.getElementById('screen-share-stage');
async function joinVoice() { 
    try { 
        joinBtn.innerHTML = "กำลังเชื่อมต่อ..."; myNumericUid = Math.floor(Math.random() * 1000000); 
        rtcClient.on("user-published", async (u, t) => { await rtcClient.subscribe(u, t); if (t === "audio") u.audioTrack.play(); if (t === "video") { ssStage.classList.remove('hidden'); const ex = document.getElementById(`v-wrap-${u.uid}`); if(ex) ex.remove(); let pc = document.createElement("div"); pc.id = `v-wrap-${u.uid}`; pc.style.cssText="width:100%;height:100%;"; pc.className = "rounded-lg overflow-hidden bg-black flex items-center justify-center"; ssStage.appendChild(pc); u.videoTrack.play(pc, { fit: "contain" }); } }); 
        rtcClient.on("user-unpublished", async (u, t) => { if (t === "video") { const pc = document.getElementById(`v-wrap-${u.uid}`); if (pc) pc.remove(); if (ssStage.children.length === 0) ssStage.classList.add('hidden'); } }); 
        rtcClient.enableAudioVolumeIndicator(); rtcClient.on("volume-indicator", vs => { document.querySelectorAll('.speaking-ring').forEach(i => i.classList.remove('speaking-ring')); vs.forEach(v => { if (v.level > 10) { let sId = null; if (v.uid === myNumericUid || v.uid === 0) { sId = currentUserId; } else { for (const k in usersData) { if (usersData[k].agoraUid === v.uid) { sId = usersData[k].id; break; } } } if (sId) { const a1 = document.getElementById(`img-avatar-${sId}`), a2 = document.getElementById(`img-sidebar-voice-${sId}`), a3 = document.getElementById(`img-grid-voice-${sId}`); if(a1) a1.classList.add('speaking-ring'); if(a2) a2.classList.add('speaking-ring'); if(a3) a3.classList.add('speaking-ring'); } } }); }); 
        await rtcClient.join(AGORA_APP_ID, "DOSH_VOICE", null, myNumericUid); localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true, AGC: true }); await rtcClient.publish(localTracks.audioTrack); isMuted = false; await updateDoc(doc(db, "users", currentUserId), { inVoice: true, agoraUid: myNumericUid, isMuted: false, isSharingScreen: false }); localStorage.setItem('dosh_active_voice', 'true'); joinBtn.classList.add('hidden'); document.getElementById('active-voice-ui').classList.remove('hidden'); muteBtn.classList.add('bg-[#151619]'); muteBtn.classList.remove('bg-gray-800', 'text-[#da373c]'); document.getElementById('mute-icon').className = "ph ph-microphone text-[20px] md:text-[24px]"; 
    } catch (err) { console.error(err); localStorage.removeItem('dosh_active_voice'); alert("เชื่อมต่อไมค์ไม่สำเร็จ"); joinBtn.innerHTML = '<i class="ph-fill ph-phone-call text-[20px] md:text-[22px] mr-1.5 md:mr-2"></i> <span class="hidden md:inline">เข้าร่วมการแชทด้วยเสียง</span><span class="md:hidden">เข้าร่วมห้องเสียง</span>'; } 
}
ssBtn.onclick = async () => { const sIco = document.getElementById('screen-icon'); if (!isSharingScreen) { try { const res = await AgoraRTC.createScreenVideoTrack({ encoderConfig: { width: 1920, height: 1080, frameRate: 30, bitrateMax: 3000 }, optimizationMode: "motion" }, "auto"); if (Array.isArray(res)) { screenTrack = res[0]; screenAudioTrack = res[1]; await rtcClient.publish([screenTrack, screenAudioTrack]); } else { screenTrack = res; await rtcClient.publish(screenTrack); } isSharingScreen = true; await updateDoc(doc(db, "users", currentUserId), { isSharingScreen: true }); ssBtn.classList.replace('bg-[#151619]', 'bg-[#23a559]'); ssBtn.classList.replace('text-gray-300', 'text-white'); sIco.className = "ph-fill ph-screencast text-[20px] md:text-[24px]"; ssStage.classList.remove('hidden'); let pc = document.createElement("div"); pc.id = `v-wrap-local`; pc.style.cssText="width:100%;height:100%;"; pc.className = "rounded-lg overflow-hidden bg-black flex items-center justify-center"; ssStage.appendChild(pc); screenTrack.play(pc, { fit: "contain" }); screenTrack.on("track-ended", stopScreenShare); } catch (err) { console.log(err); } } else { await stopScreenShare(); } };
async function stopScreenShare() { if (screenTrack) { await rtcClient.unpublish(screenTrack); screenTrack.stop(); screenTrack.close(); screenTrack = null; } if (screenAudioTrack) { await rtcClient.unpublish(screenAudioTrack); screenAudioTrack.stop(); screenAudioTrack.close(); screenAudioTrack = null; } isSharingScreen = false; if(currentUserId) await updateDoc(doc(db, "users", currentUserId), { isSharingScreen: false }); ssBtn.classList.replace('bg-[#23a559]', 'bg-[#151619]'); ssBtn.classList.replace('text-white', 'text-gray-300'); document.getElementById('screen-icon').className = "ph ph-screencast text-[20px] md:text-[24px]"; const pc = document.getElementById(`v-wrap-local`); if (pc) pc.remove(); if (ssStage.children.length === 0) ssStage.classList.add('hidden'); }
async function leaveVoice() { if (isSharingScreen) await stopScreenShare(); if (localTracks.audioTrack) { localTracks.audioTrack.stop(); localTracks.audioTrack.close(); } await rtcClient.leave(); if(currentUserId) { await updateDoc(doc(db, "users", currentUserId), { inVoice: false, agoraUid: null, isMuted: false, isSharingScreen: false }); } localStorage.removeItem('dosh_active_voice'); document.querySelectorAll('.speaking-ring').forEach(i => i.classList.remove('speaking-ring')); joinBtn.classList.remove('hidden'); joinBtn.innerHTML = '<i class="ph-fill ph-phone-call text-[20px] md:text-[22px] mr-1.5 md:mr-2"></i> <span class="hidden md:inline">เข้าร่วมการแชทด้วยเสียง</span><span class="md:hidden">เข้าร่วมห้องเสียง</span>'; document.getElementById('active-voice-ui').classList.add('hidden'); }
joinBtn.onclick = joinVoice; leaveBtn.onclick = leaveVoice;
muteBtn.onclick = async () => { isMuted = !isMuted; localTracks.audioTrack.setEnabled(!isMuted); await updateDoc(doc(db, "users", currentUserId), { isMuted: isMuted }); const muteIcon = document.getElementById('mute-icon'); if (isMuted) { muteBtn.classList.remove('bg-[#151619]'); muteBtn.classList.add('bg-gray-800', 'text-[#da373c]'); muteIcon.className = "ph-fill ph-microphone-slash text-[20px] md:text-[24px]"; } else { muteBtn.classList.add('bg-[#151619]'); muteBtn.classList.remove('bg-gray-800', 'text-[#da373c]'); muteIcon.className = "ph ph-microphone text-[20px] md:text-[24px]"; } };

// ==========================================
// 📋 9. ระบบกระดานงาน (Task Board)
// ==========================================
const zones = { 'todo': document.getElementById('todo'), 'in_progress': document.getElementById('in_progress'), 'done': document.getElementById('done') };
onSnapshot(collection(db, "tasks"), (snapshot) => { Object.values(zones).forEach(z => z.innerHTML = ''); snapshot.forEach((docSnap) => { const d = docSnap.data(), id = docSnap.id, s = d.status || 'todo'; let tC = "bg-[#1c1d21] text-[#d1d3d6] border border-[#2b2d31]"; if(d.tag && d.tag.includes('Dev')) tC = "bg-blue-500/10 text-blue-400 border border-blue-500/20"; if(d.tag && d.tag.includes('Music')) tC = "bg-pink-500/10 text-pink-400 border border-pink-500/20"; if(d.tag && d.tag.includes('Video')) tC = "bg-purple-500/10 text-purple-400 border border-purple-500/20"; if(d.tag && d.tag.includes('Design')) tC = "bg-[#23a559]/10 text-[#23a559] border border-[#23a559]/20"; const cardHTML = `<div draggable="true" data-id="${id}" class="task-card bg-[#1c1d21] p-3 rounded-lg shadow-sm cursor-move hover:shadow-md hover:-translate-y-0.5 transition duration-200 mb-2 border-l-4 ${s === 'done' ? 'border-[#3f4147] opacity-50' : 'border-[#5865F2]'} group animate-[fadeIn_0.3s_ease-out]"><div class="flex space-x-2 mb-2.5"><span class="${tC} text-[10px] font-bold px-2 py-0.5 rounded-sm flex items-center"><i class="ph-fill ph-tag text-[10px] mr-1"></i>${d.tag}</span></div><p class="text-[13px] md:text-[14px] font-medium text-[#d1d3d6] ${s === 'done' ? 'line-through text-[#6d717a]' : ''} leading-snug">${d.title}</p></div>`; if (zones[s]) zones[s].insertAdjacentHTML('beforeend', cardHTML); }); document.querySelectorAll('.task-card').forEach(c => { c.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', c.getAttribute('data-id')); setTimeout(() => c.classList.add('opacity-30'), 0); }); c.addEventListener('dragend', () => c.classList.remove('opacity-30')); }); });
Object.keys(zones).forEach(s => { const z = zones[s]; z.addEventListener('dragover', (e) => { e.preventDefault(); z.classList.add('drop-zone-active'); }); z.addEventListener('dragleave', () => z.classList.remove('drop-zone-active')); z.addEventListener('drop', async (e) => { e.preventDefault(); z.classList.remove('drop-zone-active'); const tId = e.dataTransfer.getData('text/plain'); if (tId) await updateDoc(doc(db, "tasks", tId), { status: s }); }); });
document.getElementById('add-task-btn').addEventListener('click', async () => { const t = prompt("ชื่องาน:"); if (!t) return; const tag = prompt("สายงาน (เช่น Dev, Music, Video, Design):", "Dev"); await addDoc(collection(db, "tasks"), { title: t, tag: tag || 'General', status: 'todo', timestamp: serverTimestamp() }); });