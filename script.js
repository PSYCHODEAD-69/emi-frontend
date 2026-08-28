/* ============================================================
   ELECTROMOTIVE INVENTORY — script.js
   EV scooter spare-parts storefront. Config values (API URL,
   WhatsApp number, email, brand name) come from config.js —
   never hardcode them here.
   ============================================================ */

/* ── CONFIG (from config.js) ── */
const WA_NUMBER  = window.EMI_WHATSAPP_NUMBER;
const EMAIL      = window.EMI_EMAIL;
const BRAND_NAME = window.BRAND_NAME;
const EMI_API    = window.EMI_API_URL;

/* ══════════════════════════════════════
   PRODUCTS / CATEGORIES / MODELS — Dynamic load from API
   ══════════════════════════════════════ */
let allProducts     = [];
let allCategories    = [];
let allModels        = []; // [{id, name}] — from GET /api/models
let currentCategory = "all";
let searchQuery      = "";
let priceFilter       = null; // { min, max } or null for no filter

async function loadProducts() {
  try {
    const [prodRes, catRes, modelRes] = await Promise.all([
      fetch(`${EMI_API}/api/products`),
      fetch(`${EMI_API}/api/categories`),
      fetch(`${EMI_API}/api/models`),
    ]);
    const products   = await prodRes.json();
    const categories = await catRes.json();
    const models      = await modelRes.json();
    allProducts    = Array.isArray(products) ? products : [];
    allCategories  = Array.isArray(categories) ? categories : [];
    allModels      = Array.isArray(models) ? models : [];
    renderCategoryTabs();
    renderProducts(allProducts);
    updateCategoryBadges(allProducts);
  } catch (err) {
    console.error("Failed to load products:", err);
    document.getElementById("productsGrid").innerHTML = "";
    document.getElementById("noProducts").style.display = "block";
    document.getElementById("noProducts").innerHTML =
      `<p style="font-size:1.1rem;">Could not load products. Please refresh.</p>`;
  }
}

/* Renders category filter tabs dynamically from the categories API,
   so adding/renaming/deleting a category in the admin panel is
   reflected here automatically — no HTML edits needed. */
function renderCategoryTabs() {
  const wrap = document.getElementById("catGrid");
  if (!wrap) return;

  const allImg = "/assets/all-cat.png";
  const placeholderImg = "https://via.placeholder.com/60?text=%20";

  const tabsHtml = [`
    <button class="cat-card ${currentCategory === 'all' ? 'active' : ''}" data-cat="all" onclick="filterCategory('all')">
      <div class="cat-img-wrap"><img src="${allImg}" alt="All"/></div>
      <div class="cat-name">All</div>
      <span class="cat-badge" id="badge-all">0</span>
    </button>
  `].concat(allCategories.map(c => `
    <button class="cat-card ${currentCategory === c.id ? 'active' : ''}" data-cat="${escapeHtml(c.id)}" onclick="filterCategory('${escapeHtml(c.id)}')">
      <div class="cat-img-wrap"><img src="${escapeHtml(c.image || placeholderImg)}" alt="${escapeHtml(c.label)}" onerror="this.src='${placeholderImg}'"/></div>
      <div class="cat-name">${escapeHtml(c.label)}</div>
      <span class="cat-badge" id="badge-${escapeHtml(c.id)}">0</span>
    </button>
  `));

  wrap.innerHTML = tabsHtml.join("");
}

function renderProducts(products) {
  const grid      = document.getElementById("productsGrid");
  const noProds   = document.getElementById("noProducts");
  if (!grid) return;

  let filtered = currentCategory === "all"
    ? products
    : products.filter(p => p.category === currentCategory);

  // Search: matches product name or description (case-insensitive)
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(p =>
      (p.name || "").toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q)
    );
  }

  // Price filter: uses priceNum (numeric price stored by the backend)
  if (priceFilter) {
    filtered = filtered.filter(p => {
      const price = p.priceNum ?? (parseInt(String(p.price || "0").replace(/[^0-9]/g, "")) || 0);
      const aboveMin = priceFilter.min == null || price >= priceFilter.min;
      const belowMax = priceFilter.max == null || price <= priceFilter.max;
      return aboveMin && belowMax;
    });
  }

  if (!filtered.length) {
    grid.innerHTML   = "";
    noProds.style.display = "block";
    return;
  }
  noProds.style.display = "none";

  grid.innerHTML = filtered.map(p => `
    <div class="product-card fade-up ${p.inStock === false ? "pc-oos" : ""}" data-cat="${p.category}" data-id="${p.id}" onclick="openProductDetail('${escapeHtml(p.id)}', event)">
      ${p.badge ? `<div class="pc-badge">${p.badge}</div>` : ""}
      ${p.inStock === false ? `<div class="pc-badge-oos">Out of Stock</div>` : ""}
      <div class="pc-img-wrap">
       <div class="pc-media-carousel" data-product-id="${escapeHtml(p.id)}" data-media='${escapeHtml(JSON.stringify(
         Array.isArray(p.media) && p.media.length
           ? p.media
           : (p.imageUrl ? [{ url: p.imageUrl, type: 'image' }] : [])
       ))}'>
  <div class="pc-media-track">
    ${(
      Array.isArray(p.media) && p.media.length
        ? p.media
        : (p.imageUrl ? [{ url: p.imageUrl, type: 'image' }] : [])
    ).map((m, index) => {
      if (m.type === 'video') {
        return `
          <div class="pc-media-item ${index === 0 ? 'active' : ''}" style="position:relative; width:100%; height:100%;">
            <video
              class="pc-media-video"
              src="${escapeHtml(m.url)}"
              autoplay
              muted
              loop
              playsinline
              preload="metadata"
              onclick="event.stopPropagation(); openMediaLightbox('${escapeHtml(p.id)}', ${index})">
            </video>
            <button class="pc-mute-btn" type="button" onclick="event.stopPropagation(); toggleMediaMute(this)">${muteIconSvg(true)}</button>
          </div>
        `;
      }

      return `
        <img
          class="pc-media-item ${index === 0 ? 'active' : ''}"
          src="${escapeHtml(m.url)}"
          alt="${escapeHtml(p.name)}"
          loading="lazy"
          onerror="this.src='https://via.placeholder.com/300x300?text=No+Image'"
          onclick="event.stopPropagation(); openMediaLightbox('${escapeHtml(p.id)}', ${index})"
        />
      `;
    }).join("")}
  </div>

  ${
    Array.isArray(p.media) && p.media.length > 1
      ? `
        <button class="pc-media-prev" type="button" onclick="event.stopPropagation(); changeProductMedia('${escapeHtml(p.id)}', -1)">${chevronSvg('left')}</button>
        <button class="pc-media-next" type="button" onclick="event.stopPropagation(); changeProductMedia('${escapeHtml(p.id)}', 1)">${chevronSvg('right')}</button>
      `
      : ''
  }
</div> 
      </div>
      <div class="pc-body">
        <div class="pc-cat">${categoryLabel(p.category)}</div>
        <div class="pc-name">${escapeHtml(p.name)}</div>
        ${p.description ? `<div class="pc-desc">${escapeHtml(p.description)}</div>` : ""}
        ${Array.isArray(p.models) && p.models.length ? `<div class="pc-models">${p.models.map(mid => `<span class="pc-model-tag">${escapeHtml(modelLabel(mid))}</span>`).join("")}</div>` : ""}
        <div class="pc-price-row">
          <span class="pc-price">${escapeHtml(p.price)}</span>
          <span class="pc-price-tag">Starting price</span>
        </div>
        <div class="pc-btns">
          <button class="pc-btn-cart"
            data-product="${escapeHtml(p.name)}"
            data-price="${escapeHtml(p.price)}"
            data-desc="${escapeHtml(p.description || p.name)}"
            data-id="${escapeHtml(p.id)}"
            ${p.inStock === false ? "disabled" : ""}
            onclick="event.stopPropagation(); handleCardAddToCart(this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="15" height="15"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            ${p.inStock === false ? "Out of Stock" : "Add to Cart"}
          </button>
          <button class="pc-btn-order"
            data-product="${escapeHtml(p.name)}"
            data-price="${escapeHtml(p.price)}"
            data-desc="${escapeHtml(p.description || p.name)}"
            data-id="${escapeHtml(p.id)}"
            ${p.inStock === false ? "disabled" : ""}
            onclick="event.stopPropagation(); handleCardOrderNow(this)">
            Order Now
          </button>
        </div>
      </div>
    </div>
  `).join("");

  // Re-init tilt and scroll reveal on new cards
  initCardTilt();
  initScrollReveal();
}

