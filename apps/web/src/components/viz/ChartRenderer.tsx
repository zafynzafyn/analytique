'use client';

import { useMemo, useRef, useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Download,
  Maximize2,
  Share2,
  FileImage,
  FileText,
  FileSpreadsheet,
  Link,
  Check,
} from 'lucide-react';
import { saveAs } from 'file-saver';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ChartSuggestion {
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'table';
  xAxis?: string;
  yAxis?: string;
  title?: string;
}

interface ChartRendererProps {
  data: Record<string, unknown>[];
  suggestion?: ChartSuggestion;
  title?: string;
}

const COLORS = [
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7300',
  '#0088fe',
  '#00c49f',
  '#ffbb28',
  '#ff8042',
];

function detectChartType(data: Record<string, unknown>[]): ChartSuggestion {
  if (data.length === 0) {
    return { type: 'table' };
  }

  const columns = Object.keys(data[0]);
  console.log('[detectChartType] Columns:', columns);

  // Check for numeric columns - also check if string values are actually numbers
  const numericColumns = columns.filter((col) => {
    const sample = data[0][col];
    if (typeof sample === 'number') return true;
    // Check if it's a numeric string
    if (typeof sample === 'string' && !isNaN(Number(sample)) && sample.trim() !== '') {
      return true;
    }
    return false;
  });

  console.log('[detectChartType] Numeric columns:', numericColumns);

  const dateColumns = columns.filter((col) => {
    const sample = String(data[0][col]);
    return /^\d{4}-\d{2}-\d{2}/.test(sample) || /^\d{2}\/\d{2}\/\d{4}/.test(sample);
  });

  console.log('[detectChartType] Date columns:', dateColumns);

  // Time series: has date column and numeric column
  if (dateColumns.length > 0 && numericColumns.length > 0) {
    const result = {
      type: 'line' as const,
      xAxis: dateColumns[0],
      yAxis: numericColumns[0],
    };
    console.log('[detectChartType] Detected line chart:', result);
    return result;
  }

  // Categorical with values: has a non-numeric column and a numeric column
  const categoryColumns = columns.filter(c => !numericColumns.includes(c));

  if (categoryColumns.length > 0 && numericColumns.length > 0) {
    const categoryCol = categoryColumns[0];
    const numericCol = numericColumns[0];

    if (data.length <= 7) {
      const result = {
        type: 'pie' as const,
        xAxis: categoryCol,
        yAxis: numericCol,
      };
      console.log('[detectChartType] Detected pie chart:', result);
      return result;
    }

    const result = {
      type: 'bar' as const,
      xAxis: categoryCol,
      yAxis: numericCol,
    };
    console.log('[detectChartType] Detected bar chart:', result);
    return result;
  }

  // Two numeric columns: scatter
  if (numericColumns.length >= 2) {
    const result = {
      type: 'scatter' as const,
      xAxis: numericColumns[0],
      yAxis: numericColumns[1],
    };
    console.log('[detectChartType] Detected scatter chart:', result);
    return result;
  }

  // Fallback: try to use first two columns
  if (columns.length >= 2) {
    const result = {
      type: 'bar' as const,
      xAxis: columns[0],
      yAxis: columns[1],
    };
    console.log('[detectChartType] Fallback bar chart:', result);
    return result;
  }

  console.log('[detectChartType] Falling back to table');
  return { type: 'table' };
}

interface ChartContentProps {
  data: Record<string, unknown>[];
  chartConfig: ChartSuggestion;
  height?: number;
}

