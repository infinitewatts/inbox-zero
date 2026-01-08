import { env } from "@/env";
import prisma from "@/utils/prisma";
import type { Logger } from "@/utils/logger";
import {
  getCalendarOAuth2Client,
  fetchGoogleCalendars,
  getCalendarClientWithRefresh,
} from "@/utils/calendar/client";
import type { CalendarOAuthProvider, CalendarTokens } from "../oauth-types";
import { autoPopulateTimezone } from "../timezone-helpers";

export function createGoogleCalendarProvider(
  logger: Logger,
): CalendarOAuthProvider {
  return {
    name: "google",

    async exchangeCodeForTokens(code: string): Promise<CalendarTokens> {
      const googleAuth = getCalendarOAuth2Client();

      logger.info("Exchanging OAuth code for tokens");

      let tokens;
      try {
        const result = await googleAuth.getToken(code);
        tokens = result.tokens;
      } catch (error) {
        logger.error("Failed to exchange code for tokens", {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }

      const { id_token, access_token, refresh_token, expiry_date } = tokens;

      logger.info("Token exchange result", {
        hasIdToken: !!id_token,
        hasAccessToken: !!access_token,
        hasRefreshToken: !!refresh_token,
      });

      if (!id_token) {
        throw new Error("Missing id_token from Google response");
      }

      if (!access_token || !refresh_token) {
        throw new Error("No refresh_token returned from Google");
      }

      const ticket = await googleAuth.verifyIdToken({
        idToken: id_token,
        audience: env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();

      if (!payload?.email) {
        throw new Error("Could not get email from ID token");
      }

      return {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: expiry_date ? new Date(expiry_date) : null,
        email: payload.email,
      };
    },

    async syncCalendars(
      connectionId: string,
      accessToken: string,
      refreshToken: string,
      emailAccountId: string,
      expiresAt: Date | null,
    ): Promise<void> {
      try {
        const calendarClient = await getCalendarClientWithRefresh({
          accessToken,
          refreshToken,
          expiresAt: expiresAt?.getTime() ?? null,
          emailAccountId,
          logger,
        });

        const googleCalendars = await fetchGoogleCalendars(
          calendarClient,
          logger,
        );

        for (const googleCalendar of googleCalendars) {
          if (!googleCalendar.id) continue;

          await prisma.calendar.upsert({
            where: {
              connectionId_calendarId: {
                connectionId,
                calendarId: googleCalendar.id,
              },
            },
            update: {
              name: googleCalendar.summary || "Untitled Calendar",
              description: googleCalendar.description,
              timezone: googleCalendar.timeZone,
            },
            create: {
              connectionId,
              calendarId: googleCalendar.id,
              name: googleCalendar.summary || "Untitled Calendar",
              description: googleCalendar.description,
              timezone: googleCalendar.timeZone,
              isEnabled: true,
            },
          });
        }

        await autoPopulateTimezone(emailAccountId, googleCalendars, logger);
      } catch (error) {
        logger.error("Error syncing calendars", { error, connectionId });
        await prisma.calendarConnection.update({
          where: { id: connectionId },
          data: { isConnected: false },
        });
        throw error;
      }
    },
  };
}
