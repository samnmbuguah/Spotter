import React, { useRef, useEffect, useState, useCallback } from 'react';
import { LogSheetData, LogSheetGridCell, LogSheetDrawEvent } from '../../types';

interface LogSheetCanvasProps {
  logSheetData: LogSheetData;
  onDataChange: (data: LogSheetData) => void;
  readonly?: boolean;
  width?: number;
  height?: number;
}

const DUTY_STATUS_COLORS = {
  off_duty: '#10B981', // Green
  sleeper_berth: '#8B5CF6', // Purple
  driving: '#3B82F6', // Blue
  on_duty_not_driving: '#F59E0B', // Orange
};

const LogSheetCanvas: React.FC<LogSheetCanvasProps> = ({
  logSheetData,
  onDataChange,
  readonly = false,
  width = 800,
  height = 600,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<LogSheetGridCell['status']>('off_duty');
  const [lastDrawnCell, setLastDrawnCell] = useState<{ row: number; col: number } | null>(null);

  // Grid dimensions (24 hours x 4 quarters per hour = 96 cells)
  const HOURS_PER_DAY = 24;
  const QUARTERS_PER_HOUR = 4;
  const TOTAL_CELLS = HOURS_PER_DAY * QUARTERS_PER_HOUR;

  const cellWidth = width / HOURS_PER_DAY;
  const cellHeight = (height - 100) / QUARTERS_PER_HOUR; // Reserve space for header

  useEffect(() => {
    drawLogSheet();
  }, [logSheetData, selectedStatus]);

  const drawLogSheet = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Draw header
    drawHeader(ctx);

    // Draw grid
    drawGrid(ctx);

    // Draw duty status data
    drawDutyStatus(ctx);

    // Draw time labels
    drawTimeLabels(ctx);
  }, [width, height, logSheetData]);

  const drawHeader = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#F3F4F6';
    ctx.fillRect(0, 0, width, 60);

    ctx.strokeStyle = '#D1D5DB';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, 60);

    // Draw date and driver info
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Driver: ${logSheetData.driver_name}`, 20, 25);

    ctx.font = '14px Inter, sans-serif';
    ctx.fillText(`Date: ${new Date(logSheetData.date).toLocaleDateString()}`, 20, 45);

    if (logSheetData.truck_number) {
      ctx.fillText(`Truck #: ${logSheetData.truck_number}`, width - 200, 25);
    }
    if (logSheetData.trailer_number) {
      ctx.fillText(`Trailer #: ${logSheetData.trailer_number}`, width - 200, 45);
    }
  };

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 0.5;

    // Draw vertical lines (hours)
    for (let hour = 0; hour <= HOURS_PER_DAY; hour++) {
      const x = hour * cellWidth;
      ctx.beginPath();
      ctx.moveTo(x, 60);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Draw hour labels
      if (hour < HOURS_PER_DAY) {
        ctx.fillStyle = '#6B7280';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${hour}:00`, x + cellWidth / 2, height - 10);
      }
    }

    // Draw horizontal lines (quarters)
    for (let quarter = 0; quarter <= QUARTERS_PER_HOUR; quarter++) {
      const y = 60 + quarter * cellHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  const drawDutyStatus = (ctx: CanvasRenderingContext2D) => {
    logSheetData.grid.forEach((cell) => {
      const hour = Math.floor(cell.hour / QUARTERS_PER_HOUR);
      const quarter = cell.hour % QUARTERS_PER_HOUR;

      const x = hour * cellWidth;
      const y = 60 + quarter * cellHeight;

      // Fill cell with status color
      ctx.fillStyle = DUTY_STATUS_COLORS[cell.status];
      ctx.fillRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);

      // Add border
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);

      // Add status label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '8px Inter, sans-serif';
      ctx.textAlign = 'center';
      const statusText = cell.status.replace('_', ' ').toUpperCase();
      ctx.fillText(statusText, x + cellWidth / 2, y + cellHeight / 2 + 3);
    });
  };

  const drawTimeLabels = (ctx: CanvasRenderingContext2D) => {
    // Draw quarter hour labels on the left
    ctx.fillStyle = '#6B7280';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'right';

    for (let quarter = 0; quarter < QUARTERS_PER_HOUR; quarter++) {
      const y = 60 + (quarter + 0.5) * cellHeight;
      const minutes = quarter * 15;
      ctx.fillText(`${minutes}:00`, 40, y + 3);
    }
  };

  const getCellFromMouseEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if click is in grid area
    if (x < 0 || x >= width || y < 60 || y >= height) return null;

    const hour = Math.floor(x / cellWidth);
    const quarter = Math.floor((y - 60) / cellHeight);

    return { hour, quarter, cellIndex: hour * QUARTERS_PER_HOUR + quarter };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readonly) return;

    const cell = getCellFromMouseEvent(e);
    if (!cell) return;

    setIsDrawing(true);
    setLastDrawnCell({ row: cell.quarter, col: cell.hour });

    // Update cell status
    updateCellStatus(cell.cellIndex, selectedStatus);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || readonly) return;

    const cell = getCellFromMouseEvent(e);
    if (!cell || !lastDrawnCell) return;

    // Check if we've moved to a different cell
    if (cell.quarter !== lastDrawnCell.row || cell.hour !== lastDrawnCell.col) {
      setLastDrawnCell({ row: cell.quarter, col: cell.hour });
      updateCellStatus(cell.cellIndex, selectedStatus);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setLastDrawnCell(null);
  };

  const updateCellStatus = (cellIndex: number, status: LogSheetGridCell['status']) => {
    const updatedGrid = [...logSheetData.grid];
    const existingIndex = updatedGrid.findIndex(cell => cell.hour === cellIndex);

    if (existingIndex >= 0) {
      updatedGrid[existingIndex] = { ...updatedGrid[existingIndex], status };
    } else {
      updatedGrid.push({
        hour: cellIndex,
        status,
      });
    }

    // Sort by hour
    updatedGrid.sort((a, b) => a.hour - b.hour);

    onDataChange({
      ...logSheetData,
      grid: updatedGrid,
    });
  };

  const clearLogSheet = () => {
    onDataChange({
      ...logSheetData,
      grid: [],
    });
  };

  const exportLogSheet = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `log-sheet-${logSheetData.date}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Daily Log Sheet</h3>
        <div className="flex space-x-2">
          {!readonly && (
            <>
              <button
                onClick={clearLogSheet}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={exportLogSheet}
                className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded-md text-white transition-colors"
              >
                Export
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status Selection */}
      {!readonly && (
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(DUTY_STATUS_COLORS).map(([status, color]) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status as LogSheetGridCell['status'])}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedStatus === status
                  ? 'ring-2 ring-gray-400 bg-gray-100'
                  : 'hover:bg-gray-50'
              }`}
              style={{
                backgroundColor: selectedStatus === status ? '#F3F4F6' : 'transparent',
                border: `2px solid ${color}`,
                color: '#374151',
              }}
            >
              {status.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* Canvas */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="block cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        {Object.entries(DUTY_STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center space-x-2">
            <div
              className="w-4 h-4 rounded border border-gray-300"
              style={{ backgroundColor: color }}
            />
            <span className="text-gray-600 capitalize">
              {status.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LogSheetCanvas;
