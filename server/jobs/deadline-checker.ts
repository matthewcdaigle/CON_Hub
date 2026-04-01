import { db } from "../db";
import {
  deadlines,
  subscriptions,
  notifications,
  proceedings,
} from "@shared/schema";
import { eq, and, gt, lte, ne } from "drizzle-orm";

/**
 * Checks all non-completed deadlines for approaching due dates and generates
 * notifications for subscribed users. Designed to run on a schedule (e.g. daily).
 */
export async function checkDeadlines(): Promise<void> {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Fetch all non-completed deadlines that haven't passed yet
    const activeDeadlines = await db
      .select()
      .from(deadlines)
      .where(
        and(
          eq(deadlines.isCompleted, false),
          gt(deadlines.dueDate, now)
        )
      );

    let notificationsCreated = 0;

    for (const deadline of activeDeadlines) {
      const reminderWindows = deadline.reminderDaysBefore;
      if (!reminderWindows || reminderWindows.length === 0) {
        continue;
      }

      const dueDate = new Date(deadline.dueDate);
      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check if the current day falls within any reminder window
      const matchedWindow = reminderWindows.find(
        (days) => days !== null && daysUntilDue <= days && daysUntilDue > 0
      );

      if (matchedWindow === undefined || matchedWindow === null) {
        continue;
      }

      // Find the proceeding details for the notification message
      const [proc] = await db
        .select()
        .from(proceedings)
        .where(eq(proceedings.id, deadline.proceedingId))
        .limit(1);

      if (!proc) {
        continue;
      }

      // Find users subscribed to this proceeding
      const subscribedUsers = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.proceedingId, deadline.proceedingId),
            eq(subscriptions.subscriptionType, "proceeding"),
            eq(subscriptions.inAppAlerts, true)
          )
        );

      for (const sub of subscribedUsers) {
        try {
          // Check for duplicate notification within the last 24 hours
          const existingNotifications = await db
            .select({ id: notifications.id })
            .from(notifications)
            .where(
              and(
                eq(notifications.userId, sub.userId),
                eq(notifications.proceedingId, deadline.proceedingId),
                eq(notifications.notificationType, "deadline_approaching"),
                gt(notifications.createdAt, twentyFourHoursAgo)
              )
            )
            .limit(1);

          if (existingNotifications.length > 0) {
            continue;
          }

          // Create the notification
          await db.insert(notifications).values({
            userId: sub.userId,
            proceedingId: deadline.proceedingId,
            subscriptionId: sub.id,
            notificationType: "deadline_approaching",
            title: `Deadline approaching: ${deadline.title}`,
            message: `The deadline "${deadline.title}" for ${proc.caseNumber} - ${proc.title} is due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"} (${dueDate.toLocaleDateString()}).`,
            read: false,
            emailSent: false,
          });

          notificationsCreated++;
        } catch (err) {
          console.error(
            `Failed to create deadline notification for user ${sub.userId}, deadline ${deadline.id}:`,
            err
          );
        }
      }
    }

    console.log(
      `[deadline-checker] Completed: checked ${activeDeadlines.length} deadlines, created ${notificationsCreated} notifications.`
    );
  } catch (err) {
    console.error("[deadline-checker] Fatal error during deadline check:", err);
    throw err;
  }
}
