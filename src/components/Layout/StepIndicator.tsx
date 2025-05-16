import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { Database, Table, Settings, PlayCircle } from 'lucide-react';

const steps = [
  { key: 'connections', label: 'Connections', icon: Database },
  { key: 'tables', label: 'Tables', icon: Table },
  { key: 'configuration', label: 'Configure', icon: Settings },
  { key: 'migration', label: 'Migrate', icon: PlayCircle },
];

const StepIndicator: React.FC = () => {
  const { state, dispatch } = useAppContext();
  
  const getCurrentStepIndex = () => {
    return steps.findIndex(step => step.key === state.currentStep);
  };
  
  const handleStepClick = (stepKey: string) => {
    // Only allow navigation to steps that are available based on the current state
    if (stepKey === 'connections') {
      dispatch({ type: 'SET_CURRENT_STEP', payload: 'connections' });
    } else if (stepKey === 'tables' && state.sourceConnection && state.destinationConnection) {
      dispatch({ type: 'SET_CURRENT_STEP', payload: 'tables' });
    } else if (stepKey === 'configuration' && state.sourceSchema.tables.some(t => t.selected)) {
      dispatch({ type: 'SET_CURRENT_STEP', payload: 'configuration' });
    } else if (stepKey === 'migration' && state.currentMigration) {
      dispatch({ type: 'SET_CURRENT_STEP', payload: 'migration' });
    }
  };
  
  const isStepAvailable = (stepKey: string) => {
    if (stepKey === 'connections') {
      return true;
    } else if (stepKey === 'tables') {
      return !!state.sourceConnection && !!state.destinationConnection;
    } else if (stepKey === 'configuration') {
      return state.sourceSchema.tables.some(t => t.selected);
    } else if (stepKey === 'migration') {
      return !!state.currentMigration;
    }
    return false;
  };
  
  const currentStepIndex = getCurrentStepIndex();
  
  return (
    <div className="py-4 px-2 md:px-4 bg-white shadow-sm">
      <div className="container mx-auto">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isActive = state.currentStep === step.key;
            const isCompleted = index < currentStepIndex;
            const isAvailable = isStepAvailable(step.key);
            const Icon = step.icon;
            
            return (
              <div 
                key={step.key}
                className={`flex flex-col items-center ${isAvailable ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
                onClick={() => isAvailable && handleStepClick(step.key)}
              >
                <div className="relative flex items-center">
                  {index > 0 && (
                    <div 
                      className={`absolute right-full w-12 h-0.5 -mx-2 ${
                        isCompleted ? 'bg-teal-600' : 'bg-gray-300'
                      }`}
                    ></div>
                  )}
                  <div 
                    className={`rounded-full p-2 transition-colors ${
                      isActive 
                        ? 'bg-teal-600 text-white' 
                        : isCompleted 
                          ? 'bg-teal-100 text-teal-600' 
                          : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  {index < steps.length - 1 && (
                    <div 
                      className={`absolute left-full w-12 h-0.5 -mx-2 ${
                        index < currentStepIndex ? 'bg-teal-600' : 'bg-gray-300'
                      }`}
                    ></div>
                  )}
                </div>
                <span 
                  className={`mt-2 text-xs md:text-sm font-medium ${
                    isActive ? 'text-teal-600' : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StepIndicator;