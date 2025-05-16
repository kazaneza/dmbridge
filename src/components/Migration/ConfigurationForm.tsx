import React, { useState } from 'react';
import { Settings, Play, AlertTriangle } from 'lucide-react';
import { MigrationOptions } from '../../types/migration';
import { DatabaseConnection } from '../../types/database';

interface ConfigurationFormProps {
  sourceConnection: DatabaseConnection;
  destinationConnection: DatabaseConnection;
  selectedTableCount: number;
  totalRowCount: number;
  estimatedTime: number;
  onStartMigration: (options: MigrationOptions, name: string) => void;
}

const ConfigurationForm: React.FC<ConfigurationFormProps> = ({
  sourceConnection,
  destinationConnection,
  selectedTableCount,
  totalRowCount,
  estimatedTime,
  onStartMigration,
}) => {
  const [name, setName] = useState<string>(
    `${sourceConnection.name} to ${destinationConnection.name} - ${new Date().toLocaleString()}`
  );
  
  const [options, setOptions] = useState<MigrationOptions>({
    truncateBeforeInsert: false,
    batchSize: 1000,
    skipErrors: false,
    validateBeforeMigration: true,
  });
  
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setOptions(prev => ({
      ...prev,
      [name]: checked,
    }));
  };
  
  const handleBatchSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setOptions(prev => ({
      ...prev,
      batchSize: parseInt(e.target.value, 10),
    }));
  };
  
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)} seconds`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const remainingMinutes = Math.floor((seconds % 3600) / 60);
      return `${hours} hour${hours > 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center">
          <Settings className="h-5 w-5 text-gray-500 mr-2" />
          <h2 className="text-lg font-medium text-gray-900">Migration Configuration</h2>
        </div>
      </div>
      
      <div className="p-6">
        <div className="mb-6">
          <label htmlFor="migration-name" className="block text-sm font-medium text-gray-700 mb-1">
            Migration Name
          </label>
          <input
            type="text"
            id="migration-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
        
        <div className="mb-6 bg-blue-50 p-4 rounded-md">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">Migration Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-blue-600">Source</p>
              <p className="text-sm font-medium text-blue-900">{sourceConnection.name}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600">Destination</p>
              <p className="text-sm font-medium text-blue-900">{destinationConnection.name}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600">Estimated Time</p>
              <p className="text-sm font-medium text-blue-900">{formatDuration(estimatedTime)}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600">Tables</p>
              <p className="text-sm font-medium text-blue-900">{selectedTableCount}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600">Total Rows</p>
              <p className="text-sm font-medium text-blue-900">{totalRowCount.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Options</h3>
          
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="validate"
                  name="validateBeforeMigration"
                  type="checkbox"
                  checked={options.validateBeforeMigration}
                  onChange={handleCheckboxChange}
                  className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="validate" className="font-medium text-gray-700">
                  Validate before migration
                </label>
                <p className="text-gray-500">
                  Check data compatibility between source and destination before starting the migration.
                </p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="truncate"
                  name="truncateBeforeInsert"
                  type="checkbox"
                  checked={options.truncateBeforeInsert}
                  onChange={handleCheckboxChange}
                  className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="truncate" className="font-medium text-gray-700">
                  Truncate destination tables before insert
                </label>
                <p className="text-gray-500">
                  Clear all data in the destination tables before importing new data.
                </p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="skip-errors"
                  name="skipErrors"
                  type="checkbox"
                  checked={options.skipErrors}
                  onChange={handleCheckboxChange}
                  className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="skip-errors" className="font-medium text-gray-700">
                  Continue on error
                </label>
                <p className="text-gray-500">
                  If an error occurs, skip the problematic row and continue with the migration.
                </p>
              </div>
            </div>
            
            <div className="mt-4">
              <label htmlFor="batch-size" className="block text-sm font-medium text-gray-700 mb-1">
                Batch Size
              </label>
              <select
                id="batch-size"
                value={options.batchSize}
                onChange={handleBatchSizeChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
              >
                <option value={100}>100 rows per batch (slow but safe)</option>
                <option value={500}>500 rows per batch</option>
                <option value={1000}>1000 rows per batch (recommended)</option>
                <option value={5000}>5000 rows per batch (faster)</option>
                <option value={10000}>10000 rows per batch (fastest but may cause issues)</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Larger batch sizes can improve performance but may require more memory.
              </p>
            </div>
          </div>
        </div>
        
        {options.truncateBeforeInsert && (
          <div className="mb-6 p-4 bg-amber-50 rounded-md flex items-start">
            <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-amber-800">Warning: Data Destruction</h4>
              <p className="text-xs text-amber-700 mt-1">
                You've selected to truncate destination tables. This will permanently delete all existing
                data in the destination tables. This action cannot be undone.
              </p>
            </div>
          </div>
        )}
        
        <div className="flex justify-end">
          <button
            onClick={() => onStartMigration(options, name)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
          >
            <Play className="mr-2 h-4 w-4" />
            Start Migration
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfigurationForm;