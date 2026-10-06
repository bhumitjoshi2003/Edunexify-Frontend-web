/**
 * Backend-authoritative checkout quote — mirrors CheckoutQuoteDto on the Spring Boot side.
 * All money fields are paise-native and server-computed; Angular must only format them for
 * display, never recompute. Internal gateway/Edunexify component fields are never exposed
 * here (schoolFeePaise + onlineConvenienceFeePaise is the parent-facing breakdown; the
 * component split behind onlineConvenienceFeePaise stays server-side). A non-empty
 * unresolvedMonths means the quote is partial (one or more selected months' fee couldn't be
 * confidently determined) — the caller must not treat totalPayablePaise as covering those
 * months.
 */
export interface CheckoutQuote {
  studentId: string;
  session: string;
  months: number[];
  schoolFeePaise: number;
  onlineConvenienceFeePaise: number;
  totalPayablePaise: number;
  currency: string;
  /** Itemized breakdown lines (paise) — legitimate to show a parent, unlike the gateway/
   * Edunexify component split inside onlineConvenienceFeePaise, which is never exposed. */
  additionalChargesPaise: number;
  lateFeePaise: number;
  unresolvedMonths: number[];
  /** false = the school has no ACTIVE own payment gateway and no platform fallback, so online
   * payment can't be taken (fees are shown but only payable offline). Absent/null for ADMIN quotes. */
  onlinePaymentAvailable?: boolean | null;
}
