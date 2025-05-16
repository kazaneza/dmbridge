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
      batchSize: options.batchSize ?? 1000,
      skipErrors: options.skipErrors ?? false,
      validateBeforeMigration: options.validateBeforeMigration ?? true,
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
      destinationTable: table.name,
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
    totalRows: 0, // This would be calculated based on actual table sizes
    currentTableProgress: 0,
    overallProgress: 0,
    estimatedTimeRemaining: 0,
    errors: [],
    status: 'pending'
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

// Mock function to simulate the migration process
export const runMigration = async (
  config: MigrationConfig,
  onProgress: (progress: MigrationProgress) => void
): Promise<MigrationProgress> => {
  // Initialize progress
  let progress = initializeMigrationProgress(config.id, config.selectedTables);
  progress.status = 'in_progress';
  progress.totalRows = config.selectedTables.reduce((sum, table) => sum + 5000, 0); // Mock row count
  onProgress(progress);
  
  // Mock validation step
  if (config.options.validateBeforeMigration) {
    progress.status = 'validating';
    onProgress(progress);
    await simulateDelay(2000);
  }
  
  // Process each table
  for (let i = 0; i < config.selectedTables.length; i++) {
    const table = config.selectedTables[i];
    progress.currentTable = table.name;
    progress.currentTableProgress = 0;
    onProgress(progress);
    
    // Mock row processing for current table
    const totalRowsInTable = 5000; // Mock value
    for (let row = 0; row < totalRowsInTable; row += 100) {
      await simulateDelay(100); // Simulate processing delay
      
      // Random error simulation (5% chance)
      if (Math.random() < 0.05 && !config.options.skipErrors) {
        const error: MigrationError = {
          table: table.name,
          row: row,
          message: `Error processing row ${row}: Mock error message`,
          timestamp: new Date()
        };
        progress.errors.push(error);
        
        // If we're not skipping errors, fail the migration
        if (!config.options.skipErrors) {
          progress.status = 'failed';
          progress.endTime = new Date();
          onProgress(progress);
          return progress;
        }
      }
      
      // Update progress
      const rowsProcessed = Math.min(row + 100, totalRowsInTable);
      progress.processedRows += 100;
      progress.currentTableProgress = (rowsProcessed / totalRowsInTable) * 100;
      progress.overallProgress = (progress.processedRows / progress.totalRows) * 100;
      
      // Calculate estimated time remaining
      const elapsedMs = new Date().getTime() - progress.startTime.getTime();
      const elapsedSeconds = elapsedMs / 1000;
      const percentComplete = progress.processedRows / progress.totalRows;
      if (percentComplete > 0) {
        const totalEstimatedSeconds = elapsedSeconds / percentComplete;
        progress.estimatedTimeRemaining = Math.max(0, totalEstimatedSeconds - elapsedSeconds);
      }
      
      onProgress(progress);
    }
    
    progress.processedTables++;
  }
  
  // Mark migration as completed
  progress.status = 'completed';
  progress.endTime = new Date();
  progress.overallProgress = 100;
  progress.estimatedTimeRemaining = 0;
  onProgress(progress);
  
  return progress;
};

// Helper function to simulate processing delay
const simulateDelay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};