import { authenticatedUser } from './_auth.js';

const domains = {
  Greenhouse: 'boards.greenhouse.io OR site:job-boards.greenhouse.io',
  Lever: 'jobs.lever.co OR site:jobs.eu.lever.co',
  Workable: 'apply.workable.com',
  Wellfound: 'wellfound.com/jobs',
};
const cache = new Map();

export function jobResult(result, source) {
  let url;
  try { url = new URL(result.url); } catch { return null; }
  const valid = {
    Greenhouse: ['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(url.hostname) && /\/jobs\/\d+/.test(url.pathname),
    Lever: ['jobs.lever.co', 'jobs.eu.lever.co'].includes(url.hostname) && /^\/[^/]+\/[^/]+/.test(url.pathname),
    Workable: url.hostname === 'apply.workable.com' && /\/j\/[\w-]+/i.test(url.pathname),
    Wellfound: ['wellfound.com', 'www.wellfound.com'].includes(url.hostname) && /^\/jobs\/\d+/.test(url.pathname),
  };
  if (url.protocol !== 'https:' || !valid[source]) return null;
  return {
    id: url.origin + url.pathname, source, title: result.title,
    company: '', location: '', url: url.origin + url.pathname,
    description: result.description ?? '',
  };
}

export default async function handler(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams;
  const source = params.get('source');
  const terms = (params.get('terms') ?? '').replace(/[^\p{L}\p{N} +#.,-]/gu, ' ').trim().slice(0, 120);
  const reply = (status, data) => {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(status).end(JSON.stringify(data));
  };
  if (req.method !== 'GET' || !Object.hasOwn(domains, source)) {
    return reply(400, { error: 'Invalid job source.' });
  }
  if (!process.env.BRAVE_SEARCH_API_KEY) {
    return reply(503, { error: 'Requires Brave Search setup' });
  }

  try {
    const userId = await authenticatedUser(req);
    if (!userId) return reply(401, { error: 'Sign in to search jobs.' });
    const cacheKey = userId + ':' + source + ':' + terms.toLowerCase();
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return reply(200, cached.jobs);

    const endpoint = new URL('https://api.search.brave.com/res/v1/web/search');
    endpoint.searchParams.set('q', `(site:${domains[source]}) jobs ${terms || 'software engineering'}`);
    endpoint.searchParams.set('count', '20');
    const response = await fetch(endpoint, {
      headers: { 'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error('Search unavailable');
    const { web } = await response.json();
    const jobs = [...new Map((web?.results ?? []).map(result => jobResult(result, source))
      .filter(Boolean).map(job => [job.id, job])).values()];
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, { jobs, expires: Date.now() + 6 * 60 * 60 * 1000 });
    return reply(200, jobs);
  } catch {
    return reply(502, { error: 'Search unavailable' });
  }
}
