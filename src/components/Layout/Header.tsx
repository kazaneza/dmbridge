import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { Database, ArrowRight, Settings } from 'lucide-react';

const Header: React.FC = () => {
  const { state } = useAppContext();
  
  const getStepLabel = () => {
    switch (state.currentStep) {
      case 'connections':
        return 'Database Connections';
      case 'tables':
        return 'Table Selection';
      case 'configuration':
        return 'Migration Configuration';
      case 'migration':
        return 'Migration Progress';
      default:
        return 'Database Migration Tool';
    }
  };

  const renderConnectionInfo = () => {
    if (state.currentStep === 'connections') {
      return null;
    }
    
    return (
      <div className="flex items-center text-sm">
        {state.sourceConnection && (
          <div className="flex items-center">
            <span className="font-medium">{state.sourceConnection.name}</span>
            <Database className="ml-1 h-4 w-4" />
          </div>
        )}
        
        {state.sourceConnection && state.destinationConnection && (
          <ArrowRight className="mx-2 h-4 w-4 text-gray-400" />
        )}
        
        {state.destinationConnection && (
          <div className="flex items-center">
            <span className="font-medium">{state.destinationConnection.name}</span>
            <Database className="ml-1 h-4 w-4" />
          </div>
        )}
      </div>
    );
  };

  return (
    <header className="bg-gradient-to-r from-blue-900 to-teal-800 text-white shadow-md">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold">DataBridge</h1>
            <div className="hidden md:block h-6 w-px bg-teal-500/30"></div>
            <span className="hidden md:block text-teal-100 font-medium">
              {getStepLabel()}
            </span>
          </div>
          
          <div className="flex items-center space-x-6">
            {renderConnectionInfo()}
            <button 
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;