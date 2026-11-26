const services = [
  {
    id: "moodle",
    name: "Moodle",
    description: "London South Bank University’s virtual learning environment. Module sites, lecture notes, assignments and class resources are published here.",
    href: "https://vle.lsbu.ac.uk",
    rules: [
      {
        when: /moodle|\bvle\b|virtual learning/,
        why: "Moodle is the university’s virtual learning environment."
      },
      {
        when: /lecture notes?|lecture slides?|lecture recordings?|lecture materials?|class notes?|seminar notes?|tutorial notes?|handouts?|teaching materials?|learning materials?|class resources?|course materials?|course content|module contents?|module materials?|module sites?|module pages?|coursework|assignments?/,
        why: "This is about course materials or teaching content, which is what Moodle is for."
      },
      {
        when: (value) => /\bmodules?\b|\bcoursework\b|\blectures?\b|\bseminars?\b|\btutorials?\b/.test(value) && /contents?|materials?|slides?|notes?|resources?|assignments?|coursework|upload|submit|hand in|find|where/.test(value),
        why: "This is about course materials or teaching content, which is what Moodle is for."
      },
      {
        when: /reading lists?/,
        why: "Reading lists for each module are published on Moodle."
      },
      {
        when: /submit (my |an |the )?(assignment|coursework|work)|upload (my |an |the )?(assignment|coursework)/,
        why: "Assignments and coursework are submitted through Moodle."
      }
    ]
  },
  {
    id: "mylsbu",
    name: "myLSBU",
    description: "The student portal and app for London South Bank University. Students use it for their timetable, to check in to class, and to see their attendance.",
    href: "https://my.lsbu.ac.uk",
    rules: [
      {
        when: (value) => !/spreadsheet|retyp|placement/.test(value) && (/check[-\s]?in|checked in|marked absent|was absent|register( my)? attendance/.test(value) || (/attendance/.test(value) && /check|see|view|find|show|where|app|record|history|score|my/.test(value))),
        why: "Students check in and see their own attendance in the myLSBU app."
      },
      {
        when: /mylsbu|my lsbu|student portal|student app/,
        why: "This is about the student portal, which is myLSBU."
      },
      {
        when: /\btimetables?\b|class schedules?|class times?|lecture times?|what time is my|when is my (lecture|class|seminar|tutorial)|where is my (lecture|class|seminar|tutorial|room)|which room|what room/,
        why: "This is about a student’s timetable, which myLSBU already shows."
      },
      {
        when: /campus maps?|where is the (cafe|caf[eé]|library|help desk)|study rooms?|group study rooms?|book a (study |group )?room|key dates|academic calendars?/,
        why: "myLSBU already includes this, including the campus map, key dates and group study rooms."
      }
    ]
  },
  {
    id: "myaccount",
    name: "MyAccount",
    description: "London South Bank University’s enquiry service. Students use the My Attendance page for their engagement score and absence form, and they raise questions about finance, wellbeing, the library, IT and courses.",
    href: "https://myaccount.lsbu.ac.uk",
    rules: [
      {
        when: (value) => !/spreadsheet|retyp|placement/.test(value) && (/engagement score|absence form|marked absent|was absent/.test(value) || (/attendance|\babsence\b/.test(value) && /check|see|view|find|show|where|record|history|score|app|page|form|my|absent/.test(value))),
        why: "The My Attendance page in MyAccount shows the engagement score and the absence form."
      },
      {
        when: /myaccount|my account/,
        why: "This names MyAccount, the university’s enquiry service."
      },
      {
        when: (value) => /enquir|questions?|quer(y|ies)|ask about|appointments?|talk to|speak to|support|help with/.test(value) && /students?|finance|fees?|tuition|invoices?|payments?|well-?\s?being|mental health|disabilit|dyslexia|accommodation|library|courses?|personal tutors?/.test(value),
        why: "This is a student enquiry or appointment, which MyAccount already records and tracks."
      },
      {
        when: /tuition|\bfees?\b|student finance|well-?\s?being|mental health|disabilit|dyslexia|student accommodation/,
        why: "Questions about fees, wellbeing and student support are raised in MyAccount."
      }
    ]
  },
  {
    id: "careers",
    name: "LSBU Careers Hub",
    description: "The careers service for London South Bank University students, graduates and staff. It lists jobs, placements and employability support.",
    href: "https://careershub.lsbu.ac.uk",
    rules: [
      {
        when: /careers hub|careershub|employability|\bcareers?\b|\bjobs?\b|\bvacanc(y|ies)\b|job vacanc(y|ies)|graduate (jobs?|roles?|schemes?)|part[- ]time (jobs?|work)|\binternships?\b|\bcv\b|curriculum vitae|\binterviews?\b/,
        why: "This is about careers, jobs or employability, which Careers Hub already handles."
      },
      {
        when: (value) => /\bplacements?\b|\bwork experience\b/.test(value) && /find|search|looking|apply|student|opportunit|want|need|help/.test(value) && !/attendance|spreadsheet|hours|retyp/.test(value),
        why: "This is about finding a placement, which Careers Hub already lists."
      }
    ]
  },
  {
    id: "it",
    name: "IT Services",
    description: "London South Bank University IT support. Students and staff report passwords, Wi-Fi, printing, software and classroom audio-visual faults here. On the Connect staff intranet, search for “IT support” to open the TOPdesk portal.",
    href: "https://www.lsbu.ac.uk/about-us/professional-services/it",
    rules: [
      {
        when: /topdesk|it services|it support|passwords?|wi-?\s?fi|eduroam|projectors?|audio-visual|printers?|printing|\bprints?\b|(log|sign)[ -]?in|cannot (log|sign) in|can not (log|sign) in|forgot my (passwords?|login)|locked out|laptops?|appsanywhere|one ?drive|microsoft 365|office 365/,
        why: "This is an IT or classroom technology problem, which IT Services already supports."
      },
      {
        when: (value) => /software|computers?|screens?|microphones?|speakers?/.test(value) && /install|broken|not working|does not work|doesn't work|doesnt work|fault|error|down|won.?t/.test(value),
        why: "This is an IT or classroom technology fault, which IT Services already supports."
      }
    ]
  },
  {
    id: "library",
    name: "LSBU Library",
    description: "London South Bank University’s library. Staff and students search here for books, e-books, journals and articles, and for referencing and study help.",
    href: "https://library.lsbu.ac.uk",
    rules: [
      {
        when: /\blibrary\b|skills for success/,
        why: "This is about library resources or study support, which the Library already provides."
      },
      {
        when: (value) => /\be-?\s?books?\b|\btextbooks?\b|\bbooks\b|\bjournals?\b|\barticles?\b|\bpapers?\b|referenc|reading lists?|\bborrow\b|on loan|catalogues?|catalogs?/.test(value)
          || (/\bbook\b/.test(value) && !/\bbook (a|an|the|my|our|your)\b/.test(value)),
        why: "This is about finding books, journals or articles, which the Library already provides."
      }
    ]
  }
];

