import sqlite3
from typing import List, Optional, Generator
import pyodbc
import cx_Oracle
import csv
import os
from tempfile import mkdtemp
from models import DatabaseTable, DatabaseColumn, MigrationChunk

TEMP_DIR = mkdtemp()

def get_chunk_filename(table_name: str, chunk_number: int) -> str:
    return os.path.join(TEMP_DIR, f"{table_name}_chunk_{chunk_number}.csv")

async def extract_table_chunks(
    connection_string: str,
    table_name: str,
    schema: Optional[str] = None,
    chunk_size: int = 1000000,
    selected_columns: List[str] = None
) -> Generator[MigrationChunk, None, None]:
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

async def fetch_mssql_schema(connection_string: str) -> List[DatabaseTable]:
    tables = []
    try:
        conn = pyodbc.connect(connection_string, timeout=10)
        cursor = conn.cursor()
        
        # Query to get tables, views and their row counts
        cursor.execute("""
            SELECT 
                s.name AS schema_name,
                t.name AS table_name,
                t.type_desc AS object_type,
                p.rows AS row_count
            FROM sys.tables t
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            INNER JOIN sys.indexes i ON t.object_id = i.object_id
            INNER JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
            WHERE i.index_id <= 1
            UNION ALL
            SELECT 
                s.name AS schema_name,
                v.name AS table_name,
                v.type_desc AS object_type,
                0 AS row_count
            FROM sys.views v
            INNER JOIN sys.schemas s ON v.schema_id = s.schema_id
            ORDER BY schema_name, table_name
        """)
        
        tables_data = cursor.fetchall()
        
        for table in tables_data:
            schema_name, table_name, object_type, row_count = table
            
            # Get columns for this table
            cursor.execute("""
                SELECT 
                    c.name AS column_name,
                    t.name AS data_type,
                    c.is_nullable,
                    CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END AS is_primary_key
                FROM sys.columns c
                INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
                LEFT JOIN (
                    SELECT ic.column_id, ic.object_id
                    FROM sys.index_columns ic
                    INNER JOIN sys.indexes i ON ic.object_id = i.object_id 
                    AND ic.index_id = i.index_id
                    WHERE i.is_primary_key = 1
                ) pk ON c.object_id = pk.object_id AND c.column_id = pk.column_id
                WHERE c.object_id = OBJECT_ID(?)
                ORDER BY c.column_id
            """, [f"{schema_name}.{table_name}"])
            
            columns = []
            for col in cursor.fetchall():
                column_name, data_type, is_nullable, is_primary_key = col
                columns.append(DatabaseColumn(
                    name=column_name,
                    type=data_type,
                    nullable=bool(is_nullable),
                    isPrimaryKey=bool(is_primary_key),
                    selected=True
                ))
            
            tables.append(DatabaseTable(
                name=table_name,
                schema=schema_name,
                rowCount=row_count,
                columns=columns,
                selected=False
            ))
        
        cursor.close()
        conn.close()
        
        return tables
    except Exception as e:
        raise Exception(f"Error fetching MSSQL schema: {str(e)}")

