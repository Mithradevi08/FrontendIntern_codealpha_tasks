/* =========================================================
   Waveform Music Player – logic (Vanilla JavaScript)
   ========================================================= */

/* ---------------------------------------------------------
   1. PLAYLIST DATA
   Each song: title, artist, src (audio), colors (for artwork
   and theme glow) and optional cover (path to your own image).
   The sample audio comes from SoundHelix (royalty-free).
   --------------------------------------------------------- */
const BASE = "https://www.soundhelix.com/examples/mp3/";

const playlist = [
  { title: "Neon Skyline",   artist: "SoundHelix",  src: BASE + "SoundHelix-Song-1.mp3", colors: ["#7c3aed", "#ec4899"] },
  { title: "Midnight Drive", artist: "T. Schürger", src: BASE + "SoundHelix-Song-2.mp3", colors: ["#0ea5e9", "#6366f1"] },
  { title: "Golden Hour",    artist: "SoundHelix",  src: BASE + "SoundHelix-Song-3.mp3", colors: ["#f59e0b", "#ef4444"] },
  { title: "Ocean Echoes",   artist: "T. Schürger", src: BASE + "SoundHelix-Song-4.mp3", colors: ["#10b981", "#0ea5e9"] },
  { title: "Pulse",          artist: "SoundHelix",  src: BASE + "SoundHelix-Song-5.mp3", colors: ["#ec4899", "#f97316"] },
  { title: "Afterglow",      artist: "T. Schürger", src: BASE + "SoundHelix-Song-6.mp3", colors: ["#8b5cf6", "#22d3ee"] }
];
// To use your own local files, see the instructions in the README / answer.
// Example: { title: "My Song", artist: "Me", src: "songs/my-song.mp3", cover: "images/my-song.jpg", colors: ["#7c3aed", "#ec4899"] }

/* ---------------------------------------------------------
   2. GRAB HTML ELEMENTS
   --------------------------------------------------------- */
const $ = (id) => document.getElementById(id);

const appEl        = document.querySelector(".app");
const coverEl      = $("cover");
const artworkWrap  = $("artwork-wrap");
const titleEl      = $("title");
const artistEl     = $("artist");
const errorEl      = $("error-msg");
const progressEl   = $("progress");
const currentTimeEl= $("current-time");
const durationEl   = $("duration");
const playBtn      = $("play-btn");
const iconPlay     = $("icon-play");
const iconPause    = $("icon-pause");
const prevBtn      = $("prev-btn");
const nextBtn      = $("next-btn");
const shuffleBtn   = $("shuffle-btn");
const repeatBtn    = $("repeat-btn");
const repeatBadge  = $("repeat-one-badge");
const muteBtn      = $("mute-btn");
const iconVol      = $("icon-vol");
const iconMute     = $("icon-mute");
const volumeEl     = $("volume");
const volumeValue  = $("volume-value");
const playlistEl   = $("playlist");
const trackCountEl = $("track-count");
const addForm      = $("add-form");

/* ---------------------------------------------------------
   3. STATE
   --------------------------------------------------------- */
const audio = new Audio();       // the HTML5 Audio object
audio.preload = "metadata";

let currentIndex = 0;            // index of the current song
let isShuffle = false;
let repeatMode = "off";          // "off" | "all" | "one"
let isSeeking = false;           // true while the user drags the progress bar
let lastVolume = 0.7;            // remembered volume for unmute
let shuffleHistory = [];         // songs played in shuffle mode (for Previous)

/* ---------------------------------------------------------
   4. HELPERS
   --------------------------------------------------------- */

// Turn seconds into "m:ss"
function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m + ":" + String(s).padStart(2, "0");
}

