const audio = document.getElementById('audio'), statusFunc = document.getElementById('status-function'), fileInfoLine = document.getElementById('file-info-line'), formatInfo = document.getElementById('format-info'), fileIn = document.getElementById('file-in'), canvas = document.getElementById('vu-meter'), ctx = canvas.getContext('2d'), m1 = document.getElementById('m1'), m2 = document.getElementById('m2'), s1 = document.getElementById('s1'), s2 = document.getElementById('s2'), modalImg = document.getElementById('modalImg');

// Dessine les pixels éteints dès le chargement
(function initVUOff() {
    ctx.clearRect(0, 0, 800, 70);
    ctx.font = "500 14px 'Inter', sans-serif"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#1a1a1a"; ctx.fillText("L", 18, 17); ctx.fillText("R", 18, 52);
    const ledH = 18, ledStep = 18, ledsPerSeg = 1;
    for (let i = 0; i < 25; i++) {
        for (let l = 0; l < ledsPerSeg; l++) {
            ctx.fillStyle = "#111";
            ctx.fillRect(60 + i * 28, 8 + l * ledStep, 25, ledH);
            ctx.fillRect(60 + i * 28, 43 + l * ledStep, 25, ledH);
        }
    }
})();

audio.volume = 0.2;
let playlist = [], currentIndex = 0, audioCtx, analyser, dataArray, timeMode = 'elapsed', vuVisible = true, repeatMode = 0, isShuffle = false, pointA = null, pointB = null, lastVolume = 0, digitEntry = "", digitTimeout = null;

function getVFDColor(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

let isMuted = false;
function updateStatusText() { if (digitEntry !== "") return; if (playlist.length === 0) { statusFunc.innerText = "NO TRACK"; return; } if (isMuted) { statusFunc.innerText = "MUTE"; return; } statusFunc.innerText = audio.paused ? (audio.currentTime === 0 ? "STOP" : "PAUSE") : "PLAY"; }
function toggleMute() { isMuted = !isMuted; audio.muted = isMuted; updateStatusText(); }

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


function pressDigit(num) { clearTimeout(digitTimeout); digitEntry += num; statusFunc.innerText = "SELECT: " + digitEntry; digitTimeout = setTimeout(() => { playDirect(parseInt(digitEntry) - 1); }, 1200); }
function playDirect(index) { digitEntry = ""; if (playlist.length > index && index >= 0) { currentIndex = index; loadTrack(currentIndex); handlePlay(); } else { statusFunc.innerText = "EMPTY"; setTimeout(updateStatusText, 1000); } }

fileIn.onchange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    if (playlist.length > 0) {
        playlist.push(...files);
        statusFunc.innerText = `+${files.length} TRACK${files.length > 1 ? 'S' : ''}`;
        setTimeout(updateStatusText, 1500);
    } else {
        playlist = files;
        currentIndex = 0;
        loadTrack(0);
        handlePlay();
    }
    e.target.value = '';
};

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
                } else { modalImg.src = "img/art-Technics-cover.png"; }
                updateMediaSession({
    title: t.title || file.name,
    artist: t.artist || 'Unknown Artist',
    album: t.album || 'Unknown Album'
});
            }, onError: () => { fileInfoLine.innerText = file.name.toUpperCase();updateMediaSession({
    title: file.name,
    artist: 'Unknown Artist',
    album: 'Unknown Album'
}); }
        });
    }
    updateTrackDisplay(); audio.load();
}

function updateMediaSession(metadata = {}) {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
        title: metadata.title || fileInfoLine.innerText.split(' - ')[2] || 'Unknown Title',
        artist: metadata.artist || fileInfoLine.innerText.split(' - ')[0] || 'Unknown Artist',
        album: metadata.album || fileInfoLine.innerText.split(' - ')[1] || 'Unknown Album',
        artwork: [
            {
                src: modalImg.src || 'img/art-Technics-cover.png',
                sizes: '512x512',
                type: 'image/png'
            }
        ]
    });

    navigator.mediaSession.setActionHandler('play', () => handlePlay());
    navigator.mediaSession.setActionHandler('pause', () => handlePause());
    navigator.mediaSession.setActionHandler('stop', () => handleStop());
    navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        audio.currentTime = Math.max(
            0,
            audio.currentTime - (details.seekOffset || 10)
        );
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
        audio.currentTime = Math.min(
            audio.duration || Infinity,
            audio.currentTime + (details.seekOffset || 10)
        );
    });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null) {
            audio.currentTime = details.seekTime;
        }
    });
}

