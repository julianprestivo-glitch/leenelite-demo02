# Leen Elite – SiteGround Go-Live Checklist (Google Ads Ready)

## What is already prepared in this package
- Contact form now sends to `/contact.php` (JSON) and returns a real success/fail response.
- Reserve/Booking form now sends to `/reserve.php` (JSON) and returns a real success/fail response.
- Basic anti-spam honeypot field added to both forms.
- JS keeps a “local preview mode” (file://) so you can still preview without a server.

## One-time edits (you do)
1) Recipient email (already set)
- Leads from **Contact**, **Reserve/Booking**, and **Subscribe** are already configured to go to:
  - `info@leenelite.com`
- If you ever want to change it later, edit:
  - `config/form-config.php` → `to_email`
- (Optional) You can also change `from_email` / `from_name` (same domain is best for deliverability).

2) Upload to SiteGround:
- Upload all files to `public_html/`
- Make sure PHP is enabled (default on SiteGround)

3) Test the forms:
- Open:
  - `/en/index.html` (contact)
  - `/en/upcoming-exhibitions.html` (reserve)
- Submit a real test lead and confirm it arrives to your inbox.

## Tracking (Google Ads / GA4) – manual
4) Create Google Tag Manager container + GA4 property + Google Ads conversions.
5) Paste GTM snippet into the `<head>` of ALL HTML pages (EN + AR).
6) In GTM, create triggers:
- Custom Event: `leenelite_contact_submit`
- Custom Event: `leenelite_reserve_submit`
(These events are pushed by `js/script.js` after a successful server submit.)

## DNS / Domain (Cloudflare) – manual
7) Point Cloudflare A record to your SiteGround IP.
8) Keep mail-related records as DNS-only (do NOT proxy MX).

## Optional (recommended)
- If emails land in Spam: switch PHP sending from `mail()` to SMTP (PHPMailer) using a domain-authenticated sender.
