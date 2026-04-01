import { db } from "../db";
import { storage } from "../storage";
import {
  clients,
  proceedings,
  proximityAlerts,
  notifications,
} from "@shared/schema";
import { users } from "@shared/models/auth";
import { eq, and, isNotNull, ne } from "drizzle-orm";

const EARTH_RADIUS_MILES = 3958.8;

/**
 * Haversine formula to calculate the distance in miles between two lat/lng points.
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_MILES * c;
}

/**
 * Recalculates proximity alerts between clients and proceedings.
 *
 * If `proceedingId` is provided, checks only that proceeding against all active clients.
 * If omitted, clears all existing alerts and rebuilds from scratch.
 */
export async function recalculateProximityAlerts(
  proceedingId?: number
): Promise<void> {
  try {
    // Fetch active clients with geolocation data
    const activeClients = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.isActive, true),
          isNotNull(clients.latitude),
          isNotNull(clients.longitude)
        )
      );

    if (activeClients.length === 0) {
      console.log("[proximity-calculator] No active clients with geolocation found. Skipping.");
      return;
    }

    let targetProceedings;

    if (proceedingId) {
      // Check only the specified proceeding
      targetProceedings = await db
        .select()
        .from(proceedings)
        .where(
          and(
            eq(proceedings.id, proceedingId),
            isNotNull(proceedings.latitude),
            isNotNull(proceedings.longitude)
          )
        );
    } else {
      // Full rebuild: clear existing alerts first
      await db.delete(proximityAlerts);

      // Fetch all proceedings with geolocation data
      targetProceedings = await db
        .select()
        .from(proceedings)
        .where(
          and(
            isNotNull(proceedings.latitude),
            isNotNull(proceedings.longitude)
          )
        );
    }

    let alertsCreated = 0;
    let notificationsCreated = 0;

    for (const proc of targetProceedings) {
      if (proc.latitude === null || proc.longitude === null) {
        continue;
      }

      for (const client of activeClients) {
        if (client.latitude === null || client.longitude === null) {
          continue;
        }

        const distance = haversineDistance(
          client.latitude,
          client.longitude,
          proc.latitude,
          proc.longitude
        );

        if (distance <= client.monitoringRadiusMiles) {
          try {
            // Upsert the proximity alert (insert on conflict do nothing via unique index)
            await db
              .insert(proximityAlerts)
              .values({
                clientId: client.id,
                proceedingId: proc.id,
                distanceMiles: Math.round(distance * 100) / 100,
              })
              .onConflictDoNothing();

            alertsCreated++;

            // Generate notifications for team members if this is a new single-proceeding check
            if (proceedingId) {
              const teamUsers = await db
                .select()
                .from(users)
                .where(eq(users.teamId, client.teamId));

              for (const user of teamUsers) {
                try {
                  await db.insert(notifications).values({
                    userId: user.id,
                    proceedingId: proc.id,
                    notificationType: "new_filing_nearby",
                    title: `New filing near ${client.name}`,
                    message: `A new proceeding (${proc.caseNumber} - ${proc.title}) was filed ${distance.toFixed(1)} miles from ${client.name} in ${proc.county} County.`,
                    read: false,
                    emailSent: false,
                  });
                  notificationsCreated++;
                } catch (err) {
                  console.error(
                    `[proximity-calculator] Failed to notify user ${user.id} for client ${client.id}:`,
                    err
                  );
                }
              }
            }
          } catch (err) {
            console.error(
              `[proximity-calculator] Failed to create alert for client ${client.id}, proceeding ${proc.id}:`,
              err
            );
          }
        }
      }
    }

    console.log(
      `[proximity-calculator] Completed: ${targetProceedings.length} proceedings checked against ${activeClients.length} clients. ` +
        `Created ${alertsCreated} alerts, ${notificationsCreated} notifications.`
    );
  } catch (err) {
    console.error("[proximity-calculator] Fatal error during recalculation:", err);
    throw err;
  }
}