function ChartContent({ data, chartConfig, height = 300 }: ChartContentProps) {
  const { type, xAxis, yAxis } = chartConfig;

  // Debug logging
  console.log('[ChartContent] Config:', { type, xAxis, yAxis });
  console.log('[ChartContent] Data sample:', data.slice(0, 2));
  console.log('[ChartContent] Data columns:', data.length > 0 ? Object.keys(data[0]) : []);

  if (!xAxis || !yAxis) {
    // Try to auto-detect columns if not provided
    if (data.length > 0) {
      const columns = Object.keys(data[0]);
      console.log('[ChartContent] Attempting auto-detect with columns:', columns);
    }
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>Unable to determine chart axes.</p>
        <p className="text-xs mt-2">Available columns: {data.length > 0 ? Object.keys(data[0]).join(', ') : 'none'}</p>
        <p className="text-xs">Please switch to table view.</p>
      </div>
    );
  }

  // Verify the columns exist in data
  if (data.length > 0) {
    const columns = Object.keys(data[0]);
    if (!columns.includes(xAxis)) {
      console.warn(`[ChartContent] xAxis "${xAxis}" not found in data columns:`, columns);
    }
    if (!columns.includes(yAxis)) {
      console.warn(`[ChartContent] yAxis "${yAxis}" not found in data columns:`, columns);
    }
  }

  const commonProps = {
    width: '100%',
    height,
  };

  switch (type) {
    case 'line':
      return (
        <ResponsiveContainer {...commonProps}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey={xAxis}
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                if (typeof value === 'string' && value.length > 10) {
                  return value.slice(0, 10);
                }
                return value;
              }}
              className="text-foreground"
            />
            <YAxis tick={{ fontSize: 12 }} className="text-foreground" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey={yAxis}
              stroke={COLORS[0]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      );

    case 'bar':
      return (
        <ResponsiveContainer {...commonProps}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey={xAxis}
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                if (typeof value === 'string' && value.length > 15) {
                  return value.slice(0, 15) + '...';
                }
                return value;
              }}
              className="text-foreground"
            />
            <YAxis tick={{ fontSize: 12 }} className="text-foreground" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
              }}
            />
            <Legend />
            <Bar dataKey={yAxis} fill={COLORS[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );

    case 'pie':
      return (
        <ResponsiveContainer {...commonProps}>
          <PieChart>
            <Pie
              data={data}
              dataKey={yAxis}
              nameKey={xAxis}
              cx="50%"
              cy="50%"
              outerRadius={height / 3.5}
              label={({ name, percent }) =>
                `${name}: ${(percent * 100).toFixed(0)}%`
              }
              labelLine
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );

    case 'scatter':
      return (
        <ResponsiveContainer {...commonProps}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey={xAxis}
              name={xAxis}
              tick={{ fontSize: 12 }}
              type="number"
              className="text-foreground"
            />
            <YAxis
              dataKey={yAxis}
              name={yAxis}
              tick={{ fontSize: 12 }}
              type="number"
              className="text-foreground"
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
              }}
            />
            <Legend />
            <Scatter name="Data" data={data} fill={COLORS[0]} />
          </ScatterChart>
        </ResponsiveContainer>
      );

    default:
      return (
        <div className="text-center text-muted-foreground py-8">
          Chart type "{type}" not supported. Please switch to table view.
        </div>
      );
  }
}

