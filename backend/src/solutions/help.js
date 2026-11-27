// Reviewed application instructions, not private records or an AI-generated
// description of the website. Keep these aligned with the actual screens.
export function applicationHelp(text, role) {
  const question = text.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '');
  const asking = /^(how|where|what|why|who|which|can|could|would|please|help|show|tell|explain|i (?:want|need|would like) to)\b/.test(question);
  let topic;
  if (/^(hi|hello|hey|help|help me|what can you do|how can you help(?: me)?|what is ai foundry|what does ai foundry do)$/.test(question)) topic = 'overview';
  else if (asking && /\b(?:api key|api credentials?|passwords?|sign[ -]?in|log[ -]?in|login|sign[ -]?out|log[ -]?out)\b/.test(question)) topic = 'sign_in';
  else if (asking && /\b(?:catalogue|catalog)\b/.test(question) && /\b(?:manage|add|edit|verify|verified|approve|archive|maintain)\b/.test(question)) topic = 'catalogue';
  else if (asking && /\b(?:notification|notifications|bell|unread)\b/.test(question)) topic = 'notifications';
  else if (asking && /\b(?:history|previous decisions?|previous changes?)\b/.test(question)) topic = 'history';
  else if (asking && /\b(?:benefits?|estimated|actual|savings)\b/.test(question) && /\b(?:record|add|edit|find|open|see|view|report|compare|dashboard|calculate|work|works|save|update)\b/.test(question)) topic = 'benefits';
  else if (asking && /\b(?:assess|assessment|assessments|prioritise|prioritize|approve|reject|decision)\b/.test(question) && /\b(?:opportunit(?:y|ies)|requests?|assessment|assessments|decision)\b/.test(question)) topic = 'assessment';
  else if (asking && /\bprojects?\b/.test(question) && /\b(?:delivery|progress|update|status|notes?|create|open|view|track)\b/.test(question)) topic = 'projects';
  else if (asking && /\b(?:status|statuses|submitted|under review|approved|rejected|in progress|completed|testing)\b/.test(question) && /\b(?:opportunit(?:y|ies)|requests?|status|statuses)\b/.test(question)) topic = 'statuses';
  else if (asking && /\b(?:track|find|view|open|see|follow|check)\b/.test(question) && /\b(?:my (?:submitted )?(?:opportunit(?:y|ies)|requests?|submissions?)|(?:an?|the) (?:opportunity|request)|(?:all|approved|submitted) opportunities)\b/.test(question)) topic = 'tracking';
  else if (question === 'submit anyway' || (asking && /\b(?:submit|submission|form|create|save)\b/.test(question) && /\b(?:opportunit(?:y|ies)|request|submission|form)\b/.test(question))) topic = 'submit';
  else if (asking && /\b(?:what is|what does .* mean|explain)\b/.test(question) && /\b(?:opportunity|opportunities)\b/.test(question)) topic = 'opportunity';
  if (!topic) return undefined;

  const manager = role === 'manager';
  const engineer = role === 'team';
  const messages = {
    overview: "I can look for verified existing solutions, or explain how AI Foundry works. Ask how to submit an opportunity, track your request, understand statuses or use notifications. Describe your problem when you want a solution recommendation. You can select Submit anyway at any time.",
    opportunity: 'An opportunity is a proposed improvement to an LSBU process or service. Describe the problem and the improvement you would like. A Digital Project Manager reviews it. An approved opportunity can later become a delivery project.',
    submit: 'Select Open opportunity form below, or Submit anyway at the top of this chat. Enter a title, department, problem description and proposed improvement, then submit. Required fields must be valid. The saved opportunity gets a submission date and starts as Submitted. A confirmation shows its reference. You can submit even if Alice finds no match or the AI service is unavailable.',
    tracking: manager
      ? 'Open All Opportunities and select the request to view its details, assessment, decision and history. Search or filter the list to find it. Project Delivery shows linked delivery projects. I explain the workflow here; I do not look up a particular request in this conversation.'
      : engineer
        ? 'Open Approved Opportunities for approved requests, or Project Delivery for delivery projects. Engineers cannot browse every unapproved submission. I do not look up individual records in this conversation.'
        : 'Open My Opportunities and select your request. You can see its details and current status, and refresh to load saved updates. Staff can only access their own submissions. I explain the workflow here; I do not look up a particular request in this conversation.',
    statuses: 'The opportunity starts as Submitted, moves to Under Review during assessment, and can be Approved or Rejected. A delivery project has a separate status: Not Started, In Progress, Testing or Completed. Approval does not mean that delivery has started. Open the saved request or project for its actual current status.',
    notifications: 'Use the bell in the top bar to open notifications about your own opportunities. Select a notification to open its opportunity. Dismiss marks it as read. Notifications and read state are saved; Alice does not send emails or read your notifications in this chat.',
    assessment: manager
      ? 'Open All Opportunities and select a request. Review the five assessment criteria: strategic alignment, benefit potential, complexity, resource requirements and speed to value. Choose priority and category, then use Save Assessment. Use the decision controls and Save Decision to approve or reject it. A rejection requires a reason. Review AI suggestions before saving or relying on them.'
      : 'Digital Project Managers assess, prioritise, approve and reject opportunities. Staff can track their own requests; engineers work with approved opportunities and delivery projects. Alice cannot change your role or approve a request.',
    projects: manager || engineer
      ? 'Open Project Delivery and select a project to see its details. Eligible controls let you update its delivery status and add progress notes; use Save Progress and refresh to confirm the save. Available actions depend on your role, project assignment and current stage. Completed projects appear in History. A manager creates a delivery project from an approved opportunity.'
      : 'Managers and engineers use Project Delivery to manage approved work. As staff, open your own opportunity in My Opportunities to follow its progress. Alice cannot create a project or update delivery status for you.',
    benefits: manager
      ? 'Open Benefits Reporting and use Record Benefit. Choose a delivery project and enter the category, description, measurement, estimated and actual values, unit and date; notes are optional. Save Benefit records it, and Edit lets you update it. Keep different units separate when comparing totals. AI suggestions are drafts, not measured actual outcomes.'
      : engineer
        ? 'Engineers can read project benefits in Benefits Reporting and associated project details. Only managers can record or edit benefits. Alice cannot create or edit a benefit for you.'
        : 'Managers record estimated and actual benefits for delivery projects. Staff cannot access the benefits management screens. Alice cannot record benefits or expose another role\'s records in this conversation.',
    history: manager
      ? 'Open an opportunity to see its chronological activity history, including status changes, decisions, responsible users, dates and recorded reasons. Those entries are read-only. The separate History navigation page lists completed delivery projects.'
      : engineer
        ? 'The History navigation page lists completed delivery projects. Detailed opportunity audit history is manager-only. Alice does not retrieve historical records in this conversation.'
        : 'Open your own request in My Opportunities to see its saved details, status and decision feedback. The detailed opportunity audit-history endpoint is manager-only; Alice does not retrieve it for you.',
    catalogue: manager
      ? 'Catalogue management uses the protected API. There is currently no manager catalogue screen. Follow backend/ChatBot-setup.md to list, add, edit, verify or archive an entry. Check the description and access route first, and record the verification source. Draft and archived entries are not recommended. Do not put passwords or confidential data in public descriptions.'
      : 'Only a manager can maintain and verify the catalogue. The researcher supplies checked service descriptions and access instructions. Staff use the verified recommendations and can submit anyway; they do not need to verify entries themselves.',
    sign_in: 'Use the coursework application account and its locally configured password. These are separate from university passwords. Sign out using the top-bar button. Alice cannot reveal or reset passwords, session tokens or API keys. The backend operator keeps the Gemini key in private backend/.env; staff do not need a key to use the website.'
  };
  return { decision: 'help', helpTopic: topic, question: null, matches: [], canSubmit: true, message: messages[topic] };
}