// Make a gradient album cover (as an SVG data URL) so no image files are needed
function makeCover(colors, title) {
  const letter = (title || "♪").trim().charAt(0).toUpperCase();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${colors[0]}"/>
          <stop offset="1" stop-color="${colors[1]}"/>
        </linearGradient>
      </defs>
      <rect width="400" height="400" fill="url(#g)"/>
      <circle cx="310" cy="90" r="120" fill="#fff" opacity="0.12"/>
      <circle cx="80" cy="340" r="150" fill="#000" opacity="0.15"/>
      <text x="200" y="250" font-family="Arial, sans-serif" font-size="190" font-weight="800"
            text-anchor="middle" fill="#fff" opacity="0.9">${letter}</text>
    </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

// Return the cover image for a song (own image if given, else generated)
function getCover(song) {
  return song.cover || makeCover(song.colors, song.title);
}

// Fill the coloured part of a range slider
function setRangeFill(input) {
  const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
  input.style.setProperty("--fill", pct + "%");
}

// Escape text before putting it in HTML (prevents broken markup / XSS)
function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Show/hide an element. We use the "hidden" ATTRIBUTE because the
// element.hidden property does not work on SVG icons.
function setHidden(el, hide) {
  el.toggleAttribute("hidden", hide);
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}
function hideError() {
  errorEl.hidden = true;
}

/* ---------------------------------------------------------
   5. PLAYLIST RENDERING
   --------------------------------------------------------- */
function renderPlaylist() {
  playlistEl.innerHTML = "";
  trackCountEl.textContent = playlist.length + (playlist.length === 1 ? " song" : " songs");

  if (playlist.length === 0) {
    playlistEl.innerHTML = '<li class="empty">Your playlist is empty. Add a song below.</li>';
    return;
  }

  playlist.forEach((song, index) => {
    const li = document.createElement("li");
    li.className = "track" + (index === currentIndex ? " active" : "") + (song.failed ? " unavailable" : "");
    li.tabIndex = 0;
    li.dataset.index = index;
    li.innerHTML = `
      <div class="track__thumb">
        <img src="${getCover(song)}" alt="" />
        <div class="eq"><span></span><span></span><span></span></div>
      </div>
      <div class="track__meta">
        <div class="track__title">${escapeHTML(song.title)}</div>
        <div class="track__artist">${escapeHTML(song.artist || "Unknown artist")}</div>
      </div>
      <span class="track__duration">${song.duration ? formatTime(song.duration) : "--:--"}</span>
      <button class="track__remove" title="Remove" aria-label="Remove ${escapeHTML(song.title)}">✕</button>
    `;
    playlistEl.appendChild(li);
  });
}

// Click / keyboard handling for the playlist (event delegation)
playlistEl.addEventListener("click", (e) => {
  const li = e.target.closest(".track");
  if (!li) return;
  const index = Number(li.dataset.index);

  if (e.target.closest(".track__remove")) {
    removeSong(index);
  } else {
    shuffleHistory = [];
    loadTrack(index, true);
  }
});
playlistEl.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("track")) {
    e.preventDefault();
    shuffleHistory = [];
    loadTrack(Number(e.target.dataset.index), true);
  }
});

// Read each song's length in the background so the playlist can show durations
function preloadDurations() {
  playlist.forEach((song) => {
    if (song.duration || song.durationRequested) return;
    song.durationRequested = true;
    const probe = new Audio();
    probe.preload = "metadata";
    probe.src = song.src;
    probe.addEventListener("loadedmetadata", () => {
      song.duration = probe.duration;
      updateTrackDuration(song);
    });
    probe.addEventListener("error", () => { song.failed = true; renderPlaylist(); });
  });
}
function updateTrackDuration(song) {
  const index = playlist.indexOf(song);
  const li = playlistEl.querySelector(`.track[data-index="${index}"] .track__duration`);
  if (li) li.textContent = formatTime(song.duration);
}

/* ---------------------------------------------------------
   6. LOADING & PLAYING TRACKS
   --------------------------------------------------------- */

// Load a song into the player. If autoplay is true, start playing it.
function loadTrack(index, autoplay = false) {
  if (playlist.length === 0) return;
  currentIndex = (index + playlist.length) % playlist.length;
  const song = playlist[currentIndex];

  hideError();
  audio.src = song.src;
  audio.load();

  // Update song information
  titleEl.textContent = song.title;
  artistEl.textContent = song.artist || "Unknown artist";
  coverEl.src = getCover(song);
  document.title = song.title + " – Waveform";
  durationEl.textContent = song.duration ? formatTime(song.duration) : "0:00";
  currentTimeEl.textContent = "0:00";
  progressEl.value = 0;
  setRangeFill(progressEl);

  // Theme colours follow the album art
  document.documentElement.style.setProperty("--accent1", song.colors[0]);
  document.documentElement.style.setProperty("--accent2", song.colors[1]);

  renderPlaylist();
  scrollActiveIntoView();

  if (autoplay) playAudio();
  else setPlayingUI(false);
}

function playAudio() {
  const promise = audio.play();
  // play() returns a promise; it can be rejected (e.g. bad file, browser rules)
  if (promise !== undefined) {
    promise.catch((err) => {
      if (err.name !== "AbortError") setPlayingUI(false);
    });
  }
}
function pauseAudio() {
  audio.pause();
}

