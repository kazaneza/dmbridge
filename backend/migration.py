import csv
import os
from tempfile import mkdtemp
from typing import AsyncGenerator, List, Optional
import sqlite3
import pyodbc
import cx_Oracle
from models import MigrationChunk

TEMP_DIR = mkdtemp()

def get_chunk_filename(table_name: str, chunk_number: int) -> str:
    return os.path.join(TEMP_DIR, f"{table_name}_chunk_{chunk_number}.csv")

async def extract_table_chunks(
    connection_string: str,
    table_name: str,
    schema: Optional[str] = None,
    chunk_size: int = 1000000,
    selected_columns: List[str] = None
) -> AsyncGenerator[MigrationChunk, None]:
    try:
        conn = None
        cursor = None
        
        if '.db' in connection_string:  # SQLite
            conn = sqlite3.connect(connection_string)
            cursor = conn.cursor()
        else:  # Oracle or MSSQL
            if 'ODBC Driver' in connection_string:
                conn = pyodbc.connect(connection_string)
            else:
                conn = cx_Oracle.connect(connection_string)
            cursor = conn.cursor()
        
        # Get total row count
        count_query = f"""
            SELECT COUNT(*) FROM {f'"{schema}".' if schema else ''}{table_name}
        """
        cursor.execute(count_query)
        total_rows = cursor.fetchone()[0]
        
        # Calculate number of chunks
        total_chunks = (total_rows + chunk_size - 1) // chunk_size
        
        # Generate chunks
        for chunk_number in range(total_chunks):
            offset = chunk_number * chunk_size
            
            # Build query with selected columns
            columns = '*' if not selected_columns else ', '.join(selected_columns)
            query = f"""
                SELECT {columns} 
                FROM {f'"{schema}".' if schema else ''}{table_name}
                OFFSET {offset} ROWS FETCH NEXT {chunk_size} ROWS ONLY
            """
            
            cursor.execute(query)
            columns = [column[0] for column in cursor.description]
            rows = []
            
            # Fetch rows and convert to dictionaries
            for row in cursor:
                row_dict = dict(zip(columns, row))
                rows.append(row_dict)
            
            # Create chunk file
            chunk_file = get_chunk_filename(table_name, chunk_number)
            with open(chunk_file, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=columns)
                writer.writeheader()
                writer.writerows(rows)
            
            yield MigrationChunk(
                table_name=table_name,
                schema=schema,
                chunk_number=chunk_number,
                total_chunks=total_chunks,
                rows=rows
            )
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        raise Exception(f"Error extracting chunks: {str(e)}")

async def import_chunk(
    connection_string: str,
    chunk: MigrationChunk,
    create_table: bool = True
) -> None:
    try:
        conn = None
        cursor = None
        
        if '.db' in connection_string:  # SQLite
            conn = sqlite3.connect(connection_string)
            cursor = conn.cursor()
        else:  # Oracle or MSSQL
            if 'ODBC Driver' in connection_string:
                conn = pyodbc.connect(connection_string)
            else:
                conn = cx_Oracle.connect(connection_string)
            cursor = conn.cursor()
        
        if create_table and chunk.chunk_number == 0:
            # Create table based on first chunk
            columns = list(chunk.rows[0].keys())
            create_query = f"""
                CREATE TABLE IF NOT EXISTS {chunk.table_name} (
                    {', '.join(f'{col} TEXT' for col in columns)}
                )
            """
            cursor.execute(create_query)
        
        # Import rows
        chunk_file = get_chunk_filename(chunk.table_name, chunk.chunk_number)
        with open(chunk_file, 'r', newline='') as f:
            reader = csv.DictReader(f)
            for row in reader:
                placeholders = ', '.join(['?' for _ in row])
                columns = ', '.join(row.keys())
                values = list(row.values())
                
                insert_query = f"""
                    INSERT INTO {chunk.table_name} ({columns})
                    VALUES ({placeholders})
                """
                cursor.execute(insert_query, values)
        
        conn.commit()
        cursor.close()
        conn.close()
        
        # Clean up chunk file
        os.remove(chunk_file)
        
    except Exception as e:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        raise Exception(f"Error importing chunk: {str(e)}")