<?php
// Leen Elite – Exhibitor Toolkit lead capture endpoint (SiteGround / Apache)
// NOTE: PHP does not execute on Vercel static hosting.
// This file is intended for the production Apache/cPanel environment.

header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
  exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

$email = '';
$lang = '';
$page = '';
$source = '';

if (is_array($data)) {
  $email = isset($data['email']) ? trim((string)$data['email']) : '';
  $lang  = isset($data['lang']) ? trim((string)$data['lang']) : '';
  $page  = isset($data['page']) ? trim((string)$data['page']) : '';
  $source = isset($data['source']) ? trim((string)$data['source']) : '';
}

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'invalid_email']);
  exit;
}

// Build an absolute URL to the toolkit PDF (works on live domain)
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
$toolkitPath = '/downloads/LeenElite_Exhibitor_Toolkit_AR-EN.pdf';
$toolkitUrl = ($host ? ($scheme . '://' . $host . $toolkitPath) : $toolkitPath);

// 1) Notify site owner (lead capture)
$to = 'info@leenelite.com';
$subject = 'Leen Elite – Exhibitor Toolkit Request';
$message = "New toolkit request:\n\n" .
           "Email: {$email}\n" .
           "Language: {$lang}\n" .
           "Page: {$page}\n" .
           "Source: {$source}\n" .
           "Toolkit: {$toolkitUrl}\n" .
           "Date (server): " . date('c') . "\n";

$headers = [];
$headers[] = 'MIME-Version: 1.0';
$headers[] = 'Content-type: text/plain; charset=UTF-8';
$headers[] = 'From: Leen Elite <info@leenelite.com>'; // adjust if needed
$headers[] = 'Reply-To: ' . $email;

$sentAdmin = @mail($to, $subject, $message, implode("\r\n", $headers));

if (!$sentAdmin) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'send_failed']);
  exit;
}

// 2) Email the toolkit link to the visitor (best-effort)
$isArabic = (strpos(strtolower($lang), 'ar') === 0);

$userSubject = $isArabic ? 'Leen Elite – دليل العارض للمعارض' : 'Leen Elite – Exhibitor Toolkit';

$userMessageAr = "مرحبًا،\n\n" .
  "شكرًا لتسجيلك. يمكنك تحميل/فتح دليل العارض للمعارض من الرابط التالي:\n" .
  "{$toolkitUrl}\n\n" .
  "إذا لم تقم بطلب هذا الدليل، يمكنك تجاهل هذه الرسالة.\n\n" .
  "مع التحية،\n" .
  "Leen Elite\n";

$userMessageEn = "Hello,\n\n" .
  "Thank you for your request. You can open/download the Exhibitor Toolkit here:\n" .
  "{$toolkitUrl}\n\n" .
  "If you did not request this toolkit, you can ignore this message.\n\n" .
  "Regards,\n" .
  "Leen Elite\n";

$userMessage = $isArabic ? ($userMessageAr . "\n\n---\n\n" . $userMessageEn) : ($userMessageEn . "\n\n---\n\n" . $userMessageAr);

$userHeaders = [];
$userHeaders[] = 'MIME-Version: 1.0';
$userHeaders[] = 'Content-type: text/plain; charset=UTF-8';
$userHeaders[] = 'From: Leen Elite <info@leenelite.com>'; // adjust if needed

$sentUser = @mail($email, $userSubject, $userMessage, implode("\r\n", $userHeaders));

// Optional: best-effort CSV log (may require writable permission)
try {
  $dir = __DIR__ . '/storage';
  if (!is_dir($dir)) {
    @mkdir($dir, 0755, true);
  }
  $csv = $dir . '/toolkit_leads.csv';
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
