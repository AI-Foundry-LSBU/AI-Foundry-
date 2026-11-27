const editable = ['name', 'description', 'keywords', 'href', 'accessInstructions', 'visibility', 'active', 'verified', 'verificationNotes'];
const stopWords = new Set('a an and are as at be before by can could do does for from has have help how i in is it lsbu london me my of on or our please problem south that the their them there this to university us want we what when where which who with would'.split(' '));

export function searchTerms(text) {
  return [...new Set((text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((word) => word.length > 1 && !stopWords.has(word)))].slice(0, 40);
}

export function validateCatalogueEntry(body) {
  const fields = {};
  const data = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { data, fields: { body: 'Send a JSON object.' } };
  }
  if (Object.keys(body).some((key) => !editable.includes(key))) fields.body = 'Only catalogue fields may be supplied.';
  for (const [key, max, required] of [
    ['name', 120, true], ['description', 2000, true], ['accessInstructions', 1000, false], ['verificationNotes', 2000, false]
  ]) {
    const value = body[key];
    if (!required && (value === undefined || value === null || value === '')) { data[key] = null; continue; }
    if (typeof value !== 'string' || !value.trim() || [...value.trim()].length > max || value.includes('\0')) {
      fields[key] = `Enter ${required ? 'a value of ' : ''}1 to ${max} characters without null characters.`;
    } else data[key] = value.trim();
  }
  data.href = null;
  if (body.href !== undefined && body.href !== null && body.href !== '') {
    try {
      const url = new URL(body.href);
      if (typeof body.href !== 'string' || body.href.length > 2000 || url.protocol !== 'https:' || url.username || url.password || /[\s\x00-\x1f\x7f]/.test(body.href)) throw new Error();
      data.href = url.href;
    } catch { fields.href = 'Enter an HTTPS link without embedded credentials.'; }
  }
  if (!data.href && !data.accessInstructions) fields.accessInstructions = 'Provide a link or access instructions.';
  const keywords = body.keywords ?? [];
  if (!Array.isArray(keywords) || keywords.length > 20 || keywords.some((word) => typeof word !== 'string' || !word.trim() || [...word.trim()].length > 50 || word.includes('\0'))) {
    fields.keywords = 'Provide up to 20 keywords of 1 to 50 characters.';
  } else data.keywords = [...new Set(keywords.map((word) => word.trim().toLowerCase()))];
  data.visibility = body.visibility ?? 'all_users';
  if (!['all_users', 'manager_only'].includes(data.visibility)) fields.visibility = 'Choose all_users or manager_only.';
  for (const [key, fallback] of [['active', true], ['verified', false]]) {
    data[key] = body[key] ?? fallback;
    if (typeof data[key] !== 'boolean' || body[key] === null) fields[key] = 'Use true or false.';
  }
  if (data.verified && !data.verificationNotes) fields.verificationNotes = 'Record how you checked this solution before verifying it.';
  return { data, fields };
}

export function validateCatalogueSearch(query, management = false) {
  const fields = {};
  const allowed = management ? ['q', 'limit', 'state'] : ['q', 'limit'];
  if (Object.keys(query).some((key) => !allowed.includes(key))) fields.query = 'Unknown search parameter.';
  const q = query.q ?? '';
  if (typeof q !== 'string' || [...q].length > 200 || q.includes('\0')) fields.q = 'Search in 200 characters or fewer.';
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if ((query.limit !== undefined && (typeof query.limit !== 'string' || !/^\d+$/.test(query.limit))) || !Number.isInteger(limit) || limit < 1 || limit > 50) fields.limit = 'Choose a limit from 1 to 50.';
  const state = query.state ?? 'all';
  if (!['all', 'verified', 'draft', 'archived'].includes(state)) fields.state = 'Choose all, verified, draft or archived.';
  return { data: { q: typeof q === 'string' ? q.trim() : '', limit, state }, fields };
}