function togglePlay() {
  if (playlist.length === 0) return;
  if (!audio.src) loadTrack(currentIndex);
  if (audio.paused) playAudio();
  else pauseAudio();
}

// Switch the play/pause icon and animations
function setPlayingUI(isPlaying) {
  setHidden(iconPlay, isPlaying);
  setHidden(iconPause, !isPlaying);
  playBtn.title = isPlaying ? "Pause" : "Play";
  playBtn.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
  artworkWrap.classList.toggle("playing", isPlaying);
  appEl.classList.toggle("is-playing", isPlaying);
}

function scrollActiveIntoView() {
  const active = playlistEl.querySelector(".track.active");
  if (active) active.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

/* ---------------------------------------------------------
   7. NEXT / PREVIOUS / SHUFFLE
   --------------------------------------------------------- */

// Pick a random song that is not the current one
function randomIndex() {
  if (playlist.length <= 1) return currentIndex;
  let i;
  do { i = Math.floor(Math.random() * playlist.length); } while (i === currentIndex);
  return i;
}

function nextTrack(autoplay = true) {
  if (playlist.length === 0) return;
  if (isShuffle) {
    shuffleHistory.push(currentIndex);
    loadTrack(randomIndex(), autoplay);
  } else {
    loadTrack(currentIndex + 1, autoplay);
  }
}

function prevTrack() {
  if (playlist.length === 0) return;
  // If the song has played for more than 3 seconds, restart it instead
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  if (isShuffle && shuffleHistory.length > 0) {
    loadTrack(shuffleHistory.pop(), true);
  } else {
    loadTrack(currentIndex - 1, true);
  }
}

function toggleShuffle() {
  isShuffle = !isShuffle;
  shuffleHistory = [];
  shuffleBtn.classList.toggle("active", isShuffle);
  shuffleBtn.setAttribute("aria-pressed", String(isShuffle));
  shuffleBtn.title = "Shuffle: " + (isShuffle ? "on" : "off");
}

// Repeat cycles: off -> all -> one -> off
function toggleRepeat() {
  repeatMode = repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";
  repeatBtn.classList.toggle("active", repeatMode !== "off");
  repeatBadge.hidden = repeatMode !== "one";
  const label = "Repeat: " + repeatMode;
  repeatBtn.title = label;
  repeatBtn.setAttribute("aria-label", label);
}

/* ---------------------------------------------------------
   8. AUDIO EVENTS
   --------------------------------------------------------- */
audio.addEventListener("play",  () => setPlayingUI(true));
audio.addEventListener("pause", () => setPlayingUI(false));

// Duration becomes known
audio.addEventListener("loadedmetadata", () => {
  durationEl.textContent = formatTime(audio.duration);
  const song = playlist[currentIndex];
  if (song && !song.duration) {
    song.duration = audio.duration;
    updateTrackDuration(song);
  }
});

// Update progress bar while playing
audio.addEventListener("timeupdate", () => {
  if (isSeeking || !audio.duration) return;
  progressEl.value = (audio.currentTime / audio.duration) * 1000;
  setRangeFill(progressEl);
  currentTimeEl.textContent = formatTime(audio.currentTime);
});

// Song finished -> autoplay next, depending on repeat mode
audio.addEventListener("ended", () => {
  if (repeatMode === "one") {
    audio.currentTime = 0;
    playAudio();
  } else if (isShuffle) {
    nextTrack(true);
  } else if (currentIndex === playlist.length - 1 && repeatMode === "off") {
    // Reached the end of the playlist: go back to the first song, but stay paused
    loadTrack(0, false);
  } else {
    nextTrack(true);
  }
});

// Handle loading errors gracefully (bad URL, no internet, unsupported file)
audio.addEventListener("error", () => {
  if (!audio.getAttribute("src")) return;
  const song = playlist[currentIndex];
  if (song) {
    song.failed = true;
    renderPlaylist();
  }
  setPlayingUI(false);
  showError("Couldn't load \"" + (song ? song.title : "this song") + "\". Check the file path or your internet connection, or try another track.");
});

/* ---------------------------------------------------------
   9. PROGRESS BAR (click or drag to seek)
   --------------------------------------------------------- */
// While dragging: just preview the time
progressEl.addEventListener("input", () => {
  isSeeking = true;
  setRangeFill(progressEl);
  if (audio.duration) {
    currentTimeEl.textContent = formatTime((progressEl.value / 1000) * audio.duration);
  }
});
// When released (or clicked): jump to that position
progressEl.addEventListener("change", () => {
  if (audio.duration) {
    audio.currentTime = (progressEl.value / 1000) * audio.duration;
  }
  isSeeking = false;
});

/* ---------------------------------------------------------
   10. VOLUME & MUTE
   --------------------------------------------------------- */
function updateVolumeUI() {
  const vol = audio.muted ? 0 : audio.volume;
  volumeEl.value = Math.round(vol * 100);
  volumeValue.textContent = Math.round(vol * 100) + "%";
  setRangeFill(volumeEl);
  setHidden(iconVol, vol === 0);
  setHidden(iconMute, vol !== 0);
  muteBtn.title = vol === 0 ? "Unmute" : "Mute";
  muteBtn.setAttribute("aria-label", vol === 0 ? "Unmute" : "Mute");
}

volumeEl.addEventListener("input", () => {
  const v = volumeEl.value / 100;
  audio.volume = v;
  audio.muted = v === 0;
  if (v > 0) lastVolume = v;
  updateVolumeUI();
});

muteBtn.addEventListener("click", () => {
  if (audio.muted || audio.volume === 0) {
    audio.muted = false;
    audio.volume = lastVolume || 0.7;   // restore previous volume
  } else {
    lastVolume = audio.volume;
    audio.muted = true;
  }
  updateVolumeUI();
});

/* ---------------------------------------------------------
   11. DYNAMIC PLAYLIST (add / remove songs)
   --------------------------------------------------------- */
const palette = [
  ["#7c3aed", "#ec4899"], ["#0ea5e9", "#6366f1"], ["#f59e0b", "#ef4444"],
  ["#10b981", "#0ea5e9"], ["#ec4899", "#f97316"], ["#8b5cf6", "#22d3ee"]
];

addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title  = $("add-title").value.trim();
  const artist = $("add-artist").value.trim();
  const url    = $("add-url").value.trim();
  const file   = $("add-file").files[0];

  if (!title) return;
  if (!url && !file) {
    showError("Please enter an audio URL or choose an audio file.");
    return;
  }

  const song = {
    title,
    artist: artist || "Unknown artist",
    // A chosen file becomes a temporary local URL (lasts until the page is refreshed)
    src: file ? URL.createObjectURL(file) : url,
    colors: palette[Math.floor(Math.random() * palette.length)]
  };
  playlist.push(song);
  addForm.reset();
  hideError();

  const wasEmpty = playlist.length === 1;
  renderPlaylist();
  preloadDurations();
  if (wasEmpty) loadTrack(0, false);
});

