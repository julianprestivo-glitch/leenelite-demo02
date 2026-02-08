<?php
// Leen Elite – Contact form endpoint (SiteGround / Apache)
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
  // spam bot
  http_response_code(200);
  echo json_encode(['ok' => true]);
  exit;
}

$name    = trim((string)($data['name'] ?? ''));
$email   = trim((string)($data['email'] ?? ''));
$phone   = trim((string)($data['phone'] ?? ''));
$message = trim((string)($data['message'] ?? ''));
$lang    = trim((string)($data['lang'] ?? ''));
$page    = trim((string)($data['page'] ?? ''));

if ($name === '' || $email === '' || $phone === '' || $message === '') {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'missing_fields']);
  exit;
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'invalid_email']);
  exit;
}

// Destination
$to = $cfg['to_email'] ?? 'info@leenelite.com';
$fromEmail = $cfg['from_email'] ?? 'info@leenelite.com';
$fromName  = $cfg['from_name']  ?? 'Leen Elite';

$subject = 'Leen Elite – New Contact Lead';

$body = "New contact form submission:\n\n"
      . "Name: {$name}\n"
      . "Email: {$email}\n"
      . "Phone: {$phone}\n"
      . "Message:\n{$message}\n\n"
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
