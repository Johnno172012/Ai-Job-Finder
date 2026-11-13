const domains = { Workable: 'apply.workable.com', Wellfound: 'wellfound.com/jobs' };
const cache = new Map();

export default async function handler(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams;
  const source = params.get('source');
  const terms = (params.get('terms') ?? '').replace(/[^\p{L}\p{N} +#.,-]/gu, ' ').trim().slice(0, 120);
  const cacheKey = source + ':' + terms.toLowerCase();
  if (req.method !== 'GET' || !Object.hasOwn(domains, source)) {
    res.writeHead(400).end();
    return;
  }

  res.setHeader('Content-Type', 'application/json');
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) {
    res.writeHead(503).end(JSON.stringify({ error: 'Requires Brave Search setup' }));
    return;
  }

  try {
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      res.end(JSON.stringify(cached.jobs));
      return;
    }

    const endpoint = new URL('https://api.search.brave.com/res/v1/web/search');
    endpoint.searchParams.set('q', `site:${domains[source]} jobs ${terms || 'software engineering'}`);
    endpoint.searchParams.set('count', '20');
    const response = await fetch(endpoint, {
      headers: { 'X-Subscription-Token': key, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error('Search unavailable');
    const { web } = await response.json();
    const jobs = (web?.results ?? []).flatMap(result => {
      const url = new URL(result.url);
      const isPosting = source === 'Workable'
        ? url.hostname === 'apply.workable.com' && /\/j\/[\w-]+/i.test(url.pathname)
        : ['wellfound.com', 'www.wellfound.com'].includes(url.hostname) && /^\/jobs\/\d+/.test(url.pathname);
      if (url.protocol !== 'https:' || !isPosting) return [];
      return [{ id: url.origin + url.pathname, source, title: result.title,
        company: '', location: '', url: url.origin + url.pathname, description: result.description ?? '' }];
    });
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, { jobs, expires: Date.now() + 6 * 60 * 60 * 1000 });
    res.end(JSON.stringify(jobs));
  } catch {
    res.writeHead(502).end(JSON.stringify({ error: 'Search unavailable' }));
  }
}
