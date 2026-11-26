# Boiler Room – App-Plattform v28

Vanilla JavaScript mit **klassischen `<script src="...">`-Dateien**. Keine ES-Module, keine Abhaengigkeiten, kein Build-Prozess.

## Installation

Inhalt des ZIPs über den bisherigen v27-Projektstand kopieren. Die produktive `repos.js` (Plural) im Stammverzeichnis **erhalten** (die Workspace-Zuordnungen koennen wie unten beschrieben umbenannt werden). Sie wird von `index.html` weiterhin vor allen Modulen geladen:

```html
<script src="repos.js"></script>
```

Ihre `originrepos` und `originrepogroups` haben weiterhin Vorrang vor den Fallback-Daten in `js/data.js`. Die Datei `repos.js` sowie eigene `img/`, `fonts/`, `icons/` und `manifest.json` sind nicht Teil dieses ZIPs und duerfen auf dem Host nicht geloescht werden.

## Neu in v28: Desktop-Layout des Offline-Managers

- App-Name und Offline-Status erhalten flexible, begrenzte Spalten; lange Manifest-Hinweise werden umgebrochen, ohne die Namensspalte zu verdrängen. Aktionsbuttons behalten ihren Platz.
- Die einspaltige Darstellung bis 640 px und die Versionsprüfungslogik bleiben unverändert.
- Shell-Cache auf `shell-v28` erhöht, damit das korrigierte CSS auch offline verfügbar ist. Installierte Pakete und Prüfergebnisse bleiben erhalten.

## Neu in v27: Versionsprüfung im Workspace-Offline-Manager

- Automatische Versionsprüfungen erfolgen ausschließlich beim Öffnen des Offline-Managers (einschließlich Neuladen und erneuter Navigation zur Seite), online für die Apps des aktuell ausgewählten Workspaces. Installierte Apps werden frühestens 24 Stunden, nicht installierte Apps frühestens 7 Tage (168 Stunden) nach der letzten Prüfung erneut geprüft. Dies gilt auch für Apps ohne Offline-Paket. Ein noch nicht geprüftes Manifest ist sofort fällig. Die lokale Suche beeinflusst den Prüfumfang nicht.
- Prüfergebnis und Zeitpunkt werden getrennt von den installierten Paketen im Service-Worker-Cache `offline-versions-v1` gespeichert. Das gilt auch für nicht installierte Apps, fehlende/ungültige Manifeste, `offline.mode: none` und momentan nicht erreichbare Manifeste. Die Ergebnisse bleiben über Seitenwechsel, Neuladen, Tab-Wechsel und Worker-Neustarts hinweg erhalten. Statisch nicht unterstützte Apps (andere Origins, Informationskarten) verursachen keine Netzwerkanfrage.
- Offline werden zuletzt gespeicherte Ergebnisse und lokale Paketdaten angezeigt; ohne Netzverbindung wird kein neuer Prüfzeitpunkt gesetzt. Workspace-Wechsel innerhalb des Managers, Fokus-/Sichtbarkeitswechsel, Wiederverbinden, Speicher- und Worker-Ereignisse sowie ein dauerhaft geöffneter Manager lösen keine automatischen Manifestabfragen aus. Bei solchen Ereignissen wird nur der gespeicherte Status angezeigt bzw. aktualisiert.
- „Versionen prüfen“ im Panel-Kopf startet online eine sofortige manuelle Prüfung des ausgewählten Workspaces, unabhängig vom 24-Stunden- bzw. 7-Tage-Intervall. Jede manuelle Prüfung setzt den letzten Prüfzeitpunkt neu; das passende Intervall beginnt von diesem Zeitpunkt an erneut. Der letzte Prüfzeitpunkt erscheint an jeder geprüften App. Ein vorübergehend nicht erreichbares Manifest kann so erneut geprüft werden.
- „Version x verfügbar“ verwendet `version_name` (ansonsten `version`) für erkannte Updates. „Alle Aktualisieren“ erscheint nur, wenn Updates vorhanden sind, und aktualisiert ausschließlich diese installierten Pakete im ausgewählten Workspace. „Bereitstellen“ bleibt für fehlende oder zu reparierende Pakete zuständig. Einzelupdates bleiben möglich.
- Eine ausdrücklich gestartete Bereitstellung, Reparatur oder Aktualisierung ruft das Live-Manifest zur sicheren Download-Transaktion erneut ab und aktualisiert das Prüfergebnis. Fehlgeschlagene Paketdownloads lassen vorher installierte Dateien unverändert. Die 24-Stunden-/7-Tage-Sperre gilt für automatische Versionsprüfungen, nicht für explizite Installationsvorgänge.
- Die Shell wird auf `shell-v27` angehoben. Die bereits installierten Pakete und der lokale Offline-Index bleiben erhalten. Nach dem Deployment alle bisherigen Workspace-Tabs/PWA-Fenster schließen und online erneut öffnen, damit der neue Worker aktiviert wird.

## Neu in v25: App-eigene `boiler-room.json`

`der Boiler Room` bleibt App-Store und Launcher. Der Workspace (`workspace/`) verwaltet die Offline-Pakete für Favoriten, Gruppen und den gesamten Katalog. Die bisherige Konfiguration `repo.offline` entfällt vollständig; bestehende Einträge in der produktiven `repos.js` können dieses Feld entfernen. Der einzige Einstieg ist `repo.url`. Der Launcher selbst öffnet weiterhin die Original-URL.

### App konfigurieren

```js
{
  label: 'Textanalyse',
  type: 'tool',
  workspace: 'dev',
  url: 'https://myprojectpages.github.io/Textanalyse/'
}
```

