import { format } from "date-fns";
import type { Order, Settings } from "@shared/schema";

export type ReceiptTemplate = "classic" | "modern" | "compact" | "detailed" | "elegant";

interface ReceiptItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: string;
  total: string;
  productName: string;
}

interface ReceiptData {
  sale: Order;
  items: ReceiptItem[];
  settings?: Settings | null;
  totalKHR: number;
  paymentDetails: string;
}

/** Format discount for receipt: returns { label: "20%" or "$2.00", amount: number } so total = subtotal - amount */
function getDiscountDisplay(sale: Order): { label: string; amount: number } {
  const sub = parseFloat(sale.subtotal) || 0;
  const disc = parseFloat(sale.discount) || 0;
  const type = (sale.discountType || "amount") as "amount" | "percentage";
  if (type === "percentage") {
    const amount = (sub * disc) / 100;
    return { label: `${disc}%`, amount };
  }
  return { label: `$${disc.toFixed(2)}`, amount: disc };
}

function subscriptionDiscountRowHtml(sale: Order): string {
  const amt = parseFloat(sale.subscriptionDiscount || "0");
  if (!amt || amt <= 0) return "";
  return `<div><span>Subscription card:</span><span>-$${amt.toFixed(2)}</span></div>`;
}

function subscriptionDiscountSummaryRow(sale: Order): string {
  const amt = parseFloat(sale.subscriptionDiscount || "0");
  if (!amt || amt <= 0) return "";
  return `<div class="summary-row">
            <span>Subscription card</span>
            <span>-$${amt.toFixed(2)}</span>
          </div>`;
}

function subscriptionDiscountCompactLine(sale: Order): string {
  const amt = parseFloat(sale.subscriptionDiscount || "0");
  if (!amt || amt <= 0) return "";
  return `<div>Subscription card: -$${amt.toFixed(2)}</div>`;
}

export function generateReceiptHTML(
  template: ReceiptTemplate,
  data: ReceiptData
): string {
  const { sale, items, settings, totalKHR, paymentDetails } = data;

  // Ensure invoice ID is never undefined/null on printed receipt
  const safeOrderNumber =
    sale?.orderNumber != null && String(sale.orderNumber).trim() !== ""
      ? String(sale.orderNumber)
      : "—";
  const saleForTemplate = { ...sale, orderNumber: safeOrderNumber };
  const dataWithSafeSale = { ...data, sale: saleForTemplate };

  const receiptHeader = settings?.receiptHeader || "";
  const receiptFooter = settings?.receiptFooter || "";
  const showLogo = settings?.showLogoOnReceipt === "true";
  const receiptLogo = settings?.receiptLogo || "";
  const invoicePrefix = settings?.invoicePrefix || "INV-";
  const companyName = settings?.businessName || "";
  const companyAddress = settings?.address || "";

  // Company details section
  let companyDetailsHtml = "";
  if (companyName || companyAddress) {
    let logoSection = "";
    if (showLogo && receiptLogo) {
      logoSection = `<div style="text-align: center; margin-bottom: 10px;">
        <img src="${receiptLogo}" alt="Company Logo" style="max-width: 180px; max-height: 80px;" />
      </div>`;
    }
    
    companyDetailsHtml = `
      <div style="text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #000;">
        ${logoSection}
        ${companyName ? `<div style="font-size: 18px; font-weight: 700; margin-bottom: 8px; color: #000000;">${companyName}</div>` : ""}
        ${companyAddress ? `<div style="font-size: 12px; color: #000000; line-height: 1.6; font-weight: 600;">${companyAddress.replace(/\n/g, '<br>')}</div>` : ""}
      </div>
    `;
  }

  const headerHtml = receiptHeader ? `<div style="text-align: center; margin-bottom: 15px; font-weight: 700; font-size: 1.1em; color: #000000;">${receiptHeader}</div>` : "";
  const footerHtml = receiptFooter ? `<div style="text-align: center; margin-top: 15px; font-size: 0.85em; color: #000000; font-weight: 600;">${receiptFooter}</div>` : "";

  switch (template) {
    case "classic":
      return generateClassicTemplate(dataWithSafeSale, companyDetailsHtml, headerHtml, footerHtml, invoicePrefix);
    case "modern":
      return generateModernTemplate(dataWithSafeSale, companyDetailsHtml, headerHtml, footerHtml, invoicePrefix);
    case "compact":
      return generateCompactTemplate(dataWithSafeSale, companyDetailsHtml, headerHtml, footerHtml, invoicePrefix);
    case "detailed":
      return generateDetailedTemplate(dataWithSafeSale, companyDetailsHtml, headerHtml, footerHtml, invoicePrefix);
    case "elegant":
      return generateElegantTemplate(dataWithSafeSale, companyDetailsHtml, headerHtml, footerHtml, invoicePrefix);
    default:
      return generateClassicTemplate(dataWithSafeSale, companyDetailsHtml, headerHtml, footerHtml, invoicePrefix);
  }
}