function filterCategory(cat) {
  currentCategory = cat;
  document.querySelectorAll(".cat-card").forEach(c => {
    c.classList.toggle("active", c.dataset.cat === cat);
  });
  renderProducts(allProducts);
}

function updateCategoryBadges(products) {
  const counts = { all: products.length };
  products.forEach(p => {
    counts[p.category] = (counts[p.category] || 0) + 1;
  });
  Object.entries(counts).forEach(([cat, count]) => {
    const badge = document.getElementById(`badge-${cat}`);
    if (badge) badge.textContent = count;
  });
}

/* Looks up a category's display label from the dynamic categories list
   (loaded from the API). Falls back to the raw id if not found — e.g.
   for a category that was later deleted but still on an old product. */
function categoryLabel(cat) {
  const found = allCategories.find(c => c.id === cat);
  return found ? found.label : cat;
}

/* Looks up a compatible-model's display name from the dynamic models
   list (loaded from GET /api/models). Falls back to the raw id if a
   model was deleted but is still referenced somewhere stale. */
function modelLabel(id) {
  const found = allModels.find(m => m.id === id);
  return found ? found.name : id;
}

/* ══════════════════════════════════════
   SEARCH — matches product name or description
   ══════════════════════════════════════ */
function handleProductSearch(value) {
  searchQuery = value || "";
  renderProducts(allProducts);
}

/* ══════════════════════════════════════
   PRICE FILTER — presets + custom range
   ══════════════════════════════════════ */
