import React, { useEffect, useRef } from 'react';
import { 
  Clock, 
  Database, 
  BarChart, 
  CheckCircle, 
  AlertCircle,
  XCircle,
  Play,
  Pause
} from 'lucide-react';
import { MigrationProgress, MigrationConfig } from '../../types/migration';
import { formatDuration } from '../../utils/migrationUtils';

interface ProgressTrackerProps {
  migrationConfig: MigrationConfig;
  progress: MigrationProgress;
  onCancel: () => void;
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  migrationConfig,
  progress,
  onCancel,
}) => {
  const progressBarRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (progressBarRef.current) {
      progressBarRef.current.style.width = `${progress.overallProgress}%`;
    }
  }, [progress.overallProgress]);
  
  const isInProgress = progress.status === 'in_progress' || progress.status === 'validating';
  const isCompleted = progress.status === 'completed';
  const isFailed = progress.status === 'failed';
  
  const renderStatusBadge = () => {
    switch (progress.status) {
      case 'validating':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-md bg-blue-100 text-blue-800">
            Validating
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-md bg-teal-100 text-teal-800">
            In Progress
          </span>
        );
      case 'completed':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-800">
            Completed
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-md bg-red-100 text-red-800">
            Failed
          </span>
        );
      case 'canceled':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-800">
            Canceled
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-800">
            {progress.status}
          </span>
        );
    }
  };
  
  const renderIcon = () => {
    switch (progress.status) {
      case 'validating':
      case 'in_progress':
        return <Play className="h-5 w-5 text-teal-500" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'canceled':
        return <Pause className="h-5 w-5 text-gray-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            {renderIcon()}
            <h2 className="text-lg font-semibold text-gray-800">{migrationConfig.name}</h2>
            {renderStatusBadge()}
          </div>
          
          {isInProgress && (
            <button
              onClick={onCancel}
              className="px-3 py-1 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
      
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <BarChart className="h-4 w-4 text-gray-500 mr-2" />
              <span className="text-sm font-medium text-gray-700">Overall Progress</span>
            </div>
            <span className="text-sm font-medium text-teal-600">{Math.round(progress.overallProgress)}%</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              ref={progressBarRef}
              className={`h-2.5 rounded-full transition-all duration-500 ${
                isCompleted ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-teal-500'
              }`}
              style={{ width: `${progress.overallProgress}%` }}
            ></div>
          </div>
          
          {progress.currentTable && (
            <div className="mt-2 flex justify-between items-center text-xs text-gray-500">
              <span>
                Current table: <span className="font-mono">{progress.currentTable}</span>
              </span>
              <span>{Math.round(progress.currentTableProgress)}% complete</span>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-xs text-gray-500 mb-1">Tables</div>
            <div className="text-lg font-semibold text-gray-900">
              {progress.processedTables} / {progress.totalTables}
            </div>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-xs text-gray-500 mb-1">Rows Processed</div>
            <div className="text-lg font-semibold text-gray-900">
              {progress.processedRows.toLocaleString()}
            </div>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-xs text-gray-500 mb-1">Elapsed Time</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatDuration(
                (progress.endTime || new Date()).getTime() / 1000 - 
                progress.startTime.getTime() / 1000
              )}
            </div>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-xs text-gray-500 mb-1">Remaining Time</div>
            <div className="text-lg font-semibold text-gray-900">
              {isInProgress 
                ? formatDuration(progress.estimatedTimeRemaining)
                : '—'
              }
            </div>
          </div>
        </div>
        
        {progress.errors.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center mb-2">
              <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
              <h3 className="text-sm font-medium text-gray-900">
                Errors ({progress.errors.length})
              </h3>
            </div>
            
            <div className="bg-red-50 rounded-md p-3 max-h-[200px] overflow-y-auto">
              <ul className="space-y-2">
                {progress.errors.map((error, index) => (
                  <li key={index} className="text-xs text-red-700">
                    <span className="font-semibold">{error.table}</span>
                    {error.row !== undefined && <span> (Row {error.row})</span>}
                    : {error.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        
        {isCompleted && (
          <div className="mt-6 bg-green-50 p-4 rounded-md flex items-start">
            <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-green-800">Migration Completed Successfully</h3>
              <p className="mt-1 text-xs text-green-700">
                Migration completed in {formatDuration(
                  progress.endTime!.getTime() / 1000 - progress.startTime.getTime() / 1000
                )}. {progress.processedRows.toLocaleString()} rows were processed across {progress.processedTables} tables.
                {progress.errors.length > 0 && ` ${progress.errors.length} errors were encountered but skipped.`}
              </p>
            </div>
          </div>
        )}
        
        {isFailed && (
          <div className="mt-6 bg-red-50 p-4 rounded-md flex items-start">
            <XCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-red-800">Migration Failed</h3>
              <p className="mt-1 text-xs text-red-700">
                Migration failed after {formatDuration(
                  progress.endTime!.getTime() / 1000 - progress.startTime.getTime() / 1000
                )}. {progress.processedRows.toLocaleString()} rows were processed before the failure.
                Check the errors above for details.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressTracker;