/**
 * Notification service for creating and dispatching in-app and email notifications.
 */

import nodemailer from "nodemailer";
import { db } from "../db";
import {
  notifications,
  subscriptions,
  type InsertNotification,
} from "@shared/schema";
import { users } from "@shared/models/auth";
import { eq, and } from "drizzle-orm";

// ===================== Email Transport =====================

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

function isEmailConfigured(): boolean {
  return !!(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!isEmailConfigured()) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST!,
      port: parseInt(SMTP_PORT!, 10),
      secure: parseInt(SMTP_PORT!, 10) === 465,
      auth: {
        user: SMTP_USER!,
        pass: SMTP_PASS!,
      },
    });
  }
  return transporter;
}

// ===================== In-App Notifications =====================

/**
 * Create an in-app notification for a specific user.
 */
export async function createNotificationForUser(
  userId: string,
  data: {
    notificationType: InsertNotification["notificationType"];
    title: string;
    message: string;
    proceedingId?: number | null;
    subscriptionId?: number | null;
  }
) {
  const [notification] = await db
    .insert(notifications)
    .values({
      userId,
      notificationType: data.notificationType,
      title: data.title,
      message: data.message,
      proceedingId: data.proceedingId ?? null,
      subscriptionId: data.subscriptionId ?? null,
      read: false,
      emailSent: false,
    })
    .returning();

  return notification;
}

/**
 * Find all users subscribed to a proceeding and create notifications for each.
 * Also sends email notifications to users who have email alerts enabled.
 */
export async function notifySubscribers(
  proceedingId: number,
  notificationType: InsertNotification["notificationType"],
  title: string,
  message: string
) {
  // Find all subscriptions for this proceeding (type = 'proceeding')
  const subs = await db
    .select({
      subscriptionId: subscriptions.id,
      userId: subscriptions.userId,
      emailAlerts: subscriptions.emailAlerts,
      inAppAlerts: subscriptions.inAppAlerts,
    })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.proceedingId, proceedingId),
        eq(subscriptions.subscriptionType, "proceeding")
      )
    );

  const created: Array<typeof notifications.$inferSelect> = [];

  for (const sub of subs) {
    // Create in-app notification if enabled
    if (sub.inAppAlerts) {
      const notification = await createNotificationForUser(sub.userId, {
        notificationType,
        title,
        message,
        proceedingId,
        subscriptionId: sub.subscriptionId,
      });
      created.push(notification);
    }

    // Send email if enabled
    if (sub.emailAlerts) {
      try {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, sub.userId))
          .limit(1);

        if (user?.email) {
          const emailSent = await sendEmailNotification(
            user.email,
            title,
            message
          );

          // Mark the notification as email_sent if we created one and email succeeded
          if (emailSent && created.length > 0) {
            const last = created[created.length - 1];
            await db
              .update(notifications)
              .set({ emailSent: true })
              .where(eq(notifications.id, last.id));
          }
        }
      } catch (error) {
        console.error(
          `Failed to send email notification to user ${sub.userId}:`,
          error
        );
      }
    }
  }

  return created;
}

// ===================== Email Notifications =====================

/**
 * Send an email notification via nodemailer.
 * Gracefully returns false if SMTP is not configured.
 */
export async function sendEmailNotification(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) {
    console.warn(
      "Email not sent: SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS environment variables."
    );
    return false;
  }

  try {
    await transport.sendMail({
      from: SMTP_USER,
      to,
      subject,
      text: body,
      html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a365d;">${subject}</h2>
        <div style="color: #333; line-height: 1.6;">${body.replace(/\n/g, "<br>")}</div>
        <hr style="margin-top: 2em; border-color: #e2e8f0;" />
        <p style="color: #718096; font-size: 0.85em;">
          Georgia CON Hub - Certificate of Need Monitoring
        </p>
      </div>`,
    });

    return true;
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    return false;
  }
}
