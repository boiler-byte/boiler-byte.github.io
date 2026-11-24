# Boiler Room – App-Plattform v10

Vanilla JavaScript mit **klassischen `<script src="...">`-Dateien**. Keine ES-Module, keine Abhaengigkeiten, kein Build-Prozess.

## Installation

Inhalt des ZIPs ueber den bisherigen v9-Projektstand kopieren. Die produktive `repos.js` (Plural) im Stammverzeichnis **unveraendert erhalten**. Sie wird von `index.html` weiterhin vor allen Modulen geladen:

```html
<script src="repos.js"></script>
```

Ihre `originrepos` und `originrepogroups` haben weiterhin Vorrang vor den Fallback-Daten in `js/data.js`. Die Datei `repos.js` sowie eigene `img/`, `fonts/`, `icons/` und `manifest.json` sind nicht Teil dieses ZIPs und duerfen auf dem Host nicht geloescht werden.

## Neu in v10: Launcher – flüchtiger Toggle und mobile App-Auswahl

- **Verwalten** bleibt nur bis zum Neuladen aktiv. Beim Start erscheint immer die App-Ansicht. Ein alter `launcherView`-Eintrag wird beim Initialisieren des bestehenden Speicherobjekts entfernt; Favoriten, Sortierung, Typgruppen und Bibliotheksansicht bleiben gespeichert.
- **+ App** öffnet ohne automatischen Suchfeld-Fokus, damit die Bildschirmtastatur erst nach bewusstem Antippen erscheint.
- Auf kleinen oder Touch-Bildschirmen erscheint das Menü unabhängig vom Button mittig im sichtbaren Browserbereich. `VisualViewport`-Resize-/Scroll-Ereignisse passen Position und Höhe bei einer Bildschirmtastatur an (Fallback: Fensterabmessungen). Die Menügröße bleibt bei wenigen oder null Treffern stabil; nur die Trefferliste scrollt, das Suchfeld bleibt sichtbar.
- Mobiler Schließen-Button neben der Suche; 16px Eingabeschrift zur Vermeidung des automatischen iOS-Eingabezooms. Auf Desktop bleibt das Dropdown am Button verankert.

Geändert: `js/storage.js`, `js/launcher.js`, `js/platform.js`, `index.html`, `css/platform.css`.

### Prüfung v10

- JavaScript-Syntax aller Module mit `node --check` geprüft.
- Chromium mit Demo-Repos und simuliertem Storage: 320, 390, 768 und 1280 px, leerer, ungruppierter und gruppierter Launcher. Geprüft: alter Toggle-Eintrag entfernt, Reload in App-Ansicht, sonstige gespeicherte Einstellungen unverändert, Öffnen ohne Suchfeld-Fokus, Suchtreffer und Null-Treffer, Scrollen der Ergebnisliste, Schließen und Hinzufügen von Apps.
- Tastaturfläche simuliert durch verkleinerten und verschobenen Visual Viewport (240 bzw. 180 px sichtbare Höhe) sowie durch tatsächliches Verkleinern des Browserfensters. Menü und Suchfeld blieben im sichtbaren Bereich; keine JavaScript-Laufzeitfehler in diesen Tests.
- Physische Android-/iOS-Geräte und Safari wurden nicht getestet.

## Neu in v9: Launcher – Verwalten-Toggle und mobiles Drag & Drop

- Der bisherige separate Apps-Button oberhalb des Launchers entfällt. **Verwalten** bleibt rechts neben **+ App** und schaltet bei jedem Klick zwischen Symbol- und Listenansicht um. In der Listenansicht ist der Toggle hervorgehoben (`aria-pressed="true"`). In v9 wurde die zuletzt gewählte Ansicht gespeichert (ab v10 nicht mehr).
- Auf Touch-Geräten wird die native Textmarkierung beziehungsweise das Long-Press-Menü bereits beim Aufsetzen des Fingers auf einem App-Symbol verhindert. Der Hinweistext unter den Apps ist nicht markierbar.
- Ein kurzes Antippen des Symbols öffnet die App einmal; nach etwa 460 ms Gedrückthalten beginnt die Sortierung. Ein Abbruch der Touch-Geste stellt die vorherige Reihenfolge wieder her. Die Sortierung per Maus und Tastatur bleibt erhalten.
- Über App-Namen und Zwischenräume kann weiterhin normal gescrollt werden. Die Sperre der Textauswahl außerhalb des Hinweises gilt nur während einer Touch-Sortiergeste. Favoriten, Gruppenzustände und Speicherstruktur bleiben unverändert.

