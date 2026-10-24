/**
 * NumTrip, ported to the browser from NumTripFinal.py (high school, EF Informatik, 2022/23).
 *
 * Every function matches its Python original: same name, same order of checks, same German
 * messages, so the game plays by exactly the same rules (quirks included, e.g. the first digit
 * picks the row although the prompt asks for the column first). Only the terminal is replaced:
 * the page hands in `print` and `input`, and because a browser can't stop and wait for the
 * player, `input` returns a Promise, so `eingabe` and `play` are async.
 */

export interface Terminal {
  /** Python's print(): writes `text`, then `end` (a newline unless given). */
  print(text?: string, end?: string): void;
  /** Python's input(): shows the prompt and resolves with the line the player enters. */
  input(prompt: string): Promise<string>;
}

/** Python's random.choice. */
const choice = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)]!;

/** Python's str.isnumeric for one character. */
const isnumeric = (ch: string) => /^\p{N}$/u.test(ch);

/**
 * Python's int() for one character: accepts any Unicode decimal digit (e.g. "٣" → 3) and
 * raises for other numeric characters such as "²" or "½", which the original then catches.
 * Unicode keeps decimal digits in runs of ten (0–9), so the value is the offset in its run.
 */
function int(ch: string): number {
  if (!/^\p{Nd}$/u.test(ch)) throw new Error(`invalid literal for int(): '${ch}'`);
  const code = ch.codePointAt(0)!;
  let start = code;
  while (/^\p{Nd}$/u.test(String.fromCodePoint(start - 1))) start--;
  return (code - start) % 10;
}