function removeSong(index) {
  const wasPlaying = !audio.paused;
  const removingCurrent = index === currentIndex;
  playlist.splice(index, 1);
  shuffleHistory = [];

  if (playlist.length === 0) {
    // Nothing left: reset the player
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    currentIndex = 0;
    titleEl.textContent = "No songs";
    artistEl.textContent = "Add a song to start";
    coverEl.src = makeCover(["#374151", "#111827"], "♪");
    durationEl.textContent = "0:00";
    currentTimeEl.textContent = "0:00";
    progressEl.value = 0;
    setRangeFill(progressEl);
    setPlayingUI(false);
    renderPlaylist();
    return;
  }

  if (removingCurrent) {
    loadTrack(index >= playlist.length ? 0 : index, wasPlaying);
  } else {
    if (index < currentIndex) currentIndex--;
    renderPlaylist();
  }
}

/* ---------------------------------------------------------
   12. BUTTONS & KEYBOARD SHORTCUTS
   --------------------------------------------------------- */
playBtn.addEventListener("click", togglePlay);
nextBtn.addEventListener("click", () => nextTrack(true));
prevBtn.addEventListener("click", prevTrack);
shuffleBtn.addEventListener("click", toggleShuffle);
repeatBtn.addEventListener("click", toggleRepeat);

// Space = play/pause, Arrow keys = next/prev (ignored while typing in a field)
document.addEventListener("keydown", (e) => {
  const tag = e.target.tagName;
  if (tag === "INPUT" || tag === "BUTTON" || e.target.classList.contains("track")) return;
  if (e.code === "Space") { e.preventDefault(); togglePlay(); }
  if (e.code === "ArrowRight") nextTrack(true);
  if (e.code === "ArrowLeft") prevTrack();
});

/* ---------------------------------------------------------
   13. START THE APP
   --------------------------------------------------------- */
audio.volume = 0.7;
updateVolumeUI();
renderPlaylist();
loadTrack(0, false);    // show the first song (browsers block autoplay on page load)
preloadDurations();
