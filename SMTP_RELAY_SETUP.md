# LeenElite – Google Workspace SMTP Relay (SiteGround)

This site now sends emails via **Google Workspace SMTP Relay** (recommended) instead of PHP `mail()`.

## 1) Your hosting type
Your plan is **StartUp** → this is **Shared Hosting** on SiteGround.

## 2) SiteGround server IP (for allowlisting)
Use this IP in Google Admin → SMTP relay allowlist:

- **35.213.156.130**

## 3) Google Admin Console settings
Google Admin Console → **Apps → Google Workspace → Gmail → Routing → SMTP relay service**

Recommended configuration:
- **Only accept mail from the specified IP addresses**
- Add IP: **35.213.156.130**
- Require TLS encryption: **ON** (recommended)
- Authentication: **OFF** (because we’re using IP allowlisting)

## 4) DNS on Cloudflare (deliverability)
Because your domain email is on Google Workspace, make sure these are set:
- **SPF**: include Google (`include:_spf.google.com`) and keep only **one** SPF record.
- **DKIM**: enable in Google Admin and add the TXT record in Cloudflare.
- **DMARC**: add a DMARC TXT record (start with `p=none` while testing, then tighten).

## 5) What changed in the code
- `contact.php`, `reserve.php`, `subscribe.php` now use `lib/smtp_mailer.php`.
- **Admin email** goes to `info@leenelite.com`.
- **Auto-reply** emails are sent to the visitor for:
  - Contact form
  - Booking form
  - Newsletter subscribe
- Language is chosen automatically from the payload (`lang`) / page path (`/ar/` or `/en/`).

## 6) Test
After upload to `public_html/`:
- Test contact form on `/ar/index.html` and `/en/index.html`
- Test booking on `/ar/upcoming-exhibitions.html` and `/en/upcoming-exhibitions.html`
- Test newsletter popup on home (wait ~5 seconds)

If the admin receives the lead but the visitor doesn’t receive confirmation, check:
- Gmail spam folder
- DKIM/SPF/DMARC
- SMTP relay allowlist IP
