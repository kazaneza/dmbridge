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
          <ArrowRight className="mx-2 h-4 w-4 text-blue-400 animate-pulse" />
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
    <header className="bg-gradient-to-r from-blue-900 to-blue-800 text-white shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center group">
              <img 
                src="/src/assets/brand-logo.png" 
                alt="BK Logo" 
                className="h-8 w-auto transition-transform duration-300 group-hover:scale-110 animate-float"
              />
              <div className="ml-3 flex flex-col">
                <span className="text-xl font-light opacity-90 group-hover:opacity-100 transition-opacity">
                  DataBridge
                </span>
                <span className="text-sm text-blue-200 animate-fade-in">
                  Enterprise Data Management
                </span>
              </div>
            </div>
            <div className="hidden md:block h-6 w-px bg-blue-700/30"></div>
            <span className="hidden md:block text-blue-100 font-medium animate-fade-in">
              {getStepLabel()}
            </span>
          </div>
          
          <div className="flex items-center space-x-6">
            {renderConnectionInfo()}
            <button 
              className="p-2 rounded-full hover:bg-white/10 transition-all duration-300 hover:shadow-glow"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5 transition-transform duration-300 hover:rotate-90" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;