Der Offline-Manager sucht `boiler-room.json` im App-Verzeichnis: bei `/Textanalyse/` oder `/Textanalyse` unter `/Textanalyse/boiler-room.json`, bei `/Textanalyse/app.html` ebenfalls dort. Relative Repo-URLs werden wie bisher relativ zum Plattform-Stamm aufgelöst. Eine URL ohne Dateiendung wird als Verzeichnis interpretiert; für HTML-Dateien eine konkrete URL mit Endung verwenden. Die Manifest-Dateien werden relativ zum Manifest-Verzeichnis aufgelöst, nicht relativ zum Plattform-Stamm.

Die mitgelieferte `boiler-room.example.json` entspricht der Vorlage des Nutzers. Beispiel für die Offline-Demo:

```json
{
  "schema_version": 2,
  "version": 1,
  "version_name": "1.0.0",
  "created": "2026-11-24",
  "updated": "2026-11-25",
  "tags": ["Offline", "Lokal", "Notizen"],
  "offline": { "mode": "full", "limitations": [] },
  "files": ["index.html", "style.css", "app.js"],
  "changelog": "CHANGELOG.md"
}
```

- `schema_version: 2` und eine nichtnegative ganzzahlige `version` sind erforderlich. Bei jeder Änderung am Paket `version` erhöhen. `version_name` ist die lesbare Versionsbezeichnung; weitere Metadaten bleiben im gespeicherten Manifest erhalten.
- `offline.mode`: `full` = vollständig, `partial` = eingeschränkt (mit sichtbaren `limitations`), `none` = nicht zentral bereitstellbar. Nur vollständig gespeicherte `full`-Pakete zählen zur vollständigen Workspace-Abdeckung.
- `files`: alle benötigten statischen Dateien mit relativen Pfaden im App-Verzeichnis, einschließlich CSS, JS, Icons, Webmanifest, ggf. Daten und Unterverzeichnissen. Der HTML-Einstieg aus `repo.url` und `boiler-room.json` werden automatisch zusätzlich gespeichert. Maximal 500 verschiedene URLs einschließlich dieser beiden Dateien. Querystrings müssen exakt passen. `changelog` ist Metadatum; soll die Datei offline verfügbar sein, muss sie zusätzlich in `files` stehen.
- Der Offline-Manager prüft Manifeste gemäß dem oben beschriebenen Intervall und erkennt Änderungen an Version, Modus, Einschränkungen oder Dateiliste. Offline werden der letzte Prüfstand und die tatsächlich gespeicherte Paketversion angezeigt.

### Hosting und Grenzen

HTTPS oder localhost und Service Worker/CacheStorage sind erforderlich. Der Workspace-Service-Worker bleibt unter `workspace/`. Die App-Dateien müssen öffentlich und unter derselben Origin (Protokoll, Host, Port) wie Boiler Room erreichbar sein. Damit können beispielsweise mehrere Projektverzeichnisse auf derselben GitHub-Pages-Origin verwaltet werden. Eine App unter `workspace/apps/<app>/` wird direkt gestartet. Apps in anderen Verzeichnissen derselben Origin werden über einen stabilen, virtuellen Pfad `workspace/offline-apps/…/` aus dem Cache gestartet; das Original in `repo.url` bleibt unverändert. Relative Ressourcenpfade und deklarierte relative Navigation funktionieren dabei; absolute/root-relative Pfade, hartcodierte Basispfade, eigene Service Worker, pfadgebundene App-Daten, APIs und dynamische Routen können zusätzliche Anpassungen an der App erfordern. Es findet kein HTML-/JS-Rewriting statt. Nur vertrauenswürdige eigene Apps verwenden. Andere Origins können nicht sicher zentral offline gestartet werden; dort muss die App selbst ihren Offlinebetrieb über einen eigenen Service Worker bereitstellen. Die normale Online-URL bleibt nutzbar.

Keine Authentifizierung, Weiterleitungen (außer der üblichen Verzeichnis-URL, die direkt mit abschließendem Slash angefragt wird), fremden Ressourcen oder `Cache-Control: private/no-store`. Die Dateien werden nicht automatisch aus HTML extrahiert. App-spezifische Abhängigkeiten und tatsächliche Offline-Fähigkeit müssen vom App-Autor geprüft werden. Die Plattform kann nur die deklarierten Dateien prüfen und speichern.

### Offline-Manager und Migration

Der Manager bleibt aus der Workspace-Sidebar erreichbar. Einzel-/Sammelbereitstellung, Reparatur, Versionsupdate und Entfernen bleiben erhalten. Updates werden atomar gespeichert; bei einem fehlgeschlagenen Download bleibt das alte Paket erhalten. Installierte Pakete können offline entfernt werden, ohne Favoriten oder App-Nutzerdaten zu löschen. Speicher ist browserprofilbezogen und kann vom Browser freigegeben werden.

Produktive `repos.js` und eigene Ressourcen erhalten; `repo.offline` wird ignoriert und kann gelöscht werden. Jede kompatible App benötigt eine eigene `boiler-room.json`. Bestehende v24-Pakete werden nicht pauschal gelöscht; sie bleiben nur dann als Offline-Einstieg nutzbar, wenn ihre gespeicherte URL zu `repo.url` passt. Sie können nach dem Manifest-Update neu bereitgestellt oder entfernt werden. Aktuelle Shell: `shell-v28`. Nach dem Deployment alle alten Workspace-Tabs/PWA-Fenster schließen und online erneut öffnen, damit der neue Worker aktiviert wird.

