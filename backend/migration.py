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
        # Set Oracle environment for UTF-8 and increase buffer size
        os.environ["NLS_LANG"] = ".AL32UTF8"
        
        # Initialize Oracle client with optimal settings
        cx_Oracle.init_oracle_client()
        
        # Connect to Oracle source database
        conn = cx_Oracle.connect(connection_string)
        cursor = conn.cursor()
        
        # Configure session for large data
        cursor.execute("ALTER SESSION SET NLS_LENGTH_SEMANTICS = 'CHAR'")
        cursor.arraysize = 1000  # Fetch 1000 rows at a time
        
        # Set large buffer size for CLOB/LONG columns
        cursor.setinputsizes(None, cx_Oracle.CLOB)
        
        # Get column information
        columns = selected_columns if selected_columns else get_table_columns(cursor, table_name, schema)
        columns_str = ', '.join([f'"{col}"' for col in columns])
        table_identifier = f"{schema}.{table_name}" if schema else table_name
        
        # Create temp directory for this table
        table_temp_dir = os.path.join(TEMP_DIR, table_name)
        os.makedirs(table_temp_dir, exist_ok=True)
        
        print(f"Starting extraction for {table_name}")
        print(f"Temp directory: {table_temp_dir}")
        
        # Get total row count first
        cursor.execute(f"SELECT COUNT(*) FROM {table_identifier}")
        total_rows = cursor.fetchone()[0]
        total_chunks = (total_rows + chunk_size - 1) // chunk_size
        
        # Extract data in chunks using array fetch
        cursor.execute(f"SELECT {columns_str} FROM {table_identifier}")
        
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
                        'total_chunks': total_chunks,
                        'columns': columns,
                        'table_name': table_name,
                        'schema': schema,
                        'total_rows': total_rows
                    }
                break
                
            # Convert row data to strings, handling None values and LOBs
            row_data = []
            for val in row:
                if val is None:
                    row_data.append('')
                elif isinstance(val, cx_Oracle.LOB):
                    row_data.append(val.read())
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
                    'total_chunks': total_chunks,
                    'columns': columns,
                    'table_name': table_name,
                    'schema': schema,
                    'total_rows': total_rows
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
        # Connect to SQL Server with fast load enabled
        conn = pyodbc.connect(connection_string, autocommit=False)
        cursor = conn.cursor()
        
        table_name = chunk_info['table_name']
        chunk_file = chunk_info['file']
        
        # Create table if needed (only for first chunk)
        if create_table:
            # Check if table exists first
            cursor.execute(f"""
                IF NOT EXISTS (SELECT * FROM sys.objects 
                WHERE object_id = OBJECT_ID(N'{table_name}') AND type in (N'U'))
                BEGIN
                    CREATE TABLE {table_name} (
                        {', '.join([f'[{col}] NVARCHAR(MAX)' for col in chunk_info['columns']])}
                    )
                END
            """)
            conn.commit()
        
        # Import data from CSV using fast load
        print(f"Importing data from {chunk_file}")
        with open(chunk_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            batch = []
            
            for row in reader:
                # Handle empty strings as NULL
                row_values = [
                    None if val == '' else val 
                    for val in [row[col] for col in chunk_info['columns']]
                ]
                
                batch.append(row_values)
                rows_imported += 1
                
                # Execute in larger batches for better performance
                if len(batch) >= 10000:  # Increased batch size
                    columns_str = ','.join([f'[{col}]' for col in chunk_info['columns']])
                    placeholders = ','.join(['?' for _ in chunk_info['columns']])
                    query = f"""
                        INSERT INTO {table_name} ({columns_str})
                        VALUES ({placeholders})
                    """
                    cursor.fast_executemany = True  # Enable fast load
                    cursor.executemany(query, batch)
                    print(f"Imported {rows_imported} rows")
                    batch = []
                    conn.commit()  # Commit each batch
            
            # Import remaining rows
            if batch:
                columns_str = ','.join([f'[{col}]' for col in chunk_info['columns']])
                placeholders = ','.join(['?' for _ in chunk_info['columns']])
                query = f"""
                    INSERT INTO {table_name} ({columns_str})
                    VALUES ({placeholders})
                """
                cursor.fast_executemany = True  # Enable fast load
                cursor.executemany(query, batch)
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
            try:
                conn.rollback()
            except:
                pass  # Ignore rollback errors
        raise Exception(f"Error importing data: {str(e)}")
        
    finally:
        if cursor:
            try:
                cursor.close()
            except:
                pass
        if conn:
            try:
                conn.close()
            except:
                pass

def get_table_columns(cursor, table_name: str, schema: Optional[str] = None) -> List[str]:
    """Get column names for the table"""
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