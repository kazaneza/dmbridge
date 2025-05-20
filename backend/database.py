import sqlite3
from typing import List, Optional
import pyodbc
import cx_Oracle
import os
from models import DatabaseTable, DatabaseColumn

# Initialize Oracle client once at module level
os.environ["NLS_LANG"] = ".AL32UTF8"
try:
    cx_Oracle.init_oracle_client()
except Exception as e:
    if "Oracle Client library has already been initialized" not in str(e):
        raise

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
    conn = None
    cursor = None
    
    try:
        conn = cx_Oracle.connect(connection_string)
        cursor = conn.cursor()
        
        # Configure session for large data
        cursor.execute("ALTER SESSION SET NLS_LENGTH_SEMANTICS = 'CHAR'")
        cursor.execute("ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD HH24:MI:SS'")
        cursor.arraysize = 1000  # Fetch 1000 rows at a time
        
        # Set large buffer size for CLOB/LONG columns
        cursor.setinputsizes(None, cx_Oracle.CLOB)
        
        # Build the search condition with proper parameter binding
        where_clause = "WHERE object_type = 'VIEW'"
        bind_vars = []
        
        if search:
            where_clause += " AND UPPER(object_name) LIKE UPPER(:1)"
            bind_vars.append(f"%{search}%")  # Using positional binding
        
        # Get list of views with optimized query
        query = f"""
            SELECT /*+ FIRST_ROWS({limit}) */
                owner AS schema_name,
                object_name AS table_name
            FROM all_objects
            {where_clause}
            AND owner NOT IN (
                'SYS', 'SYSTEM', 'OUTLN', 'DIP', 'ORACLE_OCM', 'DBSNMP', 'APPQOSSYS',
                'WMSYS', 'EXFSYS', 'CTXSYS', 'XDB', 'ANONYMOUS', 'ORDSYS', 'ORDDATA',
                'ORDPLUGINS', 'SI_INFORMTN_SCHEMA', 'MDSYS', 'OLAPSYS', 'MDDATA',
                'SPATIAL_WFS_ADMIN_USR', 'SPATIAL_CSW_ADMIN_USR', 'SYSMAN', 'MGMT_VIEW',
                'APEX_030200', 'FLOWS_FILES', 'APEX_PUBLIC_USER', 'OWBSYS', 'OWBSYS_AUDIT'
            )
            ORDER BY owner, object_name
            OFFSET :2 ROWS FETCH NEXT :3 ROWS ONLY
        """
        
        bind_vars.extend([offset, limit])
        
        cursor.execute(query, bind_vars)
        tables_data = cursor.fetchall()
        
        for table in tables_data:
            schema_name, table_name = table
            
            # Get columns for this view
            cursor.execute("""
                SELECT 
                    column_name,
                    data_type,
                    nullable,
                    data_length,
                    char_length
                FROM all_tab_columns
                WHERE owner = :1
                AND table_name = :2
                ORDER BY column_id
            """, [schema_name, table_name])
            
            columns = []
            for col in cursor.fetchall():
                column_name, data_type, nullable, data_length, char_length = col
                # Adjust data type description for large text fields
                if data_type in ('VARCHAR2', 'CHAR', 'NVARCHAR2', 'NCHAR'):
                    type_desc = f"{data_type}({char_length})"
                elif data_type == 'NUMBER' and data_length:
                    type_desc = f"{data_type}({data_length})"
                else:
                    type_desc = data_type
                
                columns.append(DatabaseColumn(
                    name=column_name,
                    type=type_desc,
                    nullable=(nullable == 'Y'),
                    isPrimaryKey=False,
                    selected=True
                ))
            
            # Get the full row count for the view
            row_count = 0
            try:
                cursor.execute("""
                    SELECT num_rows 
                    FROM all_tables 
                    WHERE owner = :1
                    AND table_name = :2
                """, [schema_name, table_name])
                
                count_result = cursor.fetchone()
                
                if not count_result or count_result[0] is None:
                    cursor.execute("ALTER SESSION SET QUERY_REWRITE_ENABLED = TRUE")
                    cursor.execute("ALTER SESSION SET NLS_LENGTH_SEMANTICS = 'CHAR'")
                    
                    try:
                        cursor.execute("BEGIN DBMS_SESSION.SET_STATEMENT_TIMEOUT(30000); END;")
                    except:
                        pass
                    
                    # For identifiers like schema and table names, we need to use 
                    # string formatting - but must sanitize the identifiers first
                    # to prevent SQL injection
                    def is_valid_identifier(name):
                        return all(c.isalnum() or c == '_' or c == '$' or c == '#' for c in name)
                    
                    if is_valid_identifier(schema_name) and is_valid_identifier(table_name):
                        # Get actual row count without ROWNUM limitation
                        count_query = f"SELECT COUNT(*) FROM {schema_name}.{table_name}"
                        cursor.execute(count_query)
                        count_result = cursor.fetchone()
                    else:
                        # Skip count for potentially unsafe identifiers
                        pass
                    
                if count_result and count_result[0] is not None:
                    row_count = count_result[0]
            except Exception:
                pass
            
            tables.append(DatabaseTable(
                name=table_name,
                schema=schema_name,
                rowCount=row_count,
                columns=columns,
                selected=False
            ))
        
        return tables
        
    except cx_Oracle.DatabaseError as e:
        error_obj, = e.args
        if error_obj.code == 12154:  # TNS:could not resolve service name
            raise Exception("Could not connect to the database. Please verify the service name and connection details.")
        elif error_obj.code == 1017:  # Invalid username/password
            raise Exception("Invalid username or password.")
        elif error_obj.code == 12541:  # No listener
            raise Exception("Could not connect to the database. Please verify the host and port.")
        else:
            raise Exception(f"Database error: {str(e)}")
    except Exception as e:
        raise Exception(f"Error searching Oracle views: {str(e)}")
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