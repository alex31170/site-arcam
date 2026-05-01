(function () {
  const state = {
    data: null,
    page: null,
    rootPrefix: document.body.dataset.root || ".",
    pagePath: normalizePath(document.body.dataset.path || ""),
    carouselTimer: null
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    try {
      if (window.SITE_DATA) {
        state.data = window.SITE_DATA;
      } else {
        const response = await fetch(assetUrl("data.json"), { cache: "no-store" });
        if (!response.ok) {
          throw new Error("data.json introuvable");
        }

        state.data = await response.json();
      }

      state.page = findPage(state.data, state.pagePath);

      if (!state.page) {
        renderError("Page introuvable", "Le chemin demande n'existe pas dans data.json.");
        return;
      }

      render();
    } catch (error) {
      renderError("Impossible de charger le site", error.message);
    }
  }

  function render() {
    document.title = state.pagePath ? formatTitle(state.page.name) : "Accueil";
    document.body.classList.toggle("dark-gallery-page", usesDarkGalleryTheme());

    if (state.pagePath === "") {
      renderHome();
      return;
    }

    renderFolder();
  }

  function renderHome() {
    document.body.innerHTML = `
      <header class="site-header" id="site-header"></header>
      <main>
        <section class="section">
          <div class="wrap">
            <div class="carousel" id="carousel" aria-label="Images aleatoires"></div>
          </div>
        </section>
        <section class="section">
          <div class="wrap">
            <h2 class="section-title home-universe-title">Découvrir mon univers</h2>
            <div class="grid" id="children-grid"></div>
          </div>
        </section>
      </main>
    `;

    renderHeader();
    renderChildren(document.getElementById("children-grid"), state.data.children || []);
    startCarousel(document.getElementById("carousel"), collectImages(state.data));
  }

  function renderFolder() {
    const parentPath = parentOf(state.pagePath);
    const children = state.page.children || [];
    const documents = state.page.documents || [];
    const childIllustrations = new Set(children.map((child) => child.image).filter(Boolean));
    const isVirtualGalleryPage = state.pagePath === "EXPOSITION/GALERIE VIRTUELLE";
    const isExpositionPage = state.pagePath === "EXPOSITION";
    const heroImagePath = isExpositionPage ? "EXPOSITION/Expo en cours .jpg" : state.page.image;
    const virtualGalleryChild = children.find((child) => child.path === "EXPOSITION/GALERIE VIRTUELLE/Je m'expose chez vous");
    const displayChildren = isVirtualGalleryPage ? [] : children;
    const showHeroImage = heroImagePath && !isVirtualGalleryPage && !isFolderIllustration(heroImagePath, state.page.name);
    const galleryImages = isVirtualGalleryPage ? [] : (state.page.gallery || []).filter((image) => {
      return image !== state.page.image && !childIllustrations.has(image);
    });

    document.body.innerHTML = `
      <nav class="topbar">
        <div class="wrap topbar-inner">
          <a class="back-link" href="${pageUrl(parentPath)}" aria-label="Retour au dossier parent">Retour</a>
        </div>
      </nav>
      <main>
        <section class="wrap hero">
          ${isExpositionPage ? "" : `
            <div>
              <h1>${escapeHtml(formatTitle(state.page.name))}</h1>
            </div>
          `}
          ${(showHeroImage || isVirtualGalleryPage) ? `
            <div class="hero-media">
              ${showHeroImage ? `<img src="${assetUrl(heroImagePath)}" alt="${escapeHtml(formatTitle(state.page.name))}" loading="eager">` : ""}
              ${isVirtualGalleryPage ? `
                <a class="hero-media-link" href="${pageUrl("EXPOSITION/GALERIE VIRTUELLE/Je m'expose chez vous")}">
                  <img src="${assetUrl(virtualGalleryChild?.image || "FRAME.jpg")}" alt="Je m'expose chez vous" loading="eager">
                </a>
                <a class="hero-media-link" href="https://framevr.io/arcammuratory" target="_blank" rel="noopener noreferrer">
                  <img src="${assetUrl("FRAME.jpg")}" alt="Visiter la galerie virtuelle Frame" loading="eager">
                </a>
              ` : ""}
            </div>
          ` : ""}
          ${isExpositionPage ? `
            <div>
              <h1>${escapeHtml(formatTitle(state.page.name))}</h1>
            </div>
          ` : ""}
        </section>
        ${displayChildren.length ? `
          <section class="section">
            <div class="wrap">
              <div class="grid" id="children-grid"></div>
            </div>
          </section>
        ` : ""}
        ${galleryImages.length ? `
          <section class="section">
            <div class="wrap">
              <div class="gallery" id="gallery"></div>
            </div>
          </section>
        ` : ""}
        ${documents.length ? `
          <section class="section">
            <div class="wrap">
              <div class="documents" id="documents"></div>
            </div>
          </section>
        ` : ""}
      </main>
    `;

    const childrenGrid = document.getElementById("children-grid");
    const gallery = document.getElementById("gallery");
    if (childrenGrid) {
      renderChildren(childrenGrid, displayChildren);
    }
    if (gallery) {
      renderGallery(gallery, galleryImages);
    }
    const documentsContainer = document.getElementById("documents");
    if (documentsContainer) {
      renderDocuments(documentsContainer, documents);
    }
  }

  function renderHeader() {
    const header = document.getElementById("site-header");
    const image = state.data.header || "entete.png";

    header.innerHTML = `
      <img class="header-image" src="${assetUrl(image)}" alt="" loading="eager">
    `;
  }

  function renderChildren(container, children) {
    if (!children.length) {
      container.className = "empty";
      container.textContent = "Aucun sous-dossier pour cette page.";
      return;
    }

    container.innerHTML = children.map((child) => `
      <a class="card" href="${pageUrl(child.path)}">
        ${child.image ? `<img src="${assetUrl(child.image)}" alt="" loading="lazy">` : ""}
        <span>${escapeHtml(formatTitle(child.name))}</span>
      </a>
    `).join("");
  }

  function renderGallery(container, images) {
    if (!images.length) {
      container.className = "empty";
      container.textContent = "Aucune image supplementaire dans ce dossier.";
      return;
    }

    container.innerHTML = images.map((image) => `
      <a class="gallery-item" href="${assetUrl(image)}">
        <img src="${assetUrl(image)}" alt="" loading="lazy">
      </a>
    `).join("");

    setupJustifiedGallery(container);
  }

  function renderDocuments(container, documents) {
    container.innerHTML = documents.map((documentPath) => {
      const url = assetUrl(documentPath);
      const name = normalizePath(documentPath).split("/").pop() || "Document PDF";

      return `
        <article class="document-viewer">
          <iframe src="${url}" title="${escapeHtml(name)}"></iframe>
          <a class="document-link" href="${url}">Ouvrir le PDF</a>
        </article>
      `;
    }).join("");
  }

  function setupJustifiedGallery(container) {
    const images = Array.from(container.querySelectorAll("img"));
    let resizeTimer = null;

    const layout = () => layoutJustifiedGallery(container);

    images.forEach((image) => {
      if (image.complete && image.naturalWidth) {
        return;
      }
      image.addEventListener("load", layout, { once: true });
      image.addEventListener("error", layout, { once: true });
    });

    layout();
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(layout, 120);
    });
  }

  function layoutJustifiedGallery(container) {
    const items = Array.from(container.querySelectorAll(".gallery-item"));
    if (!items.length) {
      return;
    }

    const isCvPage = state.pagePath === "Parcours/CV";
    const gap = window.matchMedia("(max-width: 700px)").matches ? 16 : 22;
    const targetHeight = (window.matchMedia("(max-width: 700px)").matches ? 180 : 260) * (isCvPage ? 3.5 : 1);
    const minHeight = (window.matchMedia("(max-width: 700px)").matches ? 145 : 210) * (isCvPage ? 3.5 : 1);
    const maxHeight = (window.matchMedia("(max-width: 700px)").matches ? 240 : 340) * (isCvPage ? 3.5 : 1);
    const availableWidth = container.clientWidth || container.getBoundingClientRect().width;
    const rows = [];
    let row = [];
    let aspectSum = 0;

    items.forEach((item) => {
      const image = item.querySelector("img");
      const aspect = image && image.naturalWidth && image.naturalHeight
        ? image.naturalWidth / image.naturalHeight
        : 1;

      row.push({ item, aspect });
      aspectSum += aspect;

      const widthAtTarget = aspectSum * targetHeight + gap * (row.length - 1);
      if (isCvPage || row.length === 3 || widthAtTarget >= availableWidth * 0.92) {
        rows.push(row);
        row = [];
        aspectSum = 0;
      }
    });

    if (row.length) {
      rows.push(row);
    }

    container.innerHTML = "";

    rows.forEach((rowItems) => {
      const rowAspect = rowItems.reduce((sum, entry) => sum + entry.aspect, 0);
      const rowGap = gap * (rowItems.length - 1);
      const fittedHeight = (availableWidth - rowGap) / rowAspect;
      const height = Math.max(minHeight, Math.min(maxHeight, fittedHeight));
      const rowElement = document.createElement("div");

      rowElement.className = "gallery-row";
      rowItems.forEach(({ item, aspect }) => {
        item.style.width = `${Math.round(height * aspect)}px`;
        item.style.height = `${Math.round(height)}px`;
        item.style.flex = "0 0 auto";
        rowElement.appendChild(item);
      });

      container.appendChild(rowElement);
    });
  }

  function startCarousel(container, images) {
    const shuffled = shuffle(images).slice(0, Math.min(images.length, 36));

    if (!shuffled.length) {
      container.className = "empty";
      container.textContent = "Aucune image disponible pour le carousel.";
      return;
    }

    container.innerHTML = `
      <img class="is-active" src="${assetUrl(shuffled[0].src)}" alt="" loading="eager">
      <img src="" alt="" loading="eager">
    `;

    const slides = container.querySelectorAll("img");
    let current = 0;
    let visible = 0;

    state.carouselTimer = setInterval(() => {
      current = (current + 1) % shuffled.length;
      visible = 1 - visible;
      const next = slides[visible];
      const previous = slides[1 - visible];

      next.src = assetUrl(shuffled[current].src);
      next.classList.add("is-active");
      previous.classList.remove("is-active");
    }, 3000);
  }

  function collectImages(node, trail = []) {
    const label = [...trail, node.name].filter(Boolean).join(" / ");
    const images = [];

    if (node.image) {
      images.push({ src: node.image, label: label || node.name || "Accueil" });
    }

    for (const image of node.gallery || []) {
      images.push({ src: image, label: label || node.name || "Image" });
    }

    for (const child of node.children || []) {
      images.push(...collectImages(child, [...trail, node.name].filter(Boolean)));
    }

    return images;
  }

  function findPage(node, path) {
    if (normalizePath(node.path || "") === path) {
      return node;
    }

    for (const child of node.children || []) {
      const found = findPage(child, path);
      if (found) {
        return found;
      }
    }

    return null;
  }

  function pageUrl(path) {
    const cleanPath = normalizePath(path);
    if (!cleanPath) {
      return assetUrl("index.html");
    }

    return assetUrl(`${encodePath(cleanPath)}/index.html`);
  }

  function assetUrl(path) {
    const prefix = state.rootPrefix === "." ? "." : state.rootPrefix.replace(/\/$/, "");
    return `${prefix}/${encodePath(path)}`;
  }

  function encodePath(path) {
    return normalizePath(path)
      .split("/")
      .map((part) => encodeURIComponent(decodeRepeated(part)))
      .join("/");
  }

  function parentOf(path) {
    const parts = normalizePath(path).split("/").filter(Boolean);
    parts.pop();
    return parts.join("/");
  }

  function normalizePath(path) {
    return decodeRepeated(String(path || "").replace(/\\/g, "/")).replace(/^\/+|\/+$/g, "");
  }

  function decodeRepeated(value) {
    let decoded = String(value || "");
    for (let i = 0; i < 3; i += 1) {
      try {
        const next = decodeURIComponent(decoded);
        if (next === decoded) {
          break;
        }
        decoded = next;
      } catch (error) {
        break;
      }
    }
    return decoded;
  }

  function isFolderIllustration(imagePath, folderName) {
    const fileName = normalizePath(imagePath).split("/").pop() || "";
    const baseName = fileName.replace(/\.[^.]+$/, "");
    return baseName.toLocaleLowerCase("fr-FR") === String(folderName || "").toLocaleLowerCase("fr-FR");
  }

  function usesDarkGalleryTheme() {
    const path = state.pagePath.toLocaleLowerCase("fr-FR");
    return path === "parcours/cv"
      || path.startsWith("peinture/")
      || path === "sculpture"
      || path === "exposition/galerie virtuelle/je m'expose chez vous";
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatTitle(value) {
    const text = String(value || "").trim().toLocaleLowerCase("fr-FR");
    return text ? text.charAt(0).toLocaleUpperCase("fr-FR") + text.slice(1) : "";
  }

  function renderError(title, message) {
    document.body.innerHTML = `
      <main class="wrap section">
        <h1 class="section-title">${escapeHtml(title)}</h1>
        <p class="lead">${escapeHtml(message)}</p>
      </main>
    `;
  }
})();
