# AGENTS.md

## Boiler Room Platform – App-Metadatenstandard v2

### 1. Ziel und Geltungsbereich

Boiler Room ist ein Workspace, der HTML-Anwendungen in einem iframe anzeigt und deren Offline-Ressourcen organisieren kann. Dieser Standard definiert ausschließlich die dafür bereitzustellenden Informationen und die Erreichbarkeit der Schnittstellendateien.

Die Regeln gelten für Entwickler und KI-Agenten, die eine App in Boiler Room integrieren oder ihre Metadaten aktualisieren. Sie beschreiben die tatsächlichen Eigenschaften des veröffentlichten App-Stands.

Der Standard schreibt keine interne Verzeichnisstruktur, Programmiersprache, Frameworks, Build-Werkzeuge, Benutzeroberfläche, Anwendungslogik, Datenspeicherung oder Datenmigration vor. Er definiert keine Service-Worker-Implementierung, Cache-Strategie, Installations- oder Update-Mechanismen und kein Kommunikationsprotokoll zwischen Apps und Workspace. Bestehende Funktionalität und Benutzerdaten dürfen nicht allein zur Erfüllung dieses Metadatenstandards verändert werden.

### 2. Öffentliche Schnittstellendateien

Unter der für die App veröffentlichten Basis-URL müssen folgende drei Ressourcen erreichbar sein:

| Datei | Zweck |
| --- | --- |
| `manifest.webmanifest` | Standardisierte Web-App-Metadaten |
| `boiler-room.json` | Ergänzende App-Metadaten und Offline-Ressourcenliste |
| `sw.js` | Erreichbares Service-Worker-Skript der App |

Die Basis-URL bezeichnet das öffentliche URL-Verzeichnis dieser drei Schnittstellendateien. Sie ist keine Vorgabe für die interne Quellcode- oder Build-Struktur. Der Einstiegspunkt kann beliebig heißen und sich auch in einem Unterverzeichnis befinden. Eine `index.html` ist nicht vorgeschrieben. Es werden keine weiteren Pflichtdateien oder Verzeichnisse festgelegt.

Die beiden Metadatendateien müssen gültiges JSON liefern. `sw.js` muss als Service-Worker-Skript abrufbar sein (keine HTML-Fehlerseite oder bloße Platzhalterdatei). Der Standard verlangt weder seine Registrierung durch eine bestimmte Instanz noch ein bestimmtes Laufzeitverhalten.

### 3. Zuständigkeiten und redundanzfreie Metadaten

`manifest.webmanifest` ist die führende Quelle für standardisierte Web-App-Metadaten: Identität, Name, Kurzname, Beschreibung, Sprache, Kategorien, Icons, Start-URL, Scope, Darstellungsmodus und Farben. Diese Angaben werden nicht in `boiler-room.json` wiederholt.

`boiler-room.json` enthält die technische App-Version, optional die sichtbare Versionsbezeichnung, Datumsangaben, zusätzliche Suchbegriffe und beschreibende Offline-Informationen.

Die Zuordnung einer App zum Workspace und die tatsächlich verwendete iframe-Einstiegsadresse sind nicht Bestandteil dieser Metadatenschnittstelle. Eine bestehende Workspace-Konfiguration (z. B. `repos.js` mit `workspace_entry`) bleibt davon unberührt. Der Standard legt nicht fest, wie Boiler Room die App-Basis-URL ermittelt oder die Informationen verarbeitet.

### 4. Boiler Room JSON Schema

Normative Referenz ist die mit diesem Standard gelieferte `boiler-room.schema.json` (JSON Schema Draft 2020-12). Bei lokaler Übernahme ist die Übereinstimmung mit der verwendeten Standardversion sicherzustellen. Keine öffentliche Schema-URL erfinden. Das Web App Manifest benötigt keine `$schema`-Eigenschaft.

Alle im Schema als `required` gekennzeichneten Felder sind Pflichtangaben. Nicht definierte Eigenschaften sind in `boiler-room.json` unzulässig. Bei der Validierung ist die Datumsformatprüfung zu aktivieren.

