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
      destinationTable: `${table.name}_migrated`, // Create new table with _migrated suffix
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
    status: 'pending',
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
  try {
    const response = await fetch('http://localhost:8000/api/migration/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      throw new Error('Failed to start migration');
    }

    // Set up event source for progress updates
    const eventSource = new EventSource(`http://localhost:8000/api/migration/${config.id}/progress`);
    
    eventSource.onmessage = (event) => {
      const progress = JSON.parse(event.data);
      onProgress(progress);
      
      if (progress.status === 'completed' || progress.status === 'failed') {
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      throw new Error('Lost connection to migration progress stream');
    };
  } catch (error) {
    throw new Error(`Migration failed: ${error.message}`);
  }
};