function applyPricePreset(min, max, btnEl) {
  priceFilter = { min, max };
  document.querySelectorAll(".price-preset-btn").forEach(b => b.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");

  const slider = document.getElementById("priceMaxSlider");
  if (slider) slider.value = max ?? slider.max;
  updatePriceSliderLabel(max ?? (slider ? slider.max : 2000));

  renderProducts(allProducts);
}

function handlePriceSliderInput(value) {
  updatePriceSliderLabel(value);
}

function updatePriceSliderLabel(value) {
  const label = document.getElementById("priceSliderValue");
  if (label) label.textContent = `Up to ₹${Number(value)}`;
}

function applyPriceSliderRange(value) {
  const max = Number(value);
  priceFilter = { min: 0, max };
  document.querySelectorAll(".price-preset-btn").forEach(b => b.classList.remove("active"));
  updatePriceSliderLabel(max);
  renderProducts(allProducts);
}

function clearPriceFilter() {
  priceFilter = null;
  const slider = document.getElementById("priceMaxSlider");
  if (slider) slider.value = slider.max;
  updatePriceSliderLabel(slider ? slider.max : 2000);
  document.querySelectorAll(".price-preset-btn").forEach(b => b.classList.remove("active"));
  renderProducts(allProducts);
}

function toggleFilterPanel() {
  const panel = document.getElementById("filterPanel");
  if (!panel) return;
  panel.classList.toggle("open");
}

/* ══════════════════════════════════════
   FEATURED REVIEWS — Latest 3 on homepage
   ══════════════════════════════════════ */
async function loadFeaturedReviews() {
  const container = document.getElementById("featuredReviews");
  if (!container) return;

  try {
    const res     = await fetch(`${EMI_API}/api/reviews`);
    const reviews = await res.json();
    const latest  = (Array.isArray(reviews) ? reviews : []).slice(0, 3);

    if (!latest.length) {
      container.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--muted);">
          <p>No reviews yet. <a href="reviews.html?focus=add" style="color:var(--accent);">Be the first to review!</a></p>
        </div>`;
      return;
    }

    container.innerHTML = latest.map(r => {
      const stars    = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
      const initials = r.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
      const date     = new Date(r.createdAt).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });

      const mediaList = Array.isArray(r.media) && r.media.length
        ? r.media
        : (r.mediaUrl ? [{ url: r.mediaUrl, type: r.mediaType || "image" }] : []);

      let mediaBtn = "";
      if (mediaList.length) {
        const hasVideo = mediaList.some(m => m.type === "video");
        const label = mediaList.length > 1
          ? `View ${hasVideo ? "Media" : "Photos"} (${mediaList.length})`
          : (mediaList[0].type === "video" ? "View Video" : "View Photo");
        const icon = hasVideo
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
        mediaBtn = `<button class="tc-media-btn" data-media='${escapeHtml(JSON.stringify(mediaList))}' onclick="openFeaturedMedia(JSON.parse(this.dataset.media))">
          ${icon}
          ${label}
        </button>`;
      }

      return `
        <div class="testi-card fade-up">
          <div class="tc-stars">${stars}</div>
          <p class="tc-text">"${escapeHtml(r.text)}"</p>
          ${mediaBtn}
          <div class="tc-author">
            <div class="tc-avatar">${initials}</div>
            <div>
              <div class="tc-name">${escapeHtml(r.name)}</div>
              <div class="tc-date">${date}</div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    initScrollReveal();
  } catch {
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--muted);">
        <p>Could not load reviews.</p>
      </div>`;
  }
}

/* ══════════════════════════════════════
   FEATURED REVIEW MEDIA LIGHTBOX
   ══════════════════════════════════════ */
let fmMediaList  = [];
let fmMediaIndex = 0;

function openFeaturedMedia(media) {
  fmMediaList  = Array.isArray(media) ? media : [media];
  fmMediaIndex = 0;
  if (!fmMediaList.length) return;

  const old = document.getElementById("pm-media-lb");
  if (old) old.remove();

  const lb = document.createElement("div");
  lb.id = "pm-media-lb";
  lb.className = "pm-media-lb";

  lb.innerHTML = `
    <button class="pm-lb-close" type="button" aria-label="Close">&times;</button>
    <button class="pm-lb-nav pm-lb-prev" type="button" aria-label="Previous">${chevronSvg('left')}</button>
    <div class="pm-lb-content"></div>
    <button class="pm-lb-nav pm-lb-next" type="button" aria-label="Next">${chevronSvg('right')}</button>
  `;

  document.body.appendChild(lb);
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => lb.classList.add("open"));

  renderFeaturedMedia();

  const closeBtn = lb.querySelector(".pm-lb-close");
  const prevBtn  = lb.querySelector(".pm-lb-prev");
  const nextBtn  = lb.querySelector(".pm-lb-next");

  function close() {
    lb.classList.remove("open");
    document.body.style.overflow = "";
    setTimeout(() => lb.remove(), 250);
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) {
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight") changeFeaturedMedia(1);
    if (e.key === "ArrowLeft") changeFeaturedMedia(-1);
  }

  closeBtn.addEventListener("click", close);
  lb.addEventListener("click", e => { if (e.target === lb) close(); });
  prevBtn.addEventListener("click", () => changeFeaturedMedia(-1));
  nextBtn.addEventListener("click", () => changeFeaturedMedia(1));
  document.addEventListener("keydown", onKey);
}

function renderFeaturedMedia() {
  const lb = document.getElementById("pm-media-lb");
  if (!lb) return;
  const content = lb.querySelector(".pm-lb-content");
  const m = fmMediaList[fmMediaIndex];
  if (!m) return;

  content.innerHTML = m.type === "video"
    ? `<video id="fmVideo" src="${escapeHtml(m.url)}" autoplay muted loop playsinline></video>
       <button id="fmMuteBtn" class="pm-lb-mute-btn" type="button">${muteIconSvg(true)}</button>`
    : `<img src="${escapeHtml(m.url)}" alt="">`;

  if (m.type === "video") {
    const muteBtn = content.querySelector("#fmMuteBtn");
    const video   = content.querySelector("#fmVideo");
    muteBtn.addEventListener("click", e => {
      e.stopPropagation();
      video.muted = !video.muted;
      muteBtn.innerHTML = muteIconSvg(video.muted);
    });
  }

  const showNav = fmMediaList.length > 1;
  lb.querySelector(".pm-lb-prev").style.display = showNav ? "flex" : "none";
  lb.querySelector(".pm-lb-next").style.display = showNav ? "flex" : "none";
}

function changeFeaturedMedia(direction) {
  fmMediaIndex += direction;
  if (fmMediaIndex >= fmMediaList.length) fmMediaIndex = 0;
  if (fmMediaIndex < 0) fmMediaIndex = fmMediaList.length - 1;
  renderFeaturedMedia();
}

// Inject tc-media-btn + featured lightbox CSS once
(function() {
  const s = document.createElement("style");
  s.textContent = `
    .tc-media-btn {
      display: inline-flex; align-items: center; gap: 6px;
      background: none; border: 1.5px solid var(--border);
      border-radius: 20px; padding: 5px 12px;
      font-family: 'DM Sans', sans-serif; font-size: 0.78rem;
      font-weight: 600; color: var(--ink2); cursor: pointer;
      margin-bottom: 12px; transition: all .2s;
    }
    .tc-media-btn:hover { border-color: var(--accent); color: var(--accent); }

    .pm-media-lb {
      position: fixed; inset: 0; background: rgba(0,0,0,.92);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999; opacity: 0; pointer-events: none; transition: opacity .25s;
    }
    .pm-media-lb.open { opacity: 1; pointer-events: all; }
    .pm-lb-content {
      position: relative; max-width: 92vw; max-height: 92vh;
      display: flex; align-items: center; justify-content: center;
    }
    .pm-lb-content img, .pm-lb-content video {
      max-width: 92vw; max-height: 92vh; border-radius: 12px; display: block;
      object-fit: contain;
    }
    .pm-lb-close {
      position: absolute; top: 20px; right: 24px;
      width: 40px; height: 40px; border-radius: 50%;
      background: #000; border: none; color: #fff;
      font-size: 1.8rem; line-height: 1; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      z-index: 3;
    }
    .pm-lb-nav {
      position: absolute; top: 50%; transform: translateY(-50%);
      width: 46px; height: 46px; padding: 0; border-radius: 50%;
      background: #000; border: 2px solid rgba(255,255,255,.35);
      color: #fff; font-size: 2rem; line-height: 1; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      z-index: 3; transition: background .2s, border-color .2s;
    }
    @media (hover: hover) and (pointer: fine) {
      .pm-lb-nav:hover { background: var(--accent); border-color: var(--accent); }
    }
    .pm-lb-nav:active { background: var(--accent); border-color: var(--accent); }
    .pm-lb-prev { left: 16px; }
    .pm-lb-next { right: 16px; }
    .pm-lb-mute-btn {
      position: absolute; bottom: 16px; right: 16px;
      width: 38px; height: 38px; border: none; border-radius: 50%;
      background: rgba(0,0,0,.7); color: #fff; cursor: pointer;
      display: flex; align-items: center; justify-content: center; padding: 0;
    }
    .pm-lb-mute-btn:hover { background: #000; }
    .pm-lb-mute-btn svg { width: 18px; height: 18px; }
    @media (max-width: 600px) {
      .pm-lb-nav { width: 40px; height: 40px; font-size: 1.7rem; }
      .pm-lb-prev { left: 8px; }
      .pm-lb-next { right: 8px; }
    }
  `;
  document.head.appendChild(s);
})();

/* ══════════════════════════════════════
   WHATSAPP LINK BUILDERS
   Only WhatsApp is used for ordering — no email/Instagram DM flow.
   ══════════════════════════════════════ */
function buildWALink(product, price, desc, model) {
  const msg = [
    `Hello ${BRAND_NAME}!`,
    ``,
    `I want to place an order for:`,
    `Product: ${product}`,
    ...(model ? [`Compatible Model: ${modelLabel(model)}`] : []),
    `Starting Price: ${price}`,
    `Details: ${desc}`,
    ``,
    `Please help me with order details.`,
    ``,
    `(Sent from ${BRAND_NAME})`
  ].join("\n");
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}

function buildGeneralWALink() {
  const msg = [
    `Hello ${BRAND_NAME}!`,
    ``,
    `I'd like to enquire about your EV scooter spare parts.`,
    `Please help me get started!`,
    ``,
    `(Sent from ${BRAND_NAME})`
  ].join("\n");
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}

/* ══════════════════════════════════════
   ORDER POPUP MODAL — WhatsApp only
   ══════════════════════════════════════ */
function orderProduct(el, model) {
  const product = el.dataset.product || "Spare Part";
  const price   = el.dataset.price   || "Contact for pricing";
  const desc    = el.dataset.desc    || "Spare part order";
  addRipple(el);
  showDeliveryPopup(buildWALink(product, price, desc, model || null), product, price, false, model || null);
}

/* ══════════════════════════════════════
   PRODUCT DETAIL MODAL (Amazon-style click-through)
   Opens when a product card is clicked anywhere EXCEPT its media
   (images/videos), which still open the media lightbox as before.
   Shows full description + model selection (if the product supports
   one or more models) before letting the user Add to Cart / Order.
   ══════════════════════════════════════ */
let detailModalSelectedModel = null;
let detailModalMedia = [];
let detailModalIndex = 0;
let detailModalOutOfStock = false;

function openProductDetail(productId, evt) {
  if (evt && evt.target.closest(".pc-media-carousel")) return;

  const p = allProducts.find(x => x.id === productId);
  if (!p) return;

  detailModalSelectedModel = null;
  detailModalIndex = 0;
  detailModalOutOfStock = p.inStock === false;

  const media = Array.isArray(p.media) && p.media.length
    ? p.media
    : (p.imageUrl ? [{ url: p.imageUrl, type: "image" }] : []);
  detailModalMedia = media;
  const productModels = Array.isArray(p.models) ? p.models : [];
  const hasModels = productModels.length > 0;

  const old = document.getElementById("pm-detail-modal");
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.id = "pm-detail-modal";
  modal.innerHTML = `
    <div class="pm-dtl-backdrop"></div>
    <div class="pm-dtl-box">
      <button class="pm-dtl-close" aria-label="Close">&times;</button>

      <div class="pm-dtl-media">
        <div class="pm-dtl-media-content" id="pmDtlMediaContent"></div>
        ${media.length > 1 ? `
          <button class="pm-dtl-nav pm-dtl-prev" onclick="changeDetailMedia(-1)">${chevronSvg("left")}</button>
          <button class="pm-dtl-nav pm-dtl-next" onclick="changeDetailMedia(1)">${chevronSvg("right")}</button>
          <div class="pm-dtl-dots">${media.map((_, i) => `<span class="pm-dtl-dot ${i === 0 ? "active" : ""}"></span>`).join("")}</div>
        ` : ""}
      </div>

      <div class="pm-dtl-info">
        <div class="pm-dtl-cat">${escapeHtml(categoryLabel(p.category))}</div>
        <div class="pm-dtl-name">${escapeHtml(p.name)}</div>
        <div class="pm-dtl-price">${escapeHtml(p.price)} <span class="pm-dtl-price-tag">Starting price</span></div>
        ${p.inStock === false ? `<div class="pm-dtl-oos-badge">Out of Stock</div>` : ""}
        ${p.description ? `<p class="pm-dtl-desc">${escapeHtml(p.description)}</p>` : ""}

        ${hasModels ? `
          <div class="pm-dtl-sizes">
            <div class="pm-dtl-sizes-label">Select Model <span class="pm-dtl-required">*</span></div>
            <div class="pm-dtl-size-row" id="pmDtlModelRow" role="radiogroup" aria-label="Select Model">
              ${productModels.map(mid => `<button type="button" class="pm-dtl-size-chip pm-dtl-side-chip" role="radio" aria-checked="false" data-model="${escapeHtml(mid)}" onclick="selectDetailModel(this)">${escapeHtml(modelLabel(mid))}</button>`).join("")}
            </div>
            <div class="pm-dtl-size-hint" id="pmDtlModelHint">Please select a compatible model to continue</div>
          </div>
        ` : ""}

        <div class="pm-dtl-btns">
          <button class="pc-btn-cart pm-dtl-btn-cart" id="pmDtlAddCart" ${(hasModels || p.inStock === false) ? "disabled" : ""}
            data-product="${escapeHtml(p.name)}" data-price="${escapeHtml(p.price)}" data-desc="${escapeHtml(p.description || p.name)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="15" height="15"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            ${p.inStock === false ? "Out of Stock" : "Add to Cart"}
          </button>
          <button class="pc-btn-order pm-dtl-btn-order" id="pmDtlOrderNow" ${(hasModels || p.inStock === false) ? "disabled" : ""}
            data-product="${escapeHtml(p.name)}" data-price="${escapeHtml(p.price)}" data-desc="${escapeHtml(p.description || p.name)}">
            Order Now
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";
  renderDetailMedia();
  requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add("pm-dtl-open")));

  function closeModal() {
    modal.classList.remove("pm-dtl-open");
    document.body.style.overflow = "";
    setTimeout(() => modal.remove(), 300);
  }

  modal.querySelector(".pm-dtl-backdrop").addEventListener("click", closeModal);
  modal.querySelector(".pm-dtl-close").addEventListener("click", closeModal);
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { closeModal(); document.removeEventListener("keydown", esc); }
  });

  modal.querySelector("#pmDtlAddCart").addEventListener("click", function() {
    if (detailModalOutOfStock) return;
    if (hasModels && !detailModalSelectedModel) { flashModelHint(); return; }
    addToCart(this, detailModalSelectedModel);
    closeModal();
  });

  modal.querySelector("#pmDtlOrderNow").addEventListener("click", function() {
    if (detailModalOutOfStock) return;
    if (hasModels && !detailModalSelectedModel) { flashModelHint(); return; }
    orderProduct(this, detailModalSelectedModel);
    closeModal();
  });
}

/* Select Model is a radio-style single-select: clicking a chip selects
   it and deselects whichever chip was previously selected, since the
   customer may only order ONE compatible model per line item even
   though the product itself can be compatible with many. */
function selectDetailModel(btn) {
  const model = btn.dataset.model;
  detailModalSelectedModel = model;

  const row = document.getElementById("pmDtlModelRow");
  if (row) {
    row.querySelectorAll(".pm-dtl-size-chip").forEach(chip => {
      const isSelected = chip.dataset.model === model;
      chip.classList.toggle("active", isSelected);
      chip.setAttribute("aria-checked", isSelected ? "true" : "false");
    });
  }

  const cartBtn  = document.getElementById("pmDtlAddCart");
  const orderBtn = document.getElementById("pmDtlOrderNow");
  if (!detailModalOutOfStock) {
    if (cartBtn)  cartBtn.disabled  = false;
    if (orderBtn) orderBtn.disabled = false;
  }

  const hint = document.getElementById("pmDtlModelHint");
  if (hint) {
    hint.textContent = `Model: ${modelLabel(model)} selected`;
    hint.classList.add("ok");
  }
}

function flashModelHint() {
  const hint = document.getElementById("pmDtlModelHint");
  if (!hint) return;
  hint.classList.add("shake");
  setTimeout(() => hint.classList.remove("shake"), 400);
}

/* Renders the current media item using the exact same markup/classes as the
   full media lightbox (dark contain-fit box, custom mute button, no native
   video controls) so the product detail modal matches it exactly. */
function renderDetailMedia() {
  const content = document.getElementById("pmDtlMediaContent");
  if (!content) return;
  const m = detailModalMedia[detailModalIndex];
  if (!m) return;

  content.innerHTML = m.type === "video"
    ? `<div class="ml-video-wrap">
         <video id="pmDtlVideo" src="${escapeHtml(m.url)}" autoplay muted loop playsinline></video>
         <button class="ml-mute-btn" type="button" onclick="toggleDetailMediaMute(this)">${muteIconSvg(true)}</button>
       </div>`
    : `<img src="${escapeHtml(m.url)}" alt=""/>`;

  document.querySelectorAll(".pm-dtl-dot").forEach((dot, i) => {
    dot.classList.toggle("active", i === detailModalIndex);
  });
}

function toggleDetailMediaMute(btn) {
  const video = document.getElementById("pmDtlVideo");
  if (!video) return;
  video.muted = !video.muted;
  btn.innerHTML = muteIconSvg(video.muted);
}

function changeDetailMedia(direction) {
  if (detailModalMedia.length <= 1) return;
  detailModalIndex += direction;
  if (detailModalIndex >= detailModalMedia.length) detailModalIndex = 0;
  if (detailModalIndex < 0) detailModalIndex = detailModalMedia.length - 1;
  renderDetailMedia();
}

/* ── Card-level Add to Cart / Order buttons: route through the model flow ── */
function handleCardAddToCart(el) {
  const id = el.dataset.id;
  const p  = allProducts.find(x => x.id === id);
  if (p && p.inStock === false) {
    showToast("This product is currently out of stock");
    return;
  }
  const needsModel = p && Array.isArray(p.models) && p.models.length;
  if (needsModel) {
    openProductDetail(id);
    showToast("Please select a compatible model first");
    return;
  }
  addToCart(el, null);
}

function handleCardOrderNow(el) {
  const id = el.dataset.id;
  const p  = allProducts.find(x => x.id === id);
  if (p && p.inStock === false) {
    showToast("This product is currently out of stock");
    return;
  }
  const needsModel = p && Array.isArray(p.models) && p.models.length;
  if (needsModel) {
    openProductDetail(id);
    showToast("Please select a compatible model first");
    return;
  }
  orderProduct(el, null);
}

/* ══════════════════════════════════════
   WA LINK INIT
   ══════════════════════════════════════ */
function initWALinks() {
  const general = buildGeneralWALink();
  ["floatWA", "waGeneralBtn", "footerWA", "footerWA2"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.href = general;
  });
}

/* ══════════════════════════════════════
   FOOTER CONTACT LINKS (email / Instagram) — display only, not an
   ordering method. Populated from config.js so nothing is hardcoded.
   ══════════════════════════════════════ */
function initFooterContacts() {
  const igUrl = window.EMI_INSTAGRAM_URL;
  ["footerInstagram", "footerInstagram2"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.href = igUrl;
  });
  const igText = document.getElementById("footerInstagramText");
  if (igText) igText.textContent = "Instagram";

  ["footerEmail", "footerEmail2"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.href = `mailto:${EMAIL}`;
  });
  const emailText = document.getElementById("footerEmailText");
  if (emailText) emailText.textContent = EMAIL;
}

/* ══════════════════════════════════════
   TOAST
   ══════════════════════════════════════ */
let _toastTimer;
function showToast(msg) {
  let t = document.getElementById("pm-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "pm-toast"; t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}

/* ══════════════════════════════════════
   RIPPLE
   ══════════════════════════════════════ */
function addRipple(el) {
  const old = el.querySelector(".pm-ripple");
  if (old) old.remove();
  const r = document.createElement("span");
  r.className = "pm-ripple";
  Object.assign(r.style, {
    position:"absolute", borderRadius:"50%",
    background:"rgba(255,255,255,0.3)",
    width:"160px", height:"160px",
    top:"50%", left:"50%",
    transform:"translate(-50%,-50%) scale(0)",
    animation:"pmRipple 0.5s ease-out forwards",
    pointerEvents:"none", zIndex:"10"
  });
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  el.style.overflow = "hidden";
  el.appendChild(r);
  setTimeout(() => r.remove(), 520);
}

/* ══════════════════════════════════════
   NAVBAR SCROLL
   ══════════════════════════════════════ */
function initNavbar() {
  const nav = document.getElementById("navbar");
  if (!nav) return;
  const update = () => nav.classList.toggle("scrolled", window.scrollY > 50);
  window.addEventListener("scroll", update, { passive: true });
  update();
}

/* ══════════════════════════════════════
   HAMBURGER DRAWER
   ══════════════════════════════════════ */
function initHamburger() {
  const btn      = document.getElementById("hamburger");
  const drawer   = document.getElementById("drawer");
  const backdrop = document.getElementById("drawerBackdrop");
  const closeBtn = document.getElementById("drawerClose");
  if (!btn || !drawer || !backdrop) return;

  function open() {
    drawer.classList.add("open"); backdrop.classList.add("open");
    btn.classList.add("open"); document.body.style.overflow = "hidden";
  }
  function close() {
    drawer.classList.remove("open"); backdrop.classList.remove("open");
    btn.classList.remove("open"); document.body.style.overflow = "";
  }

  btn.addEventListener("click", () => drawer.classList.contains("open") ? close() : open());
  backdrop.addEventListener("click", close);
  if (closeBtn) closeBtn.addEventListener("click", close);
  document.querySelectorAll(".dl").forEach(a => a.addEventListener("click", close));
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
}

/* ══════════════════════════════════════
   SCROLL REVEAL
   ══════════════════════════════════════ */
function initScrollReveal() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll(".fade-up:not(.visible)").forEach(el => io.observe(el));

  const stepsIO = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      document.querySelectorAll(".step-card").forEach(c => c.classList.add("visible"));
      stepsIO.disconnect();
    }
  }, { threshold: 0.15 });
  const sg = document.querySelector(".steps-grid");
  if (sg) stepsIO.observe(sg);
}

/* ══════════════════════════════════════
   MARQUEE
   ══════════════════════════════════════ */
function initMarquee() {
  const m = document.getElementById("marquee");
  if (m) m.innerHTML += m.innerHTML;
}

/* ══════════════════════════════════════
   SMOOTH SCROLL
   ══════════════════════════════════════ */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener("click", e => {
      const target = document.querySelector(a.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 72, behavior: "smooth" });
    });
  });
}

/* ══════════════════════════════════════
   COUNTER ANIMATION
   ══════════════════════════════════════ */
function animateCount(el, target, suffix) {
  let start;
  const dur = 1500;
  const step = ts => {
    if (!start) start = ts;
    const p    = Math.min((ts - start) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.floor(ease * target) + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function initCounters() {
  let done = false;
  const io = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !done) {
      done = true;
      document.querySelectorAll(".stat-num[data-target]").forEach(el => {
        animateCount(el, parseInt(el.dataset.target), el.dataset.suffix || "");
      });
      io.disconnect();
    }
  }, { threshold: 0.5 });
  const hero = document.getElementById("hero");
  if (hero) io.observe(hero);
}

/* ══════════════════════════════════════
   PRODUCT CARD TILT
   ══════════════════════════════════════ */
function initCardTilt() {
  document.querySelectorAll(".product-card").forEach(card => {
    card.addEventListener("mousemove", e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width  - 0.5;
      const y = (e.clientY - r.top)  / r.height - 0.5;
      card.style.transform = `translateY(-8px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg)`;
    });
    card.addEventListener("mouseleave", () => { card.style.transform = ""; });
  });
}

/* ══════════════════════════════════════
   CART SYSTEM
   ══════════════════════════════════════ */
let cart = [];

function saveCart() {
  localStorage.setItem("emi_cart", JSON.stringify(cart));
}

function loadCart() {
  try {
    const saved = localStorage.getItem("emi_cart");
    if (saved) cart = JSON.parse(saved);
  } catch { cart = []; }
}

function addToCart(el, model) {
  const product  = el.dataset.product;
  const price    = el.dataset.price;
  const desc     = el.dataset.desc;
  const priceNum = parseInt(price.replace(/[^0-9]/g, "")) || 0;
  model = model || null;

  const existing = cart.find(i => i.product === product && (i.model || null) === model);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ product, price, priceNum, desc, model, qty: 1 });
  }
  saveCart();
  updateCartBadge();
  addRipple(el);
  showToast(model ? `✓ ${product} (Model: ${modelLabel(model)}) added to cart!` : `✓ ${product} added to cart!`);
}

function updateCartBadge() {
  const total = cart.reduce((s, i) => s + i.qty, 0);
  const badge = document.getElementById("cartCount");
  if (!badge) return;
  badge.textContent = total;
  badge.classList.toggle("has-items", total > 0);
}

function renderCartItems() {
  const itemsEl  = document.getElementById("cartItems");
  const footerEl = document.getElementById("cartFooter");
  const totalEl  = document.getElementById("cartTotal");
  if (!itemsEl) return;

  if (cart.length === 0) {
    itemsEl.innerHTML = `
      <div class="cart-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5" width="52" height="52">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        <p>Your cart is empty!</p>
        <small>Add products to get started</small>
      </div>`;
    if (footerEl) footerEl.style.display = "none";
    return;
  }

  const grandTotal = cart.reduce((s, i) => s + i.priceNum * i.qty, 0);
  if (footerEl) footerEl.style.display = "block";
  if (totalEl)  totalEl.textContent = `Rs.${grandTotal}`;

  itemsEl.innerHTML = cart.map((item, idx) => `
    <div class="cart-item">
      <div class="ci-info">
        <div class="ci-name">${escapeHtml(item.product)}${item.model ? ` <span class="ci-size">— Model: ${escapeHtml(modelLabel(item.model))}</span>` : ""}</div>
        <div class="ci-price">${escapeHtml(item.price)} each &nbsp;·&nbsp;
          <span class="ci-subtotal">Rs.${item.priceNum * item.qty}</span>
        </div>
      </div>
      <div class="ci-qty">
        <button onclick="cartChangeQty(${idx}, -1)">&#8722;</button>
        <span>${item.qty}</span>
        <button onclick="cartChangeQty(${idx}, 1)">&#43;</button>
      </div>
      <button class="ci-remove" onclick="cartRemove(${idx})" title="Remove">&times;</button>
    </div>
  `).join("");
}

function cartChangeQty(idx, delta) {
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  saveCart(); updateCartBadge(); renderCartItems();
}

function cartRemove(idx) {
  cart.splice(idx, 1);
  saveCart(); updateCartBadge(); renderCartItems();
}

function openCart() {
  renderCartItems();
  document.getElementById("cart-drawer").classList.add("open");
  document.getElementById("cart-backdrop").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeCart() {
  document.getElementById("cart-drawer").classList.remove("open");
  document.getElementById("cart-backdrop").classList.remove("open");
  document.body.style.overflow = "";
}

function buildCartMsg() {
  const total = cart.reduce((s, i) => s + i.priceNum * i.qty, 0);
  return [
    `Hello ${BRAND_NAME}!`,
    ``,
    `I want to place an order for the following items:`,
    ``,
    ...cart.map(i => {
      const suffix = i.model ? ` (Model: ${modelLabel(i.model)})` : "";
      return `• ${i.product}${suffix} x${i.qty}  —  ${i.price} each  =  Rs.${i.priceNum * i.qty}`;
    }),
    ``,
    `Grand Total: Rs.${total}`,
    ``,
    `Please help me with order details.`,
    ``,
    `(Sent from ${BRAND_NAME})`
  ].join("\n");
}

function cartOrderWA() {
  if (cart.length === 0) { showToast("Cart is empty!"); return; }
  const cartMsg = buildCartMsg();
  closeCart();
  showDeliveryPopup(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(cartMsg)}`, null, null, true);
}

