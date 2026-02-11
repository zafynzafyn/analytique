import type { InsightsData } from '@/components/chat/KeyInsights';

export interface ReportData {
  question: string;
  answer: string;
  insights?: InsightsData;
  data?: Record<string, unknown>[];
  chartSvg?: string;
  chartType?: string;
  sql?: string;
  generatedAt: Date;
}

export interface ConversationExchangeData {
  question: string;
  answer: string;
  insights?: InsightsData;
  data?: Record<string, unknown>[];
  chartSvg?: string;
}

export interface ConversationReportData {
  title: string;
  exchanges: ConversationExchangeData[];
  generatedAt: Date;
}

export function generateReportHTML(report: ReportData): string {
  const formattedDate = report.generatedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Generate insights HTML
  const insightsHTML = report.insights ? `
    <div class="insights-section">
      <h2>Key Insights</h2>
      <div class="key-answer">
        <div class="key-answer-label">Key Finding</div>
        <div class="key-answer-text">${escapeHtml(report.insights.keyAnswer)}</div>
      </div>
      ${report.insights.metrics.length > 0 ? `
        <div class="metrics-grid">
          ${report.insights.metrics.map(metric => `
            <div class="metric-card metric-${metric.emphasis}">
              <div class="metric-label">${escapeHtml(metric.label)}</div>
              <div class="metric-value">${escapeHtml(metric.value)}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  ` : '';

  // Generate data table HTML
  const tableHTML = report.data && report.data.length > 0 ? `
    <div class="data-section">
      <h2>Data Results</h2>
      <div class="table-info">${report.data.length} rows returned</div>
      <table class="data-table">
        <thead>
          <tr>
            ${Object.keys(report.data[0]).map(key => `<th>${escapeHtml(key)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${report.data.slice(0, 50).map(row => `
            <tr>
              ${Object.values(row).map(value => `<td>${escapeHtml(formatValue(value))}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${report.data.length > 50 ? `<div class="table-note">Showing first 50 of ${report.data.length} rows</div>` : ''}
    </div>
  ` : '';

  // Generate chart HTML
  const chartHTML = report.chartSvg ? `
    <div class="chart-section">
      <h2>Visualization</h2>
      <div class="chart-container">
        <img src="${report.chartSvg}" alt="Data visualization" class="chart-image" />
      </div>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analytics Report - ${formattedDate}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background: #ffffff;
      padding: 0;
    }

    .report-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }

    /* Header */
    .report-header {
      border-bottom: 3px solid #6366f1;
      padding-bottom: 24px;
      margin-bottom: 32px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .brand-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 20px;
    }

    .brand-name {
      font-size: 24px;
      font-weight: 700;
      color: #1a1a1a;
    }

    .report-title {
      font-size: 28px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 8px;
    }

    .report-meta {
      color: #666;
      font-size: 14px;
    }

    /* Sections */
    h2 {
      font-size: 18px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e7eb;
    }

    .insights-section,
    .data-section,
    .chart-section {
      margin-bottom: 32px;
    }

    /* Key Insights */
    .key-answer {
      background: linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%);
      border: 1px solid #fbbf24;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .key-answer-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: #92400e;
      margin-bottom: 8px;
    }

    .key-answer-text {
      font-size: 20px;
      font-weight: 600;
      color: #1a1a1a;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
    }

    .metric-card {
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }

    .metric-label {
      font-size: 12px;
      color: #666;
      margin-bottom: 4px;
    }

    .metric-value {
      font-size: 24px;
      font-weight: 700;
    }

    .metric-primary {
      background: #eef2ff;
      border-color: #6366f1;
    }
    .metric-primary .metric-value {
      color: #4f46e5;
    }

    .metric-positive {
      background: #ecfdf5;
      border-color: #10b981;
    }
    .metric-positive .metric-value {
      color: #059669;
    }

    .metric-negative {
      background: #fef2f2;
      border-color: #ef4444;
    }
    .metric-negative .metric-value {
      color: #dc2626;
    }

    .metric-secondary {
      background: #f9fafb;
    }
    .metric-secondary .metric-value {
      color: #374151;
    }

    /* Data Table */
    .table-info {
      font-size: 14px;
      color: #666;
      margin-bottom: 12px;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .data-table th {
      background: #f3f4f6;
      padding: 12px 16px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #e5e7eb;
    }

    .data-table td {
      padding: 10px 16px;
      border-bottom: 1px solid #e5e7eb;
    }

    .data-table tr:nth-child(even) {
      background: #f9fafb;
    }

    .table-note {
      font-size: 12px;
      color: #666;
      font-style: italic;
      margin-top: 8px;
    }

    /* Chart */
    .chart-container {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }

    .chart-image {
      max-width: 100%;
      height: auto;
    }

    /* Footer */
    .report-footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
    }

    /* Print styles */
    @media print {
      body {
        padding: 0;
      }
      .report-container {
        padding: 20px;
        max-width: none;
      }
      .data-table {
        font-size: 11px;
      }
      .no-print {
        display: none !important;
      }
    }

    @page {
      margin: 1cm;
      size: A4;
    }
  </style>
</head>
<body>
  <div class="report-container">
    <!-- Header -->
    <header class="report-header">
      <div class="brand">
        <div class="brand-icon">✦</div>
        <span class="brand-name">Analytique</span>
      </div>
      <h1 class="report-title">Analytics Report</h1>
      <div class="report-meta">Generated on ${formattedDate}</div>
    </header>

    <!-- Key Insights -->
    ${insightsHTML}

    <!-- Chart -->
    ${chartHTML}

    <!-- Data Table -->
    ${tableHTML}

    <!-- Footer -->
    <footer class="report-footer">
      <p>Generated by Analytique AI • Powered by Claude</p>
    </footer>
  </div>

  <script>
    // Auto-print when loaded (for PDF export)
    window.onload = function() {
      // Small delay to ensure everything is rendered
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
  `;
}

export function generateConversationReportHTML(report: ConversationReportData): string {
  const formattedDate = report.generatedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Generate HTML for each exchange
  const exchangesHTML = report.exchanges.map((exchange, index) => {
    // Generate insights HTML
    const insightsHTML = exchange.insights ? `
      <div class="insights-section">
        <div class="key-answer">
          <div class="key-answer-label">Key Finding</div>
          <div class="key-answer-text">${escapeHtml(exchange.insights.keyAnswer)}</div>
        </div>
        ${exchange.insights.metrics.length > 0 ? `
          <div class="metrics-grid">
            ${exchange.insights.metrics.map(metric => `
              <div class="metric-card metric-${metric.emphasis}">
                <div class="metric-label">${escapeHtml(metric.label)}</div>
                <div class="metric-value">${escapeHtml(metric.value)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    ` : '';

    // Generate data table HTML
    const tableHTML = exchange.data && exchange.data.length > 0 ? `
      <div class="data-section">
        <div class="table-info">${exchange.data.length} rows returned</div>
        <table class="data-table">
          <thead>
            <tr>
              ${Object.keys(exchange.data[0]).map(key => `<th>${escapeHtml(key)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${exchange.data.slice(0, 25).map(row => `
              <tr>
                ${Object.values(row).map(value => `<td>${escapeHtml(formatValue(value))}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${exchange.data.length > 25 ? `<div class="table-note">Showing first 25 of ${exchange.data.length} rows</div>` : ''}
      </div>
    ` : '';

    // Generate chart HTML
    const chartHTML = exchange.chartSvg ? `
      <div class="chart-section">
        <div class="chart-container">
          <img src="${exchange.chartSvg}" alt="Data visualization" class="chart-image" />
        </div>
      </div>
    ` : '';

    return `
      <div class="exchange ${index > 0 ? 'exchange-border' : ''}">
        <div class="question-section">
          <div class="question-label">Question ${index + 1}</div>
          <div class="question-text">${escapeHtml(exchange.question)}</div>
        </div>
        ${insightsHTML}
        ${chartHTML}
        ${tableHTML}
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conversation Report - ${formattedDate}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background: #ffffff;
      padding: 0;
    }

    .report-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }

    /* Header */
    .report-header {
      border-bottom: 3px solid #6366f1;
      padding-bottom: 24px;
      margin-bottom: 32px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .brand-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 20px;
    }

    .brand-name {
      font-size: 24px;
      font-weight: 700;
      color: #1a1a1a;
    }

    .report-title {
      font-size: 28px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 8px;
    }

    .report-meta {
      color: #666;
      font-size: 14px;
    }

    .report-summary {
      background: #f8fafc;
      border-radius: 8px;
      padding: 16px;
      margin-top: 16px;
      font-size: 14px;
      color: #475569;
    }

    /* Exchange sections */
    .exchange {
      margin-bottom: 40px;
    }

    .exchange-border {
      padding-top: 32px;
      border-top: 2px solid #e5e7eb;
    }

    .question-section {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      color: white;
    }

    .question-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      opacity: 0.8;
      margin-bottom: 8px;
    }

    .question-text {
      font-size: 18px;
      font-weight: 500;
    }

    /* Sections */
    h2 {
      font-size: 18px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e7eb;
    }

    .insights-section,
    .data-section,
    .chart-section {
      margin-bottom: 24px;
    }

    /* Key Insights */
    .key-answer {
      background: linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%);
      border: 1px solid #fbbf24;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .key-answer-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: #92400e;
      margin-bottom: 8px;
    }

    .key-answer-text {
      font-size: 18px;
      font-weight: 600;
      color: #1a1a1a;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
    }

    .metric-card {
      padding: 14px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }

    .metric-label {
      font-size: 11px;
      color: #666;
      margin-bottom: 4px;
    }

    .metric-value {
      font-size: 20px;
      font-weight: 700;
    }

    .metric-primary {
      background: #eef2ff;
      border-color: #6366f1;
    }
    .metric-primary .metric-value {
      color: #4f46e5;
    }

    .metric-positive {
      background: #ecfdf5;
      border-color: #10b981;
    }
    .metric-positive .metric-value {
      color: #059669;
    }

    .metric-negative {
      background: #fef2f2;
      border-color: #ef4444;
    }
    .metric-negative .metric-value {
      color: #dc2626;
    }

    .metric-secondary {
      background: #f9fafb;
    }
    .metric-secondary .metric-value {
      color: #374151;
    }

    /* Data Table */
    .table-info {
      font-size: 13px;
      color: #666;
      margin-bottom: 10px;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }

    .data-table th {
      background: #f3f4f6;
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #e5e7eb;
    }

    .data-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #e5e7eb;
    }

    .data-table tr:nth-child(even) {
      background: #f9fafb;
    }

    .table-note {
      font-size: 11px;
      color: #666;
      font-style: italic;
      margin-top: 8px;
    }

    /* Chart */
    .chart-container {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }

    .chart-image {
      max-width: 100%;
      height: auto;
    }

    /* Footer */
    .report-footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
    }

    /* Print styles */
    @media print {
      body {
        padding: 0;
      }
      .report-container {
        padding: 20px;
        max-width: none;
      }
      .exchange-border {
        page-break-before: auto;
      }
      .data-table {
        font-size: 10px;
      }
      .no-print {
        display: none !important;
      }
    }

    @page {
      margin: 1cm;
      size: A4;
    }
  </style>
</head>
<body>
  <div class="report-container">
    <!-- Header -->
    <header class="report-header">
      <div class="brand">
        <div class="brand-icon">✦</div>
        <span class="brand-name">Analytique</span>
      </div>
      <h1 class="report-title">${escapeHtml(report.title)}</h1>
      <div class="report-meta">Generated on ${formattedDate}</div>
      <div class="report-summary">
        This report contains ${report.exchanges.length} question${report.exchanges.length !== 1 ? 's' : ''} and their analysis results.
      </div>
    </header>

    <!-- Exchanges -->
    ${exchangesHTML}

    <!-- Footer -->
    <footer class="report-footer">
      <p>Generated by Analytique AI • Powered by Claude</p>
    </footer>
  </div>

  <script>
    // Auto-print when loaded (for PDF export)
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
  `;
}

function escapeHtml(text: string): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  return String(value);
}

export async function captureChartAsDataUrl(chartElement: HTMLElement): Promise<string | null> {
  try {
    const svgElement = chartElement.querySelector('svg');
    if (!svgElement) return null;

    // Clone the SVG and add white background
    const clonedSvg = svgElement.cloneNode(true) as SVGElement;

    // Add white background rect
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', 'white');
    clonedSvg.insertBefore(rect, clonedSvg.firstChild);

    // Serialize to string
    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    // Convert to PNG data URL
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width * 2;
        canvas.height = img.height * 2;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(2, 2);
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          URL.revokeObjectURL(url);
          resolve(dataUrl);
        } else {
          resolve(null);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch (error) {
    console.error('Failed to capture chart:', error);
    return null;
  }
}

export function openReportInNewWindow(html: string): void {
  const reportWindow = window.open('', '_blank');
  if (reportWindow) {
    reportWindow.document.write(html);
    reportWindow.document.close();
  }
}
