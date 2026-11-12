// The database role is authoritative; headers, form fields and browser state do not assign access.
export function canReadOpportunity(user, opportunity) {
  if (user.role === 'manager') return true;
  if (opportunity.submitted_by === user.id) return true;
  return user.role === 'team' && opportunity.status === 'approved';
}
