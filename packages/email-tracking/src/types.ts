export interface CreatePixelResponse {
  pixelId: string;
  pixelUrl: string;
  pixelHtml: string;
}

export interface TrackingRecipient {
  recipient: string;
  pixelId: string;
  sentAt: string;
  opened: boolean;
  openCount: number;
  firstOpened: string | null;
  lastOpened: string | null;
}

export interface TrackingStatus {
  emailId: string;
  recipients: TrackingRecipient[];
}
