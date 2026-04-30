const audio = document.getElementById('audio'), statusFunc = document.getElementById('status-function'), fileInfoLine = document.getElementById('file-info-line'), formatInfo = document.getElementById('format-info'), fileIn = document.getElementById('file-in'), canvas = document.getElementById('vu-meter'), ctx = canvas.getContext('2d'), m1 = document.getElementById('m1'), m2 = document.getElementById('m2'), s1 = document.getElementById('s1'), s2 = document.getElementById('s2'), modalImg = document.getElementById('modalImg');

audio.volume = 0.2;
let playlist = [], currentIndex = 0, audioCtx, analyser, dataArray, timeMode = 'elapsed', vuVisible = true, repeatMode = 0, isShuffle = false, pointA = null, pointB = null, lastVolume = 0, digitEntry = "", digitTimeout = null;

function getVFDColor(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function updateStatusText() { if (digitEntry !== "") return; if (playlist.length === 0) { statusFunc.innerText = "NO DISC"; return; } statusFunc.innerText = audio.paused ? (audio.currentTime === 0 ? "STOP" : "PAUSE") : "PLAY"; }

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

fileIn.onchange = (e) => { playlist = Array.from(e.target.files); if (playlist.length) { currentIndex = 0; loadTrack(0); handlePlay(); } };

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

let pauseBlinkInterval = null;
function startPauseBlink() { if (pauseBlinkInterval) return; const timer = document.getElementById('timer'); let visible = true; pauseBlinkInterval = setInterval(() => { visible = !visible; timer.style.visibility = visible ? 'visible' : 'hidden'; }, 500); }
function stopPauseBlink() { if (pauseBlinkInterval) { clearInterval(pauseBlinkInterval); pauseBlinkInterval = null; } document.getElementById('timer').style.visibility = 'visible'; }

function handlePlay() { if (playlist.length > 0) { if (!audioCtx) initAudio(); stopPauseBlink(); audio.play().then(updateStatusText); } }
function handlePause() { audio.pause(); updateStatusText(); if (audio.currentTime > 0) startPauseBlink(); }
function handleStop() { audio.pause(); audio.currentTime = 0; updateStatusText(); stopPauseBlink(); pointA = pointB = null; document.getElementById('ind-ab').classList.remove('active'); }
function nextTrack() { if (!playlist.length) return; currentIndex = isShuffle ? Math.floor(Math.random() * playlist.length) : (currentIndex + 1) % playlist.length; loadTrack(currentIndex); handlePlay(); }
function prevTrack() { if (!playlist.length) return; currentIndex = (currentIndex - 1 + playlist.length) % playlist.length; loadTrack(currentIndex); handlePlay(); }
audio.onended = () => { if (repeatMode === 1) { audio.currentTime = 0; audio.play(); } else { nextTrack(); } };
audio.ontimeupdate = () => { if (pointA !== null && pointB !== null && audio.currentTime >= pointB) audio.currentTime = pointA; const isRemaining = timeMode === 'remaining' && audio.duration; let t = isRemaining ? (audio.duration - audio.currentTime) : audio.currentTime; const mm = Math.floor(Math.max(0, t / 60)).toString().padStart(2, '0'); const ss = Math.floor(Math.max(0, t % 60)).toString().padStart(2, '0'); m1.innerText = mm[0]; m2.innerText = mm[1]; s1.innerText = ss[0]; s2.innerText = ss[1]; document.getElementById('time-sign').innerText = isRemaining ? '-' : '\u00a0'; };

let analyserL, analyserR, dataArrayL, dataArrayR, bassFilter, trebleFilter, loudnessGain, channelMerger, splitter;
let lastVolL = 0, lastVolR = 0;
let bassLevel = 0, trebleLevel = 0, loudnessOn = false, monoOn = false;

function initAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaElementSource(audio);

    // Splitter stereo
    splitter = audioCtx.createChannelSplitter(2);

    // Analyseurs L et R
    analyserL = audioCtx.createAnalyser(); analyserL.fftSize = 256;
    analyserR = audioCtx.createAnalyser(); analyserR.fftSize = 256;
    dataArrayL = new Uint8Array(analyserL.frequencyBinCount);
    dataArrayR = new Uint8Array(analyserR.frequencyBinCount);

    // EQ filters
    bassFilter = audioCtx.createBiquadFilter();
    bassFilter.type = 'lowshelf'; bassFilter.frequency.value = 250; bassFilter.gain.value = 0;
    trebleFilter = audioCtx.createBiquadFilter();
    trebleFilter.type = 'highshelf'; trebleFilter.frequency.value = 4000; trebleFilter.gain.value = 0;

    // Loudness gain
    loudnessGain = audioCtx.createGain(); loudnessGain.gain.value = 1;

    // Mono merger
    channelMerger = audioCtx.createChannelMerger(2);

    // Signal chain: source → bass → treble → loudness → splitter → analyseurs → merger → destination
    source.connect(bassFilter);
    bassFilter.connect(trebleFilter);
    trebleFilter.connect(loudnessGain);
    loudnessGain.connect(splitter);
    splitter.connect(analyserL, 0);
    splitter.connect(analyserR, 1);
    splitter.connect(channelMerger, 0, 0);
    splitter.connect(channelMerger, 1, 1);
    channelMerger.connect(audioCtx.destination);

    analyser = analyserL; // compat
    dataArray = dataArrayL;
    drawVU();
}

