import React, { useState } from 'react';
import { Search, Check, ChevronRight, ChevronDown, Table as TableIcon } from 'lucide-react';
import { DatabaseTable } from '../../types/database';
import { formatDuration } from '../../utils/migrationUtils';
import { estimateMigrationTime } from '../../utils/databaseUtils';

interface TableListProps {
  tables: DatabaseTable[];
  onSelectTable: (tableName: string, schema: string | undefined, selected: boolean) => void;
  onSelectColumn: (tableName: string, schema: string | undefined, columnName: string, selected: boolean) => void;
}

const TableList: React.FC<TableListProps> = ({
  tables,
  onSelectTable,
  onSelectColumn,
}) => {
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  
  const toggleExpand = (tableName: string, schema?: string) => {
    const key = schema ? `${schema}.${tableName}` : tableName;
    setExpandedTables(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };
  
  const isExpanded = (tableName: string, schema?: string) => {
    const key = schema ? `${schema}.${tableName}` : tableName;
    return expandedTables[key] || false;
  };
  
  const filteredTables = tables.filter(table => {
    const tableIdentifier = table.schema 
      ? `${table.schema}.${table.name}` 
      : table.name;
    
    return tableIdentifier.toLowerCase().includes(searchQuery.toLowerCase());
  });
  
  const selectedTables = tables.filter(table => table.selected);
  const totalEstimatedTime = estimateMigrationTime(selectedTables, 1000);
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Available Tables
          </h2>
          <div className="flex items-center">
            <span className="text-sm text-gray-500 mr-2">
              {selectedTables.length} of {tables.length} selected
            </span>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search tables..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-1.5 block w-full border border-gray-300 rounded-md text-sm focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>
        </div>
        
        {selectedTables.length > 0 && (
          <div className="bg-blue-50 p-3 rounded-md mb-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-blue-700 font-medium">
                  {selectedTables.length} tables selected for migration
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Approximately {selectedTables.reduce((acc, table) => acc + (table.rowCount || 0), 0).toLocaleString()} rows
                </p>
              </div>
              <div className="text-sm text-blue-700">
                <span className="font-medium">Est. time: </span>
                {formatDuration(totalEstimatedTime)}
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="divide-y divide-gray-200 max-h-[500px] overflow-y-auto">
        {filteredTables.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No tables match your search.
          </div>
        ) : (
          filteredTables.map(table => {
            const tableIdentifier = table.schema 
              ? `${table.schema}.${table.name}` 
              : table.name;
            const expanded = isExpanded(table.name, table.schema);
              
            return (
              <div key={tableIdentifier} className="group">
                <div className="p-3 hover:bg-gray-50 flex items-center">
                  <div className="flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={table.selected}
                      onChange={() => onSelectTable(table.name, table.schema, !table.selected)}
                      className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                    />
                  </div>
                  <div 
                    className="ml-3 flex-grow cursor-pointer flex items-center"
                    onClick={() => toggleExpand(table.name, table.schema)}
                  >
                    <div className="flex items-center">
                      <TableIcon className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-900">{tableIdentifier}</span>
                    </div>
                    <div className="ml-auto flex items-center">
                      <span className="mr-2 text-xs text-gray-500">
                        {table.rowCount?.toLocaleString() || 0} rows
                      </span>
                      <button 
                        className="text-gray-400 hover:text-gray-600"
                        aria-label={expanded ? "Collapse" : "Expand"}
                      >
                        {expanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                
                {expanded && (
                  <div className="bg-gray-50 px-3 py-2 text-sm">
                    <div className="ml-7 pl-4 border-l border-gray-200 space-y-1">
                      {table.columns.map(column => (
                        <div 
                          key={`${tableIdentifier}.${column.name}`} 
                          className="flex items-center py-1"
                        >
                          <div className="flex-shrink-0">
                            <input
                              type="checkbox"
                              checked={column.selected}
                              onChange={() => onSelectColumn(
                                table.name, 
                                table.schema, 
                                column.name, 
                                !column.selected
                              )}
                              className="h-3.5 w-3.5 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                              disabled={!table.selected}
                            />
                          </div>
                          <div className="ml-2 flex items-center">
                            <span className={`font-mono text-xs ${column.isPrimaryKey ? 'font-semibold' : ''}`}>
                              {column.name}
                            </span>
                            <span className="ml-2 text-gray-500 text-xs">
                              {column.type}
                            </span>
                            {column.isPrimaryKey && (
                              <span className="ml-1 px-1 py-0.5 text-[10px] bg-amber-100 text-amber-800 rounded">
                                PK
                              </span>
                            )}
                            {column.nullable && (
                              <span className="ml-1 text-gray-400 text-[10px]">
                                NULL
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TableList;