import csv
import os
from tempfile import mkdtemp
from typing import AsyncGenerator, List, Optional, Dict, Any
import sqlite3
import pyodbc
import cx_Oracle
from models import MigrationChunk

TEMP_DIR = mkdtemp()
CHUNK_SIZE = 100000  # Process 100k rows at a time

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
                conn = cx_Oracle.connect(connection_string)
        
        cursor = conn.cursor()
        
        # Get column information
        columns = selected_columns if selected_columns else get_table_columns(cursor, table_name, schema)
        
        # Calculate total rows and chunks
        total_rows = get_row_count(cursor, table_name, schema)
        total_chunks = (total_rows + chunk_size - 1) // chunk_size
        
        # Create temp directory for this table if it doesn't exist
        table_temp_dir = os.path.join(TEMP_DIR, f"{schema}_{table_name}" if schema else table_name)
        os.makedirs(table_temp_dir, exist_ok=True)
        
        # Extract data in chunks
        for chunk_num in range(total_chunks):
            offset = chunk_num * chunk_size
            chunk_data = extract_chunk(
                cursor, 
                table_name, 
                schema, 
                columns, 
                offset, 
                chunk_size
            )
            
            # Save chunk to temporary CSV file
            chunk_file = os.path.join(table_temp_dir, f"chunk_{chunk_num}.csv")
            save_chunk_to_csv(chunk_file, columns, chunk_data)
            
            yield {
                'file': chunk_file,
                'chunk_number': chunk_num,
                'total_chunks': total_chunks,
                'columns': columns,
                'total_rows': total_rows,
                'table_name': table_name,  # Add table_name to the chunk info
                'schema': schema  # Add schema to the chunk info
            }
            
    except Exception as e:
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
        # Connect to destination database
        if '.db' in connection_string:
            conn = sqlite3.connect(connection_string)
        else:
            if 'ODBC Driver' in connection_string:
                conn = pyodbc.connect(connection_string)
            else:
                conn = cx_Oracle.connect(connection_string)
        
        cursor = conn.cursor()
        
        table_name = chunk_info['table_name']  # Get table_name from chunk_info
        
        # Create table if needed
        if create_table:
            create_table_query = generate_create_table_query(
                table_name, 
                chunk_info['columns']
            )
            cursor.execute(create_table_query)
        
        # Import data from CSV
        with open(chunk_info['file'], 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            batch = []
            
            for row in reader:
                batch.append(list(row.values()))
                rows_imported += 1
                
                # Execute in batches of 1000
                if len(batch) >= 1000:
                    import_batch(cursor, table_name, chunk_info['columns'], batch)
                    batch = []
            
            # Import remaining rows
            if batch:
                import_batch(cursor, table_name, chunk_info['columns'], batch)
        
        conn.commit()
        
        # Don't remove the file yet - keep it for potential retries
        # Only remove when all chunks are successfully processed
        
        return rows_imported
        
    except Exception as e:
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

def get_row_count(cursor, table_name: str, schema: Optional[str] = None) -> int:
    """Get total number of rows in the table"""
    table_identifier = f"{schema}.{table_name}" if schema else table_name
    cursor.execute(f"SELECT COUNT(*) FROM {table_identifier}")
    return cursor.fetchone()[0]

def extract_chunk(
    cursor,
    table_name: str,
    schema: Optional[str],
    columns: List[str],
    offset: int,
    chunk_size: int
) -> List[Dict[str, Any]]:
    """Extract a chunk of data from the table"""
    table_identifier = f"{schema}.{table_name}" if schema else table_name
    columns_str = ', '.join([f"[{col}]" for col in columns])
    
    if isinstance(cursor, sqlite3.Cursor):
        query = f"""
            SELECT {columns_str} FROM {table_identifier}
            LIMIT {chunk_size} OFFSET {offset}
        """
    else:
        query = f"""
            SELECT {columns_str} FROM {table_identifier}
            OFFSET {offset} ROWS FETCH NEXT {chunk_size} ROWS ONLY
        """
    
    cursor.execute(query)
    return [dict(zip(columns, row)) for row in cursor.fetchall()]

def save_chunk_to_csv(filename: str, columns: List[str], data: List[Dict[str, Any]]) -> None:
    """Save chunk data to a CSV file"""
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        writer.writerows(data)

def generate_create_table_query(table_name: str, columns: List[str]) -> str:
    """Generate CREATE TABLE query with all columns as NVARCHAR(MAX)"""
    column_defs = [f"[{col}] NVARCHAR(MAX)" for col in columns]
    return f"""
        CREATE TABLE {table_name} (
            {', '.join(column_defs)}
        )
    """

def import_batch(cursor, table_name: str, columns: List[str], batch: List[List[Any]]) -> None:
    """Import a batch of rows"""
    placeholders = ','.join(['?' for _ in columns])
    query = f"""
        INSERT INTO {table_name} ({','.join([f'[{col}]' for col in columns])})
        VALUES ({placeholders})
    """
    cursor.executemany(query, batch)