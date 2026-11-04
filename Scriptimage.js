// ---- Edit this list to use your own images ----
const P = (id, w = 1200) => `https://picsum.photos/id/${id}/${w}/${Math.round(w * 0.75)}`;
const images = [
  { title: "Mountain Lake",   category: "Nature",  id: 1018 },
  { title: "Forest Path",     category: "Nature",  id: 1015 },
  { title: "Misty Valley",    category: "Nature",  id: 1036 },
  { title: "Wild Coast",      category: "Nature",  id: 1039 },
  { title: "Downtown Lights", category: "City",    id: 1031 },
  { title: "Old Street",      category: "City",    id: 1067 },
  { title: "Glass Towers",    category: "City",    id: 1076 },
  { title: "City Towers",     category: "City",    id: 1056 },
  { title: "Sleepy Dog",      category: "Animals", id: 237 },
  { title: "Curious Fox",     category: "Animals", id: 1024 },
  { title: "Highland Cow",    category: "Animals", id: 1084 },
  { title: "Garden Bird",     category: "Animals", id: 1025 },
  { title: "Fresh Berries",   category: "Food",    id: 1080 },
  { title: "Breakfast Table", category: "Food",    id: 292 },
  { title: "Coffee Break",    category: "Food",    id: 225 },
  { title: "Street Snacks",   category: "Food",    id: 312 },
].map(i => ({ ...i, src: P(i.id), thumb: P(i.id, 500) }));

const categories = ["All", ...new Set(images.map(i => i.category))];
const $ = id => document.getElementById(id);
const grid = $("grid"), filtersEl = $("filters"), lb = $("lightbox");
let activeCat = "All", query = "", visible = [], current = 0, lastFocus = null;

// ---- Filters ----
function renderFilters() {
  filtersEl.innerHTML = "";
  categories.forEach(cat => {
    const n = cat === "All" ? images.length : images.filter(i => i.category === cat).length;
    const b = document.createElement("button");
    b.innerHTML = `${cat}<small>${n}</small>`;
    b.className = cat === activeCat ? "active" : "";
    b.onclick = () => { activeCat = cat; renderFilters(); renderGrid(); };
    filtersEl.append(b);
  });
}

// ---- Grid ----
function renderGrid() {
  const prev = grid.querySelectorAll(".card");
  prev.forEach(c => c.classList.add("hide"));
  setTimeout(() => {
    visible = images.filter(i =>
      (activeCat === "All" || i.category === activeCat) &&
      i.title.toLowerCase().includes(query));
    grid.innerHTML = "";
    $("empty").hidden = visible.length > 0;
    visible.forEach((img, idx) => {
      const card = document.createElement("button");
      card.className = "card skeleton";
      card.style.animationDelay = `${idx * 40}ms`;
      card.setAttribute("aria-label", `Open ${img.title}`);
      const el = new Image();
      el.alt = `${img.title} (${img.category})`;
      el.loading = "lazy";
      el.onload = () => { el.classList.add("loaded"); card.classList.remove("skeleton"); };
      el.onerror = () => { card.classList.remove("skeleton"); card.textContent = "Image unavailable"; };
      el.src = img.thumb;
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.innerHTML = `<b>${img.title}</b><span>${img.category}</span>`;
      card.append(el, meta);
      card.onclick = () => openLB(idx);
      grid.append(card);
    });
  }, prev.length ? 200 : 0);
}

$("search").addEventListener("input", e => { query = e.target.value.trim().toLowerCase(); renderGrid(); });

// ---- Lightbox ----
function show(idx, animate = true) {
  current = (idx + visible.length) % visible.length;
  const item = visible[current], fig = document.querySelector(".lb-fig"), img = $("lbImg");
  const apply = () => {
    img.src = item.src; img.alt = item.title;
    $("lbTitle").textContent = item.title;
    $("lbCount").textContent = `${current + 1} / ${visible.length}`;
    fig.classList.remove("switching");
  };
  if (animate) { fig.classList.add("switching"); setTimeout(apply, 180); } else apply();
}
function openLB(idx) {
  lastFocus = document.activeElement;
  lb.hidden = false;
  requestAnimationFrame(() => lb.classList.add("open"));
  document.body.style.overflow = "hidden";
  show(idx, false);
  $("lbClose").focus();
}
function closeLB() {
  lb.classList.remove("open");
  document.body.style.overflow = "";
  setTimeout(() => { lb.hidden = true; }, 300);
  lastFocus && lastFocus.focus();
}
const next = () => show(current + 1), prev = () => show(current - 1);
$("lbNext").onclick = next; $("lbPrev").onclick = prev; $("lbClose").onclick = closeLB;
lb.addEventListener("click", e => { if (e.target === lb) closeLB(); });

document.addEventListener("keydown", e => {
  if (lb.hidden) return;
  if (e.key === "ArrowRight") next();
  else if (e.key === "ArrowLeft") prev();
  else if (e.key === "Escape") closeLB();
  else if (e.key === "Tab") {           // focus trap
    const f = [...lb.querySelectorAll("button")];
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

// Swipe support
let startX = 0;
lb.addEventListener("touchstart", e => { startX = e.touches[0].clientX; }, { passive: true });
lb.addEventListener("touchend", e => {
  const dx = e.changedTouches[0].clientX - startX;
  if (Math.abs(dx) > 50) dx < 0 ? next() : prev();
});

renderFilters();
renderGrid();