Beispiel: `workspace/apps/offline-demo/` enthält den Notizblock samt Manifest und Changelog. Bei produktiver `repos.js` kann er optional als normaler Repo-Eintrag mit `url: 'workspace/apps/offline-demo/index.html'` aufgenommen werden.

### Prüfung

`node tests/offline.test.cjs` prüft die Manifest-Suche und -Validierung, fehlende und nicht erreichbare Manifeste, Modi, den simulierten Service-Worker-Lebenszyklus, die Offline-Shell, direkte und gespiegelte App-Dateien, atomare Updates mit Rollback, Reparatur, Entfernung und Cache-Isolation. Zusätzlich werden tägliche positive und negative Prüfergebnisse, manuelle Prüfungen, persistente Offline-Prüfergebnisse und parallele Anfragen geprüft. `node tests/offline-manager.test.cjs` testet die Manager-Bedienlogik in einer simulierten DOM-Umgebung. JavaScript-Syntaxprüfung für alle JS-Dateien. Reale App-Deployments und Offline-Kaltstarts auf Endgeräten müssen separat geprüft werden; die produktive `repos.js` und produktive App-Dateien liegen nicht in diesem ZIP vor.

## Neu in v23 (historisch): Workspace-PWA

- Eigenständige installierbare App unter `workspace/index.html` mit Manifest, `db`-Icons (192/512 px, maskable, Apple Touch), eigenem App-Namen und `display: standalone`. Das Manifest der Hauptplattform bleibt unverändert.
- In unterstützten Browsern erscheint „Workspace installieren“ in der Sidebar, sobald der Browser den nativen Installationsdialog anbietet. Alternativ Browser-Menü verwenden; iOS/iPadOS: Safari → Teilen → Zum Home-Bildschirm.
- HTTPS (oder localhost) erforderlich. Alle Workspace-Dateien und die bestehenden gemeinsamen JS-Dateien müssen auf demselben Host liegen. Der Service Worker wird mit Scope `workspace/` registriert; kein Root-Service-Worker nötig.
- Nach erfolgreicher Erstinstallation ist die Workspace-Oberfläche offline verfügbar. Die produktive `repos.js` und die gemeinsame Schrift werden bei erfolgreichem Abruf zwischengespeichert; der Katalog wird online aktualisiert. App-Bilder können offline fehlen. Eingebettete Apps, deren API-Aufrufe und die Hauptplattform werden bewusst nicht offline gecacht. Die Apps benötigen ggf. weiterhin eine Internetverbindung.
- `?group=dev`, Workspace-Auswahl, letzte App, Favoriten und `localStorage.boilerRoom` bleiben unverändert; der Manifest-Startpunkt enthält keine fest vorgegebene Gruppe. Die installierte App öffnet daher den zuletzt verwendeten Workspace.
- Neue Shell-Versionen werden automatisch erkannt und nach Schließen aller vom bisherigen Worker kontrollierten Seiten aktiviert. Bei zukünftigen Änderungen an gecachten Shell-Dateien den Versionsnamen `shell-v23` in `workspace/sw.js` erhöhen und den Worker mit ausliefern. Nur eigene, versionsbezogene Workspace-Caches werden bereinigt. Andere Service Worker und Caches bleiben erhalten.
- Bestehende Browser-/PWA-Storage-Regeln gelten: auf demselben Origin und im selben Browserprofil wird derselbe Storage-Schlüssel verwendet; insbesondere iOS kann Home-Screen-Web-Apps getrennt speichern.

Geändert: `workspace/index.html`, `workspace/workspace.css`, `README.md`. Neu: `workspace/manifest.webmanifest`, `workspace/sw.js`, `workspace/pwa.js`, `workspace/icons/`.

Prüfung v23: JavaScript-Syntax, Manifest und Icon-Abmessungen sowie simulierte Service-Worker-Lifecycle- und Fetch-Tests (Offline-Shell, Deep-Links, Katalog-Aktualisierung, Cache-Isolation) bestanden. Chromium blockiert lokale URL-Navigation in der Testumgebung (`ERR_BLOCKED_BY_ADMINISTRATOR`); die tatsächliche Browserinstallation und der Offline-Start auf einem Gerät wurden daher nicht geprüft.

## Neu in v22: repo.workspace

- Die kanonische Workspace-Zuordnung eines Repos heisst `workspace` statt `group`.
- Einzelne ID: `workspace: 'dev'`; mehrere IDs: `workspace: ['dev', 'cards']`.
- In der produktiven `repos.js` die bisherigen Zuordnungen `group` bzw. `groups` in `workspace` uebertragen. Die Datei ist nicht Bestandteil des ZIPs.
- Rueckwaertskompatibilitaet: Fehlt `workspace`, werden `group` und `groups` wie bisher ausgewertet. Ist `workspace` vorhanden, hat es Vorrang, auch bei `[]` oder `null` (keine Zuordnung).
- `originrepogroups`, Gruppen-IDs, `workspace/index.html?group=dev`, `localStorage.boilerRoom` und die kuratierte Sortierung bleiben unveraendert. Die zentrale Funktion `B.data.groupIds` wird weiterhin von Bibliothek, Entdecken-Metadaten und Workspace verwendet.

Geaendert: `js/data.js`, `README.md`.

Pruefung v22: JavaScript-Syntax und Node.js-Datenmodelltests fuer einzelne/mehrere IDs, Altformat, Vorrang des neuen Feldes, leere Zuordnungen, nicht definierte Gruppen und Fallback-Repos bestanden. Kein erneuter Browsertest; die produktive `repos.js` liegt nicht vor.

## Neu in v21 (historisch): Repo-Gruppen nur in der Bibliothek