audio.addEventListener('timeupdate', () => {
    if ('mediaSession' in navigator && audio.duration) {
        navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate,
            position: audio.currentTime
        });
    }
});

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

let analyserL, analyserR, dataArrayL, dataArrayR, bassFilter, trebleFilter, loudnessGain, channelMerger, splitter, pannerNode;
let balanceLevel = 0;
let lastVolL = 0, lastVolR = 0;
let peakL = 0, peakR = 0, peakTimerL = 0, peakTimerR = 0;
let bassLevel = 0, trebleLevel = 0, loudnessOn = false, monoOn = false;
let isBypass = false, bypassSnapshot = null;

function toggleBypass() {
    if (!audioCtx) return;
    isBypass = !isBypass;

    if (isBypass) {
        document.getElementById('ind-bypass').classList.add('active');
        // Sauvegarder l'état actuel
        bypassSnapshot = { bass: bassLevel, treble: trebleLevel, loudness: loudnessOn };
        // Couper bass
        bassFilter.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
        // Couper treble
        trebleFilter.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
        // Couper loudness
        loudnessGain.gain.setTargetAtTime(1, audioCtx.currentTime, 0.05);
        document.getElementById('ind-loudness').classList.remove('active');
    } else {
        // Restaurer depuis snapshot
        if (bypassSnapshot) {
            bassFilter.gain.setTargetAtTime(bypassSnapshot.bass, audioCtx.currentTime, 0.05);
            trebleFilter.gain.setTargetAtTime(bypassSnapshot.treble, audioCtx.currentTime, 0.05);
            if (bypassSnapshot.loudness) {
                loudnessGain.gain.setTargetAtTime(1.5, audioCtx.currentTime, 0.05);
                document.getElementById('ind-loudness').classList.add('active');
            }
            bassLevel = bypassSnapshot.bass;
            trebleLevel = bypassSnapshot.treble;
            loudnessOn = bypassSnapshot.loudness;
        }
        document.getElementById('ind-bypass').classList.remove('active');
    }
    const btn = document.querySelector('[onclick="toggleBypass()"]');
    if (btn) btn.style.color = isBypass ? 'var(--vfd-main)' : '';
    setTimeout(updateStatusText, 1500);
}

let specAnalyser, specDataArray, specCtx;

function initAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaElementSource(audio);

    // Splitter stereo
    splitter = audioCtx.createChannelSplitter(2);

    // Analyseurs L et R
    analyserL = audioCtx.createAnalyser(); analyserL.fftSize = 64;
    analyserR = audioCtx.createAnalyser(); analyserR.fftSize = 64;
    dataArrayL = new Uint8Array(analyserL.frequencyBinCount);
    dataArrayR = new Uint8Array(analyserR.frequencyBinCount);

    // Spectrum analyser (higher resolution, pre-EQ for accuracy)
    specAnalyser = audioCtx.createAnalyser();
    specAnalyser.fftSize = 256;
    specAnalyser.smoothingTimeConstant = 0.75;
    specDataArray = new Uint8Array(specAnalyser.frequencyBinCount);

    // EQ filters
    bassFilter = audioCtx.createBiquadFilter();
    bassFilter.type = 'lowshelf'; bassFilter.frequency.value = 250; bassFilter.gain.value = 0;
    trebleFilter = audioCtx.createBiquadFilter();
    trebleFilter.type = 'highshelf'; trebleFilter.frequency.value = 4000; trebleFilter.gain.value = 0;

    // Loudness gain
    loudnessGain = audioCtx.createGain(); loudnessGain.gain.value = 1;

    // Balance panner
    pannerNode = audioCtx.createStereoPanner(); pannerNode.pan.value = 0;

    // Mono merger
    channelMerger = audioCtx.createChannelMerger(2);

    // Signal chain
    source.connect(bassFilter);
    bassFilter.connect(trebleFilter);
    trebleFilter.connect(loudnessGain);
    loudnessGain.connect(pannerNode);
    pannerNode.connect(splitter);
    splitter.connect(analyserL, 0);
    splitter.connect(analyserR, 1);
    splitter.connect(channelMerger, 0, 0);
    splitter.connect(channelMerger, 1, 1);
    channelMerger.connect(audioCtx.destination);

    // Spectrum tap (post-EQ)
    loudnessGain.connect(specAnalyser);

    analyser = analyserL;
    dataArray = dataArrayL;
    drawVU();
}

