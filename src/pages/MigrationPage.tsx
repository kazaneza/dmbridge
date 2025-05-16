import React, { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import ProgressTracker from '../components/Migration/ProgressTracker';
import { MigrationProgress } from '../types/migration';
import { runMigration } from '../utils/migrationUtils';
import { ChevronLeft, RefreshCw } from 'lucide-react';

const MigrationPage: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  
  useEffect(() => {
    if (
      state.currentMigration && 
      state.currentMigration.status !== 'completed' && 
      state.currentMigration.status !== 'failed' && 
      !progress
    ) {
      startMigration();
    }
  }, [state.currentMigration]);
  
  const startMigration = async () => {
    if (!state.currentMigration) return;
    
    try {
      await runMigration(
        state.currentMigration,
        (updatedProgress) => {
          setProgress(updatedProgress);
          dispatch({ type: 'SET_MIGRATION_PROGRESS', payload: updatedProgress });
        }
      );
    } catch (error) {
      console.error('Migration error:', error);
    }
  };
  
  const handleCancel = () => {
    if (!progress) return;
    
    const canceledProgress: MigrationProgress = {
      ...progress,
      status: 'canceled',
      endTime: new Date()
    };
    
    setProgress(canceledProgress);
    dispatch({ type: 'SET_MIGRATION_PROGRESS', payload: canceledProgress });
  };
  
  const handleBack = () => {
    dispatch({ type: 'SET_CURRENT_STEP', payload: 'configuration' });
  };
  
  const handleNewMigration = () => {
    dispatch({ type: 'SET_CURRENT_MIGRATION', payload: null });
    dispatch({ type: 'SET_MIGRATION_PROGRESS', payload: null });
    dispatch({ type: 'SET_CURRENT_STEP', payload: 'connections' });
  };
  
  if (!state.currentMigration) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-amber-800">
          No active migration. Please configure a migration first.
        </div>
        <div className="mt-4">
          <button
            onClick={handleBack}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
          >
            <ChevronLeft className="mr-1.5 h-4 w-4" />
            Back to Configuration
          </button>
        </div>
      </div>
    );
  }
  
  if (!progress) {
    return (
      <div className="container mx-auto p-6 flex flex-col items-center justify-center py-12">
        <RefreshCw className="animate-spin h-10 w-10 text-teal-600 mb-4" />
        <h2 className="text-xl font-semibold text-gray-800">Initializing Migration...</h2>
      </div>
    );
  }
  
  const isFinished = 
    progress.status === 'completed' || 
    progress.status === 'failed' || 
    progress.status === 'canceled';
  
  return (
    <div className="container mx-auto p-6">
      <ProgressTracker
        migrationConfig={state.currentMigration}
        progress={progress}
        onCancel={handleCancel}
      />
      
      {isFinished && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleNewMigration}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
          >
            Start New Migration
          </button>
        </div>
      )}
    </div>
  );
};

export default MigrationPage;