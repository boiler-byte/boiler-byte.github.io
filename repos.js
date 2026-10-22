const originrepos = [
{
    label: "Doomsday",
    img: 'https://boiler-byte.github.io/Doomsday/doomsday.webp',
    description: 'Eine Avengers Fan Fiction, die uns braucht.',
    type: 'misc',
    url: 'https://boiler-byte.github.io/Doomsday/',
    year: 2026,
    tags: ['Geschichte', 'Satire', 'Marvel', 'X-Men', 'Wolverine', 'Captain America', 'Zombie', 'Loki', 'Gambit', 'Blade' ]
},
{
    label: "Memory",
    img: 'img/memory.webp',
    status: 'beta',
    description: 'Das gute, alte Memory mit Custom Themes.',
    type: 'game',
    url: 'https://boiler-byte.github.io/Memory/',
    year: 2026,
    tags: ['Gedächtnistraining', 'Mobil', 'Looney Tunes', 'Bugs Bunny', 'Die Simpsons', 'Familie Feuerstein']
},
{
    label: "Sudoku",
    img: 'img/sudoku.png',
    status: 'beta',
    description: 'Ein simples Sudoku.',
    type: 'game',
    url: 'https://boiler-byte.github.io/Sudoku/',
    year: 2026,
    tags: ['Mobile', 'Riddle']
},
{
    label: "Wetter",
    img: 'img/wetter.png',
    status: 'beta',
    description: 'Geklonte Wetter App mit öffentlicher API.',
    type: 'tool',
    url: 'https://boiler-byte.github.io/Wetter/',
    year: 2026,
    tags: ['API', 'Geo-Location']
},
{
    label: "Buchstaben",
    img: 'img/buchstaben.jpg',
    description: 'Lernspiel für Kinder von 3 bis 5 Jahren.',
    type: 'game',
    url: 'https://boiler-byte.github.io/Buchstaben/',
    year: 2026,
    tags: ['Lernspiel', 'Kinder'],
    featured: 'wide'
},
{
    label: "Authenticator",
    img: 'img/authenticator.png',
    status: 'beta',
    description: 'Lokale Schlüssel, AES verschlüssel mit Import/Export.',
    type: 'tool',
    url: 'https://boiler-byte.github.io/Authenticator/',
    year: 2026,
    tags: ['Lokal', 'Sensible Daten'],
    featured: 'wide'
},
{
    label: "Bildstapel-Verarbeitung",
    img: 'img/bildstapelverarbeitung.png',
    description: 'Auflösungen, Rotation, Zuschneiden, Freistellen, Zerlegen, SVG Vektorkonvertierung. Damit lässt sich in einem Rutsch aus einem Bild mit mehreren Icons eine Sammlung an passgenau zugeschnittenen SVG-Icons erstellen. Import-Formate: jpg, png, webp. Output-Formate: jpg, png, webp, svg.',
    type: 'tool',
    url: 'https://boiler-byte.github.io/Bildstapelverarbeitung/',
    year: 2026,
    tags: ['Bildbearbeitung', 'Thumbmaker', 'crop', 'resize', 'color to alpha', 'Farbe zu Alpha'],
    featured: true,
},
{
    label: "Typeshooter",
    img: 'img/typeshooter.png',
    status: 'beta',
    description: 'Schieß die tödlichen Wörter ab.',
    type: 'game',
    url: 'https://boiler-byte.github.io/Typeshooter/',
    year: 2026,
    tags: ['Speed Typing', 'High-Score'],
},
{
    label: "SVG-Studio",
    img: 'img/svgstudio.png',
    description: 'SVG Dateien bearbeiten.',
    status: 'alpha',
    type: 'tool',
    url: 'https://boiler-byte.github.io/svgstudio/',
    year: 2026,
    tags: ['svg', 'Optimierung', 'Zuschneiden', 'crop'],
},
{
    label: "Dame",
    img: 'img/dame.png',
    description: 'Dame für 2 Spieler oder gegen den Computer.',
    type: 'game',
    url: 'https://boiler-byte.github.io/Dame/',
    year: 2026,
    tags: ['2-Spieler', 'Brettspiel', 'Mobil'],
},
{
    label: "Snake",
    img: 'img/snake.png',
    status: 'beta',
    description: 'Snake, wie man es liebt. Mit Tastatursteuerung (WASD, Pfeile) smarter Touchsteuerung durch Tippen auf dem Spielfeld und an den Ecken. Oder durch Wisch-Gesten auf dem gesamten Bildschirm.',
    type: 'game',
    url: 'https://boiler-byte.github.io/Snake/',
    year: 2026,
    tags: ['Mobile', 'Classic', 'Nokia']
},
{
    label: "Countdowns",
    img: 'img/countdown.png',
    description: 'Countdowns mit Bildern (aus der Zwischenablage), Wiederholungen, Vorlagen, smarter Sortierung.',
    type: 'tool',
    url: 'https://boiler-byte.github.io/Countdown/',
    year: 2026,
    tags: ['Sonstiges']
},
{
    label: "Timestamp",
    img: 'img/timestamp.png',
    description: 'Ultimatives Unix-Timestamp Tool.',
    type: 'tool',
    url: 'https://boiler-byte.github.io/Timestamp/',
    year: 2026,
    tags: ['Unix Timestamp', 'Konverter'],
},
{
    label: "PrettyCode",
    img: 'img/prettycode.png',
    status: 'beta',
    description: 'Code Formatierung, Minifying, Syntax-Highlighting, Fehleranzeige für HTML, CSS, JavaScript (auch gemischt), MySQL, Python ,PHP, JSON.',
    type: 'tool',
    url: 'https://boiler-byte.github.io/prettycode/',
    year: 2026,
    tags: ['Lokal', 'Effizient']
},


{
    label: "QRCode",
    img: 'img/qrcode.png',
    status: 'alpha',
    description: 'QR Codes erstellen, scannen und verwalten.',
    type: 'tool',
    url: 'https://boiler-byte.github.io/QRCode/',
    year: 2026,
    tags: ['Lokal', 'Sensible Daten']
},
{
    label: "Clipwerk",
    img: 'img/clipwerk.png',
    status: 'alpha',
    description: 'Einfache Videobearbeitung.',
    type: 'tool',
    url: 'https://boiler-byte.github.io/Clipwerk/',
    year: 2026,
    tags: ['Lokal', 'Mobil']
},
{
    label: "Haushalts-Durchblick",
    img: 'img/haushaltsdurchblick.png',
    status: 'alpha',
    description: 'Überblick über das, was reinkommt, rausgeht und bleibt.',
    type: 'tool',
    url: 'https://boiler-byte.github.io/Haushaltsdurchblick/',
    year: 2026,
    tags: ['Lokal', 'Sensible Daten']
},


{
    label: "Synthesizer",
    img: 'img/synthesizer.jpg',
    description: 'Einfacher Synthesizer für unterwegs.',
    type: 'tool',
    url: 'https://boiler-byte.github.io/Synthesizer/',
    year: 2026,
    tags: ['Mobile', 'Keyboard']
},
{
    label: "Drums",
    img: 'img/drums.jpg',
    description: 'Einfaches HTML-Schlagzeug für unterwegs.',
    type: 'tool',
    url: 'https://boiler-byte.github.io/Drums/',
    year: 2026,
    tags: ['Mobile', 'Drumpad']
},
{
    label: "Dateiumbenenner",
    img: 'img/dateiumbenenner.png',
    status: 'beta',
    description: 'Ultimatives Tool um mehrere Dateien oder Verzeichnisse umzubenennen.',
    type: 'tool',
    url: 'https://github.com/boiler-byte/Dateiumbenenner',
    year: 2026,
    tags: ['Dateisystem', 'Lebenshelfer']
},
{
    label: "Weihnachtsfeier",
    img: 'img/weihnachtsfeier.jpg',
    description: 'Bericht einer Weihnachtsfeier aus der Sicht von Reik.',
    type: 'misc',
    url: 'https://boiler-byte.github.io/Weihnachtsfeier',
    year: 2026,
    tags: ['How High', 'Peace']
},
{
    label: "Textanalyse",
    img: 'img/textanalyse.png',
    status: 'beta',
    description: 'Zählen von Wörtern, Sätzen, Häufigkeiten uvm.',
    type: 'tool',
    url: 'https://boiler-byte.github.io/Textanalyse',
    year: 2026,
    tags: ['Texte', 'Keywords']
},
{
    label: "Sphären Ansicht",
    img: 'img/sphereview.webp',
    description: 'Alle Projekte als unendliche Sphäre',
    url: 'sphereview.html',
    type: 'misc',
    year: 2026,
    tags: ['Information', 'Installation'],
    // featured: 'tall', //wide,tall
},
{
    label: "Android Vollbild",
    img: 'img/pwa.png',
    description: 'Alle Apps können als PWA (Progressive-Web-App) über das Browser-Menü installiert und im Vollbild auf Android-Geräten genutzt werden. Auch "der Boiler Room" kann installiert werden und ist dann der App-Launcher. Wenn Sie ernsthaft eine oder mehrere Tools für Ihre Zwecke verwenden, werden sich zwangsweise mit der Zeit persönliche Daten anhäufen. Achten Sie darauf, in dem Browser möglichst keine oder nur vertrauenswürdige Plugins zu verwenden. Augen auf! :-)',
    type: 'misc',
    year: 2026,
    tags: ['Information', 'Installation'],
    featured: 'tall', //wide,tall
},
];