function drawSpectrum() {
    requestAnimationFrame(drawSpectrum);
    const specCanvas = document.getElementById('spectrum-canvas');
    if (!specCanvas || !specCtx) return;

    const W = specCanvas.width = specCanvas.offsetWidth || 200;
    const H = specCanvas.height = specCanvas.offsetHeight || 80;

    specCtx.clearRect(0, 0, W, H);

    if (!specAnalyser || !spectrumVisible) {
        // Off-state: draw dim LED grid
        const barCount = 28;
        const barW = Math.floor(W / barCount) - 2;
        const barGap = Math.floor(W / barCount) - barW;
        const ledH = 3, ledGap = 2, ledStep = ledH + ledGap;
        const ledCount = Math.floor(H / ledStep);
        for (let i = 0; i < barCount; i++) {
            const x = i * (barW + barGap);
            for (let l = 0; l < ledCount; l++) {
                const y = H - (l + 1) * ledStep;
                specCtx.fillStyle = '#111';
                specCtx.fillRect(x, y, barW, ledH);
            }
        }
        return;
    }

    specAnalyser.getByteFrequencyData(specDataArray);
    const mainColor = getVFDColor('--vfd-main');
    const barCount = 28;
    const usefulBins = 30;
    const step = usefulBins / barCount;

    const barW = Math.floor(W / barCount) - 2;
    const barGap = Math.floor(W / barCount) - barW;

    const ledH = 3;
    const ledGap = 2;
    const ledStep = ledH + ledGap;
    const ledCount = Math.floor(H / ledStep);

    // Init peak arrays on first call
    if (!drawSpectrum.peaks) {
        drawSpectrum.peaks = new Array(barCount).fill(0);
        drawSpectrum.peakTimers = new Array(barCount).fill(0);
    }

    // Parse color once
    let cr = 176, cg = 254, cb = 255;
    const hex = mainColor.replace('#', '');
    if (hex.length === 6) {
        cr = parseInt(hex.slice(0, 2), 16);
        cg = parseInt(hex.slice(2, 4), 16);
        cb = parseInt(hex.slice(4, 6), 16);
    } else if (mainColor === '#ffffff' || mainColor === 'ffffff' || mainColor.toLowerCase() === 'white') {
        cr = cg = cb = 255;
    }

    for (let i = 0; i < barCount; i++) {
        let sum = 0;
        const start = Math.floor(i * step);
        const end = Math.max(start + 1, Math.floor((i + 1) * step));
        for (let j = start; j < end; j++) sum += specDataArray[j] || 0;
        const val = sum / (end - start);
        const activeLeds = Math.round((val / 255) * ledCount);
        const x = i * (barW + barGap);

        // Peak hold logic
        if (activeLeds >= drawSpectrum.peaks[i]) {
            drawSpectrum.peaks[i] = activeLeds;
            drawSpectrum.peakTimers[i] = 45;
        } else if (drawSpectrum.peakTimers[i] > 0) {
            drawSpectrum.peakTimers[i]--;
        } else {
            drawSpectrum.peaks[i] = Math.max(0, drawSpectrum.peaks[i] - 1);
        }

        const peakLed = drawSpectrum.peaks[i];

        for (let l = 0; l < ledCount; l++) {
            const y = H - (l + 1) * ledStep;
            if (l === peakLed && peakLed > 0) {
                // Peak LED — rouge
                specCtx.fillStyle = 'rgba(255, 60, 34, 0.9)';
            } else if (l < activeLeds) {
                const alpha = 0.2 + (l / ledCount) * 0.8;
                specCtx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
            } else {
                specCtx.fillStyle = '#111';
            }
            specCtx.fillRect(x, y, barW, ledH);
        }
    }
}

function drawVUOff() {
    ctx.clearRect(0, 0, 800, 70);
    ctx.font = "500 14px 'Inter', sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#1a1a1a"; ctx.fillText("L", 18, 17);
    ctx.fillStyle = "#1a1a1a"; ctx.fillText("R", 18, 52);
    const ledH = 18, ledGap = 0, ledStep = 18;
    const ledsPerSeg = Math.floor(18 / ledStep);
    for (let i = 0; i < 25; i++) {
        for (let l = 0; l < ledsPerSeg; l++) {
            ctx.fillStyle = "#111";
            ctx.fillRect(60 + i * 28, 8 + l * ledStep, 25, ledH);
            ctx.fillRect(60 + i * 28, 43 + l * ledStep, 25, ledH);
        }
    }
}

