import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Capture a pre-rendered HTMLElement and export it as a paginated PDF.
 * The element should already be styled (e.g. light-theme PrintView).
 */
export async function exportPageToPdf(
  element: HTMLElement,
  title: string,
  subtitle: string,
  filename: string = 'relatorio.pdf',
) {
  // Wait a tick for layout
  await new Promise((r) => setTimeout(r, 150));

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    width: element.offsetWidth,
    windowWidth: element.offsetWidth,
  });

  // A4 landscape
  const pdf = new jsPDF('l', 'mm', 'a4');
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const headerH = 18;
  const footerH = 10;
  const margin = 10;
  const contentW = pageW - margin * 2;
  const contentH = pageH - headerH - footerH;

  const imgW = contentW;
  const imgH = (canvas.height * imgW) / canvas.width;
  const imgData = canvas.toDataURL('image/png');

  const now = new Date();
  const footerText = `Gerado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  const totalPages = Math.ceil(imgH / contentH);

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) pdf.addPage();

    // Header
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageW, headerH, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(30, 30, 30);
    pdf.text(title, margin, 10);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(120, 120, 120);
    pdf.text(subtitle, margin, 15);
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.3);
    pdf.line(margin, headerH - 0.5, pageW - margin, headerH - 0.5);

    // Content
    const yOffset = page * contentH;
    pdf.saveGraphicsState();
    // @ts-ignore
    pdf.rect(margin, headerH, contentW, contentH, null);
    // @ts-ignore
    pdf.clip();
    // @ts-ignore
    pdf.discardPath();
    pdf.addImage(imgData, 'PNG', margin, headerH - yOffset, imgW, imgH);
    pdf.restoreGraphicsState();

    // Footer
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, pageH - footerH, pageW, footerH, 'F');
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.3);
    pdf.line(margin, pageH - footerH + 0.5, pageW - margin, pageH - footerH + 0.5);
    pdf.setFontSize(7);
    pdf.setTextColor(140, 140, 140);
    pdf.text(footerText, margin, pageH - 4);
    pdf.text(`Página ${page + 1} de ${totalPages}`, pageW - margin - 22, pageH - 4);
  }

  pdf.save(filename);
}
