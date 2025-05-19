import { v4 as uuidv4 } from 'uuid';
import { 
  MigrationConfig, 
  MigrationTable, 
  MigrationOptions,
  MigrationProgress,
  MigrationStatus,
  MigrationError
} from '../types/migration';
import { DatabaseTable } from '../types/database';

// Create a new migration configuration
export const createMigrationConfig = (
  name: string,
  sourceConnectionId: string,
  destinationConnectionId: string,
  selectedTables: MigrationTable[],
  options: Partial<MigrationOptions> = {}
): MigrationConfig => {
  return {
    id: uuidv4(),
    name,
    sourceConnectionId,
    destinationConnectionId,
    selectedTables,
    createdAt: new Date(),
    status: 'draft',
    options: {
      truncateBeforeInsert: options.truncateBeforeInsert ?? false,
      batchSize: options.batchSize ?? 1000000, // Default to 1M rows
      skipErrors: options.skipErrors ?? false,
      validateBeforeMigration: options.validateBeforeMigration ?? true,
      useCsvExtraction: true // Always use CSV extraction
    }
  };
};

// Convert selected database tables to migration tables
export const createMigrationTables = (
  tables: DatabaseTable[]
): MigrationTable[] => {
  return tables
    .filter(table => table.selected)
    .map(table => ({
      name: table.name,
      schema: table.schema,
      selectedColumns: table.columns
        .filter(column => column.selected)
        .map(column => column.name),
      destinationTable: table.name, // Use the same table name
    }));
};

// Initialize migration progress
export const initializeMigrationProgress = (
  migrationId: string,
  tables: MigrationTable[]
): MigrationProgress => {
  return {
    migrationId,
    startTime: new Date(),
    processedTables: 0,
    totalTables: tables.length,
    processedRows: 0,
    totalRows: 0,
    currentTableProgress: 0,
    overallProgress: 0,
    estimatedTimeRemaining: 0,
    errors: [],
    status: 'extracting',
    currentChunk: 0,
    totalChunks: 0
  };
};

// Helper function to format time duration
export const formatDuration = (seconds: number): string => {
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

// Function to start migration process
export const runMigration = async (
  config: MigrationConfig,
  onProgress: (progress: MigrationProgress) => void
): Promise<void> => {
  let progress = initializeMigrationProgress(config.id, config.selectedTables);
  onProgress(progress);

  try {
    const response = await fetch('http://localhost:8000/api/migration/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_connection_id: config.sourceConnectionId,
        destination_connection_id: config.destinationConnectionId,
        table_name: config.selectedTables[0].name,
        schema: config.selectedTables[0].schema,
        chunk_size: config.options.batchSize,
        selected_columns: config.selectedTables[0].selectedColumns
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to start migration');
    }

    const result = await response.json();
    
    // Update progress with actual data
    progress = {
      ...progress,
      processedRows: result.chunks_processed * config.options.batchSize,
      currentTableProgress: 100,
      overallProgress: 100,
      status: 'completed',
      endTime: new Date(),
      estimatedTimeRemaining: 0
    };
    
    onProgress(progress);
  } catch (error) {
    progress = {
      ...progress,
      status: 'failed',
      endTime: new Date(),
      errors: [
        ...progress.errors,
        {
          table: config.selectedTables[0].name,
          message: error.message,
          timestamp: new Date()
        }
      ]
    };
    onProgress(progress);
    throw error;
  }
};