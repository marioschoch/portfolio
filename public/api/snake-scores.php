<?php
/**
 * Shared Snake leaderboard (top 10, one row per player), the site's only server-side code.
 *
 *   GET                                                  → { scores: [{ name, score, tries, date }] }
 *   POST { action: "name", player, name }                → { name, scores }  (claim or change a name)
 *   POST { action: "start" }                             → { token }  (call when a game starts)
 *   POST { action: "submit", token, player, name, score } → { name, scores, rank, best, tries }
 *
 * A player is a random 32-hex ID the browser keeps in localStorage; only its keyed hash is
 * stored. Names are unique (case-insensitive): the first player to use a name owns it. Every
 * finished game is submitted, also with 0 points, so `tries` counts all games played and the
 * row keeps the player's best score. A submit from an unknown player registers it with `name`.
 *
 * The start token is signed and timestamped, so a score is only accepted if at least as much
 * time has passed as the snake needs to eat that many items at full speed. That stops casual
 * cheating (a request typed by hand), not a determined one; the board is just for fun.
 *
 * Storage: JSON files in the Plesk "private" folder next to the web root (not reachable over
 * HTTP). If that folder is not writable, a dot-folder next to this script is used instead
 * (dotfiles are blocked in .htaccess). Deploys never touch these files, so scores survive.
 * To remove a player, delete their entry from players.json in that folder. A scores.json from
 * the earlier board (one row per game) is merged into players.json once, by name; those rows
 * have no owner yet and go to the first player who claims the name.
 *
 * Written for PHP 7.4+ without extensions beyond the defaults.
 */

declare(strict_types=1);

const MAX_ENTRIES = 10;
const MAX_PLAYERS = 10000;
const MAX_SCORE = 397;          // 20×20 board minus the three starting cells
const MIN_MS_PER_POINT = 70;    // the snake's fastest step (MIN_INTERVAL in snake.astro)
const TOKEN_MAX_AGE = 7200;     // seconds a game may last
const NAME_MAX = 12;
const NAME_INTERVAL = 3;        // seconds between name changes from one visitor

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function data_dir(): string
{
    $root = $_SERVER['DOCUMENT_ROOT'] ?? '';
    $candidates = [];
    if ($root !== '') {
        $candidates[] = dirname(rtrim($root, '/')) . '/private/snake';
    }
    $candidates[] = __DIR__ . '/.snake-data';
    foreach ($candidates as $dir) {
        if ((is_dir($dir) || @mkdir($dir, 0700, true)) && is_writable($dir)) {
            return $dir;
        }
    }
    respond(503, ['error' => 'storage']);
    return ''; // unreachable
}

/** Secret for signing start tokens and hashing IDs, created on first use. */
function secret(string $dir): string
{
    $file = $dir . '/secret.key';
    $key = @file_get_contents($file);
    if ($key === false || strlen($key) < 32) {
        $key = bin2hex(random_bytes(32));
        file_put_contents($file, $key, LOCK_EX);
        @chmod($file, 0600);
    }
    return $key;
}

/**
 * Read-modify-write a JSON file under an exclusive lock. $fn receives the decoded data and
 * returns [newData, result]; newData === null leaves the file unchanged.
 */
