<?php
// Leen Elite – Newsletter subscription endpoint (SiteGround / Apache)
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

if (is_array($data)) {
  $email = isset($data['email']) ? trim((string)$data['email']) : '';
  $lang  = isset($data['lang']) ? trim((string)$data['lang']) : '';
  $page  = isset($data['page']) ? trim((string)$data['page']) : '';
}

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'invalid_email']);
  exit;
}

$to = 'info@leenelite.com';
$subject = 'Leen Elite Updates – New Subscription';
$message = "New newsletter subscription:\n\n" .
           "Email: {$email}\n" .
           "Language: {$lang}\n" .
           "Page: {$page}\n" .
           "Date (server): " . date('c') . "\n";

$headers = [];
$headers[] = 'MIME-Version: 1.0';
$headers[] = 'Content-type: text/plain; charset=UTF-8';
$headers[] = 'From: Leen Elite <no-reply@leenelite.com>';
$headers[] = 'Reply-To: ' . $email;

$sent = @mail($to, $subject, $message, implode("\r\n", $headers));

if (!$sent) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'send_failed']);
  exit;
}

echo json_encode(['ok' => true]);