function drawVU() {
    requestAnimationFrame(drawVU);
    if (!analyserL) return;

    if (!vuVisible) { drawVUOff(); return; }

    analyserL.getByteFrequencyData(dataArrayL);
    analyserR.getByteFrequencyData(dataArrayR);

    let sumL = 0, sumR = 0;
    for (let i = 0; i < 15; i++) { sumL += dataArrayL[i]; sumR += dataArrayR[i]; }
    let volL = Math.min(255, (sumL / 15) * vuGain), volR = Math.min(255, (sumR / 15) * vuGain);

    if (monoOn) { const avg = (volL + volR) / 2; volL = avg; volR = avg; }

    lastVolL = volL < lastVolL ? lastVolL - 5 : volL;
    lastVolR = volR < lastVolR ? lastVolR - 5 : volR;

    // Peak hold
    if (lastVolL >= peakL) { peakL = lastVolL; peakTimerL = 25; }
    else if (peakTimerL > 0) { peakTimerL--; } else { peakL = Math.max(0, peakL - 1.5); }
    if (lastVolR >= peakR) { peakR = lastVolR; peakTimerR = 25; }
    else if (peakTimerR > 0) { peakTimerR--; } else { peakR = Math.max(0, peakR - 1.5); }

    const mainColor = getVFDColor('--vfd-main'), redColor = getVFDColor('--vfd-red'), orangeColor = getVFDColor('--vfd-orange') || '#ff8800';
    ctx.clearRect(0, 0, 800, 70);
    ctx.font = "500 14px 'Inter', sans-serif";
    ctx.textBaseline = "middle";

    ctx.fillStyle = mainColor;
    ctx.fillText("L", 18, 17);
    ctx.fillText("R", 18, 52);

    // Parse mainColor to RGB for gradient LEDs
    let cr = 176, cg = 254, cb = 255;
    const hexC = mainColor.replace(/\s/g, '').replace('#', '');
    if (hexC.length === 6) { cr = parseInt(hexC.slice(0, 2), 16); cg = parseInt(hexC.slice(2, 4), 16); cb = parseInt(hexC.slice(4, 6), 16); }
    else if (hexC === 'ffffff' || mainColor.toLowerCase().includes('white')) { cr = cg = cb = 255; }

    const segCount = 25; // segments per row
    const segW = 25, segH = 18, segSpacing = 28;
    // Each segment = 3 mini-LEDs of 4px + 2px gap = 18px total
    const ledH = 18, ledGap = 0, ledStep = 18; // LED pleine
    const ledsPerSeg = Math.floor(segH / ledStep); // 3 LEDs

    for (let i = 0; i < segCount; i++) {
        const threshL = (i / segCount) * 255;
        const threshR = (i / segCount) * 255;
        const xPos = 60 + i * segSpacing;

        // Determine zone ratio for this segment (0=bass, 1=treble)
        const ratio = i / (segCount - 1);

        for (let row = 0; row < 2; row++) {
            const yBase = row === 0 ? 8 : 43;
            const vol = row === 0 ? lastVolL : lastVolR;
            const active = vol > (row === 0 ? threshL : threshR);
            const isPeak = row === 0
                ? (i === Math.min(24, Math.floor((peakL / 255) * 25)) && peakL > 10)
                : (i === Math.min(24, Math.floor((peakR / 255) * 25)) && peakR > 10);

            for (let l = 0; l < ledsPerSeg; l++) {
                const yLed = yBase + l * ledStep;
                if (isPeak) {
                    // Peak = rouge
                    ctx.fillStyle = `rgba(255,60,34,0.9)`;
                } else if (active) {
                    if (i > 21) {
                        // Zone rouge : dégradé rouge
                        const a = 0.5 + ratio * 0.5;
                        ctx.fillStyle = `rgba(255,60,34,${a})`;
                    } else if (i > 15) {
                        // Zone orange
                        const a = 0.4 + ratio * 0.6;
                        ctx.fillStyle = `rgba(255,136,0,${a})`;
                    } else {
                        // Zone cyan/blanc : dégradé ratio
                        const a = 0.25 + ratio * 0.75;
                        ctx.fillStyle = `rgba(${cr},${cg},${cb},${a})`;
                    }
                } else {
                    ctx.fillStyle = '#111';
                }
                ctx.fillRect(xPos, yLed, segW, ledH);
            }
        }
    }
}

