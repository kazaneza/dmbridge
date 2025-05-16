export interface DatabaseConnection {
  id: string;
  name: string;
  type: 'mysql' | 'postgresql' | 'mongodb' | 'sqlite';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  connectionString?: string;
  connected: boolean;
  error?: string;
}

export interface DatabaseTable {
  name: string;
  schema?: string;
  rowCount?: number;
  size?: number;
  columns: DatabaseColumn[];
  selected: boolean;
}

export interface DatabaseColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  selected: boolean;
}

export interface DatabaseSchema {
  tables: DatabaseTable[];
  loading: boolean;
  error?: string;
}