- Entdecken zeigt keine Repo-Gruppen-Karten, gruppenspezifischen Regale oder Workspace-Gruppenlinks mehr. Highlights, Typ- und Tag-Regale sowie Gruppenangaben als Metadaten einzelner Apps bleiben erhalten.
- In der kuratierten Bibliothek bleibt die Reihenfolge der einzelnen Apps aus `originrepos` erhalten. Jede Gruppe erscheint genau einmal unmittelbar nach ihrer ersten sichtbaren Mitglieds-App. Bei mehreren Gruppen derselben App gilt die Reihenfolge des Gruppenkatalogs. Gruppen ohne sichtbare Mitglieds-App stehen am Ende (bei Typfiltern werden nicht passende Gruppen weiterhin ausgeblendet).
- Die Regel gilt in Karten-, Listen- und Icon-Ansicht. Namens-, Typ- und Jahressortierung sowie Suchrelevanz bleiben unverändert. Gruppen öffnen weiterhin `workspace/index.html?group=<id>`.
- Workspace, Launcher, produktive `repos.js` und `localStorage.boilerRoom` bleiben unverändert.

Geändert: `js/discover.js`, `js/render.js`, `js/groups.js`, `css/groups.css`, `README.md`.

Prüfung v21: JavaScript-Syntax und Chromium mit eingebetteten Projektdateien und Demo-Repos bei 320, 390, 768 und 1280 px. Kuratierte Reihenfolge, Mehrfachzugehörigkeit, leere Gruppen, Typfilter, Suche, Namenssortierung, drei Bibliotheksansichten, Entdecken ohne Gruppenregale, App-Vorschau, Workspace-Links, Deep-Link-Persistenz und iFrame-Keep-alive geprüft. Produktive Repos und echte URL-Navigation sind nicht Teil des Tests.

## Neu in v20 (historisch): Repo-Gruppen als Workspace

- Unter **Entdecken** gibt es nach den Highlights eine horizontal scrollbare Reihe „Repo-Gruppen“. Die vorhandenen App-Regale bleiben erhalten; auch die Titel der gruppenspezifischen Regale verlinken auf den jeweiligen Workspace.
- In der **Bibliothek** stehen die Gruppenkarten wieder zur Verfügung, standardmäßig vor den einzelnen Apps, in allen drei Ansichten (Karten, Liste, Icons). Apps bleiben einzeln erreichbar. Die Karten zeigen Gruppenname, Anzahl der Apps und vorhandene Gruppenbilder bzw. Collagen (`img: 'all'`, `preview: 'all'`). Ohne Bild steht das Gruppensymbol als Fallback bereit.
- Suche, Typfilter und Sortierung berücksichtigen auch Gruppen. Die Suche findet Gruppen anhand eigener Metadaten und ihrer enthaltenen Apps; Mitgliedertreffer stehen in der Relevanz unter direkten App-Titeltreffern. Ein Typfilter zeigt eine Gruppe, wenn sie mindestens eine App dieses Typs enthält. Beim Öffnen wird immer die vollständige Gruppe geladen. Gruppen erhalten keinen Favoritenstern; der Launcher bleibt unverändert.
- Gruppen sind normale Links im selben Tab, z. B. `workspace/index.html?group=dev`. Das alte Kreis-/Orbit-Menü und dessen Styles sind entfernt. Die Vorschau einzelner Apps unter Entdecken bleibt erhalten.
- Die Gruppen werden zentral aus den vorhandenen `originrepogroups`, `repo.group` und `repo.groups` gebildet; auch mehrere Gruppen pro Repo, leere Gruppen, nicht separat definierte Gruppen und IDs mit Sonderzeichen funktionieren.
- Eine gültige Gruppen-ID im URL-Parameter `group` hat beim Start Vorrang vor `localStorage.boilerRoom.workspace.selected`. Die zuletzt geöffnete App dieser Gruppe wird wiederhergestellt, sonst die erste startbare App. Ohne gültigen Parameter gilt weiterhin der gespeicherte Workspace (beim ersten Start: Favoriten). Unbekannte Parameterwerte werden ignoriert und durch die gültige Auswahl ersetzt bzw. entfernt.
- Die Gruppenauswahl im Workspace aktualisiert den URL-Parameter über `history.replaceState`, ohne zusätzliche Verlaufseinträge. Beim eigenen Favoriten-Workspace entfällt `group`. Die bisherige Persistenz und iFrame-Wiederverwendung bleiben erhalten.

Geändert: `index.html`, `js/data.js`, `js/groups.js`, `js/render.js`, `js/discover.js`, `css/groups.css`, `workspace/workspace.js`, `README.md`. Die produktive `repos.js` bleibt unverändert.

Prüfung v20: JavaScript-Syntax; Chromium mit eingebetteten Projektdateien und Demo-Repos bei 320, 390, 768 und 1280 px; Gruppenlinks per Maus/Tastatur, Scroll-Drag ohne unbeabsichtigtes Öffnen, Collagen, Suche, Filter, Namenssortierung, alle drei Bibliotheksansichten, unveränderte App-Vorschau und Launcher, Deep-Link-Priorität, Sonderzeichen, ungültige/leere Gruppen, Wiederherstellung der letzten App und iFrame-Keep-alive. Direkte URL-Navigation war administrativ gesperrt, deshalb wurden Linkaktivierung, URL/History und Storage simuliert. Produktive Repos und Assets wurden nicht getestet.

## Neu in v19 (historisch): Workspace im Launcher

