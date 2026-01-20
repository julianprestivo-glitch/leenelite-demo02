export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  try {
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();

    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    if (!valid) {
      res.status(400).json({ ok: false, error: 'invalid_email' });
      return;
    }

    // Demo-safe default:
    // In Vercel, this endpoint returns success to validate UX without exposing PDF/profile
    // or requiring vendor keys in the repository.
    //
    // Production (optional): connect an email service provider (Resend/SendGrid/etc.)
    // with environment variables, then send to: info@leenelite.com

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'server_error' });
  }
}