Geändert: `index.html`, `css/platform.css`, `js/launcher.js`, `js/drag.js`.

### Prüfung v9

- Syntaxprüfung aller JavaScript-Dateien mit `node --check`.
- Chromium mit eingebetteten Projektdateien, fiktiven Demo-Repos und simuliertem Storage: 320, 390, 768 und 1280 px; leerer, ungruppierter und gruppierter Launcher. Geprüft: Toggle einschließlich gespeicherter Ansicht, Position neben + App, horizontale Breite, Maus- und Touch-Sortierung, gespeicherte Reihenfolge, kurzer Tap ohne Doppelklick, Abbruch und zu frühe Bewegung bei Touch. Keine JavaScript-Laufzeitfehler in diesen Tests.
- Navigation zu lokalen HTTP-/Datei-URLs ist in der Testumgebung gesperrt. Wiederherstellung wurde durch Neuinitialisierung mit dem gespeicherten Storage-JSON geprüft. Physische Android-/iOS-Geräte und Safari konnten nicht getestet werden.

## Neu in v8: Entdecken – Highlight-Autoplay und horizontales Scrollen

### Highlight-Karussell

- Die Highlights wechseln automatisch etwa **alle 6 Sekunden** um eine Karte weiter. Nach der letzten erreichbaren Karte beginnt die Anzeige wieder bei der ersten.
- Der automatische Wechsel pausiert bei **Maus-Hover**, **Tastatur-/Element-Fokus**, **Pointer-/Touch-Kontakt** und **Scrollen**. Auch ein vertikaler Seiten-Scroll oder das Scrollen eines anderen Regals pausiert das Karussell.
- Nach Ende aller aktiven Pausen beginnt ein **voller neuer 6-Sekunden-Zeitraum**; das bisherige Restintervall wird nicht fortgesetzt. Nachlauf und Scroll-Animationen werden abgewartet.
- Das Karussell pausiert auch, wenn es nicht ausreichend sichtbar ist, wenn der Browser-Tab nicht aktiv ist oder wenn eine App-Vorschau geöffnet ist.
- Bei der Systemeinstellung **reduzierte Bewegung** ist Autoplay deaktiviert.
- Sind alle Highlights gleichzeitig sichtbar, ist kein automatischer Scroll nötig. Pfeile und manuelles Scrollen bleiben davon unabhängig.

### Horizontales Scrollen und Snap

- Auf Mobilgeräten bleibt **natives Touch-Swiping** mit eigener Bewegungsenergie erhalten; vertikales Seitenscrollen bleibt möglich.
- Auf dem Desktop erhalten die Highlight- und App-Regale beim **Ziehen mit der Maus** einen kurzen kinetischen Nachlauf. Dabei verhindert die bestehende Klick-Unterdrueckung versehentliches Oeffnen von Karten.
- **Kein vertikales Mausrad-Mapping**: Ein normales Mausrad scrollt weiterhin die Seite, Trackpad-Gesten können nativ horizontal scrollen.
- Highlight-Karten und kleinere App-Karten verwenden **horizontales CSS Scroll-Snap (`x mandatory`, `start`)** an der linken Kante. Snap pausiert waehrend Maus-Drag und Nachlauf und wird anschließend wieder aktiv.
- Scroll-Pfeile, App-Vorschau und alle anderen v7-Funktionen bleiben erhalten.

Geändert: `js/discover.js`, `css/platform.css`. Keine neuen Abhaengigkeiten und keine Aenderungen an `repos.js`.

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