- Der Workspace-Link befindet sich direkt rechts neben dem Info-Tooltip in der Launcher-Aktionsleiste. Auf schmalen Bildschirmen wird er als kompakter Icon-Link dargestellt; der zugängliche Name bleibt erhalten.
- Die Hauptnavigation hat wieder vier Einträge. Der Workspace öffnet weiterhin seine eigenständige Seite im selben Tab.
- Workspace-eigener Vollbild-Button, Fullscreen-Steuerung und zugehörige CSS-Regeln sind entfernt. Eingebettete Apps dürfen weiterhin selbst Vollbild anfordern.
- Gruppenwahl, Suche, Favoriten, iFrame-Keep-alive und `localStorage.boilerRoom` bleiben unverändert.

Geändert: `index.html`, `css/platform.css`, `workspace/index.html`, `workspace/workspace.css`, `workspace/workspace.js`, `README.md`.

Prüfung v19: Chromium mit eingebetteten Projektdateien und Demo-Repos bei 320, 390, 540, 768 und 1280 px im Launcher; vier Navigationseinträge, Linkposition, Info-Tooltip, Verwalten und Abschnittswechsel. Workspace-Regression bei 320, 390, 700, 768 und 1280 px: Suche, Gruppen, Persistenz, iFrame-Keep-alive und erhaltene iFrame-Vollbildberechtigung. Keine Laufzeitfehler. Produktive Repos, Assets und echte URL-Navigation wurden nicht getestet.

## Neu in v18 (historisch): Workspace-Sidebar und Vollbild

- `db` als Brand-Mark für „der Boiler“, darunter der Untertitel „der Boiler Room“.
- Der Sidebar-Header ist selbst die Workspace-Auswahl: aktueller Gruppenname, Brand-Mark und Chevron bilden die gesamte Klickfläche des nativen Dropdowns. Der separate Gruppen-Picker entfällt. Auf kleinen Bildschirmen bleibt der Schließen-Button neben dem Header erhalten; auf Desktop wird die Sidebar über die Toolbar gesteuert.
- Die App-Suche verwendet dieselbe Relevanzbewertung wie die Bibliothek. Titel haben Vorrang vor Tags, Beschreibung, Typ, Status und Jahr. Umlaute, Groß-/Kleinschreibung, mehrfacher Leerraum und kombinierte Suchbegriffe werden wie in der Bibliothek berücksichtigt. Treffer werden nach Relevanz sortiert, bei Gleichstand gilt die bisherige Workspace-Reihenfolge. Die Suche filtert nur die aktuelle Gruppe bzw. Favoriten; der Zähler zeigt Treffer/Gesamtanzahl. Die geöffnete App bleibt dabei erhalten. X oder Escape löschen den Suchbegriff, Enter übernimmt die Suche. Beim Gruppenwechsel wird die temporäre Suche zurückgesetzt.
- Der neue Toolbar-Button schaltet den gesamten Workspace über die native Fullscreen API ins Vollbild und zurück. Sidebar und Toolbar bleiben verfügbar; Symbol, Tooltip und ARIA-Status werden bei Änderungen (auch externem Vollbildende) synchronisiert. Bei fehlender API oder blockiertem Vollbild gilt die Browserbeschränkung; es wird kein Vollbild vorgetäuscht.
- `localStorage.boilerRoom`, Favoriten, Workspace-Persistenz und iFrame-Keep-alive bleiben unverändert. Suchtext und Vollbild sind bewusst nicht persistent.

Neu: `js/search-relevance.js` (gemeinsame, aus der Bibliothek ausgelagerte Suchbewertung). Geändert: `index.html`, `js/search.js`, `workspace/index.html`, `workspace/workspace.css`, `workspace/workspace.js`, `README.md`. Beim Update auch die geänderten Dateien im Stammverzeichnis und `js/` übernehmen, nicht nur `workspace/`.

### Prüfung v18

- Chromium mit lokal eingebettetem App-Testinhalt und simuliertem Storage: Suche nach Titel, Tags, Jahr, Status und mehreren Begriffen, Relevanz, Umlaute, Trefferzählung, kein Treffer, Gruppenwechsel, Such-Reset und mobile Escape-Behandlung. Vollbild-Eintritt und -Austritt über die echte Fullscreen API geprüft.
- Regressionstest der v17-Funktionen (Gruppen, Favoriten, Persistenz, iFrame-Keep-alive, Reload und mobile Navigation) bei 320, 390, 700, 768 und 1280 px. JavaScript-Syntax und ZIP-Integrität geprüft.
- Produktive `repos.js`, Assets, externe App-Aufrufe, Safari und reale Mobilgeräte sind nicht Bestandteil der Tests.

## Neu in v17 (historisch): Eigenständiger Workspace

Der Workspace-Link (seit v19 im Launcher) öffnet `workspace/index.html` als eigene Seite. Alternativ ist die App direkt unter `boiler-room/workspace/` erreichbar. Die Oberfläche besteht aus `workspace/index.html`, `workspace/workspace.css` und `workspace/workspace.js`; sie benutzt wie die Plattform klassische Skripte ohne Framework oder Build.

### Workspace-Auswahl und Apps

