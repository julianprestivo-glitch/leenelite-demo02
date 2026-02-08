<?php
// Leen Elite – Reserve/Booking request endpoint (SiteGround / Apache)
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
  exit;
}

$cfg = @include __DIR__ . '/config/form-config.php';
if (!is_array($cfg)) $cfg = [];

$honeypot = $cfg['honeypot_field'] ?? 'website';

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) $data = [];

if (!empty($data[$honeypot])) {
  http_response_code(200);
  echo json_encode(['ok' => true]);
  exit;
}

$required = ['full_name','company','email','phone','city','cr','vat','size','type','category'];
$missing = [];
foreach ($required as $k) {
  $v = trim((string)($data[$k] ?? ''));
  if ($v === '') $missing[] = $k;
}
$email = trim((string)($data['email'] ?? ''));
if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'invalid_email']);
  exit;
}
if (count($missing)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'missing_fields', 'fields' => $missing]);
  exit;
}

$to = $cfg['to_email'] ?? 'info@leenelite.com';
$fromEmail = $cfg['from_email'] ?? 'info@leenelite.com';
$fromName  = $cfg['from_name']  ?? 'Leen Elite';

$subject = 'Leen Elite – New Space Booking Request';

$notes = trim((string)($data['notes'] ?? ''));
$lang  = trim((string)($data['lang'] ?? ''));
$page  = trim((string)($data['page'] ?? ''));

$body = "New space booking request:\n\n"
      . "Full Name: " . trim((string)$data['full_name']) . "\n"
      . "Company: " . trim((string)$data['company']) . "\n"
      . "Email: {$email}\n"
      . "Phone: " . trim((string)$data['phone']) . "\n"
      . "City: " . trim((string)$data['city']) . "\n"
      . "CR: " . trim((string)$data['cr']) . "\n"
      . "VAT: " . trim((string)$data['vat']) . "\n"
      . "Space Size: " . trim((string)$data['size']) . "\n"
      . "Participation Type: " . trim((string)$data['type']) . "\n"
      . "Space Category: " . trim((string)$data['category']) . "\n"
      . "Notes: " . ($notes ?: '-') . "\n\n"
      . "Language: {$lang}\n"
      . "Page: {$page}\n"
      . "Date (server): " . date('c') . "\n"
      . "IP: " . ($_SERVER['REMOTE_ADDR'] ?? '') . "\n";

$headers = [];
$headers[] = 'MIME-Version: 1.0';
$headers[] = 'Content-type: text/plain; charset=UTF-8';
$headers[] = 'From: ' . $fromName . ' <' . $fromEmail . '>';
$headers[] = 'Reply-To: ' . $email;

$sent = @mail($to, $subject, $body, implode("\r\n", $headers));

if (!$sent) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'send_failed']);
  exit;
}

echo json_encode(['ok' => true]);
