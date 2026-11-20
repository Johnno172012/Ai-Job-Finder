export async function authenticatedUser(req) {
  const authorization = req.headers.authorization;
  const url = process.env.VITE_SUPABASE_URL;
  const apikey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !apikey || !authorization?.startsWith('Bearer ')) return null;
  const response = await fetch(new URL('/auth/v1/user', url), {
    headers: { authorization, apikey },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return null;
  const user = await response.json();
  return user.id ?? null;
}