| Eigenschaft | Typ | Bedeutung |
| --- | --- | --- |
| `schema_version` | Integer | `2` für diesen Standard; unabhängig von der App-Version. |
| `version` | Integer | Positive, fortlaufend steigende, in JavaScript sicher darstellbare technische App-Version. |
| `version_name` | String, optional | Frei wählbare, nicht leere sichtbare Versionsbezeichnung. |
| `created` | String / null | Datum der Erstveröffentlichung (`YYYY-MM-DD`); `null` bei nicht ermittelbarem Altbestand. |
| `updated` | String | Veröffentlichungsdatum des aktuellen App-Stands (`YYYY-MM-DD`). |
| `tags` | Array von Strings | Zusätzliche Suchbegriffe zum tatsächlichen Funktionsumfang, ohne Dubletten; ggf. leeres Array. |
| `offline.mode` | String | `full`, `partial` oder `none`. |
| `offline.limitations` | Array von Strings | Konkrete funktionale Offline-Einschränkungen bzw. Gründe für fehlende Offline-Fähigkeit. |
| `files` | Array von Strings | Liste der tatsächlich benötigten lokalen Offline-Ressourcen. |
| `changelog` | String, optional | Relativer URL-Pfad zu einer vorhandenen, veröffentlichten Änderungshistorie. |
| `license` | String, optional | Nachweisbare Softwarelizenz, bevorzugt als SPDX-Ausdruck. |
| `author` | String, optional | Nachweisbarer Autor oder verantwortliches Team. |

Beispiel: siehe `boiler-room.example.json`. Die Angaben sind Illustrationsdaten und dürfen nicht ungeprüft auf eine andere App übertragen werden.

### 5. Versionierung und Datumsangaben

- `schema_version` bezeichnet die Version dieses Metadatenschemas und nicht die Version der App.
- `version` ist die technische Kennung eines veröffentlichten App-Stands (Ganzzahl von 1 bis 9007199254740991). Sie wird bei jedem neuen veröffentlichten App-Stand erhöht, einschließlich Änderungen an den veröffentlichten Laufzeitressourcen oder paketbezogenen Metadaten. Unterschiedliche veröffentlichte App-Stände dürfen nicht dieselbe technische Version tragen. Sprünge sind zulässig. Reine interne Änderungen ohne Veröffentlichung erfordern keine Erhöhung.
- Bestehende numerische App-Versionen werden fortgeführt. Wenn noch keine technische Versionsnummer existiert, kann bei `1` begonnen werden. Bei Altbestand ist die erstmalige Zuordnung nachvollziehbar zu dokumentieren; vorhandene Projektversionen bleiben erhalten.
- `version_name` ist optional und dient ausschließlich der Darstellung, nicht dem technischen Versionsvergleich. Zulässig sind beispielsweise `"2.4.1"`, `"2.5.0-beta.1"`, `"2026.11"` oder `"Release 150"`. Es gibt kein vorgeschriebenes Versionsformat. Ohne `version_name` entspricht die anzuzeigende Versionsbezeichnung dem Wert von `version`.
- Die interne Versionierungsstrategie des Projekts bleibt frei. Der technische Versionsvergleich erfolgt nur innerhalb derselben App.
- `created` anhand der Projektgeschichte ermitteln und später unverändert lassen. Ein unbekanntes Datum (`null`) darf durch ein belegtes Datum ersetzt werden.
- `updated` bezeichnet das tatsächliche Veröffentlichungsdatum des aktuellen App-Stands und darf nicht vor einem bekannten `created` liegen.
- Optionale Angaben nur aufnehmen, wenn sie vorhanden und nachweisbar sind. Keine fiktiven Werte oder Platzhalter verwenden.

Die Versionsangaben beschreiben veröffentlichte Stände. Sie schreiben nicht vor, ob oder wie Boiler Room oder die App Updates, Installationen oder Rollbacks durchführen.

### 6. Web App Manifest

Der öffentliche Dateiname lautet `manifest.webmanifest`. Die folgenden Eigenschaften sind als Informationsumfang für Boiler Room vorgesehen und verpflichtend: `id`, `name`, `short_name`, `description`, `lang`, `categories`, `start_url`, `scope`, `display`, `background_color`, `theme_color`, `icons`.

Die Werte müssen dem tatsächlichen Projekt entsprechen und nach den Regeln des Web App Manifest gültig sein. Bestehende aufgelöste PWA-Identitäten sind bei einer Integration zu erhalten. `start_url`, `scope`, Darstellungsmodus, Icon-Pfade, Icon-Größen und Icon-Zwecke werden nicht durch diesen Standard festgelegt. Die Manifest-Kategorien beschreiben die App; `tags` in `boiler-room.json` ergänzen diese um Suchbegriffe.

App-Version, Offline-Klassifizierung und Offline-Ressourcenliste gehören ausschließlich in `boiler-room.json`. Die Manifest-Einbindung und die Art der Bereitstellung bleiben projektspezifisch. Weitere gültige Web-App-Manifest-Eigenschaften sind zulässig.

### 7. Offline-Klassifizierung

