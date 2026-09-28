import { Injectable } from '@angular/core';

/**
 * How a report-card PDF reaches the user. Web: shown in the in-page preview or downloaded.
 * (The Android app's version of this file hands the PDF to the system share sheet instead.)
 */
@Injectable({ providedIn: 'root' })
export class ReportCardPdfDeliveryService {
  /** True where PDFs go to the operating system (Android app) instead of an in-page preview. */
  get native(): boolean { return false; }

  /** Opens the system sheet (native) — on the web this simply downloads. */
  async share(blob: Blob, fileName: string): Promise<void> {
    this.download(blob, fileName);
  }

  download(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
