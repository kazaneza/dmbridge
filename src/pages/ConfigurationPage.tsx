import React from 'react';
import { useAppContext } from '../context/AppContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ConfigurationForm from '../components/Migration/ConfigurationForm';
import { MigrationOptions } from '../types/migration';
import { createMigrationConfig, createMigrationTables } from '../utils/migrationUtils';
import { estimateMigrationTime } from '../utils/databaseUtils';

const ConfigurationPage: React.FC = () => {
  const { state, dispatch } = useAppContext();
  
  if (!state.sourceConnection || !state.destinationConnection) {
    dispatch({ type: 'SET_CURRENT_STEP', payload: 'connections' });
    return null;
  }
  
  const selectedTables = state.sourceSchema.tables.filter(table => table.selected);
  if (selectedTables.length === 0) {
    dispatch({ type: 'SET_CURRENT_STEP', payload: 'tables' });
    return null;
  }
  
  const totalRowCount = selectedTables.reduce((sum, table) => 
    sum + (table.rowCount || 0), 0
  );
  
  const estimatedTime = estimateMigrationTime(selectedTables, 1000);
  
  const handleBack = () => {
    dispatch({ type: 'SET_CURRENT_STEP', payload: 'tables' });
  };
  
  const handleStartMigration = (options: MigrationOptions, name: string) => {
    const migrationTables = createMigrationTables(selectedTables);
    
    const migrationConfig = createMigrationConfig(
      name,
      state.sourceConnection.id,
      state.destinationConnection.id,
      migrationTables,
      options
    );
    
    dispatch({ type: 'SET_CURRENT_MIGRATION', payload: migrationConfig });
    dispatch({ type: 'SET_CURRENT_STEP', payload: 'migration' });
  };
  
  return (
    <div className="container mx-auto p-6">
      <ConfigurationForm
        sourceConnection={state.sourceConnection}
        destinationConnection={state.destinationConnection}
        selectedTableCount={selectedTables.length}
        totalRowCount={totalRowCount}
        estimatedTime={estimatedTime}
        onStartMigration={handleStartMigration}
      />
      
      <div className="mt-6">
        <button
          onClick={handleBack}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
        >
          <ChevronLeft className="mr-1.5 h-4 w-4" />
          Back to Table Selection
        </button>
      </div>
    </div>
  );
};

export default ConfigurationPage;