## Launcher: +App nach Typ gruppiert

- Die Auswahl unter **+ App** ist in die vorhandenen Typen **Games**, **Tools** und **Misc** gegliedert. Weitere in `repos.js` definierte Typen erscheinen als eigene Gruppen.
- Jede Typgruppe ist ein einklappbarer Bereich und **beim Oeffnen der Auswahl geschlossen**. Die Anzahl verfuegbarer Apps steht neben dem Gruppentitel.
- Apps sind innerhalb jeder Gruppe nach deutschem Alphabet (mit natuerlicher Zahlensortierung) geordnet. Bereits favorisierte Apps bleiben ausgeblendet.
- Klick oder Enter/Leertaste auf einen Gruppentitel klappt sie auf oder zu; Pfeiltasten navigieren durch sichtbare Titel und Apps, Escape schliesst das Dropdown.
- Die bisherige Funktion zum Hinzufuegen, die Favoritenreihenfolge und der leere Launcher bleiben erhalten.

## Launcher: +App mit Bibliothekssuche

- Direkt am Anfang des +App-Dropdowns steht ein Suchfeld mit Löschschaltfläche.
- Die Suche verwendet dieselbe Relevanzfunktion wie die Bibliothek: App-Namen, Tags, Beschreibungen, Typen, Status und Jahr werden berücksichtigt; Groß-/Kleinschreibung und Umlaute sind normalisiert.
- Ergebnisse bleiben nach App-Typ gruppiert und werden bei einer Suchanfrage direkt aufgeklappt. Innerhalb der Gruppen steht die Relevanz vor der alphabetischen Reihenfolge; ohne Suche bleiben alle Gruppen initial geschlossen und Namen alphabetisch sortiert.
- Apps ohne URL oder mit leerer URL sowie bereits zum Launcher hinzugefügte Apps erscheinen nicht in der Auswahl.
- Bei einer Suche ohne Treffer erscheint ein Hinweis. Die Suche lässt sich per X oder Escape leeren; Escape ohne Suchtext schließt das Dropdown.

## Launcher: Apps nach Typ gruppiert und dauerhaft sortierbar

- Die Hauptansicht **Apps** und die **Liste** gruppieren Favoriten erst bei **mindestens 9 Apps und mindestens 2 belegten Typen**. Darunter erscheinen Apps ohne Überschriften in ihrer individuellen Favoriten-Reihenfolge.
- Wenn beide Bedingungen erfüllt sind, werden die Apps nach Typ (Games, Tools, Misc) gruppiert; eigene Typen aus `repos.js` werden ebenfalls automatisch berücksichtigt. Leere Typgruppen werden nicht angezeigt.
- Alle Gruppen sind bei der ersten Nutzung **aufgeklappt**. Ein Klick auf den Gruppentitel klappt die Gruppe ein oder aus. Der Zustand bleibt beim Wechsel zwischen Apps/Liste sowie nach einem Reload erhalten.
- Die **Typ-Überschriften lassen sich per Drag & Drop verschieben** (Desktop: Ueberschrift greifen; Touch: Punktgriff links ziehen). Mit **Alt + Pfeil hoch/runter** lässt sich eine fokussierte Überschrift auch per Tastatur verschieben.
- Gruppenreihenfolge und eingeklappte Gruppen werden unter `launcherTypeOrder` und `launcherTypeClosed` innerhalb des bestehenden `localStorage.boilerRoom` gespeichert. Die Favoritenreihenfolge (`favoriteOrder`) bleibt eine eigene Einstellung.
- Unterschreitet die Anzahl Apps oder belegten Typen die Schwelle, werden Gruppen nur vorübergehend ausgeblendet: gespeicherte Gruppenreihenfolge und Offen-/Geschlossen-Zustände bleiben für das erneute Aktivieren erhalten.
- Einzelne Apps lassen sich weiterhin **innerhalb ihrer Typgruppe** sortieren: Listenzeilen ziehen; in der App-Ansicht Icons gedrückt halten oder Alt + Pfeiltasten nutzen.
- Auch Typen, die vorübergehend keine Favoriten besitzen, behalten ihre gespeicherte Position. Neu auftauchende Typen werden ergänzt, ohne die vorhandene Sortierung zu überschreiben.
- Das +App-Menü mit anfänglich **geschlossenen** Typen sowie Bibliothekssuche bleibt unabhängig davon unverändert.

