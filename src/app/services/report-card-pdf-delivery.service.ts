import { Injectable } from '@angular/core';

/**
 * How a report-card PDF reaches the user. Web: shown in the in-page preview or downloaded.
 * (The Android app's version of this file hands the PDF to the system share sheet instead.)
 */
@Injectable({ providedIn: 'root' })
export class ReportCardPdfDeliveryService {
  /** True where PDFs go to the operating system (Android app) instead of an in-page preview. */
  get native(): boolean { return false; }

  /** Native-only path: the browser uses the PDF iframe instead. */
  async previewPages(_blob: Blob, _fileName: string): Promise<string[]> { return []; }

  async open(blob: Blob, fileName: string): Promise<void> { this.download(blob, fileName); }

  async printNative(_blob: Blob, _fileName: string): Promise<void> { window.print(); }

  async saveToDevice(blob: Blob, fileName: string): Promise<void> { this.download(blob, fileName); }

  /** Opens the system sheet (native) — on the web this simply downloads. */
  async share(blob: Blob, fileName: string): Promise<void> {
    const file = new File([blob], fileName, { type: 'application/pdf' });
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Report Card' });
      return;
    }
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