- Beim ersten Start ist **Mein Workspace** aktiv: die vorhandenen Favoriten in ihrer gespeicherten `favoriteOrder` (weitere Favoriten folgen am Ende). Keine zweite Favoritenliste.
- Das Dropdown übernimmt alle Gruppen aus `originrepogroups` bzw. `B.data.repogroups`. Die Mitgliedschaft folgt dem vorhandenen `repo.group`; zusätzlich werden Gruppen-Arrays unter `repo.group` oder `repo.groups` unterstützt. Zugeordnete, aber nicht definierte Gruppen erscheinen unter ihrer ID.
- Die Sidebar listet alle Repos der gewählten Gruppe mit Namen, Bild bzw. Symbol und Typ. Repos ohne URL zeigen ihre Beschreibung statt eines iFrames. Leere Gruppen und leere Favoriten erhalten eigene Leerzustände.
- App-Wechsel ohne Neuladen des Workspace: Ein iFrame wird erst beim ersten Öffnen angelegt und beim Wechsel nur ausgeblendet. Dadurch bleiben laufende App-Zustände während dieser Sitzung erhalten. Die Toolbar bietet ein manuelles Neuladen der App (Start-URL) und Öffnen der Start-URL in einem separaten Tab.
- Desktop: ein- und ausblendbare Sidebar. Bis 700 px: seitlicher Drawer mit Schließen per Hintergrund, Escape oder App-Auswahl. Die App belegt dann die gesamte verfügbare Inhaltsbreite.
- Relative URLs und Bilder werden wie auf der Hauptseite relativ zum Boiler-Room-Stammverzeichnis aufgelöst. App-URLs müssen HTTP(S) sein; lokale `file:`-URLs sind für die lokale Entwicklung ebenfalls akzeptiert.

### Gemeinsame Persistenz

`localStorage.boilerRoom` bleibt der einzige Persistenzschlüssel der Plattform. Der zusätzliche Untereintrag ist beispielsweise:

```json
{
  "workspace": {
    "selected": "group:dev",
    "app": "Clipwerk",
    "lastApps": { "favorites": "Wetter", "group:dev": "Clipwerk" },
    "sidebarCollapsed": false
  }
}
```

`selected` ist `favorites` oder `group:<Gruppen-ID>`. Die gespeicherte App wird beim Start wieder geöffnet; pro Gruppe wird die letzte Auswahl separat gespeichert. Ohne gültige Auswahl öffnet sich die erste startbare App (sonst der erste Informationseintrag bzw. der Leerzustand). Entfernte Gruppen fallen auf die Favoriten zurück. Desktop-Sidebar-Zustand wird gespeichert; der mobile Drawer bleibt beim Seitenstart geschlossen. Favoritenänderungen aus anderen Tabs werden im Workspace übernommen. `js/storage.js` liest vor Zugriffen den aktuellen Speicherstand, damit Änderungen an Workspace und Plattform-Einstellungen nicht durch eine alte Kopie des Gesamtobjekts verloren gehen. Gleichzeitige konkurrierende Schreibvorgänge sind damit nicht transaktional abgesichert. Vorhandene weitere Felder bleiben erhalten, der frühere `launcherView`-Eintrag und die alten Einzel-Schlüssel werden weiterhin entfernt.

Der Workspace und die Hauptseite müssen unter derselben Origin (Schema, Host, Port) laufen, damit beide auf denselben Storage zugreifen. Bitte über einen Webserver betreiben, nicht direkt per `file://`. Beim Neuladen werden Auswahl und Sidebar wiederhergestellt; der interne App-Zustand nach einem Seitenreload hängt weiterhin von der App selbst ab.

### iFrame-Berechtigungen

Die iFrames besitzen bewusst **kein `sandbox`-Attribut**. `allow` delegiert u.a. Vollbild, Autoplay, Kamera, Mikrofon, Geolocation, Zwischenablage, Gamepad und Sensoren; `allowfullscreen` ist zusätzlich gesetzt. Nur eigene bzw. vertrauenswürdige Apps in den Repo-Katalog aufnehmen. Browser-Sicherheitsregeln, Nutzerfreigaben, HTTPS-Anforderungen, Same-Origin-Policy, übergeordnete Permissions-Policy und Drittanbieter-Speicherregeln bleiben wirksam. Insbesondere können `X-Frame-Options` oder CSP `frame-ancestors` auf dem Zielserver die Einbettung verhindern. In diesem Fall können Apps über das Toolbar-Symbol separat geöffnet werden. Cross-Origin-Apps können nicht automatisch den Boiler-Room-Storage lesen. Es wird kein Sicherheitsmechanismus umgangen.

Geändert: `index.html`, `css/platform.css`, `js/storage.js`. Neu: `workspace/index.html`, `workspace/workspace.css`, `workspace/workspace.js`.

### Prüfung v17

- JavaScript-Syntax und ZIP-Integrität geprüft.
- Chromium offline mit eingebetteten Test-Apps und simuliertem Storage bei 320, 390, 700, 768 und 1280 px: Favoritenreihenfolge, alle Gruppenauswahlen, leere Gruppen, Informationseinträge, letzte App pro Gruppe, Wiederherstellung des Workspace, Erhalt von App-Eingaben beim Wechsel, expliziter Reload, iFrame-Attribute, Drawer, Storage-Änderungsereignisse und Erhalt anderer Einstellungen geprüft. Hauptnavigation auf 320 px auf Überlauf geprüft.
- Direkte URL-Navigation wurde von der Browserumgebung blockiert. Produktive `repos.js`, Bilder und produktive iFrame-Serverheader waren nicht verfügbar. Echte Cross-Origin-Aufrufe, Berechtigungsdialoge, Safari und physische Mobilgeräte wurden nicht getestet.

## Neu in v16: Bibliothek – violette Filter-Akzente

