import sqlite3
from typing import List, Optional
import pyodbc
import cx_Oracle
from models import DatabaseTable, DatabaseColumn

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
        where_clause = "WHERE ao.object_type = 'VIEW' AND ao.object_name LIKE 'FBNK%'"
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