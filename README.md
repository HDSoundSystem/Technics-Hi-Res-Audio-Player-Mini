# Technics High Resolution Vintage Audio Player

A high-fidelity web application emulating the aesthetics and user experience of the iconic Technics CD player from the 1990s.

<img width="1563" height="743" alt="Capture d’écran 2026-05-01 203020" src="https://github.com/user-attachments/assets/4db4213d-ec65-4891-a80c-5b652f50b3de" />

<img width="1563" height="742" alt="Capture d’écran 2026-05-01 170440" src="https://github.com/user-attachments/assets/8f7cf0aa-b2dd-4f43-adee-30d3df73bace" />

## 📱 Overview
This audio player recreates the authentic look of the vintage Vacuum Fluorescent Displays (VFD) and physical tactile controls, blending retro hardware vibes with modern web capabilities.

## ✨ Features

### 🎛 Playback Controls
- **Full Transport Deck**: Play, Pause, Stop, Skip (+/- 10s), and track navigation.
- **Numeric Keypad**: Direct track entry and selection.
- **Jog Shuttle**: Interactive slider for rapid search and scanning.
- **Playlist Management**: Supports multi-file selection via the "Open" button.

### 📊 VFD (Vacuum Fluorescent Display)
- **Time Counter**: Stabilized digital display using tabular numerals to prevent jitter, with *Elapsed* and *Remaining* time modes.
- **Dynamic VU Meter**: Real-time frequency spectrum analyzer (L/R) with red peak segments.
- **Metadata Support**: Displays Artist, Album, and Title by reading ID3 tags using `jsmediatags`.
- **Status Indicators**: Visual cues for Shuffle, Repeat (1/All), and A-B Loop modes.

### 🎨 Design & Ergonomics
- **Dual Chassis Themes**: Switch between Dark Mode (Black) and Light Mode (Beige/Ivory) by clicking the Technics logo.
- **Refined Typography**: Uses the **Inter** typeface (weights 400/500) for a premium, modern look.
- **Color Accuracy**: Authentic mint-green glow (`#CBFFB3`) with custom glow effects.
- **Album Art**: Modal window to view embedded cover art by clicking the file info line.

## 🛠 Technical Stack
- **HTML5 / CSS3**: CSS Variables for theme management, Flexbox/Grid for layout, and PWA readiness.
- **JavaScript (Vanilla)**: Core logic for playback and DOM manipulation.
- **Web Audio API**: Frequency analysis for the VU meter and Peak Search processing.
- **jsmediatags**: External library for extracting metadata from MP3/FLAC files.
- **DS-Digital**: Digital font for the vintage counter rendering.

## 🚀 Getting Started
1. Download the `index.html` file.
2. Ensure you have an active internet connection to load Google Fonts and the `jsmediatags` library.
3. Open `index.html` in any modern web browser.
4. Click **OPEN** to load your local audio files.

## 📝 Persistent Settings
The application automatically saves your preferences via `localStorage`:
- **Language**: Locked to English for Hi-Fi authenticity.
- **Theme**: Your choice of Dark or Light mode is remembered across browser sessions.

---
*Developed with passion for vintage audio by Yohann Zaoui.*
