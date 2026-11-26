const solutionIds = ['moodle', 'mylsbu', 'myaccount', 'careers', 'it', 'library'];

const catalogue = [
  'moodle: London South Bank University virtual learning environment at vle.lsbu.ac.uk. It publishes module sites, lecture notes, slides, assignments and class resources. It does not take attendance and it does not scan student IDs.',
  'mylsbu: The student portal and app at my.lsbu.ac.uk. Students view their timetable, check in to a class themselves in the app, and see their own attendance history. Check-in is done by the student in the app. It does not scan a student ID at a door and it does not take attendance automatically.',
  'myaccount: The enquiry service at myaccount.lsbu.ac.uk. Students raise and track questions about finance, wellbeing, accommodation, the library, IT and courses, and the My Attendance page shows an engagement score and an absence form. It does not scan a student ID and it does not take attendance automatically.',
  'careers: LSBU Careers Hub at careershub.lsbu.ac.uk. It lists jobs, placements, internships and employability support such as CVs and interviews. It does not record placement attendance or retype hours from spreadsheets.',
  'it: IT support for passwords, signing in, Wi-Fi, printing, software and classroom audio-visual faults. It does not build a new attendance system.',
  'library: The library at library.lsbu.ac.uk. Staff and students search for books, e-books, journals and articles, and get referencing and study help.'
].join('\n');

const checkSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['decision', 'matches'],
  properties: {
    decision: { type: 'string', enum: ['match', 'none', 'clarify'] },
    matches: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'reason'],
        properties: {
          id: { type: 'string', enum: solutionIds },
          reason: { type: 'string' }
        }
      }
    }
  }
};

function failure(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

export function normaliseSolutionCheck(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  if (!['match', 'none', 'clarify'].includes(value.decision)) return undefined;
  if (!Array.isArray(value.matches)) return undefined;

  const byId = new Map();
  for (const item of value.matches) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return undefined;
    if (!solutionIds.includes(item.id) || byId.has(item.id)) continue;
    const reason = typeof item.reason === 'string' ? item.reason.replace(/\s+/g, ' ').trim() : '';
    if (!reason || [...reason].length > 240 || reason.includes('\0')) continue;
    byId.set(item.id, reason);
  }

  if (value.decision !== 'match' || byId.size === 0) {
    return { decision: value.decision === 'clarify' ? 'clarify' : 'none', matches: [] };
  }
  return {
    decision: 'match',
    matches: solutionIds.filter((id) => byId.has(id)).map((id) => ({ id, reason: byId.get(id) }))
  };
}

export async function requestSolutionCheck(text, {
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_MODEL || 'gpt-4o-mini',
  fetchImpl = fetch
} = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw failure(503, 'SOLUTION_CHECK_UNAVAILABLE', 'Existing services cannot be checked right now.');
  }

  let response;
  try {
    response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'solution_check', strict: true, schema: checkSchema }
        },
        messages: [
          {
            role: 'system',
            content: [
              'You decide whether London South Bank University already has a service that does what the person asked.',
              'Use only this catalogue. Do not invent services, features or statistics.',
              catalogue,
              'Choose match only when a listed service already does the requested task itself.',
              'A related topic is not a match. A service that shows or records something does not cover a request for a different mechanism.',
              'An automatic door scanner that reads a student ID is not myLSBU and not MyAccount. Those only let a student check in from the app and view a record. That request is none.',
              'Retyping placement attendance from spreadsheets is none.',
              'Choose clarify only when the message is too vague to know what work they mean.',
              'For none or clarify, return an empty matches array.',
              'For match, include only the services that already do the task. reason is one sentence about the real feature, not the feature they wish existed.'
            ].join('\n')
          },
          { role: 'user', content: text }
        ]
      })
    });
  } catch {
    throw failure(502, 'SOLUTION_CHECK_FAILED', 'Existing services could not be checked.');
  }

  if (!response.ok) throw failure(502, 'SOLUTION_CHECK_FAILED', 'Existing services could not be checked.');

  const body = await response.json().catch(() => null);
  let parsed;
  try {
    parsed = JSON.parse(body?.choices?.[0]?.message?.content ?? '');
  } catch {
    parsed = undefined;
  }
  const result = normaliseSolutionCheck(parsed);
  if (!result) throw failure(502, 'SOLUTION_CHECK_FAILED', 'Existing services could not be checked.');
  return result;
}
