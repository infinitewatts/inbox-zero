/**
 * Email Tracking Pixel Integration
 *
 * Integrates with the email-tracker server to:
 * 1. Create unique tracking pixels for each email/recipient
 * 2. Inject tracking pixels into outgoing email HTML
 * 3. Query tracking status for sent emails
 */

import { nanoid } from "nanoid";
import type { CreatePixelResponse, TrackingStatus } from "./types";

// Configuration via environment variables
const getTrackerUrl = () =>
  process.env.EMAIL_TRACKER_API_URL || "http://localhost:3001";

export const isTrackingEnabled = () =>
  process.env.EMAIL_TRACKING_ENABLED === "true";

/**
 * Create a tracking pixel for an email recipient
 */
export async function createTrackingPixel(
  emailId: string,
  recipient: string,
  subject: string
): Promise<CreatePixelResponse | null> {
  if (!isTrackingEnabled()) {
    return null;
  }

  try {
    const response = await fetch(`${getTrackerUrl()}/api/pixels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailId, recipient, subject }),
    });

    if (!response.ok) {
      console.error(
        `[email-tracking] Failed to create pixel: ${response.status}`
      );
      return null;
    }

    return (await response.json()) as CreatePixelResponse;
  } catch (error) {
    console.error("[email-tracking] Error creating pixel:", error);
    return null;
  }
}

/**
 * Inject tracking pixel HTML into email body
 */
export function injectTrackingPixel(html: string, pixelHtml: string): string {
  // Inject before </body>
  if (html.includes("</body>")) {
    return html.replace("</body>", `${pixelHtml}</body>`);
  }

  // Inject before </html>
  if (html.includes("</html>")) {
    return html.replace("</html>", `${pixelHtml}</html>`);
  }

  // Append at end
  return html + pixelHtml;
}

/**
 * Parse recipients from to/cc/bcc strings
 */
export function parseRecipients(
  to: string,
  cc?: string,
  bcc?: string
): string[] {
  const recipients: string[] = [];

  const parseField = (field: string | undefined) => {
    if (!field) return;
    const emails = field.split(",").map((e) => {
      const match = e.match(/<([^>]+)>/);
      return match ? match[1].trim() : e.trim();
    });
    recipients.push(...emails.filter((e) => e && e.includes("@")));
  };

  parseField(to);
  parseField(cc);
  parseField(bcc);

  return [...new Set(recipients)];
}

/**
 * Add tracking to email HTML
 * Generates unique ID, creates pixel, injects into HTML
 */
export async function addTrackingToEmail(
  html: string,
  recipients: string[],
  subject: string
): Promise<{ html: string; emailId: string }> {
  const emailId = nanoid(16);

  if (!isTrackingEnabled() || recipients.length === 0) {
    return { html, emailId };
  }

  // Create pixel for primary recipient
  const pixel = await createTrackingPixel(emailId, recipients[0], subject);

  if (!pixel) {
    return { html, emailId };
  }

  // Create pixels for additional recipients (for per-recipient tracking)
  for (let i = 1; i < recipients.length; i++) {
    await createTrackingPixel(emailId, recipients[i], subject);
  }

  return {
    html: injectTrackingPixel(html, pixel.pixelHtml),
    emailId,
  };
}

/**
 * Get tracking status for an email
 */
export async function getTrackingStatus(
  emailId: string
): Promise<TrackingStatus | null> {
  if (!isTrackingEnabled()) {
    return null;
  }

  try {
    const response = await fetch(
      `${getTrackerUrl()}/api/status/${encodeURIComponent(emailId)}`
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as TrackingStatus;
  } catch {
    return null;
  }
}
