import React, { createContext, useContext, useReducer } from 'react';
import { DatabaseConnection, DatabaseSchema } from '../types/database';
import { MigrationConfig, MigrationProgress, MigrationHistory } from '../types/migration';

interface AppState {
  connections: DatabaseConnection[];
  sourceConnection: DatabaseConnection | null;
  destinationConnection: DatabaseConnection | null;
  sourceSchema: DatabaseSchema;
  destinationSchema: DatabaseSchema;
  currentMigration: MigrationConfig | null;
  migrationProgress: MigrationProgress | null;
  migrationHistory: MigrationHistory;
  currentStep: 'connections' | 'tables' | 'configuration' | 'migration';
}

const initialState: AppState = {
  connections: [],
  sourceConnection: null,
  destinationConnection: null,
  sourceSchema: { tables: [], loading: false },
  destinationSchema: { tables: [], loading: false },
  currentMigration: null,
  migrationProgress: null,
  migrationHistory: { migrations: [], loading: false },
  currentStep: 'connections',
};

type AppAction =
  | { type: 'SET_CONNECTIONS', payload: DatabaseConnection[] }
  | { type: 'ADD_CONNECTION', payload: DatabaseConnection }
  | { type: 'UPDATE_CONNECTION', payload: DatabaseConnection }
  | { type: 'REMOVE_CONNECTION', payload: string }
  | { type: 'SET_SOURCE_CONNECTION', payload: DatabaseConnection | null }
  | { type: 'SET_DESTINATION_CONNECTION', payload: DatabaseConnection | null }
  | { type: 'SET_SOURCE_SCHEMA', payload: DatabaseSchema }
  | { type: 'SET_DESTINATION_SCHEMA', payload: DatabaseSchema }
  | { type: 'SET_CURRENT_MIGRATION', payload: MigrationConfig | null }
  | { type: 'SET_MIGRATION_PROGRESS', payload: MigrationProgress | null }
  | { type: 'SET_MIGRATION_HISTORY', payload: MigrationHistory }
  | { type: 'SET_CURRENT_STEP', payload: AppState['currentStep'] }
  | { type: 'SELECT_TABLE', payload: { schema?: string, tableName: string, selected: boolean } }
  | { type: 'SELECT_COLUMN', payload: { schema?: string, tableName: string, columnName: string, selected: boolean } };

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_CONNECTIONS':
      return { ...state, connections: action.payload };
    case 'ADD_CONNECTION':
      return { ...state, connections: [...state.connections, action.payload] };
    case 'UPDATE_CONNECTION':
      return {
        ...state,
        connections: state.connections.map(conn => 
          conn.id === action.payload.id ? action.payload : conn
        )
      };
    case 'REMOVE_CONNECTION':
      return {
        ...state,
        connections: state.connections.filter(conn => conn.id !== action.payload)
      };
    case 'SET_SOURCE_CONNECTION':
      return { ...state, sourceConnection: action.payload };
    case 'SET_DESTINATION_CONNECTION':
      return { ...state, destinationConnection: action.payload };
    case 'SET_SOURCE_SCHEMA':
      return { ...state, sourceSchema: action.payload };
    case 'SET_DESTINATION_SCHEMA':
      return { ...state, destinationSchema: action.payload };
    case 'SET_CURRENT_MIGRATION':
      return { ...state, currentMigration: action.payload };
    case 'SET_MIGRATION_PROGRESS':
      return { ...state, migrationProgress: action.payload };
    case 'SET_MIGRATION_HISTORY':
      return { ...state, migrationHistory: action.payload };
    case 'SET_CURRENT_STEP':
      return { ...state, currentStep: action.payload };
    case 'SELECT_TABLE': {
      const { schema, tableName, selected } = action.payload;
      return {
        ...state,
        sourceSchema: {
          ...state.sourceSchema,
          tables: state.sourceSchema.tables.map(table => 
            (table.schema === schema && table.name === tableName) 
              ? { ...table, selected } 
              : table
          )
        }
      };
    }
    case 'SELECT_COLUMN': {
      const { schema, tableName, columnName, selected } = action.payload;
      return {
        ...state,
        sourceSchema: {
          ...state.sourceSchema,
          tables: state.sourceSchema.tables.map(table => 
            (table.schema === schema && table.name === tableName) 
              ? { 
                ...table, 
                columns: table.columns.map(column => 
                  column.name === columnName ? { ...column, selected } : column
                ) 
              } 
              : table
          )
        }
      };
    }
    default:
      return state;
  }
};

interface AppContextProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};