export function ChartRenderer({ data, suggestion, title }: ChartRendererProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const chartConfig = useMemo(() => {
    return suggestion || detectChartType(data);
  }, [data, suggestion]);

  // Convert numeric string values to actual numbers for Recharts
  const processedData = useMemo(() => {
    if (!chartConfig.yAxis) return data;

    return data.map(row => {
      const newRow = { ...row };
      // Convert yAxis value to number if it's a numeric string
      if (chartConfig.yAxis && typeof newRow[chartConfig.yAxis] === 'string') {
        const numValue = Number(newRow[chartConfig.yAxis]);
        if (!isNaN(numValue)) {
          newRow[chartConfig.yAxis] = numValue;
        }
      }
      // Also convert xAxis for scatter plots
      if (chartConfig.type === 'scatter' && chartConfig.xAxis && typeof newRow[chartConfig.xAxis] === 'string') {
        const numValue = Number(newRow[chartConfig.xAxis]);
        if (!isNaN(numValue)) {
          newRow[chartConfig.xAxis] = numValue;
        }
      }
      return newRow;
    });
  }, [data, chartConfig]);

  const chartTitle = title || suggestion?.title || `${chartConfig.type.charAt(0).toUpperCase() + chartConfig.type.slice(1)} Chart`;

  // Export to PNG using canvas
  const exportToPng = useCallback(async () => {
    if (!chartRef.current) return;
    setExporting(true);
    try {
      const svgElement = chartRef.current.querySelector('svg');
      if (!svgElement) {
        throw new Error('No SVG element found');
      }

      // Clone the SVG and add white background
      const clonedSvg = svgElement.cloneNode(true) as SVGElement;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', '100%');
      rect.setAttribute('height', '100%');
      rect.setAttribute('fill', 'white');
      clonedSvg.insertBefore(rect, clonedSvg.firstChild);

      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

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
          canvas.toBlob((blob: Blob | null) => {
            if (blob) {
              saveAs(blob, `chart-${Date.now()}.png`);
            }
            URL.revokeObjectURL(url);
            setExporting(false);
          }, 'image/png');
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        setExporting(false);
        console.error('Failed to load SVG as image');
      };
      img.src = url;
    } catch (error) {
      console.error('Failed to export PNG:', error);
      setExporting(false);
    }
  }, []);

  // Export to SVG
  const exportToSvg = useCallback(async () => {
    if (!chartRef.current) return;
    setExporting(true);
    try {
      const svgElement = chartRef.current.querySelector('svg');
      if (svgElement) {
        // Clone and add white background
        const clonedSvg = svgElement.cloneNode(true) as SVGElement;
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', '100%');
        rect.setAttribute('height', '100%');
        rect.setAttribute('fill', 'white');
        clonedSvg.insertBefore(rect, clonedSvg.firstChild);

        const svgData = new XMLSerializer().serializeToString(clonedSvg);
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        saveAs(blob, `chart-${Date.now()}.svg`);
      }
    } catch (error) {
      console.error('Failed to export SVG:', error);
    } finally {
      setExporting(false);
    }
  }, []);

  // Export to PDF using canvas approach
  const exportToPdf = useCallback(async () => {
    if (!chartRef.current) return;
    setExporting(true);
    try {
      const svgElement = chartRef.current.querySelector('svg');
      if (!svgElement) {
        throw new Error('No SVG element found');
      }

      // Clone the SVG and add white background
      const clonedSvg = svgElement.cloneNode(true) as SVGElement;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', '100%');
      rect.setAttribute('height', '100%');
      rect.setAttribute('fill', 'white');
      clonedSvg.insertBefore(rect, clonedSvg.firstChild);

      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width * 2;
        canvas.height = img.height * 2;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(2, 2);
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);

          // Create PDF using data URL
          const imgData = canvas.toDataURL('image/png');

          // Simple PDF generation using data URL download
          // For proper PDF, we create a printable page
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Chart Export</title>
                  <style>
                    body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                    img { max-width: 100%; height: auto; }
                    @media print { body { margin: 0; } }
                  </style>
                </head>
                <body>
                  <img src="${imgData}" alt="Chart" />
                  <script>
                    window.onload = function() {
                      window.print();
                      window.onafterprint = function() { window.close(); };
                    };
                  </script>
                </body>
              </html>
            `);
            printWindow.document.close();
          }
        }
        URL.revokeObjectURL(url);
        setExporting(false);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        setExporting(false);
        console.error('Failed to load SVG as image');
      };
      img.src = url;
    } catch (error) {
      console.error('Failed to export PDF:', error);
      setExporting(false);
    }
  }, []);

  // Export to CSV
  const exportToCsv = useCallback(() => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map((row) =>
        headers.map((header) => {
          const value = row[header];
          const strValue = String(value ?? '');
          // Escape quotes and wrap in quotes if contains comma or quote
          if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
            return `"${strValue.replace(/"/g, '""')}"`;
          }
          return strValue;
        }).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `chart-data-${Date.now()}.csv`);
  }, [data]);

  // Copy share link
  const copyShareLink = useCallback(async () => {
    try {
      // Create a shareable data URL with encoded chart data
      const shareData = {
        type: chartConfig.type,
        xAxis: chartConfig.xAxis,
        yAxis: chartConfig.yAxis,
        title: chartTitle,
        data: data.slice(0, 100), // Limit data for URL
      };

      const encodedData = encodeURIComponent(JSON.stringify(shareData));
      const shareUrl = `${window.location.origin}/share/chart?data=${encodedData}`;

      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  }, [chartConfig, chartTitle, data]);

  // Share via Web Share API
  const shareChart = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: chartTitle,
          text: `Check out this ${chartConfig.type} chart`,
          url: window.location.href,
        });
      } catch (error) {
        // User cancelled or share failed, fallback to copy
        if ((error as Error).name !== 'AbortError') {
          copyShareLink();
        }
      }
    } else {
      copyShareLink();
    }
  }, [chartTitle, chartConfig.type, copyShareLink]);

  if (!data || data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No data to visualize
      </div>
    );
  }

  console.log('[ChartRenderer] Rendering chart:', {
    type: chartConfig.type,
    xAxis: chartConfig.xAxis,
    yAxis: chartConfig.yAxis,
    dataLength: processedData.length,
    sampleRow: processedData[0],
  });

  const toolbar = (
    <div className="flex items-center gap-1">
      {/* Export Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={exporting}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={exportToPng}>
            <FileImage className="h-4 w-4 mr-2" />
            Export as PNG
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportToSvg}>
            <FileImage className="h-4 w-4 mr-2" />
            Export as SVG
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportToPdf}>
            <FileText className="h-4 w-4 mr-2" />
            Export as PDF
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={exportToCsv}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Data as CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Fullscreen Button */}
      <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(true)}>
        <Maximize2 className="h-4 w-4 mr-1" />
        Fullscreen
      </Button>

      {/* Share Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <Share2 className="h-4 w-4 mr-1" />
            Share
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={shareChart}>
            <Share2 className="h-4 w-4 mr-2" />
            Share Chart
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyShareLink}>
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Link className="h-4 w-4 mr-2" />
                Copy Link
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-muted-foreground">{chartTitle}</h4>
        {toolbar}
      </div>

      {/* Chart */}
      <div ref={chartRef} className="bg-background p-4 rounded-lg">
        <ChartContent data={processedData} chartConfig={chartConfig} height={300} />
      </div>

      {/* Fullscreen Dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-8">
              <span>{chartTitle}</span>
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" disabled={exporting}>
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportToPng}>
                      <FileImage className="h-4 w-4 mr-2" />
                      Export as PNG
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToSvg}>
                      <FileImage className="h-4 w-4 mr-2" />
                      Export as SVG
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToPdf}>
                      <FileText className="h-4 w-4 mr-2" />
                      Export as PDF
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={exportToCsv}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Export Data as CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 p-4">
            <ChartContent data={processedData} chartConfig={chartConfig} height={Math.min(window.innerHeight * 0.7, 600)} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
