// Vercel Edge Middleware (Basic Auth)
// Requires Environment Variables on Vercel: PREVIEW_USER and PREVIEW_PASS
// Do NOT store the password in code. Set PREVIEW_PASS in Vercel Dashboard.
export default function middleware(request) {
  const { headers } = request;
  const USER = process.env.PREVIEW_USER || '';
  const PASS = process.env.PREVIEW_PASS || '';

  if (!USER || !PASS) {
    return new Response('Preview not configured. Set PREVIEW_USER/PREVIEW_PASS in Vercel.', { status: 503 });
  }

  const auth = headers.get('authorization') || '';
  const BASIC = 'Basic ';

  if (auth.startsWith(BASIC)) {
    try {
      const b64 = auth.slice(BASIC.length);
      const decoded = atob(b64);
      const [u, p] = decoded.split(':');
      if (u === USER && p === PASS) {
        return new Response(null, { status: 200 });
      }
    } catch (e) {
      // ignore
    }
  }

  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Preview"' }
  });
}