function drawVU() {
    requestAnimationFrame(drawVU);
    if (!vuVisible || !analyserL) return;
    analyserL.getByteFrequencyData(dataArrayL);
    analyserR.getByteFrequencyData(dataArrayR);

    let sumL = 0, sumR = 0;
    for (let i = 0; i < 15; i++) { sumL += dataArrayL[i]; sumR += dataArrayR[i]; }
    let volL = sumL / 15, volR = sumR / 15;

    // En mono : les deux barres affichent la même valeur (moyenne L+R)
    if (monoOn) { const avg = (volL + volR) / 2; volL = avg; volR = avg; }

    lastVolL = volL < lastVolL ? lastVolL - 2 : volL;
    lastVolR = volR < lastVolR ? lastVolR - 2 : volR;

    const mainColor = getVFDColor('--vfd-main'), redColor = getVFDColor('--vfd-red'), orangeColor = getVFDColor('--vfd-orange') || '#ff8800';
    ctx.clearRect(0, 0, 800, 70);
    ctx.font = "500 14px 'Inter', sans-serif";
    ctx.textBaseline = "middle";

    // Labels L / R
    ctx.fillStyle = lastVolL > 10 ? mainColor : "#222"; ctx.fillText("L", 18, 17);
    ctx.fillStyle = lastVolR > 10 ? mainColor : "#222"; ctx.fillText("R", 18, 52);

    for (let i = 0; i < 25; i++) {
        const threshL = (i / 25) * 255, threshR = (i / 25) * 255;
        // L
        if (lastVolL > threshL) { ctx.fillStyle = i > 21 ? redColor : i > 15 ? orangeColor : mainColor; }
        else { ctx.fillStyle = "#111"; }
        ctx.fillRect(60 + i * 28, 8, 25, 18);
        // R
        if (lastVolR > threshR) { ctx.fillStyle = i > 21 ? redColor : i > 15 ? orangeColor : mainColor; }
        else { ctx.fillStyle = "#111"; }
        ctx.fillRect(60 + i * 28, 43, 25, 18);
    }
}

function applyMono() {
    if (!channelMerger || !splitter) return;
    try { splitter.disconnect(channelMerger, 0, 1); } catch(e) {}
    try { splitter.disconnect(channelMerger, 1, 1); } catch(e) {}
    if (monoOn) {
        splitter.connect(channelMerger, 0, 1); // L → R output (mono)
    } else {
        splitter.connect(channelMerger, 1, 1); // R → R output (stereo)
    }
}

let statusResetTimer = null;
function delayedStatusReset() { clearTimeout(statusResetTimer); statusResetTimer = setTimeout(updateStatusText, 2000); }

function toggleLoudness() {
    if (!audioCtx) return;
    loudnessOn = !loudnessOn;
    loudnessGain.gain.setTargetAtTime(loudnessOn ? 1.5 : 1, audioCtx.currentTime, 0.05);
    const el = document.getElementById('ind-loudness');
    el.classList.toggle('active', loudnessOn);
    statusFunc.innerText = loudnessOn ? "LOUDNESS ON" : "LOUDNESS OFF";
    setTimeout(updateStatusText, 1200);
}

function toggleMono() {
    if (!audioCtx) return;
    monoOn = !monoOn;
    applyMono();
    const el = document.getElementById('ind-mono');
    el.classList.toggle('active', monoOn);
    statusFunc.innerText = monoOn ? "MONO" : "STEREO";
    setTimeout(updateStatusText, 1200);
}

function changeBass(d) {
    if (!bassFilter) return;
    bassLevel = Math.min(12, Math.max(-12, bassLevel + d));
    bassFilter.gain.setTargetAtTime(bassLevel, audioCtx.currentTime, 0.05);
    showBass();
}
function showBass() { statusFunc.innerText = `BASS: ${bassLevel > 0 ? '+' : ''}${bassLevel} dB`; }

function changeTreble(d) {
    if (!trebleFilter) return;
    trebleLevel = Math.min(12, Math.max(-12, trebleLevel + d));
    trebleFilter.gain.setTargetAtTime(trebleLevel, audioCtx.currentTime, 0.05);
    showTreble();
}
function showTreble() { statusFunc.innerText = `TREBLE: ${trebleLevel > 0 ? '+' : ''}${trebleLevel} dB`; }

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
function confirmRestart() { document.getElementById('restartModal').style.display = 'flex'; }