| Modus | Bedeutung | `limitations` | `files` |
| --- | --- | --- | --- |
| `full` | Alle Funktionen sind bei vollständig verfügbaren Offline-Ressourcen ohne Internet nutzbar. | Leeres Array | Nicht leere Ressourcenliste |
| `partial` | Die App startet offline und bietet weiterhin sinnvolle Funktionen, jedoch mit Einschränkungen. | Mindestens eine konkrete Einschränkung | Nicht leere Ressourcenliste |
| `none` | Die App ist ohne Internet nicht sinnvoll nutzbar. | Mindestens ein konkreter Grund | Leeres Array |

Die Einstufung beschreibt die tatsächliche Offline-Fähigkeit des veröffentlichten App-Stands, nicht den Installationsstatus auf einem bestimmten Gerät. Sie ist nach relevanten Änderungen zu überprüfen. Auch bei `none` bleiben alle drei Schnittstellendateien erreichbar. Aus der Klassifizierung folgen keine vorgeschriebenen Installations-, Cache- oder UI-Verhaltensweisen.

### 8. Offline-Ressourcenliste

`files` beschreibt bei `full` und `partial` alle lokalen veröffentlichten Ressourcen, die für den Offline-Start und die angegebenen Offline-Funktionen benötigt werden, z. B. HTML, CSS, JavaScript, Bilder, Icons, Fonts, JSON, WASM oder Worker-Skripte. Die Liste orientiert sich am tatsächlich veröffentlichten App-Stand, nicht am Quellcode.

Einträge sind eindeutige relative URL-Dateipfade, bezogen auf die URL von `boiler-room.json`. Sie enthalten keine führenden Schrägstriche, `./`- oder `../`-Segmente, absoluten URLs, Query-Strings, Fragmente, Backslashes oder Wildcards. Unterverzeichnisse, Punkte am Anfang eines Dateinamens und URL-kodierte Zeichen (z. B. `%20` für Leerzeichen) sind zulässig. Pfade müssen gültige URL-Referenzen sein und dürfen auch nach URL-Auflösung nicht aus der App-Basis-URL herausführen. Keine doppelt aufgelösten Ressourcen angeben.

Es gibt keine vorgeschriebenen Ressourcennamen oder Unterverzeichnisse. Insbesondere ist `index.html` kein Pflichteintrag. Die drei Schnittstellendateien sind unabhängig von `files` erreichbar; ob sie zusätzlich in der Liste stehen, richtet sich danach, ob sie zu den benötigten Offline-Ressourcen gehören. Auch andere JSON-Dateien namens `manifest.json` sind als Ressource zulässig.

Jede angegebene Ressource muss existieren und unter der aufgelösten URL abrufbar sein. Die Liste ist bei relevanten Änderungen zu aktualisieren. Externe oder dynamische Abhängigkeiten sind bei der Offline-Klassifizierung zu berücksichtigen. Es besteht keine Pflicht, sie umzubauen oder lokal bereitzustellen. Der Standard legt nicht fest, wie die Liste verarbeitet wird.

Für `changelog` gelten dieselben relativen URL-Pfadregeln.

### 9. Prüfung der Informationsbereitstellung

- [ ] `manifest.webmanifest`, `boiler-room.json` und `sw.js` sind unter der App-Basis-URL erreichbar und liefern den erwarteten Inhalt.
- [ ] Die Manifest-Pflichtangaben sind vorhanden, gültig und entsprechen der App; bestehende PWA-Identität ist erhalten.
- [ ] `boiler-room.json` entspricht dem v2-Schema einschließlich Datumsformatprüfung.
- [ ] Pflichtangaben sind vollständig; optionale Angaben sind nachweisbar.
- [ ] Technische Version, optionale Versionsbezeichnung und Veröffentlichungsdaten stimmen mit dem App-Stand überein.
- [ ] Offline-Modus und Einschränkungen beschreiben die tatsächlichen Funktionen.
- [ ] Alle angegebenen Offline-Ressourcen sind vorhanden, abrufbar und für die beschriebenen Offline-Funktionen vollständig erfasst.
- [ ] Tatsächliche Nutzbarkeit im Workspace-iframe ist, soweit prüfbar, bestätigt; Einschränkungen werden gemeldet, nicht eigenmächtig durch Architekturänderungen behoben.

Nur tatsächlich durchgeführte Prüfungen als bestanden kennzeichnen. Unbekannte Informationen, nicht durchgeführte Prüfungen und festgestellte Abweichungen ausdrücklich melden. Eine gültige Metadatendatei allein garantiert weder iframe-Kompatibilität noch Offline-Funktionalität.
