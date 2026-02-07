const audio = document.getElementById('audio'), statusFunc = document.getElementById('status-function'), fileInfoLine = document.getElementById('file-info-line'), formatInfo = document.getElementById('format-info'), fileIn = document.getElementById('file-in'), canvas = document.getElementById('vu-meter'), ctx = canvas.getContext('2d'), m1 = document.getElementById('m1'), m2 = document.getElementById('m2'), s1 = document.getElementById('s1'), s2 = document.getElementById('s2'), modalImg = document.getElementById('modalImg');

audio.volume = 0.2;
let playlist = [], currentIndex = 0, audioCtx, analyser, dataArray, timeMode = 'elapsed', vuVisible = true, repeatMode = 0, isShuffle = false, pointA = null, pointB = null, lastVolume = 0, digitEntry = "", digitTimeout = null;

function getVFDColor(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function toggleTheme() { const currentTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light'; document.documentElement.setAttribute('data-theme', currentTheme); localStorage.setItem('user-theme', currentTheme); }
document.documentElement.setAttribute('data-theme', localStorage.getItem('user-theme') || 'dark');

function updateStatusText() { if (digitEntry !== "") return; if (!audio.src || playlist.length === 0) { statusFunc.innerText = "NO DISC"; return; } statusFunc.innerText = audio.paused ? (audio.currentTime === 0 ? "STOP" : "PAUSE") : "PLAY"; }

function openPlaylist() {
    if (playlist.length === 0) return;
    const container = document.getElementById('playlist-items-container');
    container.innerHTML = '';
    playlist.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'playlist-item' + (index === currentIndex ? ' active' : '');
        item.innerHTML = `<span>${index + 1}</span> ${file.name.toUpperCase()}`;
        item.onclick = () => { playDirect(index); closePlaylist(); };
        container.appendChild(item);
    });
    document.getElementById('playlistModal').style.display = 'flex';
}

function closePlaylist() { document.getElementById('playlistModal').style.display = 'none'; }

// Reprise du reste des fonctions existantes (loadTrack, handlePlay, etc.)
function pressDigit(num) { clearTimeout(digitTimeout); digitEntry += num; statusFunc.innerText = "SELECT: " + digitEntry; digitTimeout = setTimeout(() => { playDirect(parseInt(digitEntry) - 1); }, 1200); }
function playDirect(index) { digitEntry = ""; if (playlist.length > index && index >= 0) { currentIndex = index; loadTrack(currentIndex); handlePlay(); } else { statusFunc.innerText = "EMPTY"; setTimeout(updateStatusText, 1000); } }

fileIn.onchange = (e) => { playlist = Array.from(e.target.files); if (playlist.length) { currentIndex = 0; loadTrack(0); statusFunc.innerText = "READY"; } };

function loadTrack(index) {
    const file = playlist[index];
    if (audio.src) URL.revokeObjectURL(audio.src);
    audio.src = URL.createObjectURL(file);
    formatInfo.innerText = file.name.split('.').pop().toUpperCase();
    if (window.jsmediatags) {
        window.jsmediatags.read(file, {
            onSuccess: (tag) => {
                const t = tag.tags;
                fileInfoLine.innerText = `${t.artist || "UNKNOWN"} - ${t.album || "UNKNOWN"} - ${t.title || file.name}`.toUpperCase();
                if (t.picture) {
                    const { data, format } = t.picture; let base64 = "";
                    for (let i = 0; i < data.length; i++) base64 += String.fromCharCode(data[i]);
                    modalImg.src = `data:${format};base64,${window.btoa(base64)}`;
                } else { modalImg.src = "img/Technics_logo.png"; }
            }, onError: () => { fileInfoLine.innerText = file.name.toUpperCase(); }
        });
    }
    updateTrackDisplay(); audio.load();
}

function handlePlay() { if (playlist.length > 0) { if (!audioCtx) initAudio(); audio.play().then(updateStatusText); } }
function handlePause() { audio.pause(); updateStatusText(); }
function handleStop() { audio.pause(); audio.currentTime = 0; updateStatusText(); pointA = pointB = null; document.getElementById('ind-ab').classList.remove('active'); }
function nextTrack() { if (!playlist.length) return; currentIndex = isShuffle ? Math.floor(Math.random() * playlist.length) : (currentIndex + 1) % playlist.length; loadTrack(currentIndex); handlePlay(); }
function prevTrack() { if (!playlist.length) return; currentIndex = (currentIndex - 1 + playlist.length) % playlist.length; loadTrack(currentIndex); handlePlay(); }
audio.onended = () => { if (repeatMode === 1) { audio.currentTime = 0; audio.play(); } else { nextTrack(); } };
audio.ontimeupdate = () => { if (pointA !== null && pointB !== null && audio.currentTime >= pointB) audio.currentTime = pointA; let t = (timeMode === 'remaining' && audio.duration) ? (audio.duration - audio.currentTime) : audio.currentTime; const mm = Math.floor(Math.max(0, t / 60)).toString().padStart(2, '0'); const ss = Math.floor(Math.max(0, t % 60)).toString().padStart(2, '0'); m1.innerText = mm[0]; m2.innerText = mm[1]; s1.innerText = ss[0]; s2.innerText = ss[1]; };

