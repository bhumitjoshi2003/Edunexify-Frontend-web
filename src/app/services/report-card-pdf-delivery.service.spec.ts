import { jsPDF } from 'jspdf';
import { ReportCardPdfDeliveryService } from './report-card-pdf-delivery.service';

describe('ReportCardPdfDeliveryService web preview', () => {
  it('renders a real PDF page without relying on a browser iframe', async () => {
    const pdf = new jsPDF();
    pdf.text('Edunexify report card preview', 20, 20);
    const service = new ReportCardPdfDeliveryService();

    const pages = await service.previewPages(pdf.output('blob'), 'report-card.pdf');

    expect(pages.length).toBe(1);
    expect(pages[0]).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('rejects invalid PDF content rather than displaying binary data', async () => {
    const service = new ReportCardPdfDeliveryService();
    await expectAsync(service.previewPages(new Blob(['not a PDF']), 'invalid.pdf')).toBeRejectedWithError('The report-card response is not a PDF');
  });
});