function applyMono() {
    if (!channelMerger || !splitter) return;
    try { splitter.disconnect(channelMerger, 0, 1); } catch (e) { }
    try { splitter.disconnect(channelMerger, 1, 1); } catch (e) { }
    if (monoOn) {
        splitter.connect(channelMerger, 0, 1); // L → R output (mono)
    } else {
        splitter.connect(channelMerger, 1, 1); // R → R output (stereo)
    }
}

let statusResetTimer = null;
function delayedStatusReset() { clearTimeout(statusResetTimer); statusResetTimer = setTimeout(updateStatusText, 2000); }

function toggleLoudness() {
    if (!audioCtx || isBypass) return;
    loudnessOn = !loudnessOn;
    loudnessGain.gain.setTargetAtTime(loudnessOn ? 1.5 : 1, audioCtx.currentTime, 0.05);
    const el = document.getElementById('ind-loudness');
    el.classList.toggle('active', loudnessOn);
    setTimeout(updateStatusText, 1200);
}

function toggleMono() {
    if (!audioCtx) return;
    monoOn = !monoOn;
    applyMono();
    const el = document.getElementById('ind-mono');
    el.classList.toggle('active', monoOn);
    setTimeout(updateStatusText, 1200);
}

function changeBass(d) {
    if (!bassFilter || isBypass) return;
    bassLevel = Math.min(12, Math.max(-12, bassLevel + d));
    bassFilter.gain.setTargetAtTime(bassLevel, audioCtx.currentTime, 0.05);
    showBass();
}
function showBass() { statusFunc.innerText = `BASS: ${bassLevel > 0 ? '+' : ''}${bassLevel} dB`; }

function changeTreble(d) {
    if (!trebleFilter || isBypass) return;
    trebleLevel = Math.min(12, Math.max(-12, trebleLevel + d));
    trebleFilter.gain.setTargetAtTime(trebleLevel, audioCtx.currentTime, 0.05);
    showTreble();
}
function showTreble() { statusFunc.innerText = `TREBLE: ${trebleLevel > 0 ? '+' : ''}${trebleLevel} dB`; }

function changeToneFlat() {
    if (!bassFilter || !trebleFilter) return;
    bassLevel = 0; trebleLevel = 0;
    bassFilter.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
    trebleFilter.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
    currentPreset = null;
    const ind = document.getElementById('eq-preset-ind');
    if (ind) ind.textContent = '';
    statusFunc.innerText = "TONE FLAT";
    setTimeout(updateStatusText, 1500);
}

const EQ_PRESETS = {
    rock: { bass: 8, treble: 6 },
    pop: { bass: 3, treble: 5 },
    dance: { bass: 10, treble: 3 },
    jazz: { bass: 4, treble: -3 },
    classic: { bass: -3, treble: 4 },
    live: { bass: -3, treble: 6 },
    vocal: { bass: -5, treble: 7 },
    flat: { bass: 0, treble: 0 },
};

let currentPreset = null;

function applyEQPreset(name) {
    if (!bassFilter || !trebleFilter) return;
    const p = EQ_PRESETS[name];
    if (!p) return;
    bassLevel = p.bass; trebleLevel = p.treble;
    bassFilter.frequency.value = 80;
    trebleFilter.frequency.value = 8000;
    bassFilter.gain.setTargetAtTime(bassLevel, audioCtx.currentTime, 0.02);
    trebleFilter.gain.setTargetAtTime(trebleLevel, audioCtx.currentTime, 0.02);
    currentPreset = name === 'flat' ? null : name;
    const ind = document.getElementById('eq-preset-ind');
    if (ind) ind.textContent = currentPreset ? `EQ: ${currentPreset.toUpperCase()}` : '';
    setTimeout(updateStatusText, 1500);
}