/* ══════════════════════════════════════
   DELIVERY POPUP — naam/phone/address
   Saves to KV via API before redirecting to WhatsApp
   ══════════════════════════════════════ */
function showDeliveryPopup(waLink, product, price, isCart, model) {
  const old = document.getElementById("pm-delivery-popup");
  if (old) old.remove();

  const popup = document.createElement("div");
  popup.id = "pm-delivery-popup";
  popup.innerHTML = `
    <div class="pm-dp-backdrop"></div>
    <div class="pm-dp-box">
      <div class="pm-dp-title">📦 Delivery Details</div>
      <p class="pm-dp-sub">Fill in your details so we know where to deliver</p>
      <input type="text"  id="dpName"    class="pm-dp-input" placeholder="Your Name *"         maxlength="60"/>
      <input type="tel"   id="dpPhone"   class="pm-dp-input" placeholder="Phone Number *"      maxlength="15"/>
      <textarea           id="dpAddress" class="pm-dp-input pm-dp-textarea" rows="2"
        placeholder="Delivery Address *" maxlength="200"></textarea>
      <div class="pm-dp-btns">
        <button class="pm-dp-cancel"  id="dpCancel">Cancel</button>
        <button class="pm-dp-confirm" id="dpConfirm">Confirm &amp; Order</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => requestAnimationFrame(() => popup.classList.add("pm-dp-open")));

  setTimeout(() => document.getElementById("dpName")?.focus(), 350);

  function closePopup() {
    popup.classList.remove("pm-dp-open");
    document.body.style.overflow = "";
    setTimeout(() => popup.remove(), 300);
  }

  popup.querySelector("#dpCancel").addEventListener("click", closePopup);
  popup.querySelector(".pm-dp-backdrop").addEventListener("click", closePopup);
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { closePopup(); document.removeEventListener("keydown", esc); }
  });

  popup.querySelector("#dpConfirm").addEventListener("click", async function() {
    const name    = (document.getElementById("dpName")?.value    || "").trim();
    const phone   = (document.getElementById("dpPhone")?.value   || "").trim();
    const address = (document.getElementById("dpAddress")?.value || "").trim();

    if (!name)    { showToast("Please enter your name!");             document.getElementById("dpName")?.focus();    return; }
    if (!phone)   { showToast("Please enter your phone number!");     document.getElementById("dpPhone")?.focus();   return; }
    if (!address) { showToast("Please enter your delivery address!"); document.getElementById("dpAddress")?.focus(); return; }

    // Build items array in the shape POST /api/orders expects:
    // [{ productId, quantity, model? }] — exactly ONE item per product
    // line, carrying at most the single model the customer selected.
    // The backend recomputes and returns the authoritative total — we
    // never send our own total.
    let items = [];
    if (isCart) {
      items = cart.map(i => {
        const productRecord = allProducts.find(p => p.name === i.product);
        const productId = productRecord ? productRecord.id : null;
        if (!productId) return null;
        return { productId, quantity: i.qty, ...(i.model ? { model: i.model } : {}) };
      }).filter(Boolean);
    } else if (product) {
      const productRecord = allProducts.find(p => p.name === product);
      const productId = productRecord ? productRecord.id : null;
      if (productId) {
        items = [{ productId, quantity: 1, ...(model ? { model } : {}) }];
      }
    }

    // Save order to backend (non-blocking — don't wait for it to open WhatsApp).
    // total is intentionally NOT sent; the backend computes and returns it.
    if (items.length) {
      saveOrderToAPI({ name, phone, address, items }).catch(() => {});
    }

    window.open(waLink, "_blank");

    if (isCart) { cart = []; saveCart(); updateCartBadge(); }
    closePopup();
  });
}

/* ══════════════════════════════════════
   SAVE ORDER TO API
   ══════════════════════════════════════ */
async function saveOrderToAPI(orderData) {
  try {
    await fetch(`${EMI_API}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData)
    });
  } catch { /* silently fail — WhatsApp still opened */ }
}

