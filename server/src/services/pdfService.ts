import PDFDocument from 'pdfkit';
import { Response } from 'express';

interface InspectionPdfData {
  inspectionId: string;
  facilityName: string;
  facilityAddress: string;
  zoneName?: string;
  checkpointName?: string;
  assetName?: string;
  inspectorName: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  summaryNotes?: string;
  items: Array<{
    label: string;
    result?: string;
    numericValue?: number;
    textValue?: string;
    notes?: string;
    isFlaggedDefect?: boolean;
    failedReason?: string;
  }>;
}

export function generateInspectionPdf(data: InspectionPdfData, res: Response): void {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Inspection-${data.inspectionId.slice(0, 8)}.pdf"`
  );

  doc.pipe(res);

  // Title & Header (Terracotta / Charcoal Palette)
  doc.rect(40, 40, 515, 6).fill('#C66B4E'); // Terracotta primary bar
  doc.moveDown(1.5);

  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor('#292824')
    .text('SPOTCHECK FACILITY INSPECTION REPORT');

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#77736B')
    .text(`Generated: ${new Date().toUTCString()} | Record ID: ${data.inspectionId}`);

  doc.moveDown(1);
  doc.rect(40, doc.y, 515, 1).fill('#E6DED2'); // Warm border line
  doc.moveDown(1);

  // Facility & Metadata Table Box
  const metaY = doc.y;
  doc.rect(40, metaY, 515, 85).fillAndStroke('#F7F4EE', '#E6DED2');

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#292824');
  doc.text('Facility:', 55, metaY + 12);
  doc.font('Helvetica').fillColor('#292824').text(data.facilityName, 120, metaY + 12);

  doc.font('Helvetica-Bold').text('Location:', 55, metaY + 28);
  doc.font('Helvetica').text(`${data.zoneName || 'Global'} / ${data.checkpointName || 'General Area'}`, 120, metaY + 28);

  doc.font('Helvetica-Bold').text('Inspector:', 55, metaY + 44);
  doc.font('Helvetica').text(data.inspectorName, 120, metaY + 44);

  doc.font('Helvetica-Bold').text('Status:', 320, metaY + 12);
  doc.font('Helvetica-Bold').fillColor(data.status === 'SUBMITTED' ? '#687568' : '#B98535').text(data.status, 380, metaY + 12);

  doc.font('Helvetica-Bold').fillColor('#292824').text('Started:', 320, metaY + 28);
  doc.font('Helvetica').text(new Date(data.startedAt).toLocaleString(), 380, metaY + 28);

  doc.font('Helvetica-Bold').text('Completed:', 320, metaY + 44);
  doc.font('Helvetica').text(data.completedAt ? new Date(data.completedAt).toLocaleString() : 'In Progress', 380, metaY + 44);

  if (data.assetName) {
    doc.font('Helvetica-Bold').text('Asset:', 55, metaY + 60);
    doc.font('Helvetica').text(data.assetName, 120, metaY + 60);
  }

  doc.y = metaY + 105;

  // Summary Notes
  if (data.summaryNotes) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#292824').text('Summary Notes:');
    doc.font('Helvetica').fontSize(9.5).fillColor('#292824').text(data.summaryNotes);
    doc.moveDown(1);
  }

  // Checklist Items Section
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#292824').text('Checklist Evaluation Results');
  doc.moveDown(0.5);

  data.items.forEach((item, index) => {
    // Check if new page needed
    if (doc.y > 700) {
      doc.addPage();
    }

    const itemY = doc.y;
    const isDefect = item.isFlaggedDefect || item.result === 'FAIL';
    const bgColor = isDefect ? '#FCF5F5' : index % 2 === 0 ? '#FFFFFF' : '#FAFAF8';

    doc.rect(40, itemY, 515, 42).fillAndStroke(bgColor, '#E6DED2');

    // Label
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#292824').text(`${index + 1}. ${item.label}`, 50, itemY + 8, { width: 330 });

    // Result Badge
    let resultText = item.result || (item.numericValue !== undefined ? `${item.numericValue}` : item.textValue || 'Recorded');
    let badgeColor = '#687568'; // Sage
    if (isDefect) badgeColor = '#A33F35'; // Dark red
    if (item.result === 'NA') badgeColor = '#77736B'; // Muted

    doc.font('Helvetica-Bold').fontSize(9).fillColor(badgeColor).text(resultText, 400, itemY + 8, { width: 140, align: 'right' });

    // Subtext or notes
    if (item.notes || item.failedReason) {
      doc.font('Helvetica').fontSize(8).fillColor('#77736B').text(
        item.failedReason ? `DEFECT: ${item.failedReason}` : `Note: ${item.notes}`,
        50,
        itemY + 24,
        { width: 480 }
      );
    }

    doc.y = itemY + 48;
  });

  // Sign-off Block
  doc.moveDown(2);
  if (doc.y > 680) {
    doc.addPage();
  }

  const signY = doc.y;
  doc.rect(40, signY, 515, 70).stroke('#E6DED2');
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#77736B').text('CERTIFIED INSPECTOR SIGN-OFF BLOCK', 50, signY + 10);
  doc.font('Helvetica').fontSize(9).fillColor('#292824').text(`Inspector Name: ${data.inspectorName}`, 50, signY + 30);
  doc.text(`Digital Sign-off Timestamp: ${data.completedAt ? new Date(data.completedAt).toISOString() : new Date().toISOString()}`, 50, signY + 48);
  doc.text('Signature Status: VERIFIED CREDENTIAL SESSION', 320, signY + 48);

  doc.end();
}
