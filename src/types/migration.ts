export interface MigrationConfig {
  id: string;
  name: string;
  sourceConnectionId: string;
  destinationConnectionId: string;
  selectedTables: MigrationTable[];
  createdAt: Date;
  status: MigrationStatus;
  options: MigrationOptions;
}

export interface MigrationTable {
  name: string;
  schema?: string;
  selectedColumns: string[];
  destinationTable: string;
  transformations?: Record<string, string>;
}

export interface MigrationOptions {
  truncateBeforeInsert: boolean;
  batchSize: number;
  skipErrors: boolean;
  validateBeforeMigration: boolean;
}

export type MigrationStatus = 
  | 'draft'
  | 'validating'
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'canceled';

export interface MigrationProgress {
  migrationId: string;
  startTime: Date;
  endTime?: Date;
  currentTable?: string;
  processedTables: number;
  totalTables: number;
  processedRows: number;
  totalRows: number;
  currentTableProgress: number;
  overallProgress: number;
  estimatedTimeRemaining: number; // in seconds
  errors: MigrationError[];
  status: MigrationStatus;
}

export interface MigrationError {
  table: string;
  row?: number;
  message: string;
  timestamp: Date;
}

export interface MigrationHistory {
  migrations: MigrationSummary[];
  loading: boolean;
}

export interface MigrationSummary {
  id: string;
  name: string;
  source: string;
  destination: string;
  tableCount: number;
  rowCount: number;
  startTime: Date;
  endTime?: Date;
  duration: number; // in seconds
  status: MigrationStatus;
  hasErrors: boolean;
}