function with_json(string $file, callable $fn)
{
    $handle = fopen($file, 'c+');
    if ($handle === false) {
        respond(503, ['error' => 'storage']);
    }
    flock($handle, LOCK_EX);
    $raw = stream_get_contents($handle);
    $data = json_decode($raw === false || $raw === '' ? '[]' : $raw, true);
    if (!is_array($data)) {
        $data = [];
    }
    [$next, $result] = $fn($data);
    if ($next !== null) {
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode((object) $next, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        fflush($handle);
    }
    flock($handle, LOCK_UN);
    fclose($handle);
    return $result;
}

/** Players with at least one point, best first (ties: whoever got there first stays ahead). */
function ranking(array $players): array
{
    $ranked = array_filter($players, function ($p) {
        return $p['best'] > 0;
    });
    uasort($ranked, function ($a, $b) {
        return $b['best'] <=> $a['best'] ?: $a['at'] <=> $b['at'];
    });
    return $ranked;
}

function public_scores(array $players): array
{
    return array_values(array_map(function ($p) {
        return ['name' => $p['name'], 'score' => $p['best'], 'tries' => $p['tries'], 'date' => $p['date']];
    }, array_slice(ranking($players), 0, MAX_ENTRIES, true)));
}

/** 1-based place of a player in the top MAX_ENTRIES, or null. */
function rank_of(array $players, string $id): ?int
{
    $place = array_search($id, array_keys(array_slice(ranking($players), 0, MAX_ENTRIES, true)), true);
    return $place === false ? null : $place + 1;
}

/** Trim, drop control characters, collapse spaces, cut to NAME_MAX characters. */
function clean_name($name): string
{
    if (!is_string($name)) {
        return '';
    }
    $name = preg_replace('/[\p{C}]+/u', '', $name) ?? '';
    $name = trim(preg_replace('/\s+/u', ' ', $name) ?? '');
    preg_match_all('/./us', $name, $chars);
    return implode('', array_slice($chars[0], 0, NAME_MAX));
}

/** Names compare case-insensitively, so "Mario" and "mario" are the same player. */
function name_key(string $name): string
{
    return function_exists('mb_strtolower') ? mb_strtolower($name, 'UTF-8') : strtolower($name);
}

/** The stored ID of the player who owns $name, or null. */
function owner_of(array $players, string $name): ?string
{
    foreach ($players as $id => $p) {
        if (name_key($p['name']) === name_key($name)) {
            return (string) $id;
        }
    }
    return null;
}

/**
 * Give player $id the name $name, creating the player if needed. Returns the new players array,
 * or an error code ('taken', 'full'). A name held by an ownerless legacy row is claimed together
 * with that row's score and tries.
 */
function assign_name(array $players, string $id, string $name)
{
    $owner = owner_of($players, $name);
    if ($owner !== null && $owner !== $id) {
        if (strpos($owner, 'legacy:') !== 0) {
            return 'taken';
        }
        $legacy = $players[$owner];
        unset($players[$owner]);
        if (isset($players[$id])) {
            // An existing player renaming to a legacy name merges both rows.
            $mine = $players[$id];
            $legacy['tries'] += $mine['tries'];
            if ($mine['best'] > $legacy['best']) {
                $legacy = array_merge($legacy, ['best' => $mine['best'], 'date' => $mine['date'], 'at' => $mine['at']]);
            }
        }
        $players[$id] = $legacy;
    }
    if (!isset($players[$id])) {
        if (count($players) >= MAX_PLAYERS) {
            return 'full';
        }
        $players[$id] = ['name' => $name, 'best' => 0, 'tries' => 0, 'date' => null, 'at' => 0];
    }
    $players[$id]['name'] = $name;
    return $players;
}

/** players.json, created on first use from the earlier one-row-per-game scores.json. */
function players_file(string $dir): string
{
    $file = $dir . '/players.json';
    $old = $dir . '/scores.json';
    if (!is_file($file) && is_file($old)) {
        $rows = json_decode((string) file_get_contents($old), true);
        $players = [];
        foreach (is_array($rows) ? $rows : [] as $row) {
            $id = 'legacy:' . name_key((string) $row['name']);
            $p = $players[$id] ?? ['name' => $row['name'], 'best' => 0, 'tries' => 0, 'date' => null, 'at' => 0];
            $p['tries']++;
            if ($row['score'] > $p['best']) {
                $p = array_merge($p, ['best' => $row['score'], 'date' => $row['date'], 'at' => $row['at']]);
            }
            $players[$id] = $p;
        }
        with_json($file, function ($data) use ($players) {
            return [$data ?: $players, null];
        });
    }
    return $file;
}

function sign(string $payload, string $key): string
{
    return hash_hmac('sha256', $payload, $key);
}

$dir = data_dir();
$playersFile = players_file($dir);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $players = with_json($playersFile, function ($data) {
        return [null, $data];
    });
    respond(200, ['scores' => public_scores($players)]);
}

if ($method !== 'POST') {
    header('Allow: GET, POST');
    respond(405, ['error' => 'method']);
}

// Same-origin requests only (the API is not meant for other sites).
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== preg_replace('/:\d+$/', '', $host)) {
    respond(403, ['error' => 'origin']);
}

$input = json_decode((string) file_get_contents('php://input', false, null, 0, 2048), true);
if (!is_array($input)) {
    respond(400, ['error' => 'input']);
}
$key = secret($dir);
$action = $input['action'] ?? '';

if ($action === 'start') {
    $payload = time() . '.' . bin2hex(random_bytes(8));
    respond(200, ['token' => $payload . '.' . sign($payload, $key)]);
}

