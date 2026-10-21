<?php
/**
 * Shared Snake leaderboard (top 10), the site's only server-side code.
 *
 *   GET                                        → { scores: [{ name, score, date }] }
 *   POST { action: "start" }                   → { token }  (call when a game starts)
 *   POST { action: "submit", token, name, score } → { scores, rank }
 *
 * The start token is signed and timestamped, so a score is only accepted if at least as much
 * time has passed as the snake needs to eat that many items at full speed. That stops casual
 * cheating (a request typed by hand), not a determined one; the board is just for fun.
 *
 * Storage: JSON files in the Plesk "private" folder next to the web root (not reachable over
 * HTTP). If that folder is not writable, a dot-folder next to this script is used instead
 * (dotfiles are blocked in .htaccess). Deploys never touch these files, so scores survive.
 * To remove an entry, edit scores.json in that folder.
 *
 * Written for PHP 7.4+ without extensions beyond the defaults.
 */

declare(strict_types=1);

const MAX_ENTRIES = 10;
const MAX_SCORE = 397;          // 20×20 board minus the three starting cells
const MIN_MS_PER_POINT = 70;    // the snake's fastest step (MIN_INTERVAL in snake.astro)
const TOKEN_MAX_AGE = 7200;     // seconds a game may last
const NAME_MAX = 12;
const SUBMIT_INTERVAL = 10;     // seconds between submissions from one visitor

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

/** Secret for signing start tokens, created on first use. */
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
        fwrite($handle, json_encode($next, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        fflush($handle);
    }
    flock($handle, LOCK_UN);
    fclose($handle);
    return $result;
}

function public_scores(array $scores): array
{
    return array_map(function ($s) {
        return ['name' => $s['name'], 'score' => $s['score'], 'date' => $s['date']];
    }, $scores);
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

function sign(string $payload, string $key): string
{
    return hash_hmac('sha256', $payload, $key);
}

$dir = data_dir();
$scoresFile = $dir . '/scores.json';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $scores = with_json($scoresFile, function ($data) {
        return [null, $data];
    });
    respond(200, ['scores' => public_scores($scores)]);
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

if (($input['action'] ?? '') === 'start') {
    $payload = time() . '.' . bin2hex(random_bytes(8));
    respond(200, ['token' => $payload . '.' . sign($payload, $key)]);
}

if (($input['action'] ?? '') !== 'submit') {
    respond(400, ['error' => 'action']);
}

// Validate the token and the score.
$parts = explode('.', (string) ($input['token'] ?? ''));
if (count($parts) !== 3 || !ctype_digit($parts[0])) {
    respond(400, ['error' => 'token']);
}
[$started, $nonce, $mac] = $parts;
if (!hash_equals(sign($started . '.' . $nonce, $key), $mac)) {
    respond(400, ['error' => 'token']);
}
$score = $input['score'] ?? null;
if (!is_int($score) || $score < 1 || $score > MAX_SCORE) {
    respond(400, ['error' => 'score']);
}
$elapsed = time() - (int) $started;
if ($elapsed > TOKEN_MAX_AGE || $elapsed * 1000 < $score * MIN_MS_PER_POINT) {
    respond(400, ['error' => 'token']);
}
$name = clean_name($input['name'] ?? '');
if ($name === '') {
    respond(400, ['error' => 'name']);
}

// One submission per token, and a short pause between submissions per visitor.
$visitor = sign($_SERVER['REMOTE_ADDR'] ?? '', $key);
$allowed = with_json($dir . '/recent.json', function ($recent) use ($nonce, $visitor) {
    $now = time();
    $recent = array_filter($recent, function ($t) use ($now) {
        return is_int($t) && $now - $t < TOKEN_MAX_AGE;
    });
    if (isset($recent['n:' . $nonce]) || $now - ($recent['v:' . $visitor] ?? 0) < SUBMIT_INTERVAL) {
        return [$recent, false];
    }
    $recent['n:' . $nonce] = $now;
    $recent['v:' . $visitor] = $now;
    return [$recent, true];
});
if (!$allowed) {
    respond(429, ['error' => 'rate']);
}

// Insert, keep the best MAX_ENTRIES (ties: the earlier score stays ahead).
$entry = ['name' => $name, 'score' => $score, 'date' => gmdate('Y-m-d'), 'at' => microtime(true)];
$result = with_json($scoresFile, function ($scores) use ($entry) {
    $scores[] = $entry;
    usort($scores, function ($a, $b) {
        return $b['score'] <=> $a['score'] ?: $a['at'] <=> $b['at'];
    });
    $scores = array_slice(array_values($scores), 0, MAX_ENTRIES);
    $rank = null;
    foreach ($scores as $i => $s) {
        if ($s['at'] === $entry['at'] && $s['name'] === $entry['name']) {
            $rank = $i + 1;
        }
    }
    return [$scores, ['scores' => $scores, 'rank' => $rank]];
});

respond(200, ['scores' => public_scores($result['scores']), 'rank' => $result['rank']]);