export function numtrip({ print, input }: Terminal) {
  function random_spielfeld() {
    // generiert ein zufälliges spielfeld mit den zahlen 1, 2 oder 4
    const anfangszahlen = [1, 2, 4];
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        spielfeld[i][j] = choice(anfangszahlen);
      }
    }
  }

  const spielfeld = [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ];

  function show_spielfeld() {
    // Zeigt dem spieler das spielfeld und die darin vorhandenen Werte an
    let zeilennummer = 1;
    print('          1      2      3      4      5');
    for (const zeile of spielfeld) {
      print('      +------+------+------+------+------+');
      print('      |      |      |      |      |      |');
      print(`   ${zeilennummer}  `, '');
      for (const zelle of zeile) {
        if (zelle >= 10000) {
          print(`| ${zelle}`, '');
        } else if (zelle >= 1000) {
          print(`| ${zelle} `, '');
        } else if (zelle >= 100) {
          print(`|  ${zelle} `, '');
        } else if (zelle >= 10) {
          print(`|  ${zelle}  `, '');
        } else {
          print(`|   ${zelle}  `, '');
        }
      }
      print('|');
      zeilennummer = zeilennummer + 1;
      print('      |      |      |      |      |      |');
    }
    print('      +------+------+------+------+------+');
  }

  function transform_eingabe(raw: string): [number, number] | null {
    // Kontolliert ob eingabe nur nummern enthält, streicht leerschläge weg gibt anschliessend
    // die erste stelle als x und die zweite als y wieder
    for (const zeichen of [' ', '-', '.', ',', '/', ';', ':']) raw = raw.replaceAll(zeichen, '');
    const chars = [...raw]; // Python counts characters, not UTF-16 code units
    if (chars.length !== 2) {
      // Kontolliert ob eingabe 2 lang ist, falls ja gehts weiter, sonst gibts nichts wieder
      print('Bitte gib nur 2 Zeichen ein!');
      return null;
    }
    const x = chars[0]!;
    if (!isnumeric(x)) {
      print('Spalte muss eine Zahl sein!');
      return null;
    }
    const y = chars[1]!;
    if (!isnumeric(y)) {
      print('Zeile muss eine Zahl sein!');
      return null;
    }
    return [int(x) - 1, int(y) - 1];
  }

  async function eingabe(): Promise<[number, number]> {
    // Fordert benutzer zu eingabe auf, überprüft ob es transform_eingabe erfolgreich überlebt,
    // falls ja wiedergibt es die eingabe als x,y wert
    let valid = false;
    let eingaben: [number, number] | null = null;
    while (!valid) {
      try {
        eingaben = transform_eingabe(await input('Gibt eine Spalte und Zeile an:'));
        valid = eingaben !== null;
      } catch {
        print('Keine gültige Eingabe');
      }
    }

    let nebeneinander = false; // Kontrolliert ob die ausgewählte zahl alleinestehend oder nicht alleinestehend ist
    const [x, y] = eingaben!;

    if (x < 0 || x > 4) {
      // Kontrolliert ob eingabe x zwischen 1 und 5 war
      print('Zahl nicht zwischen 1 & 5!');
      return eingabe();
    }
    if (y < 0 || y > 4) {
      // Kontrolliert ob eingabe y zwischen 1 und 5 war
      print('Zahl nicht zwischen 1 & 5!');
      return eingabe();
    }

    // (The original also computes `left` and `right` here, but never uses them.)

    // Testet randzahlen (ausser eckzahlen) auf benachbarte gleiche zahlen
    if (x === 4 && y < 4 && y > 0) {
      if (
        spielfeld[x][y] === spielfeld[x][y - 1] ||
        spielfeld[x][y] === spielfeld[x][y + 1] ||
        spielfeld[x][y] === spielfeld[x - 1][y]
      ) {
        nebeneinander = true;
      }
    }
    if (x === 0 && y < 4 && y > 0) {
      if (
        spielfeld[x][y] === spielfeld[x][y - 1] ||
        spielfeld[x][y] === spielfeld[x][y + 1] ||
        spielfeld[x][y] === spielfeld[x + 1][y]
      ) {
        nebeneinander = true;
      }
    }
    if (y === 4 && x < 4 && x > 0) {
      if (
        spielfeld[x][y] === spielfeld[x][y - 1] ||
        spielfeld[x][y] === spielfeld[x + 1][y] ||
        spielfeld[x][y] === spielfeld[x - 1][y]
      ) {
        nebeneinander = true;
      }
    }
    if (y === 0 && x < 4 && x > 0) {
      if (
        spielfeld[x][y] === spielfeld[x + 1][y] ||
        spielfeld[x][y] === spielfeld[x][y + 1] ||
        spielfeld[x][y] === spielfeld[x - 1][y]
      ) {
        nebeneinander = true;
      }
    }
    // Testet Eckzahlen auf benachbarte gleiche Zahlen
    if (y === 0 && x === 0) {
      if (spielfeld[x][y] === spielfeld[x + 1][y] || spielfeld[x][y] === spielfeld[x][y + 1]) {
        nebeneinander = true;
      }
    }
    if (y === 0 && x === 4) {
      if (spielfeld[x][y] === spielfeld[x - 1][y] || spielfeld[x][y] === spielfeld[x][y + 1]) {
        nebeneinander = true;
      }
    }
    if (y === 4 && x === 0) {
      if (spielfeld[x][y] === spielfeld[x + 1][y] || spielfeld[x][y] === spielfeld[x][y - 1]) {
        nebeneinander = true;
      }
    }
    if (y === 4 && x === 4) {
      if (spielfeld[x][y] === spielfeld[x - 1][y] || spielfeld[x][y] === spielfeld[x][y - 1]) {
        nebeneinander = true;
      }
    }
    // Testet alle mittleren zahlen auf benachbarte gleiche zahlen
    if (x > 0 && x < 4 && y > 0 && y < 4) {
      if (
        spielfeld[x][y] === spielfeld[x + 1][y] ||
        spielfeld[x][y] === spielfeld[x][y - 1] ||
        spielfeld[x][y] === spielfeld[x][y + 1] ||
        spielfeld[x][y] === spielfeld[x - 1][y]
      ) {
        nebeneinander = true;
      }
    }
    if (nebeneinander === true) {
      // Falls nicht alleinestehend geht es weiter
      return [x, y];
    } else {
      // Falls alleinestehend sagt es uns dies, und fordert eine neue Eingabe
      print('Alleinstehende Zahl, bitte gib eine neue ein!');
      return eingabe();
    }
  }

  function removeNumbers(x: number, y: number, alteZahl: number): boolean {
    // Check if coordinates are in Spielfeld
    if (x < 0 || x > 4) return false;
    if (y < 0 || y > 4) return false;

    // Falls alte zahl noch in Feld, ändert sie und wiederholt das programm.
    if (spielfeld[x][y] === alteZahl) {
      spielfeld[x][y] = 0;
      removeNumbers(x, y + 1, alteZahl); // unten
      removeNumbers(x, y - 1, alteZahl); // oben
      removeNumbers(x + 1, y, alteZahl); // rechts
      removeNumbers(x - 1, y, alteZahl); // links
      return true;
    } else {
      return false;
    }
  }

  function runterfallen() {
    // Falls unten im Feld lücken entstehen, schiebt es die zahlen darüber nach unten so dass
    // alle leeren Felder oben sind
    for (let k = 0; k < 5; k++) {
      for (let i = 4; i > 0; i--) {
        // [4,3,2,1]
        for (let j = 0; j < 5; j++) {
          if (spielfeld[i][j] === 0) {
            spielfeld[i][j] = spielfeld[i - 1][j];
            spielfeld[i - 1][j] = 0;
          }
        }
      }
    }
  }

  function auffüllen() {
    // füllt felder die auf 0 gesetzt sind auf
    const anfangszahlen = [1, 2, 4];
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        if (spielfeld[i][j] === 0) {
          spielfeld[i][j] = choice(anfangszahlen);
        }
      }
    }
  }

  function gewonnen(): boolean | undefined {
    // kontrolliert ob man gewonnen hat oder nicht
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        if (spielfeld[i][j] === 256) {
          print('DU HAST GEWONNEN!');
          return true;
        }
      }
    }
    return undefined; // Python's implicit None
  }

  /** Despite its name: true while there is still a possible move. */
  function verloren(): boolean | undefined {
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        // Testet randzahlen (ausser eckzahlen) auf benachbarte gleiche zahlen
        if (x === 4 && y < 4 && y > 0) {
          if (
            spielfeld[x][y] === spielfeld[x][y - 1] ||
            spielfeld[x][y] === spielfeld[x][y + 1] ||
            spielfeld[x][y] === spielfeld[x - 1][y]
          ) {
            return true;
          }
        }
        if (x === 0 && y < 4 && y > 0) {
          if (
            spielfeld[x][y] === spielfeld[x][y - 1] ||
            spielfeld[x][y] === spielfeld[x][y + 1] ||
            spielfeld[x][y] === spielfeld[x + 1][y]
          ) {
            return true;
          }
        }
        if (y === 4 && x < 4 && x > 0) {
          if (
            spielfeld[x][y] === spielfeld[x][y - 1] ||
            spielfeld[x][y] === spielfeld[x + 1][y] ||
            spielfeld[x][y] === spielfeld[x - 1][y]
          ) {
            return true;
          }
        }
        if (y === 0 && x < 4 && x > 0) {
          if (
            spielfeld[x][y] === spielfeld[x + 1][y] ||
            spielfeld[x][y] === spielfeld[x][y + 1] ||
            spielfeld[x][y] === spielfeld[x - 1][y]
          ) {
            return true;
          }
        }
        // Testet Eckzahlen auf benachbarte gleiche Zahlen
        if (y === 0 && x === 0) {
          if (spielfeld[x][y] === spielfeld[x + 1][y] || spielfeld[x][y] === spielfeld[x][y + 1]) {
            return true;
          }
        }
        if (y === 0 && x === 4) {
          if (spielfeld[x][y] === spielfeld[x - 1][y] || spielfeld[x][y] === spielfeld[x][y + 1]) {
            return true;
          }
        }
        if (y === 4 && x === 0) {
          if (spielfeld[x][y] === spielfeld[x + 1][y] || spielfeld[x][y] === spielfeld[x][y - 1]) {
            return true;
          }
        }
        if (y === 4 && x === 4) {
          if (spielfeld[x][y] === spielfeld[x - 1][y] || spielfeld[x][y] === spielfeld[x][y - 1]) {
            return true;
          }
        }
        // Testet alle mittleren zahlen auf benachbarte gleiche zahlen
        if (x > 0 && x < 4 && y > 0 && y < 4) {
          if (
            spielfeld[x][y] === spielfeld[x + 1][y] ||
            spielfeld[x][y] === spielfeld[x][y - 1] ||
            spielfeld[x][y] === spielfeld[x][y + 1] ||
            spielfeld[x][y] === spielfeld[x - 1][y]
          ) {
            return true;
          }
        }
      }
    }
    return undefined; // Python's implicit None
  }

  async function play() {
    random_spielfeld();
    show_spielfeld();
    while (true) {
      const [x, y] = await eingabe();
      const altezahl = spielfeld[x][y]; // weist ausgewählte zahl der variabel 'altezahl' zu
      removeNumbers(x, y, altezahl);
      spielfeld[x][y] = altezahl * 2; // verdoppelt ausgewählte zahl und setzt sie an ausgewählter stelle ein
      runterfallen();
      auffüllen();
      show_spielfeld();
      if (gewonnen() === true) {
        return false;
      }
      if (verloren() === true) {
        // pass
      } else {
        print('DU HAST VERLOREN HAHAHAHHAHAHA');
        return false;
      }
    }
  }

  return { play };
}