Geändert: `js/launcher.js`, `js/render.js`, `js/drag.js`, `js/storage.js` und `css/platform.css`.

## Weiterhin gueltig

- `localStorage.boilerRoom` bleibt der einzige persistente Datenspeicher fuer Favoriten, Favoritenreihenfolge, Typgruppen-Sortierung und -Oeffnungszustand, Bibliotheks- und Launcher-Ansicht sowie zuletzt geoeffneten Bereich.
- Keine Migration und keine Aenderung der bestehenden Repo-Datenstruktur.
- Die Bibliothek zeigt alle Apps einzeln; Gruppen sind nur Metadaten fuer Entdecken.
- Horizontal scrollbare Highlights und Shelves inklusive Maus-Ziehen, Trägheit, Scroll-Snap und Scroll-Pfeilen.

## Pruefung

- Syntax aller JavaScript-Dateien mit `node --check` geprueft.
- Chromium-Interaktionstests mit getrennten Demo-Daten bei **320, 390, 768, 1280 und 1920 px**: Vorschau, History, Escape, Hintergrund-Klick, App-Oeffnen (exakt einmal), Stern-Groesse, Favoritenwechsel und Launcher-Muelleimer.
- Zusaetzliche Tests fuer echtes Maus-Drag-to-Scroll auf Smartphone-Breite (simulierte Maus) und Desktop sowie Browser-Vorwaerts, Favorite in der Vorschau und den Schliessen-Button.
- Keine JavaScript-Laufzeitfehler oder horizontale Ueberbreite des Hauptdokuments.
- Der direkte `file://`-Aufruf ist in der QA-Umgebung administrativ gesperrt; der Browsertest nutzte ein eingebettetes Dokument mit inhaltlich unveraenderten Projekt-Skripten und CSS sowie nur im Test verwendeten externen Demo-Repos. Die produktive `repos.js` war nicht beteiligt.

### Zusaetzliche Pruefung: Launcher-Typgruppen

- JavaScript-Syntax mit `node --check` geprueft.
- Chromium mit eingebetteten CSS-/JS-Projektdateien und isolierten Demo-Repos: 320, 390 und 1280 px, ohne Laufzeitfehler oder horizontalen Überlauf.
- Initial offene Gruppen, Einklappen und Wiederherstellen, Desktop-Drag & Drop, Touch-Griff, Tastatur-Sortierung, Reload und Ansicht-Wechsel geprueft.
- Weiterhin funktionsfaehig: einzelne Apps per Alt + Pfeil bzw. Listen-Drag sortieren, Entfernen und erneutes Hinzufuegen ueber die +App-Suche, Ausschluss von Repos ohne URL im Dropdown.
- Das Testdokument ist isoliert; die produktive `repos.js` wird nicht eingebunden oder veraendert.

### Pruefung v8

- JavaScript-Syntax aller Dateien mit `node --check` geprueft.
- Chromium-Browsertests mit separaten Demo-Apps: 320, 390, 754 und 1280 px. Kein horizontaler Ueberlauf oder JavaScript-Laufzeitfehler.
- Highlight-Intervall von 6 Sekunden geprueft; zusaetzlich Ablauf-/Pause-Tests mit einem beschleunigten Testintervall fuer Hover, Fokus, Kontakt, Scroll, Abschnittswechsel und reduzierte Bewegung.
- Native mobile Touch-Swipes, CSS-Snap, Maus-Drag mit Nachlauf und unveraendertes vertikales Mausrad-Verhalten geprueft.
- Die QA verwendet lokal eingebettete Projektdateien und rein fiktive Test-Repos. Die produktive `repos.js` ist nicht Bestandteil des ZIPs.
