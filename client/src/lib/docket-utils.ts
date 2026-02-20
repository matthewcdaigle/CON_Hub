import type { Docket } from "@shared/schema";

export const statusColors: Record<string, string> = {
  // LOI statuses
  loi_filed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  loi_expired: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300",
  loi_converted: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  // Primary review
  filed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  under_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  desk_determination_issued: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  // Appeal stages
  appeal_hearing_officer_pending: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  appeal_hearing_officer_decided: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  appeal_con_panel_pending: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  appeal_con_panel_decided: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  appeal_superior_court_pending: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  appeal_superior_court_decided: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  appeal_court_of_appeals_pending: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  appeal_court_of_appeals_decided: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  appeal_supreme_court_pending: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  appeal_supreme_court_decided: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  // Terminal
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  denied: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  withdrawn: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300",
  closed: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300",
};

export function formatStatus(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}
