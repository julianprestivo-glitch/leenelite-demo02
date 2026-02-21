<?php
// Minimal SMTP mailer for Google Workspace SMTP relay (STARTTLS).
// - Designed for IP allowlisting (no SMTP AUTH).
// - UTF-8 safe subjects (Arabic/English).

function leenelite_encode_header_utf8(string $text): string {
  // RFC 2047 encoded-word using Base64
  // Only encode if non-ASCII present.
  if (preg_match('/[^\x20-\x7E]/', $text)) {
    return '=?UTF-8?B?' . base64_encode($text) . '?=';
  }
  return $text;
}

function leenelite_build_headers(array $headers): string {
  // $headers may be associative or list.
  $lines = [];
  foreach ($headers as $k => $v) {
    if (is_int($k)) {
      $line = trim((string)$v);
      if ($line !== '') $lines[] = $line;
    } else {
      $key = trim((string)$k);
      $val = trim((string)$v);
      if ($key !== '' && $val !== '') $lines[] = $key . ': ' . $val;
    }
  }
  return implode("\r\n", $lines);
}

function leenelite_smtp_read($fp): string {
  $data = '';
  while (!feof($fp)) {
    $line = fgets($fp, 515);
    if ($line === false) break;
    $data .= $line;
    // Multi-line replies have hyphen after status code.
    if (preg_match('/^\d{3}\s/', $line)) break;
  }
  return $data;
}

function leenelite_smtp_expect($fp, array $okCodes): array {
  $resp = leenelite_smtp_read($fp);
  $code = 0;
  if (preg_match('/^(\d{3})/', $resp, $m)) $code = (int)$m[1];
  return [in_array($code, $okCodes, true), $code, $resp];
}

function leenelite_smtp_cmd($fp, string $cmd, array $okCodes): array {
  fwrite($fp, $cmd . "\r\n");
  return leenelite_smtp_expect($fp, $okCodes);
}

/**
 * Send a single email via SMTP relay.
 *
 * @param array $smtpCfg expects keys: host, port, encryption ('tls' or ''), timeout, helo
 * @param string $fromEmail envelope sender / From header
 * @param string $fromName  From display name
 * @param string $toEmail   recipient
 * @param string $subject   UTF-8 subject
 * @param string $body      UTF-8 plain text
 * @param array  $extraHeaders associative headers (e.g. Reply-To)
 *
 * @return array [ok(bool), error_code(string), debug(string)]
 */
function leenelite_send_smtp(array $smtpCfg, string $fromEmail, string $fromName, string $toEmail, string $subject, string $body, array $extraHeaders = []): array {
  $host = $smtpCfg['host'] ?? '';
  $port = (int)($smtpCfg['port'] ?? 587);
  $timeout = (int)($smtpCfg['timeout'] ?? 20);
  $helo = $smtpCfg['helo'] ?? 'localhost';
  $encryption = strtolower((string)($smtpCfg['encryption'] ?? 'tls'));

  if ($host === '') {
    return [false, 'smtp_no_host', 'SMTP host missing'];
  }

  $remote = sprintf('tcp://%s:%d', $host, $port);
  $ctx = stream_context_create([
    'ssl' => [
      // Rely on system CA store; do not disable verification.
      'verify_peer' => true,
      'verify_peer_name' => true,
      'allow_self_signed' => false,
    ]
  ]);

  $fp = @stream_socket_client($remote, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $ctx);
  if (!$fp) {
    return [false, 'smtp_connect_failed', "connect errno=$errno err=$errstr"]; 
  }
  stream_set_timeout($fp, $timeout);

  // 220 greeting
  [$ok, $code, $resp] = leenelite_smtp_expect($fp, [220]);
  if (!$ok) {
    fclose($fp);
    return [false, 'smtp_bad_greeting', $resp];
  }

  // EHLO
  [$ok, $code, $resp] = leenelite_smtp_cmd($fp, 'EHLO ' . $helo, [250]);
  if (!$ok) {
    // try HELO fallback
    [$ok2, $code2, $resp2] = leenelite_smtp_cmd($fp, 'HELO ' . $helo, [250]);
    if (!$ok2) {
      fclose($fp);
      return [false, 'smtp_helo_failed', $resp . "\n" . $resp2];
    }
  }

  // STARTTLS if requested
  if ($encryption === 'tls') {
    [$ok, $code, $resp] = leenelite_smtp_cmd($fp, 'STARTTLS', [220]);
    if (!$ok) {
      fclose($fp);
      return [false, 'smtp_starttls_failed', $resp];
    }

    $cryptoOk = @stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
    if ($cryptoOk !== true) {
      fclose($fp);
      return [false, 'smtp_tls_negotiation_failed', 'TLS negotiation failed'];
    }

    // EHLO again over TLS
    [$ok, $code, $resp] = leenelite_smtp_cmd($fp, 'EHLO ' . $helo, [250]);
    if (!$ok) {
      fclose($fp);
      return [false, 'smtp_ehlo_after_tls_failed', $resp];
    }
  }

  // MAIL FROM (envelope)
  [$ok, $code, $resp] = leenelite_smtp_cmd($fp, 'MAIL FROM:<' . $fromEmail . '>', [250]);
  if (!$ok) {
    fclose($fp);
    return [false, 'smtp_mail_from_failed', $resp];
  }

  // RCPT TO
  [$ok, $code, $resp] = leenelite_smtp_cmd($fp, 'RCPT TO:<' . $toEmail . '>', [250, 251]);
  if (!$ok) {
    fclose($fp);
    return [false, 'smtp_rcpt_to_failed', $resp];
  }

  // DATA
  [$ok, $code, $resp] = leenelite_smtp_cmd($fp, 'DATA', [354]);
  if (!$ok) {
    fclose($fp);
    return [false, 'smtp_data_failed', $resp];
  }

  $fromHeader = $fromName !== ''
    ? sprintf('%s <%s>', $fromName, $fromEmail)
    : $fromEmail;

  $headers = [
    'Date' => date('r'),
    'From' => $fromHeader,
    'To' => $toEmail,
    'Subject' => leenelite_encode_header_utf8($subject),
    'Message-ID' => '<' . bin2hex(random_bytes(16)) . '@' . $helo . '>',
    'MIME-Version' => '1.0',
    'Content-Type' => 'text/plain; charset=UTF-8',
    'Content-Transfer-Encoding' => '8bit',
  ];

  foreach ($extraHeaders as $k => $v) {
    $headers[$k] = $v;
  }

  $headerStr = leenelite_build_headers($headers);

  // Normalize line endings and dot-stuffing
  $body = str_replace(["\r\n", "\r"], "\n", $body);
  $body = str_replace("\n", "\r\n", $body);
  $body = preg_replace('/\r\n\./', "\r\n..", $body);

  $dataMsg = $headerStr . "\r\n\r\n" . $body . "\r\n.";
  fwrite($fp, $dataMsg . "\r\n");

  [$ok, $code, $resp] = leenelite_smtp_expect($fp, [250]);
  if (!$ok) {
    fclose($fp);
    return [false, 'smtp_message_rejected', $resp];
  }

  // QUIT
  @leenelite_smtp_cmd($fp, 'QUIT', [221, 250]);
  fclose($fp);

  return [true, '', ''];
}
