
import csv
import os
from tempfile import mkdtemp
from typing import AsyncGenerator, List, Optional, Dict, Any
import sqlite3
import pyodbc
import cx_Oracle
from models import MigrationChunk

TEMP_DIR = mkdtemp()
CHUNK_SIZE = 1000000  # Process 1M rows at a time

async def extract_table_chunks(
    connection_string: str,
    table_name: str,
    schema: Optional[str] = None,
    chunk_size: int = CHUNK_SIZE,
    selected_columns: List[str] = None
) -> AsyncGenerator[Dict[str, Any], None]:
    conn = None
    cursor = None
    
    try:
        # Connect to appropriate database
        if '.db' in connection_string:  # SQLite
            conn = sqlite3.connect(connection_string)
        else:  # Oracle or MSSQL
            if 'ODBC Driver' in connection_string:
                conn = pyodbc.connect(connection_string)
            else:
                # Set Oracle environment
                os.environ["NLS_LANG"] = ".AL32UTF8"
                conn = cx_Oracle.connect(connection_string)
        
        cursor = conn.cursor()
        
        # Get column information
        columns = selected_columns if selected_columns else get_table_columns(cursor, table_name, schema)
        columns_str = ', '.join([f'"{col}"' for col in columns])
        table_identifier = f"{schema}.{table_name}" if schema else table_name
        
        # Create temp directory for this table
        table_temp_dir = os.path.join(TEMP_DIR, table_name)
        os.makedirs(table_temp_dir, exist_ok=True)
        
        print(f"Starting extraction for {table_name}")
        print(f"Temp directory: {table_temp_dir}")
        
        # Simple query to get all data
        query = f"SELECT {columns_str} FROM {table_identifier}"
        print(f"Executing query: {query}")
        
        cursor.execute(query)
        
        chunk_num = 0
        rows = []
        
        while True:
            row = cursor.fetchone()
            if not row:
                if rows:  # Save last chunk
                    chunk_file = os.path.join(table_temp_dir, f"chunk_{chunk_num}.csv")
                    chunk_data = [dict(zip(columns, row_data)) for row_data in rows]
                    save_chunk_to_csv(chunk_file, columns, chunk_data)
                    print(f"Saved final chunk {chunk_num} with {len(rows)} rows")
                    yield {
                        'file': chunk_file,
                        'chunk_number': chunk_num,
                        'total_chunks': chunk_num + 1,
                        'columns': columns,
                        'table_name': table_name,
                        'schema': schema
                    }
                break
                
            # Convert row data to strings, handling None values
            row_data = []
            for val in row:
                if val is None:
                    row_data.append('')
                elif isinstance(val, (bytes, bytearray)):
                    row_data.append(val.decode('utf-8', errors='replace'))
                else:
                    row_data.append(str(val))
            
            rows.append(row_data)
            
            if len(rows) >= chunk_size:
                chunk_file = os.path.join(table_temp_dir, f"chunk_{chunk_num}.csv")
                chunk_data = [dict(zip(columns, row_data)) for row_data in rows]
                save_chunk_to_csv(chunk_file, columns, chunk_data)
                print(f"Saved chunk {chunk_num} with {len(rows)} rows")
                yield {
                    'file': chunk_file,
                    'chunk_number': chunk_num,
                    'total_chunks': -1,  # Will be updated at end
                    'columns': columns,
                    'table_name': table_name,
                    'schema': schema
                }
                
                # Reset for next chunk
                rows = []
                chunk_num += 1
                
    except Exception as e:
        print(f"Error during extraction: {str(e)}")
        raise Exception(f"Error extracting data: {str(e)}")
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

