import React, { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { fetchDatabaseSchema, searchOracleViews } from '../utils/databaseUtils';
import TableList from '../components/Tables/TableList';
import { ChevronRight, ChevronLeft, RefreshCw } from 'lucide-react';

const TablesPage: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout>();
  
  useEffect(() => {
    // Load schema if necessary
    if (
      state.sourceConnection && 
      state.sourceConnection.connected && 
      state.sourceSchema.tables.length === 0 && 
      !state.sourceSchema.loading
    ) {
      loadSourceSchema();
    }
  }, [state.sourceConnection]);

  useEffect(() => {
    // Handle Oracle view search
    if (state.sourceConnection?.type === 'oracle') {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }

      const timeout = setTimeout(async () => {
        setIsLoading(true);
        try {
          const views = await searchOracleViews(
            state.sourceConnection!.id,
            searchQuery,
            10,
            0
          );
          dispatch({ 
            type: 'SET_SOURCE_SCHEMA', 
            payload: { tables: views, loading: false } 
          });
        } catch (error) {
          console.error('Error searching views:', error);
          dispatch({ 
            type: 'SET_SOURCE_SCHEMA', 
            payload: { 
              tables: [], 
              loading: false, 
              error: 'Failed to search views' 
            } 
          });
        } finally {
          setIsLoading(false);
        }
      }, 500);

      setSearchTimeout(timeout);

      return () => {
        if (timeout) {
          clearTimeout(timeout);
        }
      };
    }
  }, [searchQuery, state.sourceConnection?.type]);
  
  const loadSourceSchema = async () => {
    if (!state.sourceConnection) return;
    
    setIsLoading(true);
    dispatch({ 
      type: 'SET_SOURCE_SCHEMA', 
      payload: { tables: [], loading: true } 
    });
    
    try {
      const schema = await fetchDatabaseSchema(state.sourceConnection);
      dispatch({ type: 'SET_SOURCE_SCHEMA', payload: schema });
    } catch (error) {
      console.error('Error loading schema:', error);
      dispatch({ 
        type: 'SET_SOURCE_SCHEMA', 
        payload: { 
          tables: [], 
          loading: false, 
          error: 'Failed to load database schema' 
        } 
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSelectTable = (tableName: string, schema: string | undefined, selected: boolean) => {
    dispatch({ 
      type: 'SELECT_TABLE', 
      payload: { tableName, schema, selected } 
    });
  };
  
  const handleSelectColumn = (
    tableName: string, 
    schema: string | undefined, 
    columnName: string, 
    selected: boolean
  ) => {
    dispatch({ 
      type: 'SELECT_COLUMN', 
      payload: { tableName, schema, columnName, selected } 
    });
  };
  
  const handleBack = () => {
    dispatch({ type: 'SET_CURRENT_STEP', payload: 'connections' });
  };
  
  const handleNext = () => {
    dispatch({ type: 'SET_CURRENT_STEP', payload: 'configuration' });
  };
  
  const canProceed = state.sourceSchema.tables.some(table => table.selected);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };
  
  if (!state.sourceConnection || !state.destinationConnection) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-amber-800">
          Please select source and destination connections first.
        </div>
        <div className="mt-4">
          <button
            onClick={handleBack}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
          >
            <ChevronLeft className="mr-1.5 h-4 w-4" />
            Back to Connections
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Select Tables</h2>
        <button
          onClick={loadSourceSchema}
          disabled={isLoading}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
        >
          <RefreshCw className={`mr-1.5 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Schema
        </button>
      </div>
      
      {state.sourceSchema.loading ? (
        <div className="flex justify-center items-center py-12">
          <RefreshCw className="animate-spin h-8 w-8 text-teal-600 mr-3" />
          <span className="text-lg font-medium text-gray-700">Loading schema...</span>
        </div>
      ) : state.sourceSchema.error ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
          {state.sourceSchema.error}
        </div>
      ) : state.sourceSchema.tables.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-amber-800">
          {state.sourceConnection.type === 'oracle' 
            ? 'Start typing to search for views...'
            : 'No tables found in the source database. Please check your connection or permissions.'}
        </div>
      ) : (
        <TableList
          tables={state.sourceSchema.tables}
          onSelectTable={handleSelectTable}
          onSelectColumn={handleSelectColumn}
          onSearch={handleSearch}
          searchQuery={searchQuery}
        />
      )}
      
      <div className="mt-6 flex justify-between">
        <button
          onClick={handleBack}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
        >
          <ChevronLeft className="mr-1.5 h-4 w-4" />
          Back
        </button>
        
        <button
          onClick={handleNext}
          disabled={!canProceed}
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 ${
            canProceed 
              ? 'bg-teal-600 hover:bg-teal-700' 
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          Next
          <ChevronRight className="ml-1.5 h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default TablesPage;