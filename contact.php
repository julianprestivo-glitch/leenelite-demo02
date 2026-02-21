<?php
// Leen Elite – Contact form endpoint (SiteGround / Apache)
header('Content-Type: application/json; charset=UTF-8');

require_once __DIR__ . '/lib/smtp_mailer.php';

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

$smtp = $cfg['smtp'] ?? [];
$smtpEnabled = (bool)($smtp['enabled'] ?? false);

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

// --- Send admin notification ----------------------------------------------
$sentAdmin = false;
$adminDebug = '';

if ($smtpEnabled) {
  [$ok, $err, $dbg] = leenelite_send_smtp(
    $smtp,
    $fromEmail,
    $fromName,
    $to,
    $subject,
    $body,
    ['Reply-To' => $email]
  );
  $sentAdmin = $ok;
  $adminDebug = $err ?: $dbg;
} else {
  $sentAdmin = @mail($to, $subject, $body, implode("\r\n", $headers));
}

if (!$sentAdmin) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'send_failed']);
  exit;
}

// --- Auto-reply to visitor (best-effort) ---------------------------------
$isArabic = (strpos(strtolower($lang), 'ar') === 0) || (strpos($page, '/ar/') !== false);

$userSubject = $isArabic
  ? 'Leen Elite – تم استلام رسالتك'
  : 'Leen Elite – We received your message';

$userMessageAr = "مرحبًا {$name}،\n\n" .
  "شكرًا لتواصلك مع لين إيليت. تم استلام رسالتك وسنقوم بالرد عليك في أقرب وقت ممكن.\n\n" .
  "ملخص رسالتك:\n{$message}\n\n" .
  "مع التحية،\nLeen Elite\n";

$userMessageEn = "Hello {$name},\n\n" .
  "Thanks for contacting Leen Elite. We received your message and will get back to you as soon as possible.\n\n" .
  "Your message summary:\n{$message}\n\n" .
  "Regards,\nLeen Elite\n";

$userBody = $isArabic
  ? ($userMessageAr . "\n\n---\n\n" . $userMessageEn)
  : ($userMessageEn . "\n\n---\n\n" . $userMessageAr);

$sentUser = false;
if ($smtpEnabled) {
  [$ok2, $err2, $dbg2] = leenelite_send_smtp(
    $smtp,
    $fromEmail,
    $fromName,
    $email,
    $userSubject,
    $userBody,
    ['Reply-To' => $to]
  );
  $sentUser = $ok2;
} else {
  $userHeaders = [];
  $userHeaders[] = 'MIME-Version: 1.0';
  $userHeaders[] = 'Content-type: text/plain; charset=UTF-8';
  $userHeaders[] = 'From: ' . $fromName . ' <' . $fromEmail . '>';
  $userHeaders[] = 'Reply-To: ' . $to;
  $sentUser = @mail($email, $userSubject, $userBody, implode("\r\n", $userHeaders));
}

echo json_encode(['ok' => true, 'user_mail_sent' => (bool)$sentUser]);
