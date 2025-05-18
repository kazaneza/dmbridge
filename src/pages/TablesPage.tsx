import React, { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { fetchDatabaseSchema } from '../utils/databaseUtils';
import TableList from '../components/Tables/TableList';
import { ChevronRight, ChevronLeft, RefreshCw } from 'lucide-react';

const TablesPage: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  
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
    dispatch({ type: 'SET_CURRENT_STEP', payload: 'configurat