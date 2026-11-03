# Flora-Pflanzen-Editor

[English](README.md) · **Deutsch** · [Español](README.es.md) · [Français](README.fr.md)

Eine eigenständige Web-App, mit der du Pflanzen für [Flora](https://github.com/jaseknighter/flora) auf dem monome norns zeichnest.
Du zeichnest die Form, und die App schreibt das L-System dazu: Axiom, Regeln, Wachstumsstufen und Melodie.
Sie zeigt eine norns-Vorschau, spielt die Melodie ab und exportiert eine fertige `.flora`-Datei.

Alles steckt in einer einzigen Datei, `index.html`. Es gibt nichts zu installieren oder zu bauen, und die App läuft auch offline.

## Schnellstart

1. Öffne `index.html` in einem aktuellen Browser (Chrome, Edge, Firefox oder Safari), z. B. per Doppelklick.
2. Ziehe mit **✏️ Zeichnen** vom roten Startpunkt aus eine Linie. Sie rastet in die Richtungen des gewählten Winkels ein.
3. Wähle **Symmetrie** (z. B. 6-fach) und **Spiegeln**, um aus einem einzigen Arm eine Schneeflocke zu bauen.
4. Mit **▶ Abspielen** hörst du die Melodie. Der Regler **Ansicht bis Generation** zeigt, wie die Pflanze wächst.
5. Klicke auf **Speichern (.flora)** und kopiere die Datei auf den norns (siehe [Pflanze auf dem norns verwenden](#pflanze-auf-dem-norns-verwenden)).

Über das Menü 🌐 oben rechts schaltest du zwischen Deutsch, Englisch, Spanisch und Französisch um.

## Im Web bereitstellen

Die App ist eine statische Seite mit `index.html` als Startdatei. Jeder Webserver oder statische Hoster kann sie ausliefern,
z. B. GitHub Pages, Netlify oder ein eigener Server. Lade `index.html` hoch; die README-Dateien sind optional.
Es gibt keinen Code auf dem Server, und die App lädt nichts von fremden Servern nach.

- **HTTPS** ist empfehlenswert: Dort kopiert die App über die Zwischenablage-Schnittstelle des Browsers. Über reines HTTP nutzt sie ein älteres Kopierverfahren; alles andere funktioniert gleich.
- Was sich die App merkt, liegt im Browser der jeweiligen Besucher, getrennt für jede Webadresse.

## Funktionen

### Zeichnen
- **Raster:** Winkel 30°, 45°, 60° und 90°. Linien rasten in die erlaubten Richtungen ein und werden in Turtle-Schritte zerlegt.
- **Symmetrie:** 2- bis 12-fach, je nach Winkel.
- **Spiegeln:** legt jede neue Linie zusätzlich gespiegelt an der senkrechten Achse an.
- **Linientypen:**
  - ♪ **Ton** (`F`): zeichnet und spielt einen Ton.
  - — **Linie** (`G`): zeichnet mit einer Pause.
  - ┄ **Sprung** (`f`): bewegt sich unsichtbar, z. B. vom Mittelpunkt zu einem Ring.
- **Werkzeuge:** Zeichnen, Auswählen, Übertragen (Typ und Generation), Radieren. Rückgängig/Wiederholen mit Strg+Z / Strg+Y.
- **Navigation:** Mausrad zoomt, rechte Maustaste verschiebt.

### Wachstum
- **Generationen:** Jede Linie hat eine Generation, erkennbar an der Farbe. Generation 0 ist sofort da, höhere wachsen nacheinander dazu.
- **Regeln:** Die App macht daraus automatisch Regeln. Spätere Teile stecken hinter Hilfsbuchstaben, die pro Generation eine Stufe weiterwachsen.
- **Regler:** „Ansicht bis Generation“ zeigt jede Stufe im Editor, in der Vorschau und in der Melodie.

### Melodie
- **Tonhöhen:** An jeder Ton-Linie steht die Stufe (1–24) der Tonleiter, die Flora dort spielen würde.
- **Feste Tonhöhe:** Wähle mit **↖ Auswählen** eine Ton-Linie und setze eine **feste Tonhöhe**. Der Code bekommt dann formneutrale Zeichen (`[]`, `+-`, `|---`), die genau diese Stufe einstellen.
- **Symmetrie-Kopien** klingen immer wie der gezeichnete Arm.
- **Gleiche Töne:** Mit dieser Option spielen auch Spiegelbilder dieselben Töne wie ihr Original.
- **Wiedergabe** im Browser mit wählbarer Tonleiter, Grundton, Floras *note scalar* und Notenlänge. Der gerade gespielte Ton leuchtet in Zeichnung und Vorschau auf.

### Code
- **Live-Code:** Axiom, Regeln, Winkel, Schrittlänge, Startpunkt und Generationen stehen neben der Zeichnung und aktualisieren sich laufend.
- **Von Hand bearbeiten:** Du kannst den Code selbst ändern. Dann ist die Zeichnung nicht mehr verknüpft, und die App zeigt das an.
- **Zeichnung aus Code aufbauen:** macht aus den Linien eines beliebigen Codes (z. B. eines Beispiels) eine Zeichnung.
- **Warnungen:** Eine Tabelle zeigt pro Generation Zeichen, Töne und Pausen. Die App warnt bei Sätzen über 300 Zeichen, bei Tönen außerhalb der Tonleiter und bei ungültigen Regeln.

### Export
- **`.flora`-Datei:** für Floras Nursery. Die Zeichnung steckt als Lua-Kommentar mit in der Datei, beim Laden ist sie also exakt wieder da. Flora ignoriert den Kommentar.
- **maiden-Befehl:** legt die Datei direkt auf dem norns an.
- **Katalog-Eintrag:** für `lib/gardens/garden_catalog_default.lua`.
- **Beispiele:** Zehn Schneeflocken sind eingebaut, zu finden unter **Beispiel laden…**.

## Pflanze auf dem norns verwenden

1. Kopiere die `.flora`-Datei auf dem norns nach `dust/data/flora/nursery/`.
   - Windows: `\\norns.local\dust` im Explorer (Benutzer `we`).
   - macOS: Finder → Gehe zu → Mit Server verbinden → `smb://norns.local/dust`.
   - Oder füge den **maiden-Befehl** in die maiden-REPL ein. Er legt die Datei an.
2. In Flora: **K1 → PARAMETERS → EDIT → GARDENING → ADD PLANT TO GARDEN** und die Datei wählen.
3. Auf der Plant-Seite **K1** halten und mit **E2** zur Pflanze blättern. Mit **K2 / K3** gehst du durch ihre Generationen.

## Wie die App Flora nachbildet

Vorschau und Melodie folgen Floras eigenem Code (`lib/l_system.lua`, `lib/turtle.lua`, `lib/plant_sounds.lua`):

- **Regeln:** einzelne Buchstaben. Jede Generation wird auf 300 Zeichen gekürzt (`MAX_SENTENCE_LENGTH`).
- **Turtle-Zeichen:** `F` zeichnet und spielt einen Ton, `G` zeichnet mit Pause, `f` bewegt sich ohne zu zeichnen, `+`/`-` drehen um den Winkel, `|` dreht um 180°, `[`/`]` merken und holen Position und Richtung zurück.
- **Tonhöhe:**
  - `+` und `-` ändern die Tonhöhe um `ceil(note scalar × Winkel im Bogenmaß)` Stufen. Mit dem Standardwert 3 sind das +4/−3 bei 60° und +2/−1 bei 30°.
  - `]` setzt die Tonhöhe auf Stufe 12 von 24 zurück, weil `[` in Flora keine Tonhöhe speichert.
- **Darstellung:** Flora zeigt Pflanze 1 um 32 px nach links versetzt. Die Vorschau macht das genauso und zeigt Pflanze 2 gedimmt daneben.

## Grenzen

- **Klang:** Der Klang im Browser ist nur eine Annäherung an Floras Engine.
- **Tonleiter-Nummern:** Ich nehme an, dass sie der Reihenfolge in `MusicUtil` auf dem norns folgen (5 = Dorisch).
- **Linien, die beim Wachsen wieder verschwinden**, z. B. eine nach außen wandernde Spitze, kann eine Zeichnung nicht darstellen. Importierter Code dieser Art behält nur seine Endform.
- **Zeichengrenze:** Große Zeichnungen, hohe Symmetrie und viele feste Tonhöhen kosten Zeichen. Achte in der Tabelle der Generationen auf die Grenze von 300 Zeichen.
- **Speichern im Browser:** Die App merkt sich deine Arbeit im Browser, aber nur, wenn die Seite normal geöffnet ist (nicht in eingebetteten Vorschaufenstern). Was du behalten willst, speichere als `.flora`-Datei.

## Selbsttest

Öffne die Browser-Konsole und führe `floraSelfTest()` aus. Der Test macht aus jeder der zehn eingebauten Schneeflocken eine Zeichnung, erzeugt daraus wieder Code und prüft, ob die Endform identisch ist.
