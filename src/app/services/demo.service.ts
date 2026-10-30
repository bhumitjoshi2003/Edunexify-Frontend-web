import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DemoRequestPayload {
  schoolName:   string;
  contactName:  string;
  email:        string;
  phone:        string;
  numberOfStudents?: string;
  city?:        string;
  message?:     string;
}

export interface DemoSubmissionResult {
  notificationSent: boolean | null;
}

export interface DemoRequestSummary {
  id:           number;
  schoolName:   string;
  contactName:  string;
  email:        string;
  phone:        string;
  numberOfStudents?: string;
  city?:        string;
  message?:     string;
  status:       'PENDING' | 'CONTACTED' | 'COMPLETED' | 'REJECTED';
  requestedAt:  string;
}

@Injectable({ providedIn: 'root' })
export class DemoService {

  private baseUrl = `${environment.apiUrl}/demo-requests`;

  constructor(private http: HttpClient) {}

  /** Public — no auth required */
  submitRequest(payload: DemoRequestPayload): Observable<DemoSubmissionResult> {
    // Accept the legacy plain-text response during backend-first rollouts too.
    return this.http.post(this.baseUrl, payload, { responseType: 'text' }).pipe(
      map(body => body.trim().startsWith('{')
        ? JSON.parse(body) as DemoSubmissionResult
        : { notificationSent: null })
    );
  }

  /** Admin only — view all demo requests */
  getAll(): Observable<DemoRequestSummary[]> {
    return this.http.get<DemoRequestSummary[]>(this.baseUrl);
  }

  /** Admin only — update status */
  updateStatus(id: number, status: DemoRequestSummary['status']): Observable<string> {
    return this.http.patch(`${this.baseUrl}/${id}/status`, { status }, { responseType: 'text' });
  }
}