/* ══════════════════════════════════════
   HELPER — HTML escape
   ══════════════════════════════════════ */
function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ══════════════════════════════════════
   THEME (LIGHT / DARK)
   ══════════════════════════════════════ */
function initTheme() {
  const stored = localStorage.getItem("emi_theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = stored || (prefersDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
  updateThemeToggleIcon(theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("emi_theme", next);
  updateThemeToggleIcon(next);
}

function updateThemeToggleIcon(theme) {
  document.querySelectorAll(".theme-toggle-btn").forEach(btn => {
    btn.innerHTML = theme === "dark" ? sunIconSvg() : moonIconSvg();
    btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    btn.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  });
}

function sunIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="19" height="19"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
}

function moonIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="19" height="19"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
}

/* ══════════════════════════════════════
   BOOT
   ══════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  loadCart();
  updateCartBadge();
  initWALinks();
  initFooterContacts();
  initNavbar();
  initHamburger();
  initScrollReveal();
  initMarquee();
  initSmoothScroll();
  initCounters();

  loadProducts();
  loadFeaturedReviews();

  console.log("%cElectromotive Inventory loaded!", "color:#0ea86b;font-weight:bold;font-size:14px");
});
function changeProductMedia(productId, direction) {
  const carousel = document.querySelector(
    `.pc-media-carousel[data-product-id="${productId}"]`
  );

  if (!carousel) return;

  const items = carousel.querySelectorAll('.pc-media-item');
  if (items.length <= 1) return;

  let current = Array.from(items).findIndex(item =>
    item.classList.contains('active')
  );

  if (current === -1) current = 0;

  items[current].classList.remove('active');

  let next = current + direction;

  if (next >= items.length) next = 0;
  if (next < 0) next = items.length - 1;

  items[next].classList.add('active');

  items.forEach((item, index) => {
    const video = item.tagName === 'VIDEO' ? item : item.querySelector('video');
    if (video && index !== next) video.pause();
    if (video && index === next) video.play().catch(() => {});
  });
}

/* Pixel-perfect chevron icon (SVG centers reliably, unlike the ‹ › glyphs
   which can look off-center depending on the font). */
