export const statusColors: Record<string, string> = {
  // LOI statuses
  loi_filed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  loi_expired: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300",
  loi_batching: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  // Application review
  application_filed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  under_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  incomplete: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  pending_decision: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  // DET lifecycle
  request_filed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  determination_issued: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  // Appeal stages
  appeal_filed: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  appeal_hearing_pending: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  appeal_decided: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  // Terminal
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  denied: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  withdrawn: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300",
  closed: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300",
};

export const typeColors: Record<string, string> = {
  con: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  det: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  det_eqt: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  det_asc: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

export const typeLabels: Record<string, string> = {
  con: "CON",
  det: "DET",
  det_eqt: "DET-EQT",
  det_asc: "DET-ASC",
};

export function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export function formatType(type: string): string {
  return typeLabels[type] || type.toUpperCase();
}

export function getDeadlineUrgencyColor(daysRemaining: number): string {
  if (daysRemaining < 0) return "text-gray-500";
  if (daysRemaining < 3) return "text-red-600 dark:text-red-400";
  if (daysRemaining < 7) return "text-orange-600 dark:text-orange-400";
  if (daysRemaining < 14) return "text-yellow-600 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}

export function getDaysRemaining(dueDate: string | Date): number {
  const due = new Date(dueDate);
  const now = new Date();
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
