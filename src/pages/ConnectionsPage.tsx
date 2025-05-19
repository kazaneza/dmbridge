import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { DatabaseConnection } from '../types/database';
import ConnectionForm from '../components/DatabaseConnection/ConnectionForm';
import ConnectionCard from '../components/DatabaseConnection/ConnectionCard';
import { PlusCircle, RefreshCw, Database } from 'lucide-react';
import { loadConnections, saveConnection } from '../utils/databaseUtils';

const ConnectionsPage: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingConnection, setEditingConnection] = useState<DatabaseConnection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    loadSavedConnections();
    const timer = setTimeout(() => setIsInitialLoad(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  const loadSavedConnections = async () => {
    setIsLoading(true);
    try {
      const connections = await loadConnections();
      dispatch({ type: 'SET_CONNECTIONS', payload: connections });
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddConnection = async (connection: DatabaseConnection) => {
    try {
      await saveConnection(connection);
      dispatch({ type: 'ADD_CONNECTION', payload: connection });
      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to save connection:', error);
    }
  };

  const handleUpdateConnection = (connection: DatabaseConnection) => {
    dispatch({ type: 'UPDATE_CONNECTION', payload: connection });
    setEditingConnection(null);
  };

  const handleDeleteConnection = (connection: DatabaseConnection) => {
    if (state.sourceConnection?.id === connection.id) {
      dispatch({ type: 'SET_SOURCE_CONNECTION', payload: null });
    }
    if (state.destinationConnection?.id === connection.id) {
      dispatch({ type: 'SET_DESTINATION_CONNECTION', payload: null });
    }
    
    dispatch({ type: 'REMOVE_CONNECTION', payload: connection.id });
  };

  const handleSetSource = (connection: DatabaseConnection | null) => {
    dispatch({ type: 'SET_SOURCE_CONNECTION', payload: connection });
    
    if (connection && state.destinationConnection) {
      dispatch({ type: 'SET_CURRENT_STEP', payload: 'tables' });
    }
  };

  const handleSetDestination = (connection: DatabaseConnection | null) => {
    dispatch({ type: 'SET_DESTINATION_CONNECTION', payload: connection });
    
    if (connection && state.sourceConnection) {
      dispatch({ type: 'SET_CURRENT_STEP', payload: 'tables' });
    }
  };

  if (isInitialLoad) {
    return (
      <div className="fixed inset-0 bg-gradient-to-r from-blue-900 to-blue-800 flex items-center justify-center">
        <div className="text-center">
          <div className="flex flex-col items-center justify-center mb-8 animate-fade-in">
            <div className="flex items-center mb-4">
              <img 
                src="/src/assets/brand-logo.png" 
                alt="BK Logo" 
                className="h-16 w-auto mr-4 animate-float"
              />
              <Database className="h-16 w-16 text-white animate-pulse" />
            </div>
            <h1 className="text-3xl font-light text-white mb-3">DataBridge</h1>
            <p className="text-xl text-blue-200 mb-2 animate-fade-in delay-300">
              Enterprise Data Management
            </p>
            <div className="flex items-center space-x-2 animate-fade-in delay-500">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-0"></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-150"></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-300"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (showAddForm) {
      return (
        <ConnectionForm
          onSave={handleAddConnection}
          onCancel={() => setShowAddForm(false)}
        />
      );
    }

    if (editingConnection) {
      return (
        <ConnectionForm
          initialConnection={editingConnection}
          onSave={handleUpdateConnection}
          onCancel={() => setEditingConnection(null)}
        />
      );
    }

    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-12">
          <RefreshCw className="animate-spin h-8 w-8 text-blue-600 mr-3" />
          <span className="text-lg font-medium text-gray-700">Loading connections...</span>
        </div>
      );
    }

    if (state.connections.length === 0) {
      return (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No database connections</h3>
          <p className="text-gray-500 mb-6">Add your first database connection to start migrating data.</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 hover:shadow-lg"
          >
            <PlusCircle className="mr-2 h-5 w-5" />
            Add Database Connection
          </button>
        </div>
      );
    }

    return (
      <>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Database Connections</h2>
          <div className="flex space-x-4">
            <button
              onClick={loadSavedConnections}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300"
            >
              <RefreshCw className={`mr-1.5 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 hover:shadow-lg"
            >
              <PlusCircle className="mr-1.5 h-4 w-4" />
              Add Connection
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {state.connections.map(connection => (
            <ConnectionCard
              key={connection.id}
              connection={connection}
              isSource={state.sourceConnection?.id === connection.id}
              isDestination={state.destinationConnection?.id === connection.id}
              onConnect={(conn) => dispatch({ type: 'UPDATE_CONNECTION', payload: conn })}
              onDisconnect={(conn) => dispatch({ type: 'UPDATE_CONNECTION', payload: conn })}
              onEdit={setEditingConnection}
              onDelete={handleDeleteConnection}
              onSetSource={handleSetSource}
              onSetDestination={handleSetDestination}
            />
          ))}
        </div>
      </>
    );
  };

  return (
    <div className="container mx-auto p-6">
      {renderContent()}
    </div>
  );
};

export default ConnectionsPage;