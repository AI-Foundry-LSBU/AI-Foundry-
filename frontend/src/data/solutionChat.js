export function greetingMessage() {
  return {
    id: 'greeting', role: 'assistant', kind: 'greeting',
    text: "Hi, I'm Alice. Tell me what you are trying to improve and I'll check verified catalogue entries. I can also explain how to submit or track a request and use AI Foundry. You can submit an opportunity at any time."
  };
}

// Cards are supplied by the authenticated backend, never a second browser catalogue.
export function cardsFor(matches) {
  const seen = new Set();
  return (Array.isArray(matches) ? matches : []).flatMap((entry) => {
    if (!entry || !entry.id || seen.has(entry.id) || !entry.name || !entry.description || !entry.reason) return [];
    let href = null;
    try {
      const url = new URL(entry.href);
      if (url.protocol === 'https:' && !url.username && !url.password) href = url.href;
    } catch { /* An entry can instead contain access instructions. */ }
    if (!href && !entry.accessInstructions) return [];
    seen.add(entry.id);
    return [{ id: entry.id, name: entry.name, description: entry.description,
      reason: entry.reason, href, accessInstructions: entry.accessInstructions ?? null }];
  });
}

export function solutionReply(result) {
  if (result.decision === 'help') return {
    kind: 'help', text: result.message, showFormAction: result.helpTopic === 'submit'
  };
  const cards = result.decision === 'match' ? cardsFor(result.matches) : [];
  if (cards.length) return { kind: 'found', text: result.message, solutions: cards };
  if (result.decision === 'clarify' && result.question) return { kind: 'clarify', text: result.question };
  return { kind: 'none', text: result.message || 'No suitable verified solution was found. You can submit an opportunity.' };
}
