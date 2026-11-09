import { Injectable } from '@angular/core';

/**
 * How a report-card PDF reaches the user. Web: shown in the in-page preview or downloaded.
 * (The Android app's version of this file hands the PDF to the system share sheet instead.)
 */
@Injectable({ providedIn: 'root' })
export class ReportCardPdfDeliveryService {
  /** True where PDFs go to the operating system (Android app) instead of an in-page preview. */
  get native(): boolean { return false; }

  /**
   * Render the PDF ourselves instead of embedding Chrome's mobile PDF file-opening
   * UI in an iframe. The worker ships with the web app; no third-party PDF URL.
   */
  async previewPages(blob: Blob, _fileName: string): Promise<string[]> {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = '/assets/pdfjs/pdf.worker.min.mjs';
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length < 5 || String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') {
      throw new Error('The report-card response is not a PDF');
    }
    const task = pdfjs.getDocument({ data: bytes, isEvalSupported: false });
    const pdf = await task.promise;
    try {
      const pages: string[] = [];
      for (let index = 1; index <= pdf.numPages; index++) {
        const page = await pdf.getPage(index);
        const initial = page.getViewport({ scale: 1 });
        // A fixed maximum width keeps mobile rendering sharp without exhausting memory.
        const viewport = page.getViewport({ scale: Math.min(2, 1300 / initial.width) });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('PDF canvas rendering is unavailable');
        await page.render({ canvasContext: context, viewport }).promise;
        pages.push(canvas.toDataURL('image/jpeg', 0.92));
        canvas.width = canvas.height = 0;
        page.cleanup();
      }
      return pages;
    } finally {
      await pdf.destroy();
    }
  }

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