export function greetingMessage() {
  return {
    id: "greeting",
    role: "assistant",
    kind: "greeting",
    text: "Hey, I'm Alice, the AI assistant. How can I help today?"
  };
}

function matchesRule(value, when) {
  return typeof when === "function" ? when(value) : when.test(value);
}

export function cardsFor(matches) {
  const reasons = new Map((Array.isArray(matches) ? matches : []).map((match) => [match.id, match.reason]));
  return services.flatMap((service) => {
    if (!reasons.has(service.id)) return [];
    const { rules, ...details } = service;
    return [{ ...details, reason: reasons.get(service.id) }];
  });
}

function findServices(text) {
  const value = text.toLowerCase();
  return services.flatMap((service) => {
    const rule = service.rules.find((item) => matchesRule(value, item.when));
    if (!rule) return [];
    const { rules, ...details } = service;
    return [{ ...details, reason: rule.why }];
  });
}

function isVague(text) {
  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 4) return true;
  return /^(hi|hello|help|please help|i need help|improve|improvement|problem|something|not sure|idea)\b/.test(text.trim().toLowerCase());
}

function rejectsSuggestions(text) {
  return /none of these|not these|does not cover|doesn't cover|do not cover|don't cover|still need|not what i|something else|no suitable/.test(text.toLowerCase());
}

export function replyTo(messages, input) {
  const text = input.trim();
  const showedSolutions = messages.some((message) => message.solutions?.length);
  const last = [...messages].reverse().find((message) => message.role === "assistant");
  if ((showedSolutions || last?.kind === "clarify") && rejectsSuggestions(text)) {
    return {
      kind: "none",
      text: "Those London South Bank University services do not cover this. Continue to the form and describe what is still missing."
    };
  }
  const matches = findServices(text);
  if (matches.length) {
    return {
      kind: "found",
      text: matches.length === 1
        ? "London South Bank University already has a service that may cover this."
        : "London South Bank University already has services that may cover this.",
      solutions: matches
    };
  }
  if (last?.kind !== "clarify" && isVague(text)) {
    return {
      kind: "clarify",
      text: "What happens in the work at London South Bank University today, and who does it?"
    };
  }
  return {
    kind: "none",
    text: "I could not find an existing London South Bank University service for that. You can submit an opportunity and the AI Foundry team will review it."
  };
}
