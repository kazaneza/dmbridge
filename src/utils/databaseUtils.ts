import { v4 as uuidv4 } from 'uuid';
import { 
  DatabaseConnection, 
  DatabaseTable, 
  DatabaseColumn,
  DatabaseSchema 
} from '../types/database';

// Function to save a connection to the backend
export const saveConnection = async (connection: DatabaseConnection): Promise<void> => {
  try {
    const response = await fetch('http://localhost:8000/api/connections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(connection),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to save connection');
    }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to save connection');
  }
};

// Function to load saved connections from the backend
export const loadConnections = async (): Promise<DatabaseConnection[]> => {
  try {
    const response = await fetch('http://localhost:8000/api/connections');
    if (!response.ok) {
      throw new Error('Failed to load connections');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading connections:', error);
    return [];
  }
};

// Function to connect to the backend API
export const connectToDatabase = async (
  connection: DatabaseConnection
): Promise<DatabaseConnection> => {
  try {
    const response = await fetch('http://localhost:8000/api/connections/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(connection),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to connect to database');
    }

    return {
      ...connection,
      connected: true,
      error: undefined
    };
  } catch (error) {
    return {
      ...connection,
      connected: false,
      error: error instanceof Error ? error.message : 'Failed to connect to database'
    };
  }
};

// Function to disconnect from a database
export const disconnectFromDatabase = async (
  connection: DatabaseConnection
): Promise<DatabaseConnection> => {
  return {
    ...connection,
    connected: false
  };
};

// Function to retrieve schema information
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
    return connection.type === 'oracle' ? 'Service Name is required' : 'Database name is required';
  }
  
  return null; // Connection is valid
};

// Function to estimate migration time
export const estimateMigrationTime = (
  tables: DatabaseTable[],
  batchSize: number
): number => {
  const totalRows = tables.reduce((sum, table) => sum + (table.rowCount || 0), 0);
  const rowsPerSecond = 1000; // Mock value
  const estimatedSeconds = Math.ceil(totalRows / rowsPerSecond);
  
  return Math.max(estimatedSeconds, 5); // Minimum 5 seconds
};

// Helper function to generate mock tables based on database type
const getMockTablesForType = (type: DatabaseConnection['type'], dbName: string): DatabaseTable[] => {
  switch (type) {
    case 'mssql':
      return [
        createMockTable('Customers', 'dbo', 10000, [
          createMockColumn('CustomerID', 'int', false, true),
          createMockColumn('Name', 'nvarchar(100)', false, false),
          createMockColumn('Email', 'nvarchar(255)', false, false),
          createMockColumn('CreatedAt', 'datetime', false, false),
        ]),
        createMockTable('Orders', 'dbo', 50000, [
          createMockColumn('OrderID', 'int', false, true),
          createMockColumn('CustomerID', 'int', false, false),
          createMockColumn('Amount', 'decimal(18,2)', false, false),
          createMockColumn('Status', 'nvarchar(50)', false, false),
          createMockColumn('OrderDate', 'datetime', false, false),
        ]),
      ];
    case 'oracle':
      return [
        createMockTable('EMPLOYEES', 'HR', 15000, [
          createMockColumn('EMPLOYEE_ID', 'NUMBER', false, true),
          createMockColumn('FIRST_NAME', 'VARCHAR2(50)', true, false),
          createMockColumn('LAST_NAME', 'VARCHAR2(50)', false, false),
          createMockColumn('EMAIL', 'VARCHAR2(100)', false, false),
          createMockColumn('HIRE_DATE', 'DATE', false, false),
        ]),
        createMockTable('DEPARTMENTS', 'HR', 5000, [
          createMockColumn('DEPARTMENT_ID', 'NUMBER', false, true),
          createMockColumn('DEPARTMENT_NAME', 'VARCHAR2(100)', false, false),
          createMockColumn('MANAGER_ID', 'NUMBER', true, false),
          createMockColumn('LOCATION_ID', 'NUMBER', true, false),
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