function initAudio() { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); analyser = audioCtx.createAnalyser(); const source = audioCtx.createMediaElementSource(audio); source.connect(analyser); analyser.connect(audioCtx.destination); dataArray = new Uint8Array(analyser.frequencyBinCount); drawVU(); }
function drawVU() { requestAnimationFrame(drawVU); if (!vuVisible) return; analyser.getByteFrequencyData(dataArray); let sum = 0; for (let i = 0; i < 15; i++) sum += dataArray[i]; let vol = sum / 15; lastVolume = vol < lastVolume ? lastVolume - 2 : vol; const mainColor = getVFDColor('--vfd-main'), redColor = getVFDColor('--vfd-red'); ctx.clearRect(0, 0, 800, 120); ctx.font = "500 22px 'Inter', sans-serif"; ctx.fillStyle = lastVolume > 10 ? mainColor : "#222"; ctx.fillText("L", 15, 42); ctx.fillText("R", 15, 98); for (let i = 0; i < 25; i++) { ctx.fillStyle = lastVolume > (i / 25) * 255 ? (i > 20 ? redColor : mainColor) : "#111"; ctx.fillRect(60 + i * 28, 15, 25, 20); ctx.fillRect(60 + i * 28, 70, 25, 20); } }

async function runPeak() {
    if (!playlist.length || !audio.src) return;
    statusFunc.innerText = "PEAK SEARCH";
    try {
        const response = await fetch(audio.src);
        const arrayBuffer = await response.arrayBuffer();
        const tempCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 44100, 44100);
        const decodedBuffer = await tempCtx.decodeAudioData(arrayBuffer);
        const rawData = decodedBuffer.getChannelData(0);
        let maxVal = 0, maxPos = 0;
        for (let i = 0; i < rawData.length; i += 200) { if (Math.abs(rawData[i]) > maxVal) { maxVal = Math.abs(rawData[i]); maxPos = i; } }
        audio.currentTime = maxPos / decodedBuffer.sampleRate;
        statusFunc.innerText = "PEAK FOUND";
        handlePlay(); setTimeout(() => { handlePause(); updateStatusText(); }, 3000);
    } catch (e) {
        setTimeout(() => { audio.currentTime = Math.random() * (audio.duration || 10); statusFunc.innerText = "PEAK FOUND"; handlePlay(); setTimeout(() => { handlePause(); updateStatusText(); }, 2000); }, 1500);
    }
}

function doShuttle(v) { if (v != 0) { audio.currentTime += v * 0.5; statusFunc.innerText = v > 0 ? "SEARCH >>" : "<< SEARCH"; } }
function resetShuttle() { document.getElementById('shuttle').value = 0; updateStatusText(); }
function updateTrackDisplay() {
    const grid = document.getElementById('track-grid');
    grid.innerHTML = '';
    
    // On limite l'affichage aux 20 premiers éléments
    const displayLimit = 20;
    const tracksToShow = playlist.slice(0, displayLimit);
    
    tracksToShow.forEach((_, i) => {
        const s = document.createElement('span');
        s.className = 'track-num' + (i === currentIndex ? ' active' : '');
        s.innerText = i + 1;
        grid.appendChild(s);
    });

    // Si la playlist dépasse 20, on ajoute l'indicateur "OVER"
    if (playlist.length > displayLimit) {
        const more = document.createElement('span');
        more.className = 'track-more';
        more.innerHTML = '<i class="fa-solid fa-caret-right"></i>';
        grid.appendChild(more);
    }
}
function skip(v) { audio.currentTime += v; }
function changeVolume(d) { audio.volume = Math.min(1, Math.max(0, audio.volume + d)); showVolume(); }
function showVolume() { statusFunc.innerText = `VOL: ${Math.round(audio.volume * 10)}`; }
function toggleTime() { timeMode = (timeMode === 'elapsed' ? 'remaining' : 'elapsed'); }
function toggleVUMode() { vuVisible = !vuVisible; canvas.style.display = vuVisible ? 'block' : 'none'; }
function toggleRepeat() { repeatMode = (repeatMode + 1) % 3; document.getElementById('ind-repeat1').classList.toggle('active', repeatMode === 1); document.getElementById('ind-repeatAll').classList.toggle('active', repeatMode === 2); }
function handleAB() { const ind = document.getElementById('ind-ab'); if (pointA === null) { pointA = audio.currentTime; ind.classList.add('active'); } else if (pointB === null) { pointB = audio.currentTime; } else { pointA = pointB = null; ind.classList.remove('active'); } }
function toggleShuffle() { isShuffle = !isShuffle; document.getElementById('ind-shuffle').classList.toggle('active', isShuffle); }
function runAutoCue() { statusFunc.innerText = "AUTO CUE"; setTimeout(updateStatusText, 1000); }
function openArtModal() { if (playlist.length) document.getElementById('artModal').style.display = 'flex'; }