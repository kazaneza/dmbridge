import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { DatabaseConnection } from '../types/database';
import ConnectionForm from '../components/DatabaseConnection/ConnectionForm';
import ConnectionCard from '../components/DatabaseConnection/ConnectionCard';
import { PlusCircle } from 'lucide-react';

const ConnectionsPage: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingConnection, setEditingConnection] = useState<DatabaseConnection | null>(null);

  const handleAddConnection = (connection: DatabaseConnection) => {
    dispatch({ type: 'ADD_CONNECTION', payload: connection });
    setShowAddForm(false);
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
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
          >
            <PlusCircle className="mr-1.5 h-4 w-4" />
            Add Connection
          </button>
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