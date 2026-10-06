/** Mirrors SchoolPaymentGatewayResponse — non-secret facts only; secrets never reach the browser. */
export type PaymentGatewayStatus = 'PENDING' | 'ACTIVE' | 'RETIRED' | 'REJECTED';

/** Where a school's online fee payments go right now (OnlinePaymentRoutingService.RouteType). */
export type OnlinePaymentRoute = 'SCHOOL_GATEWAY' | 'PLATFORM_FALLBACK' | 'UNAVAILABLE';

export interface SchoolPaymentGateway {
  id: number;
  schoolId: number;
  schoolName: string | null;
  provider: string;
  maskedKeyId: string;
  liveMode: boolean;
  status: PaymentGatewayStatus;
  submittedBy: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  activatedAt: string | null;
  activatedBy: string | null;
  retiredAt: string | null;
  rejectedAt: string | null;
  statusReason: string | null;
  lastWebhookAt: string | null;
  /** Only present for the owning school's admin. */
  webhookUrl: string | null;
}

export interface SchoolPaymentGatewayOverview {
  route: OnlinePaymentRoute;
  platformFallbackUntil: string | null;
  requireLiveKeys: boolean;
  encryptionConfigured: boolean;
  requiredWebhookEvents: string[];
  gateways: SchoolPaymentGateway[];
}

export interface SchoolPaymentGatewaySubmitRequest {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  currentPassword: string;
}
