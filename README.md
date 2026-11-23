# Boiler Room – App-Plattform v7

Vanilla JavaScript mit **klassischen `<script src="...">`-Dateien**. Keine ES-Module, keine Abhaengigkeiten, kein Build-Prozess.

## Installation

Inhalt des ZIPs ueber die bisherige v6-Version kopieren. Die produktive `repos.js` (Plural) im Stammverzeichnis **unveraendert erhalten**. Sie wird von `index.html` weiterhin vor allen Modulen geladen:

```html
<script src="repos.js"></script>
```

Ihre `originrepos` und `originrepogroups` haben weiterhin Vorrang vor den Fallback-Daten in `js/data.js`. Die Datei `repos.js` sowie eigene `img/`, `fonts/`, `icons/` und `manifest.json` sind nicht Teil dieses ZIPs und duerfen auf dem Host nicht geloescht werden.

## Neu in v7

### Entdecken: App-Vorschau beim Klick auf ein Thumbnail

- Klick auf ein App-Symbol in einer Entdecken-Shelf oeffnet die **grosse Bibliothekskarte** als zentrierte Vorschau vor einem abgedunkelten Hintergrund.
- Die Hover-Optik (Glow, Bild-Zoom und optionales Preview-Bild) bleibt **dauerhaft aktiviert**.
- Klick auf die grosse Karte oder die Schaltflaeche **„App öffnen“** schliesst die Vorschau und oeffnet die Repo-URL in einem neuen Tab (sofern vorhanden).
- Klick auf freie Hintergrundflaechen, auf das X, **Escape** oder **Browser-Zurueck** schliesst die Vorschau ohne Oeffnen.
- Browser-Vorwaerts kann eine so geschlossene Vorschau wiederherstellen. Das Oeffnen erzeugt einen History-Eintrag, ohne die bestehende Navigation zu veraendern.
- Der Favoritenstern funktioniert auch in der grossen Vorschau; er schliesst die Karte nicht.
- Die Desktop-Drag-to-Scroll-Funktion der Shelf-Links und Highlights bleibt erhalten: Ein echter Drag erzeugt keinen Klick.
- Vorschau und Focus-Trap sind responsive und respektieren die Browser-Einstellung fuer reduzierte Animationen.

Neue Dateien: `js/discover-preview.js` und `css/discover-preview.css`. Angepasst: `index.html`, `js/discover.js`, `js/platform.js`.

### Launcher: Liste mit Entfernen-Button rechts

- In der Listenansicht sitzt der ehemalige Favoriten-Button **hinter dem App-Namen ganz rechts**.
- Statt des Sterns zeigt er ein **Muelleimer-SVG** und heisst fuer Screenreader „Aus Launcher entfernen: [App]“.
- Der Klick entfernt den Eintrag aus den Favoriten; der bisherige Toast erscheint. Die Drag-and-drop-Sortierung bleibt erhalten.
- In der App-Ansicht bleiben die runden App-Icons und die Long-Press-Sortierung unveraendert.

Angepasst: `js/cards.js`, `js/render.js`, `js/drag.js` und `css/platform.css`.

### Fav-Icon: groesser, wenn App noch kein Favorit ist

- Der Stern normaler, **noch nicht favorisierten** App-Karten ist jetzt 36 statt 18 px gross. Seine Klickflaeche waechst von 38 auf 58 px.
- Favorisierte Sterne bleiben 18 px gross. Der Muelleimer in der Launcher-Liste bleibt bewusst kompakt.

Angepasst: `css/cards.css`.

## Navigation und Layout (Neon Rail)

- Die Hauptnavigation zeigt vier kompakte SVG-Symbole mit Beschriftung ueber einer durchgehenden Linie. Der aktive Bereich erhaelt einen dezenten unteren Lichtstreifen; die anderen Bereiche bleiben neutral.
- Die Akzentfarben kommen aus den vorhandenen Variablen: Entdecken in der gedämpften Titelfarbe von „der Boiler Room“, Bibliothek violett, Launcher cyan und Ueber neutralgrau. Der Leuchteffekt bleibt unterhalb der Navigationslinie.
- Entdecken zeigt in den Regal-Ueberschriften nur noch Titel (und gegebenenfalls das Metadaten-Symbol); die bisher dynamisch eingefuegten Untertitel-`p`-Elemente entfallen.
- Der einleitende Claim steht jetzt unter **Ueber den Boiler Room** statt im globalen Hero.
- Der Entfernen-Button in der Launcher-Liste ist neutralgrau und besitzt auch bei Hover keinen Glow.
- Navigation, Favoriten-Logik und lokale Speicherung behalten ihre bisherigen Schnittstellen.

## Bibliothek: reduzierte Filterleiste

- Die Filterleiste ist transparent und verzichtet auf den bisherigen Backdrop-Blur; Rahmen und Abstaende bleiben erhalten.
- Der aktive „Alle“-Filter verwendet dasselbe Neutralgrau wie der „Ueber“-Tab, ohne Glow.
- Games, Tools und Misc verwenden monochrome Inline-SVGs anstelle der Emoji-Icons. Die Filterfunktion und die Beschriftungen bleiben unveraendert.

## Weiterhin gueltig

- `localStorage.boilerRoom` bleibt der einzige persistente Datenspeicher fuer Favoriten, Favoritenreihenfolge, Bibliotheks- und Launcher-Ansicht sowie zuletzt geoeffneten Bereich.
- Keine Migration und keine Aenderung der bestehenden Repo-Datenstruktur.
- Die Bibliothek zeigt alle Apps einzeln; Gruppen sind nur Metadaten fuer Entdecken.
- Horizontal scrollbare Highlights und Shelves inklusive Maus-Ziehen und Scroll-Pfeilen.

## Pruefung

- Syntax aller JavaScript-Dateien mit `node --check` geprueft.
- Chromium-Interaktionstests mit getrennten Demo-Daten bei **320, 390, 768, 1280 und 1920 px**: Vorschau, History, Escape, Hintergrund-Klick, App-Oeffnen (exakt einmal), Stern-Groesse, Favoritenwechsel und Launcher-Muelleimer.
- Zusaetzliche Tests fuer echtes Maus-Drag-to-Scroll auf Smartphone-Breite (simulierte Maus) und Desktop sowie Browser-Vorwaerts, Favorite in der Vorschau und den Schliessen-Button.
- Keine JavaScript-Laufzeitfehler oder horizontale Ueberbreite des Hauptdokuments.
- Der direkte `file://`-Aufruf ist in der QA-Umgebung administrativ gesperrt; der Browsertest nutzte ein eingebettetes Dokument mit inhaltlich unveraenderten Projekt-Skripten und CSS sowie nur im Test verwendeten externen Demo-Repos. Die produktive `repos.js` war nicht beteiligt.