- Ansicht, Sortierung, Suche und der Alle-Chip beim Fokus verwenden die vorhandene Bibliotheksfarbe `--violet-base` (#b78aff) sowie die zugehörigen Rahmen- und Glow-Variablen.
- Auch aktive Nicht-Standardoptionen und der Fokus innerhalb der Dropdowns sowie das Suchsymbol und Löschsymbol folgen dem violetten Akzent.
- Die Typ-Chips behalten ihre Farben: Games orange, Tools cyan, Misc grün. Standardwerte bleiben neutral und alle Filter bleiben 36 px hoch.
- Keine Änderungen an Filterlogik, Persistenz, Hauptmenü oder Launcher.

Geändert: `css/controls.css`, `css/platform.css`.

Prüfung: Chromium mit Demo-Daten bei 320, 390, 768 und 1280 px: Farbzustände, Dropdown-Optionen, Typfarben, 36-px-Höhe, Suche und Rücksetzen erfolgreich getestet. Physische Mobilgeräte und Safari wurden nicht getestet.

## Neu in v15: Bibliothek – Filter-Akzente

- Chips, Ansichts- und Sortierbuttons sowie Suche sind exakt 36 px hoch und haben denselben dezenten grauen Hintergrund, abgerundete Rahmen und neutrale Grundfarbe.
- Standardwerte: Alle, Karten, kuratierte Reihenfolge und leere Suche. Diese sind ohne Farbakzent; der ausgewählte Alle-Chip hat eine neutrale Markierung.
- Abweichende Werte werden ohne Leuchtschein farbig markiert: Games orange, Tools cyan, Misc grün; Ansicht, Sortierung und Suche cyan. Die Chip-SVGs übernehmen die Textfarbe.
- Bei Fokus oder geöffnetem Dropdown leuchtet der jeweilige Akzent; nach Fokusverlust bleibt nur die normale Farbanzeige abweichender Werte. Die Standardwerte erscheinen wieder neutral. Die Suche färbt auch das Löschsymbol ein.
- Bis 860 px stehen die Chips in einer eigenen Zeile, die beiden Dropdowns und die Suche gemeinsam darunter. Bis 620 px bleiben die Typ-Chips wie bisher reine Icons und die Suche nutzt 16 px Schriftgröße gegen iOS-Eingabezoom.
- Die bisherige Filterlogik und Persistenz bleiben unverändert. Die Launcher-Suche ist nicht von den neuen Bibliotheksstilen betroffen.

Geändert: `css/controls.css`, `css/views.css`, `css/platform.css`, `js/views.js`.

### Prüfung v15

- Chromium mit Demo-Repos, simuliertem Storage und Bildschirmbreiten 320, 390, 768 und 1280 px: exakte Höhe und Grundfarbe aller Filter, Fokus/Glow, Nicht-Standardwerte, Rücksetzen, Suchtreffer und automatische Chip-Rücksetzung geprüft. Zusätzlich v14-Regressionstests für Ansicht, Sortierung, Menüs, Tastaturbedienung und Launcher-Zurück-Icon bestanden.
- JavaScript-Syntax und ZIP-Integrität geprüft. Physische Mobilgeräte und Safari wurden nicht getestet.

## Neu in v14: Launcher-Zurück-Pfeil und Bibliotheks-Dropdowns

- Der Verwalten-Toggle zeigt in der Listenansicht einen SVG-Linkspfeil neben **Zurück**. Beim Wechsel zur App-Ansicht erscheint wieder das Listen-Symbol neben **Verwalten**.
- Die bisherigen Selects `viewSelect` und `librarySort` sind jetzt zwei kompakte Icon-Buttons. Das SVG des aktuellen Werts ist das einzige sichtbare Element im geschlossenen Zustand.
- Die Menüs zeigen SVG-Icons, ausgeschriebene Optionen und ein Häkchen am aktiven Eintrag. Karten, Liste, Icons sowie kuratierte Reihenfolge, Name A–Z, neueste zuerst und Typ A–Z bleiben erhalten.
- Die beiden Buttons bleiben zusammen. Die Dropdowns werden am Bildschirmrand horizontal begrenzt und bei Bedarf oberhalb des Buttons geöffnet. Bei wenig Platz scrollt das Menü intern.
- Maus, Touch und Tastatur (Pfeile, Home/End, Enter, Escape, Tab) werden unterstützt. Außerhalb antippen oder den Bereich wechseln schließt das Menü. Die Bibliotheksansicht bleibt wie bisher gespeichert; die Sortierung bleibt flüchtig.

Geändert: `index.html`, `css/controls.css`, `css/views.css`, `css/platform.css`, `js/views.js`, `js/platform.js`, `js/launcher.js`.

### Prüfung v14

- Chromium mit Demo-Repos und simuliertem Storage: 320, 390, 768 und 1280 px. Alle Ansichts- und Sortieroptionen, SVG-Status, Reihenfolge, gespeicherte Ansicht, Menüposition, Maus-/Touch-Auswahl, Tastaturbedienung, Schließen und Launcher-Toggle inklusive Iconwechsel geprüft. JavaScript-Syntax geprüft.
- Physische Mobilgeräte und Safari wurden nicht getestet.

## Neu in v13: Launcher – Verwalten / Zurück und mobiles Listen-Drag&Drop

- Der Verwalten-Toggle heißt in der Listenansicht **Zurück**, in der App-Ansicht **Verwalten**. Der flüchtige Zustand aus v10 bleibt unverändert.
- Auf Touch-Geräten ist der Punktgriff in jeder Listenzeile eine eigene, mindestens 44 px breite Drag-Fläche. Bereits bei `touchstart` wird die native Textauswahl bzw. Scrollgeste am Griff unterbunden; außerhalb des Griffs bleibt normales Scrollen möglich.
- Direktes Ziehen ab 8 px Bewegung oder Gedrückthalten für 460 ms startet die Sortierung mit einer schwebenden Zeilenvorschau. Am Bildschirmrand scrollt die Seite während des aktiven Ziehens kontrolliert mit.
- Die Reihenfolge wird beim Loslassen gespeichert. Bei Abbruch wird die ursprüngliche Reihenfolge wiederhergestellt. Sortierung bleibt wie bisher auf die jeweilige Typgruppe beschränkt; Desktop-Drag&Drop bleibt nativ.
- Der Info-Tooltip erläutert den Punktgriff. Beim Verlassen des Launchers wird eine laufende Geste beendet.

Geändert: `js/launcher.js`, `js/drag.js`, `js/platform.js`, `css/platform.css`.

### Prüfung v13

- Chromium mit Demo-Repos und simuliertem Storage: 320, 390, 768 und 1280 px, leerer Launcher sowie Listen mit 4, 10 und 12 Apps. Toggle-Beschriftung, direkte Touch-Sortierung, Long-Press, Textauswahl, Abbruch, Persistenz, normale Scrollgeste und automatisches Scrollen am Rand, Gruppengrenzen, App-Öffnen und Entfernen geprüft. Bestehende App-Symbol-Sortierung und natives Desktop-Listen-Drag&Drop ebenfalls geprüft.
- JavaScript-Syntax aller Module geprüft. Physische Mobilgeräte und Safari wurden nicht getestet.

## Neu in v12: Hauptnavigation – Neon nur bei Interaktion

- Alle vier Menüpunkte haben im Ruhezustand gedämpfte Akzentfarben. Entdecken bleibt goldfarben, Bibliothek violett, Launcher cyan und Über neutralgrau.
- Nur ein nicht selektierter Menüpunkt leuchtet beim Maus-Hover auf: Symbol, Beschriftung, untere Lichtspur und weicher Schein. Einblenden in 150 ms, Ausblenden in 250 ms.
- Die selektierte Seite behält eine matte Unterkante und dezente Hintergrundtönung, auch beim Hover. Der Neon-Effekt erlischt bei Auswahl.
- Auf Touch-Geräten leuchtet ein inaktiver Menüpunkt beim Drücken kurz auf (60 ms Einblendzeit), ohne dauerhaftes Hover. Tastaturfokus bleibt mit einem matten Rahmen erkennbar. Die Einstellung für reduzierte Bewegung schaltet die Übergänge ab.
- Die Farbwerte im Ruhezustand sind auf lesbare, gedämpfte Akzente abgestimmt; die bisherige Titelfarbe bleibt als Auswahlmarkierung für Entdecken erhalten. Navigation, Persistenz und Launcher-Funktionen bleiben unverändert.

Geändert: `css/platform.css`, `js/platform.js`.

### Prüfung v12

- Chromium mit eingebetteten Projektdateien, Fallback-Repos und simuliertem Storage: Ruhezustand, Hover, Auswahl, Tastaturfokus und Navigation bei 320, 390, 768 und 1280 px geprüft. Touch-Drücken, Loslassen und Antippen in der Touch-Emulation sowie Abbruch über ein synthetisches pointercancel-Ereignis geprüft. Reduzierte Bewegung und JavaScript-Syntax geprüft.
- Physische Mobilgeräte und Safari wurden nicht getestet.

## Neu in v11: Launcher – Info-Tooltip

- Ein runder Info-Button steht links in der unteren Aktionsleiste, auf einer Höhe mit **+ App** und **Verwalten**. Auch im leeren Launcher bleiben alle drei Buttons in derselben Zeile.
- Der bisherige `launcherHint` erscheint oberhalb des Info-Buttons als Tooltip statt dauerhaft sichtbarer Text. Die bestehenden Hinweise wechseln weiterhin passend zur App-/Listenansicht und zur Gruppierung.
- Maus-Hover, Tastaturfokus oder Antippen zeigen den Tooltip an; Klick/Antippen hält ihn offen, erneutes Antippen, Klick außerhalb oder Escape schließen ihn. Beim Ansichts- oder Bereichswechsel wird er geschlossen.
- Die bisherige große +App-Schaltfläche im leeren Launcher bleibt ab 480 px erhalten; bei schmaleren Displays wird sie kompakter, damit die drei Buttons nebeneinander passen.

Geändert: `index.html`, `css/platform.css`, `js/launcher.js`, `js/render.js`, `js/platform.js`.

### Prüfung v11

- Chromium mit Demo-Repos und simuliertem Storage: 320, 390, 768 und 1280 px. Geprüft wurden die gemeinsame Aktionsleiste im leeren, ungruppierten und gruppierten Launcher, Maus-Hover, Tastaturfokus, Escape, Touch-Antippen, Schließen außerhalb, Kontextwechsel und beide Launcher-Ansichten.
- Regressionstests für v10 (flüchtiger Verwalten-Toggle, App-Auswahl ohne Autofokus, simulierte Tastaturfläche, Suche und Hinzufügen) bestanden. JavaScript-Syntax aller Module geprüft.
- Physische Android-/iOS-Geräte und Safari wurden nicht getestet.

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

- Die Hauptnavigation zeigt vier kompakte SVG-Symbole mit Beschriftung ueber einer durchgehenden Linie. Seit v12 erhaelt der aktive Bereich eine matte untere Markierung; die anderen Bereiche zeigen gedämpfte Farbakzente. Nur inaktive Menüpunkte leuchten bei Interaktion.
- Die Akzentfarben kommen aus den vorhandenen Variablen: Entdecken mattgolden (Auswahlmarkierung in der Titelfarbe von „der Boiler Room“), Bibliothek violett, Launcher cyan und Ueber neutralgrau. Beim Hover leuchten Symbol, Beschriftung und untere Lichtspur.
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
- Die Bibliothek zeigt einzelne Apps und seit v20 auch Repo-Gruppen als Workspace-Links.
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
