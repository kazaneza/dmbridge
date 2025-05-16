import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Database, Server } from 'lucide-react';
import { DatabaseConnection } from '../../types/database';
import { validateConnectionParams } from '../../utils/databaseUtils';

interface ConnectionFormProps {
  onSave: (connection: DatabaseConnection) => void;
  onCancel: () => void;
  initialConnection?: DatabaseConnection;
}

const ConnectionForm: React.FC<ConnectionFormProps> = ({
  onSave,
  onCancel,
  initialConnection
}) => {
  const [connection, setConnection] = useState<Partial<DatabaseConnection>>(
    initialConnection || {
      id: uuidv4(),
      name: '',
      type: 'mssql',
      host: 'localhost',
      port: 1433,
      username: '',
      password: '',
      database: '',
      connected: false
    }
  );

  const [useConnectionString, setUseConnectionString] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setConnection(prev => ({
      ...prev,
      [name]: value
    }));

    // Set default port based on database type
    if (name === 'type') {
      setConnection(prev => ({
        ...prev,
        port: value === 'oracle' ? 1521 : value === 'mssql' ? 1433 : undefined,
        // Clear connection string when switching types
        connectionString: ''
      }));
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConnection(prev => ({
      ...prev,
      [name]: value ? parseInt(value, 10) : undefined
    }));
  };

  const handleToggleConnectionString = () => {
    setUseConnectionString(!useConnectionString);
    // Clear either connection string or individual fields when toggling
    if (!useConnectionString) {
      setConnection(prev => ({
        ...prev,
        connectionString: '',
      }));
    } else {
      setConnection(prev => ({
        ...prev,
        host: undefined,
        port: undefined,
        username: undefined,
        password: undefined,
        database: undefined,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateConnectionParams(connection);
    if (validationError) {
      setError(validationError);
      return;
    }

    // For Oracle, if not using connection string, build it
    if (connection.type === 'oracle' && !useConnectionString) {
      const oracleConnStr = `DRIVER={Oracle in instantclient_21_1};DBQ=${connection.host}:${connection.port}/${connection.database};Uid=${connection.username};Pwd=${connection.password}`;
      connection.connectionString = oracleConnStr;
    }
    
    onSave(connection as DatabaseConnection);
  };

  const getConnectionStringPlaceholder = () => {
    switch (connection.type) {
      case 'mssql':
        return 'Driver={ODBC Driver 17 for SQL Server};Server=localhost,1433;Database=master;Uid=sa;Pwd=yourpassword';
      case 'oracle':
        return 'DRIVER={Oracle in instantclient_21_1};DBQ=localhost:1521/ORCLPDB1;Uid=system;Pwd=yourpassword';
      case 'sqlite':
        return 'Path to SQLite database file';
      default:
        return '';
    }
  };

  const renderConnectionTypeFields = () => {
    if (useConnectionString) {
      return (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">
            Connection String
          </label>
          <input
            type="text"
            name="connectionString"
            value={connection.connectionString || ''}
            onChange={handleChange}
            placeholder={getConnectionStringPlaceholder()}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
          />
          <p className="mt-1 text-sm text-gray-500">
            {connection.type === 'oracle' ? 
              'For Oracle, ensure you have Oracle Instant Client installed and the ORACLE_HOME environment variable set.' :
              connection.type === 'mssql' ?
              'For SQL Server, ensure you have the ODBC Driver 17 for SQL Server installed.' :
              ''}
          </p>
        </div>
      );
    }

    return (
      <>
        <div className="mt-4 grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700">
              Host
            </label>
            <input
              type="text"
              name="host"
              value={connection.host || ''}
              onChange={handleChange}
              placeholder="localhost"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
              disabled={connection.type === 'sqlite'}
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700">
              Port
            </label>
            <input
              type="number"
              name="port"
              value={connection.port || ''}
              onChange={handleNumberChange}
              placeholder={connection.type === 'oracle' ? '1521' : '1433'}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
              disabled={connection.type === 'sqlite'}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              type="text"
              name="username"
              value={connection.username || ''}
              onChange={handleChange}
              placeholder={connection.type === 'oracle' ? 'system' : 'sa'}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
              disabled={connection.type === 'sqlite'}
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={connection.password || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
              disabled={connection.type === 'sqlite'}
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">
            {connection.type === 'oracle' ? 'Service Name' : 'Database'}
          </label>
          <input
            type="text"
            name="database"
            value={connection.database || ''}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
            placeholder={connection.type === 'oracle' ? 'ORCLPDB1' : connection.type === 'sqlite' ? 'Path to SQLite file' : 'Database name'}
          />
          {connection.type === 'oracle' && (
            <p className="mt-1 text-sm text-gray-500">
              The Oracle service name (e.g., ORCLPDB1, XE)
            </p>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center mb-4">
        <Database className="h-6 w-6 text-teal-600 mr-2" />
        <h2 className="text-lg font-semibold text-gray-800">
          {initialConnection ? 'Edit Connection' : 'Add New Connection'}
        </h2>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Connection Name
          </label>
          <input
            type="text"
            name="name"
            value={connection.name}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
            placeholder="e.g. Production Oracle DB"
            required
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">
            Database Type
          </label>
          <select
            name="type"
            value={connection.type}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
          >
            <option value="mssql">Microsoft SQL Server</option>
            <option value="oracle">Oracle</option>
            <option value="sqlite">SQLite</option>
          </select>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={handleToggleConnectionString}
            className="text-sm text-teal-600 hover:text-teal-700 flex items-center"
          >
            {useConnectionString 
              ? "Use individual connection parameters" 
              : "Use connection string instead"}
            <Server className="ml-1 h-4 w-4" />
          </button>
        </div>

        {renderConnectionTypeFields()}

        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 border border-transparent rounded-md shadow-sm hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
          >
            Save Connection
          </button>
        </div>
      </form>
    </div>
  );
};

export default ConnectionForm;