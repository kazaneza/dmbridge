import React, { useState } from 'react';
import { 
  Database, 
  Check, 
  X, 
  Edit, 
  Trash, 
  Link, 
  Server, 
  AlertCircle 
} from 'lucide-react';
import { DatabaseConnection } from '../../types/database';
import { connectToDatabase, disconnectFromDatabase } from '../../utils/databaseUtils';

interface ConnectionCardProps {
  connection: DatabaseConnection;
  isSource: boolean;
  isDestination: boolean;
  onConnect: (connection: DatabaseConnection) => void;
  onDisconnect: (connection: DatabaseConnection) => void;
  onEdit: (connection: DatabaseConnection) => void;
  onDelete: (connection: DatabaseConnection) => void;
  onSetSource: (connection: DatabaseConnection) => void;
  onSetDestination: (connection: DatabaseConnection) => void;
}

const ConnectionCard: React.FC<ConnectionCardProps> = ({
  connection,
  isSource,
  isDestination,
  onConnect,
  onDisconnect,
  onEdit,
  onDelete,
  onSetSource,
  onSetDestination,
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const updatedConnection = await connectToDatabase(connection);
      onConnect(updatedConnection);
    } catch (error) {
      console.error('Connection error:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const updatedConnection = await disconnectFromDatabase(connection);
      onDisconnect(updatedConnection);
    } catch (error) {
      console.error('Disconnection error:', error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const getTypeIcon = () => {
    switch (connection.type) {
      case 'postgresql':
        return <Database className="h-5 w-5 text-blue-600" />;
      case 'mysql':
        return <Database className="h-5 w-5 text-orange-500" />;
      case 'mongodb':
        return <Database className="h-5 w-5 text-green-500" />;
      case 'sqlite':
        return <Database className="h-5 w-5 text-purple-500" />;
      default:
        return <Database className="h-5 w-5 text-gray-500" />;
    }
  };

  const getConnectionDetails = () => {
    if (connection.connectionString) {
      const masked = connection.connectionString.replace(
        /\/\/([^:]+):([^@]+)@/,
        '//$1:****@'
      );
      return masked;
    }

    if (connection.type === 'sqlite') {
      return connection.database;
    }

    return `${connection.host}:${connection.port}/${connection.database}`;
  };

  return (
    <div className={`relative bg-white rounded-lg shadow-md border overflow-hidden ${
      connection.error ? 'border-red-300' : 
      connection.connected ? 'border-teal-300' : 'border-gray-200'
    }`}>
      {(isSource || isDestination) && (
        <div className={`absolute top-0 left-0 h-full w-1 ${
          isSource ? 'bg-blue-600' : 'bg-orange-500'
        }`}></div>
      )}

      <div className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center">
            {getTypeIcon()}
            <h3 className="ml-2 text-lg font-medium text-gray-900">{connection.name}</h3>
          </div>
          <div className="flex">
            <button
              onClick={() => onEdit(connection)}
              className="p-1 text-gray-400 hover:text-gray-500"
              aria-label="Edit"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(connection)}
              className="ml-1 p-1 text-gray-400 hover:text-red-500"
              aria-label="Delete"
            >
              <Trash className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-center text-sm text-gray-500">
          <Server className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
          <span className="truncate">{getConnectionDetails()}</span>
        </div>

        {connection.error && (
          <div className="mt-2 flex items-center text-sm text-red-600">
            <AlertCircle className="flex-shrink-0 mr-1.5 h-4 w-4" />
            <span>{connection.error}</span>
          </div>
        )}
      </div>

      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
        <div className="flex items-center">
          {connection.connected ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
              <Check className="mr-1 h-3 w-3" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
              <X className="mr-1 h-3 w-3" />
              Disconnected
            </span>
          )}
        </div>

        <div className="flex space-x-2">
          {!connection.connected ? (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          )}

          {connection.connected && !isSource && !isDestination && (
            <>
              <button
                onClick={() => onSetSource(connection)}
                className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Link className="mr-1 h-3 w-3" />
                Set as Source
              </button>
              <button
                onClick={() => onSetDestination(connection)}
                className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              >
                <Link className="mr-1 h-3 w-3" />
                Set as Destination
              </button>
            </>
          )}

          {connection.connected && (isSource || isDestination) && (
            <button
              onClick={() => isSource ? onSetSource(null as any) : onSetDestination(null as any)}
              className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              <X className="mr-1 h-3 w-3" />
              Clear {isSource ? 'Source' : 'Destination'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectionCard;