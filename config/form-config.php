<?php
// Leen Elite – Form configuration (SiteGround)
return [
  // Where leads should be sent
  'to_email' => 'info@leenelite.com',

  // Sender identity (should be same domain to reduce spam)
  'from_email' => 'info@leenelite.com',
  'from_name'  => 'Leen Elite',

  // SMTP (Google Workspace SMTP relay)
  // Using IP allowlisting (no username/password) is the most secure option on shared hosting.
  // Relay host: smtp-relay.gmail.com (STARTTLS on 587)
  'smtp' => [
    'enabled'    => true,
    'host'       => 'smtp-relay.gmail.com',
    'port'       => 587,
    'encryption' => 'tls',   // STARTTLS
    'auth'       => false,   // IP allowlisting
    'username'   => '',
    'password'   => '',
    'timeout'    => 20,
    // Used in EHLO. Prefer your real domain.
    'helo'       => 'leenelite.com',
  ],

  // Basic anti-spam
  'honeypot_field' => 'website',
];
