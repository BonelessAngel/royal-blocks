# Royal Blocks

Block-Puzzle mit Pokerhänden für [bens-games.de](https://bens-games.de) – wie Block Blast, aber jedes Kästchen ist eine Spielkarte.

## Spielregeln

- Feld 8×8, unten liegen immer 3 Teile. Teile per Finger/Maus aufs Feld ziehen.
- Jedes Kästchen trägt eine Karte (2 bis Ass, alle Werte gleich wahrscheinlich). **Jedes Teil hat eine Farbe**
  (♠ ♥ ♦ ♣) – so lassen sich Flushs planen.
- Volle Reihe oder Spalte → aus ihren 8 Karten zählt die **beste Pokerhand aus 5 Karten**.
- **Mindesthand:** Die Reihe verschwindet nur, wenn ihre Hand mindestens die Mindesthand erreicht. Sonst bleibt sie
  **gesperrt** liegen, bis eine Reihe quer durch sie abgeräumt wird (dann entsteht eine Lücke und eine neue Chance).
  Die Mindesthand steigt mit den abgeräumten Reihen: Paar (ab 0) → Zwei Paare (ab 10).
  **Casual:** Gesperrte Reihen zerbröseln nach 5 Zügen von selbst (ohne Punkte), ein Zähler zeigt die verbleibenden Züge.
  Die Kurve ist per Simulation eingestellt: Wer Poker beachtet, macht rund 40–60 % mehr Punkte als jemand, der es ignoriert.
- Punkte pro abgeräumter Reihe = 8 Kästchen × 10 × Faktor der Hand:

  | Hand | Faktor | | Hand | Faktor |
  |---|---|---|---|---|
  | Hohe Karte | ×1 | | Flush | ×6 |
  | Paar | ×2 | | Full House | ×8 |
  | Zwei Paare | ×3 | | Vierling | ×12 |
  | Drilling | ×4 | | Straight Flush | ×20 |
  | Straße | ×5 | | Royal Flush | ×50 |

- **Kombo:** mehrere Reihen mit einem Zug → Summe × Anzahl Reihen.
- **Serie:** Abräumen in aufeinanderfolgenden Zügen → ×1,5 / ×2 / ×2,5 …; die Serie hält 2 Züge ohne Abräumen aus.
- **Tisch leer:** Feld komplett leer → +2000 (× Serie).
- +1 Punkt pro gesetztem Kästchen. Spielende, wenn keins der übrigen Teile mehr passt.
- **Hilfreiches Austeilen** (wie bei Block Blast): In 60 % der Fälle werden 5 Sätze Teile ausprobiert und der genommen,
  mit dem sich die meisten Reihen abräumen lassen. Neue Karten passen öfter zu fast vollen Reihen (Farbe 35 %, Wert 30 %).
  Laut Simulation: Runden etwa 50 % länger, mehr als doppelt so viele Punkte. Leere Felder in fast vollen Reihen leuchten.
- **Belohnungen** (`src/progress.js`): Spieler-Level mit Erfahrung aus jeder Runde (Level-Aufstieg = Chips, jedes 5. Level
  ein Design), Truhe am Rundenende (mehr Chips für bessere Runden, selten ×3), Tagesgeschenk mit Tagesserie (50–300 Chips),
  Lob-Rufe beim Abräumen. Einmal pro Runde gratis weiterspielen.
- **Joker ★:** etwa jedes 25. Teil hat ein Joker-Kästchen, das als die Karte zählt, die die beste Hand ergibt.
- **Chips** (bleiben über alle Runden): pro abgeräumter Reihe so viele wie der Faktor der Hand, +25 bei „Tisch leer“,
  dazu Belohnungen für Aufträge. Eine Runde bringt laut Simulation etwa 500–650 Chips.
- **Spezialzüge:** Passen (60, drei neue Teile), Farbe tauschen (40), Sprengen (120, gesperrte Reihe entfernen).
  Am Spielende kann man sich mit Passen oder Sprengen retten.
- **Aufträge:** immer ein Ziel sichtbar (Hand ab X, Flush in Farbe, Kombo, Serie); geschafft → Chips und neues, schwereres Ziel.
- **„Fast!“:** fehlte genau eine Karte zu Straße, Flush oder Royal Flush, wird das angezeigt.
- **Tages-Challenge:** gleicher Startwert für alle an einem Tag (aus dem Datum), beliebig oft spielbar, eigener Tagesrekord.
  Der Zufall liegt im Spielstand, deshalb bleibt die Folge auch nach Neuladen gleich.
- **Gefühl:** Plopp-Kette (jedes Kästchen ein steigender Ton), Punkte fliegen zur Anzeige.
- **Vibration:** Android über die Vibrations-Schnittstelle; iPhone (ab iOS 18) über einen versteckten Schalter,
  der ein kurzes haptisches Tippen auslöst – mehr erlaubt Safari Webseiten nicht.
- **Musik:** im Browser erzeugter Synthwave-Takt, wird mit der Serie voller; eigener Schalter im Menü.
- **Designs** (mit Chips freischaltbar): Farbwelten Neon, Gold-Casino (1.500), Eis (3.000), Retro-Arcade (5.000);
  Kachel-Stile Standard, Glas (1.000), Pixel (2.000), Chip (4.000).

Alle Werte stehen in `src/game.js`, `src/poker.js`, `src/pieces.js` und (Designs) `src/main.js`.

## Befehle

Voraussetzung: [Node.js](https://nodejs.org) ab Version 20. Es gibt **keine** Abhängigkeiten, `npm install` ist nicht nötig.

| Befehl | Was passiert |
|---|---|
| `npm run dev` | Testserver mit dem Quelltext: http://localhost:5173/games/royal-blocks/ (ohne Offline-Cache) |
| `npm run build` | baut das Spiel nach `dist/` |
| `npm run preview` | baut und startet das fertige Spiel: http://localhost:5174/games/royal-blocks/ |
| `npm test` | alle Tests (Pokerhände, Regeln, Build-Anforderungen der Plattform) |
| `npm run icons` | zeichnet die App-Symbole in `src/` neu |

## Aufbau

| Datei | Inhalt |
|---|---|
| `src/poker.js` | Pokerhände erkennen (beste Hand aus beliebig vielen Karten) |
| `src/pieces.js` | Formen der Teile, Karten, Zufall |
| `src/game.js` | Spielregeln ohne Anzeige: Setzen, Abräumen, Punkte, Spielende |
| `src/main.js` | Anzeige, Ziehen, Effekte, Menü |
| `src/fx.js`, `src/audio.js` | Partikel, Töne (im Browser erzeugt), Vibration |
| `src/storage.js` | Rekorde, Chips, Designs, Einstellungen und laufende Runden im Browser (`localStorage`, Präfix `royal-blocks:`) |
| `src/sw.js` | Service Worker (Vorlage, der Build setzt Cache-Name und Dateiliste ein) |
| `scripts/files.mjs` | **Spiel-ID, Build-Ordner und genaue Dateiliste** |

## Übergabe an die Plattform

| | |
|---|---|
| Spiel-ID | `royal-blocks` |
| Name | Royal Blocks |
| Kurzbeschreibung | Block-Puzzle mit Pokerhänden: Reihen füllen, Hände bilden, Punkte abräumen. |
| Build-Befehl | `npm run build` (reproduzierbar, kein Zeitstempel) |
| Build-Ordner | `dist` (nicht im Repo, wird aus dem getaggten Stand gebaut) |
| Service-Worker-Vorlage | `src/sw.js` (im Build mit Cache `royal-blocks-v<Version>-<Inhalts-Hash>`) |
| Symbol für die Bibliothek | `src/icon-512.png` |

Dateiliste des Builds (gleich wie `scripts/files.mjs`):

```
index.html, style.css, main.js, game.js, poker.js, pieces.js, audio.js, fx.js, storage.js, progress.js,
manifest.webmanifest, sw.js, icon-180.png, icon-192.png, icon-512.png
```

Anforderungen (geprüft in `tests/build.test.mjs`): nur relative Pfade, Manifest mit `scope`/`start_url` = `/games/royal-blocks/`,
Symbole 192 und 512 px, keine externen Quellen (Systemschrift, keine Schriftdateien), nichts unter `/icons/`,
eigener Service Worker nur für den Spielordner, löscht nur eigene Caches (`royal-blocks-…`).
Das Spiel sendet **keine Daten** an Server; alles bleibt im Browser.

## Zuständigkeit

Version 1 baut Claude (Branches `claude/...`), danach übernimmt Codex auf Bens Anweisung (Branches `codex/...`).
Immer nur ein Agent gleichzeitig. Merge nach `main` und Tags (`v1.0.0`, …) nur durch Ben.
