import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PaymentData } from '../interfaces/payment-data';
import { environment } from '../../environments/environment';

export interface RazorpayOrderResponse {
  razorpayKey: string;
  /** Razorpay Checkout display name, chosen server-side from trusted data: the school's own name
   * on its own gateway, Edunexify on the platform account. */
  checkoutName?: string;
  /** Paise — the actual Razorpay order amount, freshly computed at order-creation time from
   * the CURRENTLY effective payment pricing (never the earlier checkout-quote figure). This is
   * what the Razorpay widget itself displays and charges — the true final confirmation. */
  amount: number;
  orderId: string;
  schoolFeePaise?: number;
  onlineConvenienceFeePaise?: number;
  totalPayablePaise?: number;
  currency?: string;
}

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayVerifyResponse {
  success: boolean;
  message?: string;
  /** Razorpay's capture couldn't be confirmed yet (e.g. Razorpay briefly unreachable). The
   * payment is kept and confirmed automatically in the background — not a failure. */
  pending?: boolean;
  paymentId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RazorpayService {

  private baseUrl = `${environment.apiUrl}/payments`;

  constructor(private http: HttpClient) { }

  createOrder(paymentData: PaymentData): Observable<RazorpayOrderResponse> {
    return this.http.post<RazorpayOrderResponse>(`${this.baseUrl}/create`, paymentData);
  }

  verifyPayment(paymentResponse: RazorpayPaymentResponse, orderDetails: RazorpayOrderResponse): Observable<RazorpayVerifyResponse> {
    return this.http.post<RazorpayVerifyResponse>(`${this.baseUrl}/verify`, { paymentResponse, orderDetails });
  }
}