function chevronSvg(direction) {
  const points = direction === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><polyline points="${points}"></polyline></svg>`;
}

/* Professional speaker (mute/unmute) SVG icons — replaces the old emoji buttons */
function muteIconSvg(isMuted) {
  return isMuted
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
}

function toggleMediaMute(btn) {
  const video = btn.previousElementSibling;
  if (!video || video.tagName !== 'VIDEO') return;
  video.muted = !video.muted;
  btn.innerHTML = muteIconSvg(video.muted);
}

/* ── MEDIA LIGHTBOX (full-size view on click) ── */
let lightboxMedia = [];
let lightboxIndex = 0;

function openMediaLightbox(productId, startIndex) {
  const carousel = document.querySelector(
    `.pc-media-carousel[data-product-id="${productId}"]`
  );
  if (!carousel) return;

  try {
    lightboxMedia = JSON.parse(carousel.dataset.media);
  } catch {
    lightboxMedia = [];
  }
  if (!lightboxMedia.length) return;

  lightboxIndex = startIndex || 0;
  renderLightbox();

  const overlay = document.getElementById('mediaLightboxOverlay');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function renderLightbox() {
  const content = document.getElementById('mediaLightboxContent');
  const m = lightboxMedia[lightboxIndex];
  if (!m) return;

  content.innerHTML = m.type === 'video'
    ? `<div class="ml-video-wrap">
         <video id="mlVideo" src="${escapeHtml(m.url)}" autoplay muted loop playsinline></video>
         <button class="ml-mute-btn" type="button" onclick="toggleLightboxMute(this)">${muteIconSvg(true)}</button>
       </div>`
    : `<img src="${escapeHtml(m.url)}" alt=""/>`;

  const nav = document.getElementById('mediaLightboxNav');
  nav.style.display = lightboxMedia.length > 1 ? 'flex' : 'none';
}

function toggleLightboxMute(btn) {
  const video = document.getElementById('mlVideo');
  if (!video) return;
  video.muted = !video.muted;
  btn.innerHTML = muteIconSvg(video.muted);
}

function changeLightboxMedia(direction) {
  lightboxIndex += direction;
  if (lightboxIndex >= lightboxMedia.length) lightboxIndex = 0;
  if (lightboxIndex < 0) lightboxIndex = lightboxMedia.length - 1;
  renderLightbox();
}

function closeMediaLightbox() {
  const overlay = document.getElementById('mediaLightboxOverlay');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  document.getElementById('mediaLightboxContent').innerHTML = '';
  lightboxMedia = [];
}