if ($action !== 'name' && $action !== 'submit') {
    respond(400, ['error' => 'action']);
}

$player = $input['player'] ?? '';
if (!is_string($player) || !preg_match('/^[0-9a-f]{32}$/', $player)) {
    respond(400, ['error' => 'player']);
}
$id = sign('player.' . $player, $key);
$name = clean_name($input['name'] ?? '');

if ($action === 'name') {
    if ($name === '') {
        respond(400, ['error' => 'name']);
    }
    // A short pause after each name change per visitor, so names can't be reserved in bulk.
    // Only successful changes count, so trying a taken name doesn't lock anyone out.
    $visitor = 'v:' . sign($_SERVER['REMOTE_ADDR'] ?? '', $key);
    $last = with_json($dir . '/recent.json', function ($recent) use ($visitor) {
        return [null, $recent[$visitor] ?? 0];
    });
    if (time() - $last < NAME_INTERVAL) {
        respond(429, ['error' => 'rate']);
    }
    $result = with_json($playersFile, function ($players) use ($id, $name) {
        $next = assign_name($players, $id, $name);
        return is_string($next) ? [null, $next] : [$next, $next];
    });
    if (is_string($result)) {
        respond($result === 'taken' ? 409 : 503, ['error' => $result]);
    }
    with_json($dir . '/recent.json', function ($recent) use ($visitor) {
        $now = time();
        $recent = array_filter($recent, function ($t) use ($now) {
            return is_int($t) && $now - $t < TOKEN_MAX_AGE;
        });
        $recent[$visitor] = $now;
        return [$recent, null];
    });
    respond(200, ['name' => $result[$id]['name'], 'scores' => public_scores($result)]);
}

// Submit: validate the token and the score.
$parts = explode('.', (string) ($input['token'] ?? ''));
if (count($parts) !== 3 || !ctype_digit($parts[0])) {
    respond(400, ['error' => 'token']);
}
[$started, $nonce, $mac] = $parts;
if (!hash_equals(sign($started . '.' . $nonce, $key), $mac)) {
    respond(400, ['error' => 'token']);
}
$score = $input['score'] ?? null;
if (!is_int($score) || $score < 0 || $score > MAX_SCORE) {
    respond(400, ['error' => 'score']);
}
$elapsed = time() - (int) $started;
if ($elapsed > TOKEN_MAX_AGE || $elapsed * 1000 < $score * MIN_MS_PER_POINT) {
    respond(400, ['error' => 'token']);
}

// A player the server doesn't know yet (e.g. after a reset) is registered with the sent name
// before the token is used up, so a taken name can be fixed and the same game sent again.
$known = with_json($playersFile, function ($players) use ($id, $name) {
    if (isset($players[$id])) {
        return [null, true];
    }
    if ($name === '') {
        return [null, 'name'];
    }
    $next = assign_name($players, $id, $name);
    return is_string($next) ? [null, $next] : [$next, true];
});
if ($known !== true) {
    respond($known === 'taken' ? 409 : ($known === 'full' ? 503 : 400), ['error' => $known]);
}

// One submission per token.
$fresh = with_json($dir . '/recent.json', function ($recent) use ($nonce) {
    $now = time();
    $recent = array_filter($recent, function ($t) use ($now) {
        return is_int($t) && $now - $t < TOKEN_MAX_AGE;
    });
    if (isset($recent['n:' . $nonce])) {
        return [$recent, false];
    }
    $recent['n:' . $nonce] = $now;
    return [$recent, true];
});
if (!$fresh) {
    respond(429, ['error' => 'rate']);
}

// Count the try and keep the best score.
$players = with_json($playersFile, function ($players) use ($id, $score) {
    if (!isset($players[$id])) {
        return [null, $players]; // removed in the meantime
    }
    $players[$id]['tries']++;
    if ($score > $players[$id]['best']) {
        $players[$id] = array_merge($players[$id], [
            'best' => $score,
            'date' => gmdate('Y-m-d'),
            'at' => microtime(true),
        ]);
    }
    return [$players, $players];
});
if (!isset($players[$id])) {
    respond(400, ['error' => 'player']);
}

respond(200, [
    'name' => $players[$id]['name'],
    'scores' => public_scores($players),
    'rank' => rank_of($players, $id),
    'best' => $players[$id]['best'],
    'tries' => $players[$id]['tries'],
]);
