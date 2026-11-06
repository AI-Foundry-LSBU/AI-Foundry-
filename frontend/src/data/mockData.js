// Sample LSBU opportunities, projects and benefits used until the backend is connected.
export const initialOpportunities = [
  {
    id: "OPP-2025-018",
    title: "Student Enquiry Automation",
    department: "Student Services",
    submittedBy: "Sarah Smith",
    submittedDate: "14 May 2025",
    status: "Approved",
    priority: "High",
    category: "AI",
    problem: "The Student Services team responds manually to a high volume of repetitive questions across email and web forms, creating long response times during peak periods.",
    improvement: "Introduce an AI-assisted enquiry triage service that classifies requests, drafts approved responses and routes complex cases to the right team.",
    expectedBenefits: "Faster response times for students and fewer repetitive enquiries handled manually.",
    decisionReason: "Strong alignment with the student experience strategy and a clear opportunity to reduce repetitive work. Approved for a controlled pilot."
  },
  {
    id: "OPP-2025-021",
    title: "Attendance Reporting",
    department: "Academic Quality",
    submittedBy: "Sarah Smith",
    submittedDate: "28 May 2025",
    status: "Under Review",
    priority: "Medium",
    category: "Reporting",
    problem: "Attendance information is exported from several systems and combined manually each week.",
    improvement: "Create one automated attendance dashboard with scheduled exception reports for course teams."
  },
  {
    id: "OPP-2025-024",
    title: "Room Booking Improvement",
    department: "Estates & Facilities",
    submittedBy: "Sarah Smith",
    submittedDate: "6 Jun 2025",
    status: "Submitted",
    priority: "Not set",
    category: "Digital Improvement",
    problem: "Staff cannot easily identify suitable rooms or understand why booking requests have been declined.",
    improvement: "Provide a guided booking experience with live room attributes, availability and clear approval steps."
  },
  {
    id: "OPP-2025-012",
    title: "Research Contract Triage",
    department: "Research & Innovation",
    submittedBy: "Dr James Wilson",
    submittedDate: "22 Apr 2025",
    status: "Approved",
    priority: "High",
    category: "AI",
    problem: "Research contract reviews depend on manual categorisation and are delayed at busy points in the funding cycle.",
    improvement: "Use an assisted triage workflow to identify contract types, key clauses and the right legal review path.",
    decisionReason: "High strategic value and a well-defined discovery scope. Proceed to planning with Research & Innovation."
  },
  {
    id: "OPP-2025-009",
    title: "Invoice Exception Workflow",
    department: "Finance",
    submittedBy: "Priya Shah",
    submittedDate: "10 Apr 2025",
    status: "Approved",
    priority: "High",
    category: "Automation",
    problem: "Invoice exceptions are tracked through shared mailboxes and spreadsheets.",
    improvement: "Create a structured exception queue with ownership, alerts and management reporting."
  },
  {
    id: "OPP-2025-006",
    title: "Graduate Outcomes Data Check",
    department: "Careers & Employability",
    submittedBy: "Mark Lewis",
    submittedDate: "25 Mar 2025",
    status: "Approved",
    priority: "Medium",
    category: "Data",
    problem: "Data quality checks require repeated comparison of large exports.",
    improvement: "Automate matching and surface likely data quality issues for review."
  },
  {
    id: "OPP-2025-026",
    title: "Library Resource Recommendations",
    department: "Library & Learning Resources",
    submittedBy: "Emily Chen",
    submittedDate: "11 Jun 2025",
    status: "Submitted",
    priority: "Not set",
    category: "AI",
    problem: "Students find it difficult to discover resources relevant to their modules.",
    improvement: "Explore a transparent recommendation service using module reading lists and library metadata."
  },
  {
    id: "OPP-2025-004",
    title: "Visitor Parking Requests",
    department: "Estates & Facilities",
    submittedBy: "Robert Hall",
    submittedDate: "12 Mar 2025",
    status: "Rejected",
    priority: "Low",
    category: "Automation",
    problem: "Visitor parking requests are sent by email.",
    improvement: "Build a standalone request application.",
    decisionReason: "The expected volume and benefit do not currently justify a standalone solution. The process should first be considered within the existing facilities platform."
  }
];
export const initialProjects = [
  {
    id: "PRJ-014",
    opportunityId: "OPP-2025-018",
    title: "Student Enquiry Automation",
    department: "Student Services",
    description: "AI-assisted triage and response drafting for common student enquiries.",
    priority: "High",
    status: "In Progress",
    startDate: "3 Jun 2025",
    targetDate: "29 Aug 2025",
    progress: 68,
    notes: "The knowledge base is complete. A review with the Student Services team begins next week.",
    activity: [
      {
        date: "12 Jun 2025",
        author: "Alex Morgan",
        text: "Completed initial intent model and knowledge base review."
      },
      {
        date: "3 Jun 2025",
        author: "Olivia Bennett",
        text: "Project moved into active delivery."
      }
    ]
  },
  {
    id: "PRJ-015",
    opportunityId: "OPP-2025-012",
    title: "Research Contract Triage",
    department: "Research & Innovation",
    description: "Assisted triage for research contracts, clauses and legal review routes.",
    priority: "High",
    status: "Approved",
    startDate: "Not scheduled",
    targetDate: "Not scheduled",
    progress: 10,
    notes: "Awaiting discovery workshop with Research & Innovation.",
    activity: [
      {
        date: "9 Jun 2025",
        author: "Olivia Bennett",
        text: "Opportunity approved and added to Project Delivery."
      }
    ]
  },
  {
    id: "PRJ-011",
    opportunityId: "OPP-2025-009",
    title: "Invoice Exception Workflow",
    department: "Finance",
    description: "Structured workflow for invoice exceptions, ownership and reporting.",
    priority: "High",
    status: "Planned",
    startDate: "1 Jul 2025",
    targetDate: "30 Sep 2025",
    progress: 30,
    notes: "Technical design agreed; delivery starts in July.",
    activity: [
      {
        date: "5 Jun 2025",
        author: "Maya Patel",
        text: "Technical design reviewed with Finance systems team."
      }
    ]
  },
  {
    id: "PRJ-008",
    opportunityId: "OPP-2025-006",
    title: "Graduate Outcomes Data Check",
    department: "Careers & Employability",
    description: "Automated matching and quality checks for graduate outcomes data.",
    priority: "Medium",
    status: "Completed",
    startDate: "7 Apr 2025",
    targetDate: "30 May 2025",
    progress: 100,
    notes: "Solution deployed and handed over. Benefits monitoring is in progress.",
    activity: [
      {
        date: "30 May 2025",
        author: "Daniel Okoro",
        text: "Project completed and handed over to Careers & Employability."
      }
    ]
  }
];
export const initialBenefits = [
  {
    id: "BEN-001",
    projectId: "PRJ-008",
    project: "Graduate Outcomes Data Check",
    category: "Efficiency",
    description: "Reduced time spent comparing data exports.",
    measurement: "Staff hours saved per month",
    estimated: 28,
    actual: 31,
    unit: "Hours/month",
    date: "30 May 2025",
    notes: "Validated against the May processing cycle."
  },
  {
    id: "BEN-002",
    projectId: "PRJ-008",
    project: "Graduate Outcomes Data Check",
    category: "Data",
    description: "More records passing first-time validation.",
    measurement: "Records validated first time",
    estimated: 92,
    actual: 95,
    unit: "Percent",
    date: "30 May 2025",
    notes: "Measured from the first month after handover."
  },
  {
    id: "BEN-003",
    projectId: "PRJ-014",
    project: "Student Enquiry Automation",
    category: "Efficiency",
    description: "Projected reduction in repetitive enquiry handling.",
    measurement: "Staff hours saved per month",
    estimated: 40,
    actual: 35,
    unit: "Hours/month",
    date: "12 Jun 2025",
    notes: "Pilot measurement; review again after full rollout."
  },
  {
    id: "BEN-004",
    projectId: "PRJ-008",
    project: "Graduate Outcomes Data Check",
    category: "Financial",
    description: "Reduced temporary data processing support.",
    measurement: "Annual operating saving",
    estimated: 18000,
    actual: 16500,
    unit: "GBP/year",
    date: "2 Jun 2025",
    notes: "Annualised from confirmed staffing costs."
  }
];
