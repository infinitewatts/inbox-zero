export {
  addTrackingToEmail,
  parseRecipients,
  getTrackingStatus,
  createTrackingPixel,
  injectTrackingPixel,
  isTrackingEnabled,
} from "./tracker";

export type {
  CreatePixelResponse,
  TrackingStatus,
  TrackingRecipient,
} from "./types";