async def import_chunk(
    connection_string: str,
    chunk_info: Dict[str, Any],
    create_table: bool = False
) -> int:
    conn = None
    cursor = None
    rows_imported = 0
    
    try:
        # Connect to destination database based on connection string type
        is_sqlserver = 'ODBC Driver' in connection_string
        
        if '.db' in connection_string:
            conn = sqlite3.connect(connection_string)
        elif is_sqlserver:
            conn = pyodbc.connect(connection_string)
        else:
            conn = cx_Oracle.connect(connection_string)
        
        cursor = conn.cursor()
        
        table_name = chunk_info['table_name']
        chunk_file = chunk_info['file']
        
        # Create table if needed (only for first chunk)
        if create_table:
            create_table_query = generate_create_table_query(
                table_name, 
                chunk_info['columns'],
                is_sqlserver
            )
            print(f"Creating table {table_name}")
            print(f"Query: {create_table_query}")
            cursor.execute(create_table_query)
            conn.commit()
        
        # Import data from CSV
        print(f"Importing data from {chunk_file}")
        with open(chunk_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            batch = []
            
            for row in reader:
                # Handle empty strings as NULL for SQL Server
                if is_sqlserver:
                    row_values = [
                        None if val == '' else val 
                        for val in [row[col] for col in chunk_info['columns']]
                    ]
                else:
                    row_values = [row[col] for col in chunk_info['columns']]
                
                batch.append(row_values)
                rows_imported += 1
                
                # Execute in batches
                if len(batch) >= 1000:  # Smaller batch size for better performance
                    import_batch(
                        cursor, 
                        table_name, 
                        chunk_info['columns'],
                        batch,
                        is_sqlserver
                    )
                    print(f"Imported {rows_imported} rows")
                    batch = []
                    conn.commit()  # Commit each batch
            
            # Import remaining rows
            if batch:
                import_batch(
                    cursor, 
                    table_name, 
                    chunk_info['columns'],
                    batch,
                    is_sqlserver
                )
                print(f"Imported final {len(batch)} rows")
                conn.commit()
        
        print(f"Successfully imported {rows_imported} rows")
        
        # Clean up CSV file after successful import
        os.remove(chunk_file)
        print(f"Removed chunk file {chunk_file}")
        
        return rows_imported
        
    except Exception as e:
        print(f"Error during import: {str(e)}")
        if conn:
            conn.rollback()
        raise Exception(f"Error importing data: {str(e)}")
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def get_table_columns(cursor, table_name: str, schema: Optional[str] = None) -> List[str]:
    """Get column names for the table"""
    if isinstance(cursor, sqlite3.Cursor):
        cursor.execute(f"PRAGMA table_info({table_name})")
        return [row[1] for row in cursor.fetchall()]
    else:
        table_identifier = f"{schema}.{table_name}" if schema else table_name
        cursor.execute(f"SELECT * FROM {table_identifier} WHERE 1=0")
        return [desc[0] for desc in cursor.description]

def save_chunk_to_csv(filename: str, columns: List[str], data: List[Dict[str, Any]]) -> None:
    """Save chunk data to a CSV file"""
    print(f"Saving {len(data)} rows to {filename}")
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        writer.writerows(data)
    
    print(f"Saved chunk to {filename}")

def generate_create_table_query(table_name: str, columns: List[str], is_sqlserver: bool = False) -> str:
    """Generate CREATE TABLE query with appropriate column types"""
    if is_sqlserver:
        # SQL Server syntax
        column_defs = [f'[{col}] NVARCHAR(MAX)' for col in columns]
        return f"""
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'{table_name}') AND type in (N'U'))
            BEGIN
                CREATE TABLE {table_name} (
                    {', '.join(column_defs)}
                )
            END
        """
    else:
        # Oracle syntax
        column_defs = [f'"{col}" NVARCHAR2(4000)' for col in columns]
        return f"""
            CREATE TABLE {table_name} (
                {', '.join(column_defs)}
            )
        """

def import_batch(cursor, table_name: str, columns: List[str], batch: List[List[Any]], is_sqlserver: bool = False) -> None:
    """Import a batch of rows"""
    if is_sqlserver:
        # SQL Server syntax with proper column quoting
        columns_str = ','.join([f'[{col}]' for col in columns])
        placeholders = ','.join(['?' for _ in columns])
        query = f"""
            INSERT INTO {table_name} ({columns_str})
            VALUES ({placeholders})
        """
    else:
        # Oracle syntax
        columns_str = ','.join([f'"{col}"' for col in columns])
        placeholders = ','.join([':' + str(i+1) for i in range(len(columns))])
        query = f"""
            INSERT INTO {table_name} ({columns_str})
            VALUES ({placeholders})
        """
    
    cursor.executemany(query, batch)
