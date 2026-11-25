/* Datenmodell: Typen, Status, Gruppen und lokale Beispieldaten. */
(function (B) {
  'use strict';

  // ======================================================
  // DATENMODELL
  // ======================================================
  // 🗂️ Alle
  // ⭐ Favoriten
  const types = {
    game: { label: 'Games', symbol: '🕹️', color: 'orange' },
    tool: { label: 'Tools', symbol: '🔧', color: 'cyan' },
    misc: { label: 'Misc', symbol: '🧩', color: 'green' },
    // music: { label: 'Music', color: 'violet' },
    // violet: { label: 'Violet' },   // z.B. Experiments / Art
    // green:  { label: 'Green'  },   // Libraries / Frameworks
    // pink:   { label: 'Pink'   },   // Featured / Specials
    // gold:   { label: 'Gold'   },   // Education / Docs
  };

  // Status-Mapping für optionale Badges
  const STATUS = {
    beta:  { label: 'Beta',  symbol: '🧪' },
    alpha: { label: 'Alpha', symbol: '🧪🧪🧪' }, //⚡
  };

  // Gruppen liefern Sammlungsnamen und -Bilder fuer Workspace und Bibliothek.
  // "img": Bildpfad oder "all" für eine dauerhaft sichtbare Bild-Collage.
  // "preview": Bildpfad oder "all" für eine Collage beim Hover/Fokus.
  // Raster für "all": 1–4 Repos = 2x2, 5–6 = 3x2, 7–9 = 3x3.
  // Bei mehr als 9 Bildern wächst das Raster weiter, damit alle sichtbar bleiben.
  // Beispiel: dev: { label: 'Dev-Tools', img: 'all', preview: 'all' }.
  const repogroups =  (typeof originrepogroups !== 'undefined') ? originrepogroups : {
    dev: { label: "Dev-Tools", img: 'img/grp/devtools.png' },
    cards: { label: "Kartenspiele", img: 'img/grp/cards.png' },
    'offline-demo': { label: "Offline-Demo" }
  }

  // ======================================================
  // REPOS
  // ======================================================
  // Optionales "icon" (Emoji/Symbol) für kompakte Ansichten.
  // Optionales "status" ("beta" | "alpha") für Badge.
  // Optionales "preview" (Bildpfad): bei Card-Hover statt "img";
  // in der Gruppen-Vorschau direkt sichtbar (z. B. preview: 'img/snake-preview.png').
  const repos = (typeof originrepos !== 'undefined' && Array.isArray(originrepos)) ? originrepos : [
    {
        label: "Offline-Notizblock",
        icon: '✎',
        img: 'workspace/icons/icon-192.png',
        description: 'Lokales Offline-Beispiel ohne externe Abhängigkeiten.',
        type: 'tool',
        workspace: 'offline-demo',
        url: 'workspace/apps/offline-demo/index.html',
        year: 2026,
        tags: ['Offline', 'Lokal']
    },
    {
        label: "Android Vollbild",
        img: 'img/pwa.png',
        description: 'Alle Apps können als PWA (Progressive-Web-App) über das Browser-Menü installiert und im Vollbild auf Android-Geräten genutzt werden.',
        type: 'misc',
        year: 2026,
        tags: ['Information', 'Installation'],
        featured: 'tall', //wide,tall
    },
    {
        label: "Sudoku",
        img: 'img/sudoku.png',
        status: 'beta',
        description: 'Ein simples Sudoku.',
        type: 'game',
        url: 'https://myprojectpages.github.io/Sudoku/',
        year: 2026,
        tags: ['Mobile', 'Riddle']
    },
    {
        label: "Wetter",
        img: 'img/wetter.png',
        status: 'beta',
        description: 'Geklonte Wetter App mit öffentlicher API.',
        type: 'tool',
        url: 'https://myprojectpages.github.io/Wetter/',
        year: 2026,
        tags: ['API', 'Geo-Location']
    },
    {
        label: "Buchstaben",
        img: 'img/buchstaben.jpg',
        description: 'Lernspiel für Kinder von 3 bis 5 Jahren.',
        type: 'game',
        url: 'https://myprojectpages.github.io/Buchstaben/',
        year: 2026,
        tags: ['Lernspiel', 'Kinder'],
        featured: 'wide'
    },
    {
        label: "Dame",
        img: 'img/dame.png',
        description: 'Dame für 2 Spieler oder gegen den Computer.',
        type: 'game',
        url: 'https://myprojectpages.github.io/Dame/',
        year: 2026,
        tags: ['2-Spieler', 'Brettspiel', 'Mobil'],
    },
    {
        label: "Snake",
        img: 'img/snake.png',
        status: 'beta',
        description: 'Snake, wie man es liebt. Mit Tastatursteuerung (WASD, Pfeile) smarter Touchsteuerung durch Tippen auf dem Spielfeld und an den Ecken. Oder durch Wisch-Gesten auf dem gesamten Bildschirm.',
        type: 'game',
        url: 'https://myprojectpages.github.io/Snake/',
        year: 2026,
        tags: ['Mobile', 'Classic', 'Nokia']
    },
    {
        label: "Clipwerk",
        img: 'img/clipwerk.png',
        status: 'alpha',
        workspace: 'dev',
        description: 'Einfache Videobearbeitung.',
        type: 'tool',
        url: 'https://myprojectpages.github.io/Clipwerk/',
        year: 2026,
        tags: ['Lokal', 'Mobil']
    },
    {
        label: "Synthesizer",
        img: 'img/synthesizer.jpg',
        description: 'Einfacher Synthesizer für unterwegs.',
        type: 'tool',
        url: 'https://myprojectpages.github.io/Synthesizer/',
        year: 2026,
        tags: ['Mobile', 'Keyboard']
    },
    {
        label: "Textanalyse",
        img: 'img/textanalyse.png',
        status: 'beta',
        description: 'Zählen von Wörtern, Sätzen, Häufigkeiten uvm.',
        type: 'tool',
        workspace: 'dev',
        url: 'https://myprojectpages.github.io/Textanalyse',
        year: 2026,
        tags: ['Texte', 'Keywords']
    },
  ];

  // repo.workspace is canonical (ID or array of IDs). Legacy fields are
  // accepted only if workspace is absent, so [] or null can clear membership.
  function groupIds(repo) {
    const membership = Object.prototype.hasOwnProperty.call(repo, 'workspace')
      ? [repo.workspace] : [repo.group, repo.groups];
    return [...new Set(membership.flat().filter(id => typeof id === 'string' && id.trim()))];
  }

  function getGroups() {
    const groups = new Map();
    for (const [id, raw] of Object.entries(repogroups || {})) {
      if (!id.trim()) continue;
      const definition = raw && typeof raw === 'object' ? raw : {};
      groups.set(id, { ...definition, id, label: typeof raw === 'string' ? raw || id : definition.label || id, repos: [] });
    }
    const seen = new Set();
    for (const repo of repos) {
      if (!repo || typeof repo.label !== 'string' || !repo.label.trim() || seen.has(repo.label)) continue;
      seen.add(repo.label);
      for (const id of groupIds(repo)) {
        if (!groups.has(id)) groups.set(id, { id, label: id, repos: [] });
        groups.get(id).repos.push(repo);
      }
    }
    return groups;
  }
  B.data = { types, STATUS, repogroups, repos, groupIds, getGroups };
})(window.BoilerRoom);
