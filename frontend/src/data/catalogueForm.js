export function catalogueStatus(entry) {
  if (!entry.active) return "Archived";
  if (entry.verified) return "Verified";
  return "Draft";
}

export function cataloguePayload(form, pendingKeyword = "") {
  const keywords = form.keywords.map((word) => word.trim().toLowerCase()).filter(Boolean);
  const pending = pendingKeyword.trim().toLowerCase();
  if (pending) keywords.push(pending);
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    keywords: [...new Set(keywords)],
    href: form.href.trim() || null,
    accessInstructions: form.accessInstructions.trim() || null,
    visibility: form.visibility,
    active: Boolean(form.active),
    verified: Boolean(form.verified),
    verificationNotes: form.verificationNotes.trim() || null,
  };
}

export function catalogueProblems(payload) {
  const fields = {};
  if (!payload.name || [...payload.name].length > 120 || payload.name.includes("\0")) {
    fields.name = "Enter a name of 1 to 120 characters.";
  }
  if (!payload.description || [...payload.description].length > 2000 || payload.description.includes("\0")) {
    fields.description = "Enter a description of 1 to 2000 characters.";
  }
  if (payload.keywords.length > 20 || payload.keywords.some((word) => [...word].length > 50 || word.includes("\0"))) {
    fields.keywords = "Use up to 20 keywords, each of 1 to 50 characters.";
  }
  if (payload.href) {
    try {
      const url = new URL(payload.href);
      if (payload.href.length > 2000 || url.protocol !== "https:" || url.username || url.password || /[\s\x00-\x1f\x7f]/.test(payload.href)) {
        throw new Error("invalid");
      }
    } catch {
      fields.href = "Enter an HTTPS link without a username or password.";
    }
  }
  if (payload.accessInstructions && ([...payload.accessInstructions].length > 1000 || payload.accessInstructions.includes("\0"))) {
    fields.accessInstructions = "Use 1000 characters or fewer.";
  }
  if (!payload.href && !payload.accessInstructions && !fields.href) {
    fields.accessInstructions = "Add a link or say how to reach the service.";
  }
  if (!["all_users", "manager_only"].includes(payload.visibility)) {
    fields.visibility = "Choose who can see this.";
  }
  if (payload.verificationNotes && ([...payload.verificationNotes].length > 2000 || payload.verificationNotes.includes("\0"))) {
    fields.verificationNotes = "Use 2000 characters or fewer.";
  }
  if (payload.verified && !payload.verificationNotes) {
    fields.verificationNotes = "Record how you checked this service before verifying it.";
  }
  return fields;
}
