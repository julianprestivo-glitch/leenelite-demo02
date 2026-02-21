<?php
// Leen Elite – Newsletter / Updates subscription endpoint (SiteGround / Apache)
// NOTE: PHP does not execute on Vercel static hosting.
// This file is intended for the production Apache/cPanel environment.

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

// Honeypot (optional; front-end may not send it)
if (!empty($data[$honeypot])) {
  http_response_code(200);
  echo json_encode(['ok' => true]);
  exit;
}

$email  = isset($data['email']) ? trim((string)$data['email']) : '';
$lang   = isset($data['lang']) ? trim((string)$data['lang']) : '';
$page   = isset($data['page']) ? trim((string)$data['page']) : '';
$source = isset($data['source']) ? trim((string)$data['source']) : '';

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'invalid_email']);
  exit;
}

// Destination + sender (configurable)
$to        = $cfg['to_email']   ?? 'info@leenelite.com';
$fromEmail = $cfg['from_email'] ?? 'info@leenelite.com';
$fromName  = $cfg['from_name']  ?? 'Leen Elite';

$smtp = $cfg['smtp'] ?? [];
$smtpEnabled = (bool)($smtp['enabled'] ?? false);

// 1) Notify site owner (new subscription)
$subject = 'Leen Elite – New Subscription';
$message = "New newsletter subscription:\n\n" .
           "Email: {$email}\n" .
           "Language: {$lang}\n" .
           "Page: {$page}\n" .
           "Source: {$source}\n" .
           "Date (server): " . date('c') . "\n" .
           "IP: " . ($_SERVER['REMOTE_ADDR'] ?? '') . "\n";

$headers = [];
$headers[] = 'MIME-Version: 1.0';
$headers[] = 'Content-type: text/plain; charset=UTF-8';
$headers[] = 'From: ' . $fromName . ' <' . $fromEmail . '>';
$headers[] = 'Reply-To: ' . $email;

$sentAdmin = false;

if ($smtpEnabled) {
  [$ok, $err, $dbg] = leenelite_send_smtp(
    $smtp,
    $fromEmail,
    $fromName,
    $to,
    $subject,
    $message,
    ['Reply-To' => $email]
  );
  $sentAdmin = $ok;
} else {
  $sentAdmin = @mail($to, $subject, $message, implode("\r\n", $headers));
}

if (!$sentAdmin) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'send_failed']);
  exit;
}

// 2) Confirmation email to the visitor (best-effort)
$isArabic = (strpos(strtolower($lang), 'ar') === 0);

$userSubject = $isArabic ? 'Leen Elite – تم تأكيد الاشتراك' : 'Leen Elite – Subscription confirmed';

$userMessageAr = "مرحبًا،\n\n" .
  "شكرًا لاشتراكك. سيتم إرسال أهم تحديثات لين إيليت إلى بريدك الإلكتروني عند توفرها.\n\n" .
  "يمكنك تجاهل هذه الرسالة إذا لم تقم بالاشتراك.\n\n" .
  "مع التحية،\n" .
  "Leen Elite\n";

$userMessageEn = "Hello,\n\n" .
  "Thanks for subscribing. We'll email you important Leen Elite updates when they're available.\n\n" .
  "If you did not subscribe, you can ignore this message.\n\n" .
  "Regards,\n" .
  "Leen Elite\n";

$userMessage = $isArabic ? ($userMessageAr . "\n\n---\n\n" . $userMessageEn) : ($userMessageEn . "\n\n---\n\n" . $userMessageAr);

$userHeaders = [];
$userHeaders[] = 'MIME-Version: 1.0';
$userHeaders[] = 'Content-type: text/plain; charset=UTF-8';
$userHeaders[] = 'From: ' . $fromName . ' <' . $fromEmail . '>';

$sentUser = false;
if ($smtpEnabled) {
  [$ok2, $err2, $dbg2] = leenelite_send_smtp(
    $smtp,
    $fromEmail,
    $fromName,
    $email,
    $userSubject,
    $userMessage,
    ['Reply-To' => $to]
  );
  $sentUser = $ok2;
} else {
  $sentUser = @mail($email, $userSubject, $userMessage, implode("\r\n", $userHeaders));
}

// Optional: best-effort CSV log (may require writable permission)
try {
  $dir = __DIR__ . '/storage';
  if (!is_dir($dir)) {
    @mkdir($dir, 0755, true);
  }
  $csv = $dir . '/newsletter_leads.csv';
  $line = [date('c'), $email, $lang, $page, $source];
  $fp = @fopen($csv, 'a');
  if ($fp) {
    @fputcsv($fp, $line);
    @fclose($fp);
  }
} catch (Exception $e) {
  // ignore logging errors
}

echo json_encode(['ok' => true, 'user_mail_sent' => (bool)$sentUser]);
