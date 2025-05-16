import { v4 as uuidv4 } from 'uuid';
import { 
  DatabaseConnection, 
  DatabaseTable,
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

// Function to retrieve schema information from the backend
export const fetchDatabaseSchema = async (
  connection: DatabaseConnection
): Promise<DatabaseSchema> => {
  try {
    const response = await fetch(`http://localhost:8000/api/connections/${connection.id}/schema`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch schema');
    }
    
    const tables = await response.json();
    return {
      tables,
      loading: false
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch schema');
  }
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
  const rowsPerSecond = 1000; // Estimated value
  const estimatedSeconds = Math.ceil(totalRows / rowsPerSecond);
  
  return Math.max(estimatedSeconds, 5); // Minimum 5 seconds
};