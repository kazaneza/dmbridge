import { v4 as uuidv4 } from 'uuid';
import { 
  DatabaseConnection, 
  DatabaseTable, 
  DatabaseColumn,
  DatabaseSchema 
} from '../types/database';

// Mock function to simulate connecting to a database
export const connectToDatabase = async (
  connection: DatabaseConnection
): Promise<DatabaseConnection> => {
  // In a real application, this would connect to the actual database
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        ...connection,
        connected: true,
        error: undefined
      });
    }, 1000);
  });
};

// Mock function to simulate disconnecting from a database
export const disconnectFromDatabase = async (
  connection: DatabaseConnection
): Promise<DatabaseConnection> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        ...connection,
        connected: false
      });
    }, 500);
  });
};

// Mock function to retrieve schema information
export const fetchDatabaseSchema = async (
  connection: DatabaseConnection
): Promise<DatabaseSchema> => {
  // In a real application, this would query the database for tables and columns
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockTables = getMockTablesForType(connection.type, connection.database || '');
      resolve({
        tables: mockTables,
        loading: false
      });
    }, 1500);
  });
};

// Function to create a new database connection object
export const createConnection = (
  name: string,
  type: DatabaseConnection['type'],
  connectionDetails: Partial<DatabaseConnection>
): DatabaseConnection => {
  return {
    id: uuidv4(),
    name,
    type,
    connected: false,
    ...connectionDetails
  };
};

// Function to validate connection parameters
export const validateConnectionParams = (connection: Partial<DatabaseConnection>): string | null => {
  if (!connection.name?.trim()) {
    return 'Connection name is required';
  }
  
  if (!connection.type) {
    return 'Database type is required';
  }
  
  if (connection.connectionString) {
    return null; // If connection string is provided, other fields are optional
  }
  
  if (!connection.host && connection.type !== 'sqlite') {
    return 'Host is required';
  }
  
  if (!connection.database) {
    return 'Database name is required';
  }
  
  return null; // Connection is valid
};

// Mock function to estimate migration time
export const estimateMigrationTime = (
  tables: DatabaseTable[],
  batchSize: number
): number => {
  // This would be more sophisticated in a real app, considering:
  // - Network latency
  // - Database performance
  // - Table sizes
  // - Indexes
  // - Constraints
  
  const totalRows = tables.reduce((sum, table) => sum + (table.rowCount || 0), 0);
  const rowsPerSecond = 1000; // Mock value
  const estimatedSeconds = Math.ceil(totalRows / rowsPerSecond);
  
  return Math.max(estimatedSeconds, 5); // Minimum 5 seconds
};

// Helper function to generate mock tables based on database type
const getMockTablesForType = (type: DatabaseConnection['type'], dbName: string): DatabaseTable[] => {
  switch (type) {
    case 'mysql':
      return [
        createMockTable('customers', 'public', 10000, [
          createMockColumn('id', 'int', false, true),
          createMockColumn('name', 'varchar(255)', false, false),
          createMockColumn('email', 'varchar(255)', false, false),
          createMockColumn('created_at', 'datetime', false, false),
        ]),
        createMockTable('orders', 'public', 50000, [
          createMockColumn('id', 'int', false, true),
          createMockColumn('customer_id', 'int', false, false),
          createMockColumn('amount', 'decimal(10,2)', false, false),
          createMockColumn('status', 'varchar(50)', false, false),
          createMockColumn('created_at', 'datetime', false, false),
        ]),
        createMockTable('products', 'public', 5000, [
          createMockColumn('id', 'int', false, true),
          createMockColumn('name', 'varchar(255)', false, false),
          createMockColumn('price', 'decimal(10,2)', false, false),
          createMockColumn('stock', 'int', true, false),
          createMockColumn('category', 'varchar(100)', true, false),
        ]),
      ];
    case 'postgresql':
      return [
        createMockTable('users', 'public', 15000, [
          createMockColumn('id', 'uuid', false, true),
          createMockColumn('email', 'text', false, false),
          createMockColumn('name', 'text', true, false),
          createMockColumn('created_at', 'timestamp with time zone', false, false),
        ]),
        createMockTable('posts', 'public', 75000, [
          createMockColumn('id', 'uuid', false, true),
          createMockColumn('user_id', 'uuid', false, false),
          createMockColumn('title', 'text', false, false),
          createMockColumn('content', 'text', false, false),
          createMockColumn('published', 'boolean', false, false),
          createMockColumn('created_at', 'timestamp with time zone', false, false),
        ]),
        createMockTable('comments', 'public', 120000, [
          createMockColumn('id', 'uuid', false, true),
          createMockColumn('post_id', 'uuid', false, false),
          createMockColumn('user_id', 'uuid', false, false),
          createMockColumn('content', 'text', false, false),
          createMockColumn('created_at', 'timestamp with time zone', false, false),
        ]),
      ];
    case 'mongodb':
      return [
        createMockTable('users', undefined, 20000, [
          createMockColumn('_id', 'ObjectID', false, true),
          createMockColumn('email', 'String', false, false),
          createMockColumn('name', 'String', true, false),
          createMockColumn('createdAt', 'Date', false, false),
        ]),
        createMockTable('items', undefined, 100000, [
          createMockColumn('_id', 'ObjectID', false, true),
          createMockColumn('name', 'String', false, false),
          createMockColumn('price', 'Number', false, false),
          createMockColumn('categories', 'Array', true, false),
          createMockColumn('createdAt', 'Date', false, false),
        ]),
      ];
    case 'sqlite':
      return [
        createMockTable('users', undefined, 5000, [
          createMockColumn('id', 'INTEGER', false, true),
          createMockColumn('name', 'TEXT', false, false),
          createMockColumn('email', 'TEXT', false, false),
          createMockColumn('created_at', 'TEXT', false, false),
        ]),
        createMockTable('tasks', undefined, 15000, [
          createMockColumn('id', 'INTEGER', false, true),
          createMockColumn('user_id', 'INTEGER', false, false),
          createMockColumn('title', 'TEXT', false, false),
          createMockColumn('completed', 'INTEGER', false, false),
          createMockColumn('created_at', 'TEXT', false, false),
        ]),
      ];
    default:
      return [];
  }
};

// Helper functions to create mock tables and columns
const createMockTable = (
  name: string, 
  schema: string | undefined, 
  rowCount: number, 
  columns: DatabaseColumn[]
): DatabaseTable => ({
  name,
  schema,
  rowCount,
  size: Math.floor(rowCount * columns.length * 100),
  columns,
  selected: false,
});

const createMockColumn = (
  name: string, 
  type: string, 
  nullable: boolean, 
  isPrimaryKey: boolean
): DatabaseColumn => ({
  name,
  type,
  nullable,
  isPrimaryKey,
  selected: true, // By default, select all columns
});