import { db } from "../db";
import { notifications, proceedings } from "@shared/schema";
import { users } from "@shared/models/auth";
import { eq, and, inArray } from "drizzle-orm";

interface DigestEntry {
  id: number;
  title: string;
  message: string;
  notificationType: string;
  caseNumber?: string;
  createdAt: Date;
}

interface UserDigest {
  userId: string;
  email: string;
  firstName: string | null;
  entries: DigestEntry[];
}

/**
 * Sends a daily email digest of unread, un-emailed notifications to each user.
 * Designed to be called once per day via scheduler.
 */
export async function sendDailyDigest(): Promise<void> {
  try {
    // Find all unread notifications that haven't been emailed yet
    const pendingNotifications = await db
      .select({
        notification: notifications,
        user: users,
        proceeding: proceedings,
      })
      .from(notifications)
      .innerJoin(users, eq(notifications.userId, users.id))
      .leftJoin(proceedings, eq(notifications.proceedingId, proceedings.id))
      .where(
        and(
          eq(notifications.read, false),
          eq(notifications.emailSent, false)
        )
      );

    if (pendingNotifications.length === 0) {
      console.log("[email-digest] No pending notifications to digest.");
      return;
    }

    // Group notifications by user
    const digestsByUser = new Map<string, UserDigest>();

    for (const row of pendingNotifications) {
      const { notification, user, proceeding } = row;

      if (!user.email) {
        continue;
      }

      if (!digestsByUser.has(user.id)) {
        digestsByUser.set(user.id, {
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          entries: [],
        });
      }

      digestsByUser.get(user.id)!.entries.push({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        notificationType: notification.notificationType,
        caseNumber: proceeding?.caseNumber ?? undefined,
        createdAt: notification.createdAt,
      });
    }

    let emailsSent = 0;
    let notificationsMarked = 0;

    for (const digest of Array.from(digestsByUser.values())) {
      try {
        const emailBody = composeDigestEmail(digest);

        // Send the email via the notification/email service
        // In production this would call an actual email provider (SendGrid, SES, etc.)
        await sendEmail({
          to: digest.email,
          subject: `CON Hub Daily Digest - ${digest.entries.length} notification${digest.entries.length === 1 ? "" : "s"}`,
          html: emailBody,
        });

        emailsSent++;

        // Mark all notifications in this digest as emailSent
        const notificationIds = digest.entries.map((e) => e.id);
        await db
          .update(notifications)
          .set({ emailSent: true })
          .where(inArray(notifications.id, notificationIds));

        notificationsMarked += notificationIds.length;
      } catch (err) {
        console.error(
          `[email-digest] Failed to send digest to ${digest.email}:`,
          err
        );
      }
    }

    console.log(
      `[email-digest] Completed: sent ${emailsSent} digest emails covering ${notificationsMarked} notifications.`
    );
  } catch (err) {
    console.error("[email-digest] Fatal error during daily digest:", err);
    throw err;
  }
}

/**
 * Composes an HTML email body from a user's digest entries.
 */
function composeDigestEmail(digest: UserDigest): string {
  const greeting = digest.firstName
    ? `Hi ${digest.firstName},`
    : "Hello,";

  const rows = digest.entries
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((entry) => {
      const caseRef = entry.caseNumber
        ? ` <span style="color:#666;">(${entry.caseNumber})</span>`
        : "";
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">
            <strong>${escapeHtml(entry.title)}</strong>${caseRef}<br/>
            <span style="color:#555;font-size:14px;">${escapeHtml(entry.message)}</span>
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#888;font-size:13px;white-space:nowrap;">
            ${entry.createdAt.toLocaleDateString()}
          </td>
        </tr>`;
    })
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
      <h2 style="color:#1a365d;">CON Hub Daily Digest</h2>
      <p>${greeting}</p>
      <p>You have <strong>${digest.entries.length}</strong> unread notification${digest.entries.length === 1 ? "" : "s"}:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        ${rows}
      </table>
      <p style="margin-top:24px;">
        <a href="${process.env.APP_URL || "https://conhub.app"}/notifications"
           style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
          View All Notifications
        </a>
      </p>
      <p style="color:#999;font-size:12px;margin-top:32px;">
        You are receiving this because you have unread notifications in CON Hub.
        Manage your notification preferences in your account settings.
      </p>
    </div>
  `;
}

/**
 * Escapes HTML special characters to prevent XSS in email content.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Sends an email. This is a placeholder that should be replaced with your
 * actual email provider integration (e.g., SendGrid, AWS SES, Resend).
 */
async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  // TODO: Replace with actual email service integration
  // Example with SendGrid:
  //   await sgMail.send({ to: options.to, from: 'noreply@conhub.app', subject: options.subject, html: options.html });
  //
  // Example with AWS SES:
  //   await ses.sendEmail({ Destination: { ToAddresses: [options.to] }, Message: { Subject: { Data: options.subject }, Body: { Html: { Data: options.html } } }, Source: 'noreply@conhub.app' }).promise();

  console.log(
    `[email-digest] Email queued for ${options.to}: "${options.subject}"`
  );
}
