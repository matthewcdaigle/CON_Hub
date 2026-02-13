import type { Docket } from "@shared/schema";

export const statusColors: Record<string, string> = {
  pre_filing: "bg-muted text-muted-foreground",
  filed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  under_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  hearing_scheduled: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  hearing_complete: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  decision_pending: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  denied: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  withdrawn: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300",
  appealed: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
};

export function formatStatus(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}