async def search_oracle_views(
    connection_string: str,
    search: Optional[str] = None,
    limit: int = 10,
    offset: int = 0
) -> List[DatabaseTable]:
    tables = []
    try:
        conn = cx_Oracle.connect(connection_string)
        cursor = conn.cursor()
        
        # Build the search condition
        where_clause = "WHERE ao.object_type = 'VIEW'"
        if search:
            where_clause += f" AND ao.object_name LIKE '%{search.upper()}%'"
        
        # First get the list of views
        cursor.execute(f"""
            SELECT 
                ao.owner AS schema_name,
                ao.object_name AS table_name,
                ao.object_type
            FROM all_objects ao
            {where_clause}
            AND ao.owner NOT IN (
                'SYS', 'SYSTEM', 'OUTLN', 'DIP', 'ORACLE_OCM', 'DBSNMP', 'APPQOSSYS',
                'WMSYS', 'EXFSYS', 'CTXSYS', 'XDB', 'ANONYMOUS', 'ORDSYS', 'ORDDATA',
                'ORDPLUGINS', 'SI_INFORMTN_SCHEMA', 'MDSYS', 'OLAPSYS', 'MDDATA',
                'SPATIAL_WFS_ADMIN_USR', 'SPATIAL_CSW_ADMIN_USR', 'SYSMAN', 'MGMT_VIEW',
                'APEX_030200', 'FLOWS_FILES', 'APEX_PUBLIC_USER', 'OWBSYS', 'OWBSYS_AUDIT'
            )
            ORDER BY ao.owner, ao.object_name
            OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
        """, {'offset': offset, 'limit': limit})
        
        tables_data = cursor.fetchall()
        
        for table in tables_data:
            schema_name, table_name, object_type = table
            
            # Get actual row count for this view using dynamic SQL
            row_count = 0
            try:
                count_sql = f'SELECT COUNT(*) FROM "{schema_name}"."{table_name}"'
                cursor.execute(count_sql)
                row_count = cursor.fetchone()[0]
            except Exception as e:
                print(f"Error getting row count for {schema_name}.{table_name}: {str(e)}")
                row_count = 0
            
            # Get columns for this view
            cursor.execute("""
                SELECT 
                    atc.column_name,
                    atc.data_type,
                    atc.nullable,
                    CASE WHEN pk.column_name IS NOT NULL THEN 1 ELSE 0 END as is_primary_key
                FROM all_tab_columns atc
                LEFT JOIN (
                    SELECT column_name
                    FROM all_cons_columns acc
                    JOIN all_constraints ac ON acc.owner = ac.owner 
                        AND acc.constraint_name = ac.constraint_name
                    WHERE ac.constraint_type = 'P'
                    AND ac.owner = :1
                    AND ac.table_name = :2
                ) pk ON atc.column_name = pk.column_name
                WHERE atc.owner = :1
                AND atc.table_name = :2
                ORDER BY atc.column_id
            """, [schema_name, table_name])
            
            columns = []
            for col in cursor.fetchall():
                column_name, data_type, nullable, is_primary_key = col
                columns.append(DatabaseColumn(
                    name=column_name,
                    type=data_type,
                    nullable=(nullable == 'Y'),
                    isPrimaryKey=bool(is_primary_key),
                    selected=True
                ))
            
            tables.append(DatabaseTable(
                name=table_name,
                schema=schema_name,
                rowCount=row_count,
                columns=columns,
                selected=False
            ))
        
        cursor.close()
        conn.close()
        
        return tables
    except Exception as e:
        raise Exception(f"Error searching Oracle views: {str(e)}")

async def fetch_oracle_schema(connection_string: str) -> List[DatabaseTable]:
    # For Oracle, we'll use the search endpoint instead
    # This function now returns an empty list
    return []

async def fetch_sqlite_schema(database_path: str) -> List[DatabaseTable]:
    tables = []
    try:
        conn = sqlite3.connect(database_path)
        cursor = conn.cursor()
        
        # Get all tables and views
        cursor.execute("""
            SELECT name, type 
            FROM sqlite_master 
            WHERE type IN ('table', 'view')
            AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        """)
        
        for table_name, table_type in cursor.fetchall():
            # Get columns for this table/view
            cursor.execute(f"PRAGMA table_info('{table_name}')")
            
            columns = []
            for col in cursor.fetchall():
                cid, name, type_, notnull, dflt_value, pk = col
                columns.append(DatabaseColumn(
                    name=name,
                    type=type_,
                    nullable=not bool(notnull),
                    isPrimaryKey=bool(pk),
                    selected=True
                ))
            
            # Get approximate row count
            try:
                cursor.execute(f"SELECT COUNT(*) FROM '{table_name}'")
                row_count = cursor.fetchone()[0]
            except:
                row_count = 0
            
            tables.append(DatabaseTable(
                name=table_name,
                schema=None,
                rowCount=row_count,
                columns=columns,
                selected=False
            ))
        
        cursor.close()
        conn.close()
        
        return tables
    except Exception as e:
        raise Exception(f"Error fetching SQLite schema: {str(e)}")