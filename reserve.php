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

// Honeypot (spam bots)
if (!empty($data[$honeypot])) {
  http_response_code(200);
  echo json_encode(['ok' => true]);
  exit;
}

// --- Helpers ---------------------------------------------------------------
$normalizeDigits = function($value) {
  $s = (string)($value ?? '');
  $map = [
    '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
    '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9'
  ];
  return strtr($s, $map);
};

$get = function($key) use ($data) {
  return isset($data[$key]) ? trim((string)$data[$key]) : '';
};

$truthy = function($v) {
  if (is_bool($v)) return $v;
  $s = strtolower(trim((string)$v));
  return in_array($s, ['1','true','yes','on'], true);
};

// --- Inputs ----------------------------------------------------------------
$full_name = $get('full_name');
$company   = $get('company');
$email     = $get('email');
$phone     = $get('phone');
$city      = $get('city');
$cr        = $get('cr');
$vat       = $get('vat');
$size      = $get('size');
$type      = $get('type');
$category  = $get('category');
$notes     = $get('notes');
$lang      = $get('lang');
$page      = $get('page');

$phone_country = $get('phone_country');
$phone_local   = $get('phone_local');
$privacy_consent_raw = $data['privacy_consent'] ?? '';

// Normalize certain fields
$email = trim($email);
$phone = preg_replace('/\s+/', ' ', trim($normalizeDigits($phone)));
$phone_country = trim($normalizeDigits($phone_country));
$phone_local   = trim($normalizeDigits($phone_local));
$size = trim($normalizeDigits($size));

$cr_digits  = preg_replace('/\D/', '', $normalizeDigits($cr));
$vat_digits = preg_replace('/\D/', '', $normalizeDigits($vat));

// --- Validation ------------------------------------------------------------
$missing = [];
if ($full_name === '') $missing[] = 'full_name';
if ($company === '') $missing[] = 'company';
if ($email === '') $missing[] = 'email';
if ($phone === '') $missing[] = 'phone';
if ($city === '') $missing[] = 'city';
if ($size === '') $missing[] = 'size';
if ($type === '') $missing[] = 'type';
if ($category === '') $missing[] = 'category';

$privacy_ok = $truthy($privacy_consent_raw);
if (!$privacy_ok) $missing[] = 'privacy_consent';

if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'invalid_email']);
  exit;
}

// Phone validation (allow + and spaces, but enforce digit length)
$phone_digits = preg_replace('/\D/', '', $phone);
if ($phone_digits !== '' && (strlen($phone_digits) < 6 || strlen($phone_digits) > 16)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'invalid_phone']);
  exit;
}

// KSA rule detection (match front-end behavior)
$isKsa = false;
if ($phone_country === '+966') $isKsa = true;
if (!$isKsa && strpos($phone, '+966') === 0) $isKsa = true;

// Size must be > 0
$size_str = str_replace(",", ".", $size);
if ($size_str === "" || !is_numeric($size_str) || floatval($size_str) <= 0) {
  http_response_code(400);
  echo json_encode(["ok" => false, "error" => "invalid_size"]);
  exit;
}
$size_num = floatval($size_str);

// CR + VAT required only for Saudi numbers
if ($isKsa) {
  if ($cr_digits === '') $missing[] = 'cr';
  if ($vat_digits === '') $missing[] = 'vat';
}

// If provided, validate formats (same rules as front-end)
if ($cr_digits !== '') {
  if (!preg_match('/^[127]\d{9}$/', $cr_digits)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_cr']);
    exit;
  }
}

if ($vat_digits !== '') {
  if (!preg_match('/^\d{15}$/', $vat_digits)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_vat']);
    exit;
  }
}

if (count($missing)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'missing_fields', 'fields' => $missing]);
  exit;
}

// --- Email -----------------------------------------------------------------
$to        = $cfg['to_email']   ?? 'info@leenelite.com';
$fromEmail = $cfg['from_email'] ?? 'info@leenelite.com';
$fromName  = $cfg['from_name']  ?? 'Leen Elite';

$subject = 'Leen Elite – New Space Booking Request';

$body = "New space booking request:\n\n"
      . "Full Name: {$full_name}\n"
      . "Company: {$company}\n"
      . "Email: {$email}\n"
      . "Phone: {$phone}\n";

if ($phone_country || $phone_local) {
  $body .= "Phone Country: {$phone_country}\n";
  $body .= "Phone Local: {$phone_local}\n";
}

$body .= "City: {$city}\n"
      . "CR: " . ($cr_digits ?: '-') . "\n"
      . "VAT: " . ($vat_digits ?: '-') . "\n"
      . "Space Size: {$size}\n"
      . "Participation Type: {$type}\n"
      . "Space Category: {$category}\n"
      . "Notes: " . ($notes ?: '-') . "\n\n"
      . "Privacy Consent: " . ($privacy_ok ? 'yes' : 'no') . "\n"
      . "Saudi Requirements Applied: " . ($isKsa ? 'yes' : 'no') . "\n"
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