function generateClassicTemplate(
  data: ReceiptData,
  companyDetailsHtml: string,
  headerHtml: string,
  footerHtml: string,
  invoicePrefix: string
): string {
  const { sale, items, totalKHR, paymentDetails } = data;
  const discountDisplay = getDiscountDisplay(sale);
  
  const itemsRows = items.map(item => `
    <tr>
      <td style="color: #000000; font-weight: 600;">${item.productName || "N/A"}</td>
      <td style="text-align: center; color: #000000; font-weight: 600;">${item.quantity}</td>
      <td style="text-align: right; color: #000000; font-weight: 600;">$${parseFloat(item.price).toFixed(2)}</td>
      <td style="text-align: center; color: #000000; font-weight: 600;">-</td>
      <td style="text-align: right; color: #000000; font-weight: 600;">$${parseFloat(item.total).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt - ${invoicePrefix}${sale.orderNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; color: #000000; }
          body { 
            font-family: 'Courier New', monospace; 
            padding: 20px; 
            max-width: 400px; 
            margin: 0 auto;
            font-size: 12px;
            color: #000000;
            font-weight: 600;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px dashed #000; padding-bottom: 10px; color: #000000; }
          .header h1 { font-size: 20px; margin-bottom: 5px; font-weight: 700; color: #000000; }
          .header p { font-size: 11px; margin: 2px 0; color: #000000; font-weight: 600; }
          .info { margin: 15px 0; font-size: 11px; color: #000000; font-weight: 600; }
          .info div { display: flex; justify-content: space-between; margin: 5px 0; color: #000000; font-weight: 600; }
          .info div span { color: #000000; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { padding: 5px; text-align: left; border-bottom: 1px dashed #000; color: #000000; font-weight: 600; }
          th { background-color: #f0f0f0; font-weight: 700; text-align: center; color: #000000; }
          td { font-weight: 600; color: #000000; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .summary { margin: 15px 0; font-size: 12px; color: #000000; font-weight: 600; }
          .summary div { display: flex; justify-content: space-between; margin: 5px 0; color: #000000; font-weight: 600; }
          .summary div span { color: #000000; font-weight: 600; }
          .total { font-weight: 700; font-size: 16px; margin-top: 10px; padding-top: 10px; border-top: 2px solid #000; color: #000000; }
          .total span { color: #000000; font-weight: 700; }
          .footer { text-align: center; margin-top: 20px; font-size: 10px; border-top: 2px dashed #000; padding-top: 10px; color: #000000; font-weight: 600; }
          .footer p { color: #000000; font-weight: 600; }
          @media print { 
            * { color: #000000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { 
              padding: 10px; 
              color: #000000 !important;
              font-weight: 600 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            } 
            @page { 
              margin: 0.5cm; 
              size: 80mm auto;
            }
            table tbody { display: table-row-group; }
            tr { page-break-inside: avoid; }
            th, td { color: #000000 !important; font-weight: 600 !important; }
            .header, .header h1, .header p, .info, .info div, .info div span,
            .summary, .summary div, .summary div span, .total, .total span,
            .footer, .footer p { color: #000000 !important; }
          }
        </style>
      </head>
      <body>
        ${companyDetailsHtml}
        ${headerHtml}
        <div class="header">
          <h1>RECEIPT</h1>
          <p>Thank you for your purchase!</p>
        </div>
        <div class="info">
          <div><span>Invoice:</span><span>${invoicePrefix}${sale.orderNumber}</span></div>
          <div><span>Date:</span><span>${format(new Date(sale.createdAt), "MMM dd, yyyy HH:mm")}</span></div>
          <div><span>Customer:</span><span>${sale.customerName || "Walk-in"}</span></div>
          <div><span>Dining:</span><span class="capitalize">${sale.diningOption}</span></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="text-center">Qty</th>
              <th class="text-right">Price</th>
              <th class="text-center">Disc</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>
        <div class="summary">
          <div><span>Subtotal:</span><span>$${parseFloat(sale.subtotal).toFixed(2)}</span></div>
          ${subscriptionDiscountRowHtml(sale)}
          <div><span>Discount (${discountDisplay.label}):</span><span>-$${discountDisplay.amount.toFixed(2)}</span></div>
          <div class="total"><span>TOTAL:</span><span>$${parseFloat(sale.total).toFixed(2)}</span></div>
          <div><span>Total (KHR):</span><span>៛${totalKHR}</span></div>
        </div>
        <div class="info">${paymentDetails}</div>
        ${footerHtml}
        <div class="footer">
          <p>Thank you for your business!</p>
        </div>
      </body>
    </html>
  `;
}

function generateModernTemplate(
  data: ReceiptData,
  companyDetailsHtml: string,
  headerHtml: string,
  footerHtml: string,
  invoicePrefix: string
): string {
  const { sale, items, totalKHR, paymentDetails } = data;
  const discountDisplay = getDiscountDisplay(sale);
  
  const itemsRows = items.map(item => `
    <tr>
      <td style="padding: 8px 0;">
        <div style="font-weight: 600;">${item.productName || "N/A"}</div>
        <div style="font-size: 11px; color: #666;">${item.quantity}x $${parseFloat(item.price).toFixed(2)}</div>
      </td>
      <td style="text-align: right; font-weight: 600;">$${parseFloat(item.total).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt - ${invoicePrefix}${sale.orderNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            padding: 30px; 
            max-width: 450px; 
            margin: 0 auto;
            background: #fff;
          }
          .header { text-align: center; margin-bottom: 25px; }
          .header h1 { font-size: 24px; color: #1a1a1a; margin-bottom: 8px; font-weight: 700; }
          .header p { font-size: 12px; color: #666; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; }
          .info-item { font-size: 12px; }
          .info-label { color: #666; font-size: 11px; }
          .info-value { font-weight: 600; color: #1a1a1a; }
          table { width: 100%; margin: 20px 0; }
          th, td { padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
          th { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
          .summary { margin: 25px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; }
          .summary-row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 13px; }
          .summary-total { font-size: 20px; font-weight: 700; color: #1a1a1a; margin-top: 15px; padding-top: 15px; border-top: 2px solid #1a1a1a; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          .footer p { font-size: 11px; color: #999; }
          @media print { 
            body { padding: 20px; } 
            @page { margin: 1cm; }
            table tbody { display: table-row-group; }
            tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        ${companyDetailsHtml}
        ${headerHtml}
        <div class="header">
          <h1>Receipt</h1>
          <p>${invoicePrefix}${sale.orderNumber}</p>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Date</div>
            <div class="info-value">${format(new Date(sale.createdAt), "MMM dd, yyyy")}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Time</div>
            <div class="info-value">${format(new Date(sale.createdAt), "HH:mm")}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Customer</div>
            <div class="info-value">${sale.customerName || "Walk-in"}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Dining</div>
            <div class="info-value" style="text-transform: capitalize;">${sale.diningOption}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Item</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>
        <div class="summary">
          <div class="summary-row">
            <span>Subtotal</span>
            <span>$${parseFloat(sale.subtotal).toFixed(2)}</span>
          </div>
          ${subscriptionDiscountSummaryRow(sale)}
          <div class="summary-row">
            <span>Discount (${discountDisplay.label})</span>
            <span>-$${discountDisplay.amount.toFixed(2)}</span>
          </div>
          <div class="summary-row summary-total">
            <span>Total</span>
            <span>$${parseFloat(sale.total).toFixed(2)}</span>
          </div>
          <div class="summary-row" style="font-size: 11px; color: #666; margin-top: 5px;">
            <span>Total (KHR)</span>
            <span>៛${totalKHR}</span>
          </div>
        </div>
        <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; font-size: 12px;">
          ${paymentDetails}
        </div>
        ${footerHtml}
        <div class="footer">
          <p>Thank you for your business!</p>
        </div>
      </body>
    </html>
  `;
}

function generateCompactTemplate(
  data: ReceiptData,
  companyDetailsHtml: string,
  headerHtml: string,
  footerHtml: string,
  invoicePrefix: string
): string {
  const { sale, items, totalKHR, paymentDetails } = data;
  const discountDisplay = getDiscountDisplay(sale);
  
  const itemsRows = items.map(item => `
    <tr>
      <td style="font-size: 10px;">${item.productName || "N/A"}</td>
      <td style="text-align: center; font-size: 10px;">${item.quantity}</td>
      <td style="text-align: right; font-size: 10px;">$${parseFloat(item.total).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt - ${invoicePrefix}${sale.orderNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Courier New', monospace; 
            padding: 10px; 
            max-width: 300px; 
            margin: 0 auto;
            font-size: 10px;
          }
          .header { text-align: center; margin-bottom: 10px; }
          .header h1 { font-size: 14px; font-weight: bold; }
          .info { font-size: 9px; margin: 8px 0; line-height: 1.4; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9px; }
          th, td { padding: 3px 0; border-bottom: 1px dotted #ccc; }
          th { font-weight: bold; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .summary { margin: 10px 0; font-size: 10px; }
          .summary div { display: flex; justify-content: space-between; margin: 3px 0; }
          .total { font-weight: bold; font-size: 12px; margin-top: 5px; padding-top: 5px; border-top: 1px solid #000; }
          .footer { text-align: center; margin-top: 10px; font-size: 8px; border-top: 1px dotted #ccc; padding-top: 5px; }
          @media print { 
            body { padding: 5px; } 
            @page { margin: 0.3cm; size: 80mm auto; }
            table tbody { display: table-row-group; }
            tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        ${companyDetailsHtml}
        ${headerHtml}
        <div class="header">
          <h1>${invoicePrefix}${sale.orderNumber}</h1>
          <div class="info">${format(new Date(sale.createdAt), "MMM dd, yyyy HH:mm")}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Item</th>
              <th class="text-center">Qty</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>
        <div class="summary">
          <div>Subtotal: $${parseFloat(sale.subtotal).toFixed(2)}</div>
          ${subscriptionDiscountCompactLine(sale)}
          <div>Discount (${discountDisplay.label}): -$${discountDisplay.amount.toFixed(2)}</div>
          <div class="total">TOTAL: $${parseFloat(sale.total).toFixed(2)}</div>
          <div style="font-size: 9px;">KHR: ៛${totalKHR}</div>
        </div>
        <div class="info">${paymentDetails}</div>
        ${footerHtml}
        <div class="footer">Thank you!</div>
      </body>
    </html>
  `;
}

function generateDetailedTemplate(
  data: ReceiptData,
  companyDetailsHtml: string,
  headerHtml: string,
  footerHtml: string,
  invoicePrefix: string
): string {
  const { sale, items, totalKHR, paymentDetails } = data;
  const discountDisplay = getDiscountDisplay(sale);
  
  const itemsRows = items.map(item => `
    <tr>
      <td style="padding: 10px; border: 1px solid #ddd;">${item.productName || "N/A"}</td>
      <td style="text-align: center; padding: 10px; border: 1px solid #ddd;">${item.quantity}</td>
      <td style="text-align: right; padding: 10px; border: 1px solid #ddd;">$${parseFloat(item.price).toFixed(2)}</td>
      <td style="text-align: center; padding: 10px; border: 1px solid #ddd;">-</td>
      <td style="text-align: right; padding: 10px; border: 1px solid #ddd; font-weight: 600;">$${parseFloat(item.total).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt - ${invoicePrefix}${sale.orderNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            padding: 25px; 
            max-width: 600px; 
            margin: 0 auto;
            font-size: 13px;
          }
          .header { text-align: center; margin-bottom: 25px; padding: 20px; background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 8px; }
          .header h1 { font-size: 28px; color: #212529; margin-bottom: 10px; }
          .info-section { margin: 20px 0; padding: 15px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; }
          .info-row { display: flex; justify-content: space-between; margin: 8px 0; padding: 5px 0; border-bottom: 1px dotted #ccc; }
          .info-label { font-weight: 600; color: #495057; }
          .info-value { color: #212529; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; border: 2px solid #dee2e6; }
          th { background: #e9ecef; padding: 12px; font-weight: 700; text-align: center; border: 1px solid #dee2e6; }
          td { border: 1px solid #dee2e6; }
          .summary { margin: 25px 0; padding: 20px; background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 8px; }
          .summary-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #dee2e6; }
          .summary-total { font-size: 22px; font-weight: 700; color: #212529; margin-top: 15px; padding-top: 15px; border-top: 3px solid #212529; }
          .footer { text-align: center; margin-top: 25px; padding: 15px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; }
          @media print { 
            body { padding: 15px; } 
            @page { margin: 1cm; }
            table tbody { display: table-row-group; }
            tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        ${companyDetailsHtml}
        ${headerHtml}
        <div class="header">
          <h1>DETAILED RECEIPT</h1>
          <p style="font-size: 14px; color: #6c757d;">Invoice: ${invoicePrefix}${sale.orderNumber}</p>
        </div>
        <div class="info-section">
          <div class="info-row">
            <span class="info-label">Sale ID:</span>
            <span class="info-value">${sale.id}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date & Time:</span>
            <span class="info-value">${format(new Date(sale.createdAt), "MMMM dd, yyyy 'at' HH:mm:ss")}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Customer Name:</span>
            <span class="info-value">${sale.customerName || "Walk-in Customer"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Dining Option:</span>
            <span class="info-value" style="text-transform: capitalize;">${sale.diningOption}</span>
          </div>
          ${sale.tableId ? `<div class="info-row">
            <span class="info-label">Table:</span>
            <span class="info-value">${sale.tableId}</span>
          </div>` : ''}
        </div>
        <table>
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Discount</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>
        <div class="summary">
          <div class="summary-row">
            <span style="font-weight: 600;">Subtotal:</span>
            <span style="font-weight: 600;">$${parseFloat(sale.subtotal).toFixed(2)}</span>
          </div>
          ${subscriptionDiscountSummaryRow(sale)}
          <div class="summary-row">
            <span style="font-weight: 600;">Discount (${discountDisplay.label}):</span>
            <span style="font-weight: 600; color: #dc3545;">-$${discountDisplay.amount.toFixed(2)}</span>
          </div>
          <div class="summary-row summary-total">
            <span>GRAND TOTAL:</span>
            <span>$${parseFloat(sale.total).toFixed(2)}</span>
          </div>
          <div class="summary-row" style="font-size: 14px; color: #6c757d;">
            <span>Total in KHR:</span>
            <span>៛${totalKHR}</span>
          </div>
        </div>
        <div class="info-section">
          ${paymentDetails}
          <div class="info-row" style="margin-top: 10px; border-top: 1px solid #dee2e6; padding-top: 10px;">
            <span class="info-label">Payment Status:</span>
            <span class="info-value" style="text-transform: capitalize; font-weight: 600;">${sale.paymentStatus}</span>
          </div>
        </div>
        ${footerHtml}
        <div class="footer">
          <p style="font-weight: 600; margin-bottom: 5px;">Thank you for your business!</p>
          <p style="font-size: 11px; color: #6c757d;">We appreciate your patronage</p>
        </div>
      </body>
    </html>
  `;
}

function generateElegantTemplate(
  data: ReceiptData,
  companyDetailsHtml: string,
  headerHtml: string,
  footerHtml: string,
  invoicePrefix: string
): string {
  const { sale, items, totalKHR, paymentDetails } = data;
  const discountDisplay = getDiscountDisplay(sale);
  
  const itemsRows = items.map(item => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
        <div style="font-weight: 600; font-size: 14px; color: #1f2937;">${item.productName || "N/A"}</div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${item.quantity} × $${parseFloat(item.price).toFixed(2)}</div>
      </td>
      <td style="text-align: right; padding: 12px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 14px;">
        $${parseFloat(item.total).toFixed(2)}
      </td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt - ${invoicePrefix}${sale.orderNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Georgia', 'Times New Roman', serif; 
            padding: 40px; 
            max-width: 500px; 
            margin: 0 auto;
            background: linear-gradient(to bottom, #fafafa, #ffffff);
          }
          .header { 
            text-align: center; 
            margin-bottom: 30px; 
            padding: 30px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .header h1 { font-size: 32px; margin-bottom: 10px; font-weight: 300; letter-spacing: 2px; }
          .header p { font-size: 14px; opacity: 0.9; }
          .info { margin: 25px 0; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
          .info-row { display: flex; justify-content: space-between; margin: 12px 0; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
          .info-label { color: #6b7280; font-size: 13px; }
          .info-value { color: #1f2937; font-weight: 600; font-size: 13px; }
          table { width: 100%; margin: 25px 0; }
          th { padding: 15px 0; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
          .summary { 
            margin: 30px 0; 
            padding: 25px; 
            background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
            border-radius: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          .summary-row { display: flex; justify-content: space-between; margin: 12px 0; font-size: 14px; }
          .summary-total { 
            font-size: 24px; 
            font-weight: 700; 
            color: #1f2937; 
            margin-top: 20px; 
            padding-top: 20px; 
            border-top: 2px solid #1f2937;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          .footer { 
            text-align: center; 
            margin-top: 35px; 
            padding: 25px; 
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          .footer p { font-size: 12px; color: #6b7280; font-style: italic; }
          @media print { 
            body { padding: 30px; background: white; } 
            @page { margin: 1.5cm; }
            table tbody { display: table-row-group; }
            tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        ${companyDetailsHtml}
        ${headerHtml}
        <div class="header">
          <h1>Receipt</h1>
          <p>${invoicePrefix}${sale.orderNumber}</p>
        </div>
        <div class="info">
          <div class="info-row">
            <span class="info-label">Date</span>
            <span class="info-value">${format(new Date(sale.createdAt), "MMMM dd, yyyy")}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Time</span>
            <span class="info-value">${format(new Date(sale.createdAt), "HH:mm")}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Customer</span>
            <span class="info-value">${sale.customerName || "Walk-in"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Dining</span>
            <span class="info-value" style="text-transform: capitalize;">${sale.diningOption}</span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Item</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>
        <div class="summary">
          <div class="summary-row">
            <span>Subtotal</span>
            <span>$${parseFloat(sale.subtotal).toFixed(2)}</span>
          </div>
          ${subscriptionDiscountSummaryRow(sale)}
          <div class="summary-row">
            <span>Discount (${discountDisplay.label})</span>
            <span>-$${discountDisplay.amount.toFixed(2)}</span>
          </div>
          <div class="summary-row summary-total">
            <span>Total</span>
            <span>$${parseFloat(sale.total).toFixed(2)}</span>
          </div>
          <div class="summary-row" style="font-size: 12px; color: #6b7280; margin-top: 8px;">
            <span>Total (KHR)</span>
            <span>៛${totalKHR}</span>
          </div>
        </div>
        <div class="info" style="margin-top: 20px;">
          ${paymentDetails}
        </div>
        ${footerHtml}
        <div class="footer">
          <p>We appreciate your business</p>
          <p style="margin-top: 5px;">Thank you for choosing us</p>
        </div>
      </body>
    </html>
  `;
}

