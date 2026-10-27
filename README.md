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
- **Hilfreiches Austeilen** (wie bei Block Blast): **Kombo-Teil** – in 90 % der Fälle, in denen eine Form mehrere Reihen
  auf einmal schließen kann, liegt genau diese Form in der Ablage. Zusätzlich in 30 % der Fälle der Satz mit den meisten
  Abräum-Möglichkeiten (Kombos zählen quadratisch). Neue Karten passen öfter zu fast vollen Reihen (Farbe 35 %, Wert 30 %).
  Laut Simulation: Doppel-Abräumer etwa alle 17 Züge, 3+ Reihen etwa alle 180 Züge (vorher 44 bzw. ~1.450).
  Leere Felder in fast vollen Reihen leuchten.
- **Kombo-Regel:** Schafft bei mehreren neuen Reihen mindestens eine die Mindesthand, verschwinden alle.
  Ab 3 Reihen: „MEGA-KOMBO“ mit Blitz, Chips-Regen und eigenem Ton.
- **Belohnungen** (`src/progress.js`): Spieler-Level mit Erfahrung aus jeder Runde (Level-Aufstieg = Chips, jedes 5. Level
  ein Design), Truhe am Rundenende (mehr Chips für bessere Runden, selten ×3), Tagesgeschenk mit Tagesserie (50–300 Chips),
  Lob-Rufe beim Abräumen. Einmal pro Runde gratis weiterspielen.
- **Goldene Karte** (etwa jedes 10. Teil): doppelte Punkte für ihre Reihe, +15 Chips, Gold-Regen.
- **Fieber:** bei Serie 5, 10, 15 … zählen 6 Züge lang Punkte und Chips doppelt; Feld glüht, Musik auf voller Stärke.
- **Jackpot:** startet bei 500 Chips, wächst pro beendeter Runde um 40. Royal Flush gewinnt alles, Straight Flush ein Viertel.
- **Modi:** **Normal** (Rangliste `standard`) und **Hart** (ab Level 10, Rangliste `profi` – die Kennungen bleiben, damit alte
  Rekorde gültig bleiben), dazu die **Tages-Challenge** als Extra (Rangliste `taeglich`).
- **Startbildschirm** mit Level, Chips, Jackpot, Rekord, Normal/Hart/Tages-Challenge, Shop, Erfolge, Statistik, Regeln.
- **Rubbellos** jede 3. beendete Runde (40–750 Chips), **Statistik-Seite**, **Teilen** über das Teilen-Menü des Geräts
  (ohne Server; sonst Text in die Zwischenablage).
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
- **iPad:** hochkant größeres Feld und größere Schrift; quer Feld links, Punkte, Auftrag, Spezialzüge und Ablage rechts.
  Die installierte App darf gedreht werden.
- **Musik:** im Browser erzeugter Synthwave-Takt, wird mit der Serie voller; eigener Schalter im Menü.
- **Casino-Shop** (`src/shop.js` Katalog, `src/casino.js` Glücks-Regeln, bezahlt nur mit Chips aus dem Spiel):
  - **Kaufen:** Designs, Kacheln (auch animierte), Effekte, Hintergründe, Karten, Rahmen, Sound-Pakete, Jingles, Chip-Designs,
    Glücksbringer (+5 bis +15 % Chips, nie mehr Punkte), Start-Bonus. Seltenheiten Gewöhnlich/Selten/Episch/Legendär;
    Legendäres gibt es nur aus Truhen, dem Glücksrad oder dem Automaten. Kauf erst beim zweiten Tippen.
  - **Glück:** Truhen (Bronze 400, Silber 1.200, Gold 3.000 – Doppeltes wird zu Chips), Rubbellose (50/150/400),
    Glücksrad einmal am Tag gratis (Felder so groß wie ihre Chance), Spielautomat (Einsatz 10/25/50, höchstens 20 Drehs
    am Tag, Rückgabe ca. 78 %). Alle Gewinnchancen sind im Spiel unter „Chancen“ einsehbar.
  - **Album:** 4 Sets (Las Vegas, Eispalast, Retro-Arcade, Royal Gold); ein komplettes Set schaltet einen Bonus frei.
- **Profil-Erfolge** für bens-games.de: `shop_legendary`, `album_set`, `slot_jackpot`, `highroller` (50.000 Chips ausgegeben).

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
| `src/platform.js` | Ausfallsichere Statistik-, Ranglisten- und Fehlermelde-Anbindung der Plattform |
| `src/shop.js`, `src/casino.js` | Shop-Katalog, Seltenheiten, Sets; Truhen, Lose, Glücksrad, Automat, Glücksbringer |
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
index.html, style.css, main.js, platform.js, shop.js, game.js, poker.js, pieces.js, audio.js, fx.js, storage.js, progress.js,
scratch.js, casino.js, achievements.json, manifest.webmanifest, sw.js, icon-180.png, icon-192.png, icon-512.png
```

Anforderungen (geprüft in `tests/build.test.mjs`): eigene Dateien nur über relative Pfade, Ranglisten-Link zur Plattform,
Manifest mit `scope`/`start_url` = `/games/royal-blocks/`,
Symbole 192 und 512 px, keine externen Quellen (Systemschrift, keine Schriftdateien), nichts unter `/icons/`,
eigener Service Worker nur für den Spielordner, löscht nur eigene Caches (`royal-blocks-…`).
Spielstände, Einstellungen und Fortschritt bleiben im Browser. In Release-Builds sendet das Spiel die in der Plattform-Schnittstelle
festgelegten anonymen Nutzungsereignisse; bei angemeldeten Konten zusätzlich Bestwerte für die Rangliste. Freitexte, Namen,
E-Mail-Adressen und Konto-IDs werden nie vom Spiel gesendet. Im Dev-/Testmodus, auf localhost und bei aktiviertem Global Privacy
Control bleibt die Anbindung vollständig aus. Netzwerkfehler beeinflussen das Spiel nicht. Unerwartete Fehler meldet das Spiel
anonym an `/api/errors` (höchstens 5 pro Besuch, ohne Konto- oder Spielstanddaten).

## Zuständigkeit

Version 1 baut Claude (Branches `claude/...`), danach übernimmt Codex auf Bens Anweisung (Branches `codex/...`).
Immer nur ein Agent gleichzeitig. Merge nach `main` und Tags (`v1.0.0`, …) nur durch Ben.