let vfdWhite = true;
function toggleVFDColor() {
    vfdWhite = !vfdWhite;
    const root = document.documentElement;
    if (vfdWhite) {
        root.style.setProperty('--vfd-main', '#ffffff');
        root.style.setProperty('--vfd-shadow-main', 'rgba(255, 255, 255, 0.35)');
        root.style.setProperty('--vfd-glow', 'rgba(255, 255, 255, 0.2)');
    } else {
        root.style.setProperty('--vfd-main', '#B0FEFF');
        root.style.setProperty('--vfd-shadow-main', 'rgba(176, 254, 255, 0.35)');
        root.style.setProperty('--vfd-glow', 'rgba(0, 255, 255, 0.2)');
    }
    setTimeout(updateStatusText, 1200);
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
function changeBalance(d) {
    if (!pannerNode) return;
    balanceLevel = Math.min(1, Math.max(-1, Math.round((balanceLevel + d) * 10) / 10));
    pannerNode.pan.setTargetAtTime(balanceLevel, audioCtx.currentTime, 0.05);
    showBalance();
}
function showBalance() {
    if (balanceLevel === 0) { statusFunc.innerText = 'BALANCE: CENTER'; return; }
    const side = balanceLevel > 0 ? 'R' : 'L';
    statusFunc.innerText = `BALANCE: ${side} ${Math.round(Math.abs(balanceLevel) * 10)}`;
}
function toggleTime() { timeMode = (timeMode === 'elapsed' ? 'remaining' : 'elapsed'); }
function toggleVUMode() { vuVisible = !vuVisible; }
let spectrumVisible = true;
function toggleSpectrum() { spectrumVisible = !spectrumVisible; }
function toggleRepeat() { repeatMode = (repeatMode + 1) % 3; document.getElementById('ind-repeat1').classList.toggle('active', repeatMode === 1); document.getElementById('ind-repeatAll').classList.toggle('active', repeatMode === 2); }
function handleAB() { const ind = document.getElementById('ind-ab'); if (pointA === null) { pointA = audio.currentTime; ind.classList.add('active'); } else if (pointB === null) { pointB = audio.currentTime; } else { pointA = pointB = null; ind.classList.remove('active'); } }
function toggleShuffle() { isShuffle = !isShuffle; document.getElementById('ind-shuffle').classList.toggle('active', isShuffle); }
function openArtModal() {
    if (!playlist.length) return;
    // Populate info from file-info-line
    document.getElementById('art-track-info').innerText = fileInfoLine.innerText;
    document.getElementById('artModal').style.display = 'flex';
}
function confirmRestart() { document.getElementById('restartModal').style.display = 'flex'; }

let trayOpen = false;
function toggleTray() {
    trayOpen = !trayOpen;
    const door = document.getElementById('trayDoor');
    const icon = document.getElementById('trayIcon');
    if (trayOpen) {
        door.classList.add('tray-open');
        icon.classList.replace('fa-chevron-down', 'fa-chevron-up');
    } else {
        door.classList.remove('tray-open');
        icon.classList.replace('fa-chevron-up', 'fa-chevron-down');
    }
}

let vuGain = 1;
function changeVUGain(d) {
    vuGain = Math.min(3, Math.max(0.1, Math.round((vuGain + d) * 10) / 10));
    statusFunc.innerText = `VU GAIN: ${Math.round(vuGain * 100)}%`;
    setTimeout(updateStatusText, 1200);
}

// Start spectrum loop after DOM is fully parsed
const specCanvas = document.getElementById('spectrum-canvas');
if (specCanvas) { specCtx = specCanvas.getContext('2d'); drawSpectrum(); }

// ── DRAG & DROP ──────────────────────────────────────────────────
(function initDragDrop() {
    const overlay = document.getElementById('drop-overlay');
    let dragCounter = 0;

    document.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        overlay.classList.add('visible');
    });

    document.addEventListener('dragleave', (e) => {
        dragCounter--;
        if (dragCounter === 0) overlay.classList.remove('visible');
    });

    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        overlay.classList.remove('visible');

        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/') || /\.(mp3|flac|wav|ogg|aac|m4a|opus|weba)$/i.test(f.name));
        if (!files.length) return;

        if (playlist.length > 0) {
            // Ajouter à la suite sans interrompre la lecture
            playlist.push(...files);
            statusFunc.innerText = `+${files.length} TRACK${files.length > 1 ? 'S' : ''}`;
            setTimeout(updateStatusText, 1500);
        } else {
            playlist = files;
            currentIndex = 0;
            loadTrack(0);
            handlePlay();
        }
    });
})();
