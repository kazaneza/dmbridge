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
    const timer = setTimeout(() => setIsInitialLoad(false), 1500);
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
      // You might want to show an error message to the user here
    }
  };

  const handleUpdateConnection = (connection: DatabaseConnection) => {
    dispatch({ type: 'UPDATE_CONNECTION', payload: connection });
    setEditingConnection(null);
  };

  const handleDeleteConnection = (connection: DatabaseConnection) => {
    // If the connection is the source or destination, clear it
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
    
    // If both connections are set, move to the next step
    if (connection && state.destinationConnection) {
      dispatch({ type: 'SET_CURRENT_STEP', payload: 'tables' });
    }
  };

  const handleSetDestination = (connection: DatabaseConnection | null) => {
    dispatch({ type: 'SET_DESTINATION_CONNECTION', payload: connection });
    
    // If both connections are set, move to the next step
    if (connection && state.sourceConnection) {
      dispatch({ type: 'SET_CURRENT_STEP', payload: 'tables' });
    }
  };

  if (isInitialLoad) {
    return (
      <div className="fixed inset-0 bg-gradient-to-r from-blue-900 to-blue-800 flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center mb-6">
            <span className="text-4xl font-bold text-white mr-3">BK</span>
            <Database className="h-12 w-12 text-white animate-pulse" />
          </div>
          <h1 className="text-2xl font-light text-white mb-2">DataBridge</h1>
          <p className="text-blue-200">Initializing your data management solution...</p>
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
          <RefreshCw className="animate-spin h-8 w-8 text-teal-600 mr-3" />
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
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
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
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
            >
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Refresh
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
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

export default ConnectionsPage