from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import sqlite3
import cx_Oracle
import pyodbc
from models import Connection, DatabaseTable, SearchParams, MigrationRequest
from database import (
    fetch_mssql_schema, 
    fetch_oracle_schema, 
    fetch_sqlite_schema,
    search_oracle_views
)
from migration import extract_table_chunks, import_chunk
import logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize SQLite database
def init_db():
    conn = sqlite3.connect('connections.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS connections (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            host TEXT,
            port INTEGER,
            username TEXT,
            password TEXT,
            database TEXT,
            connection_string TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

init_db()

def get_mssql_connection_string(connection: dict) -> str:
    """Helper function to build SQL Server connection string"""
    if connection['connection_string']:
        # If custom connection string is provided, ensure it has the driver
        if 'DRIVER=' not in connection['connection_string']:
            return f"DRIVER={{ODBC Driver 17 for SQL Server}};{connection['connection_string']}"
        return connection['connection_string']
    
    # Build connection string from individual fields
    return (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={connection['host']},{connection['port']};"
        f"DATABASE={connection['database']};"
        f"UID={connection['username']};"
        f"PWD={connection['password']}"
    )

@app.get("/api/connections")
async def get_connections():
    conn = sqlite3.connect('connections.db')
    c = conn.cursor()
    c.execute('SELECT * FROM connections')
    rows = c.fetchall()
    conn.close()
    
    connections = []
    for row in rows:
        connection = dict(zip([col[0] for col in c.description], row))
        # Don't send password in response
        if 'password' in connection:
            connection['password'] = '****'
        connections.append(connection)
    
    return connections

@app.post("/api/connections")
async def create_connection(connection: Connection):
    conn = sqlite3.connect('connections.db')
    c = conn.cursor()
    
    try:
        c.execute('''
            INSERT INTO connections (id, name, type, host, port, username, password, 
                                   database, connection_string)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            connection.id,
            connection.name,
            connection.type,
            connection.host,
            connection.port,
            connection.username,
            connection.password,
            connection.database,
            connection.connection_string
        ))
        conn.commit()
    except sqlite3.Error as e:
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))
    
    conn.close()
    return {"message": "Connection created successfully"}

@app.get("/api/connections/{connection_id}/schema")
async def get_schema(connection_id: str) -> List[DatabaseTable]:
    # Get connection details
    conn = sqlite3.connect('connections.db')
    c = conn.cursor()
    c.execute('SELECT * FROM connections WHERE id = ?', (connection_id,))
    row = c.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Connection not found")
    
    connection = dict(zip([col[0] for col in c.description], row))
    conn.close()
    
    try:
        if connection['type'] == 'mssql':
            conn_str = get_mssql_connection_string(connection)
            return await fetch_mssql_schema(conn_str)
            
        elif connection['type'] == 'oracle':
            conn_str = connection['connection_string']
            if not conn_str:
                conn_str = f"{connection['username']}/{connection['password']}@{connection['host']}:{connection['port']}/{connection['database']}"
            # For Oracle, return empty list as we'll use search endpoint
            return []
            
        elif connection['type'] == 'sqlite':
            return await fetch_sqlite_schema(connection['database'])
            
        else:
            raise HTTPException(status_code=400, detail="Unsupported database type")
            
    except Exception as e:
        error_message = str(e)
        if "ORA-12514" in error_message:
            error_message = (
                "Cannot connect to database. The specified service name is not registered "
                "with the listener. Please verify the service name and ensure the listener "
                "is running on the database server."
            )
        raise HTTPException(status_code=500, detail=error_message)

@app.post("/api/connections/{connection_id}/search")
async def search_schema(connection_id: str, params: SearchParams) -> List[DatabaseTable]:
    logger.debug(f"Search request received with params: {params}")
    # Get connection details
    conn = sqlite3.connect('connections.db')
    c = conn.cursor()
    c.execute('SELECT * FROM connections WHERE id = ?', (connection_id,))
    row = c.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Connection not found")
    
    connection = dict(zip([col[0] for col in c.description], row))
    conn.close()
    
    try:
        if connection['type'] == 'oracle':
            conn_str = connection['connection_string']
            if not conn_str:
                conn_str = f"{connection['username']}/{connection['password']}@{connection['host']}:{connection['port']}/{connection['database']}"
                logger.debug("About to call search_oracle_views")
                result = await search_oracle_views(conn_str, params.search, params.limit, params.offset)
                logger.debug("search_oracle_views completed successfully")
            return result
        else:
            raise HTTPException(status_code=400, detail="Search is only supported for Oracle connections")
            
    except Exception as e:
        error_message = str(e)
        if "ORA-12514" in error_message:
            error_message = (
                "Cannot connect to database. The specified service name is not registered "
                "with the listener. Please verify the service name and ensure the listener "
                "is running on the database server."
            )
        logger.exception("Error during Oracle search")
        raise HTTPException(status_code=500, detail=error_message)

@app.put("/api/connections/{connection_id}")
async def update_connection(connection_id: str, connection: Connection):
    conn = sqlite3.connect('connections.db')
    c = conn.cursor()
    
    try:
        c.execute('''
            UPDATE connections 
            SET name=?, type=?, host=?, port=?, username=?, password=?, 
                database=?, connection_string=?
            WHERE id=?
        ''', (
            connection.name,
            connection.type,
            connection.host,
            connection.port,
            connection.username,
            connection.password,
            connection.database,
            connection.connection_string,
            connection_id
        ))
        conn.commit()
    except sqlite3.Error as e:
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))
    
    conn.close()
    return {"message": "Connection updated successfully"}

@app.delete("/api/connections/{connection_id}")
async def delete_connection(connection_id: str):
    conn = sqlite3.connect('connections.db')
    c = conn.cursor()
    
    try:
        c.execute('DELETE FROM connections WHERE id = ?', (connection_id,))
        conn.commit()
    except sqlite3.Error as e:
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))
    
    conn.close()
    return {"message": "Connection deleted successfully"}

@app.post("/api/connections/test")
async def test_connection(connection: Connection):
    try:
        if connection.type == 'oracle':
            conn_str = connection.connection_string
            if not conn_str:
                conn_str = f"{connection.username}/{connection.password}@{connection.host}:{connection.port}/{connection.database}"
            
            try:
                # First try with simple connection string
                conn = cx_Oracle.connect(conn_str)
                conn.close()
            except cx_Oracle.DatabaseError as e:
                error_obj, = e.args
                if error_obj.code == 12514:  # TNS:listener does not currently know of service requested
                    # Try with full connection descriptor
                    full_desc = (
                        f"{connection.username}/{connection.password}@"
                        f"(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST={connection.host})(PORT={connection.port}))"
                        f"(CONNECT_DATA=(SERVICE_NAME={connection.database})))"
                    )
                    conn = cx_Oracle.connect(full_desc)
                    conn.close()
                else:
                    raise
            
            return {"success": True, "message": "Connection successful"}
            
        elif connection.type == 'mssql':
            conn_str = get_mssql_connection_string(dict(connection))
            
            conn = pyodbc.connect(conn_str, timeout=5)
            cursor = conn.cursor()
            cursor.execute('SELECT @@VERSION')
            cursor.fetchone()
            cursor.close()
            conn.close()
            
            return {"success": True, "message": "Connection successful"}
            
        elif connection.type == 'sqlite':
            conn = sqlite3.connect(connection.database)
            conn.close()
            return {"success": True, "message": "SQLite connection validated"}
            
        else:
            raise HTTPException(status_code=400, detail="Unsupported database type")
            
    except Exception as e:
        error_message = str(e)
        if "ORA-12514" in error_message:
            error_message = (
                "Cannot connect to database. The specified service name is not registered "
                "with the listener. Please verify the service name and ensure the listener "
                "is running on the database server."
            )
        raise HTTPException(status_code=400, detail=error_message)

@app.post("/api/migration/start")
async def start_migration(request: MigrationRequest):
    # Get source and destination connections
    conn = sqlite3.connect('connections.db')
    c = conn.cursor()
    
    # Get source connection
    c.execute('SELECT * FROM connections WHERE id = ?', (request.source_connection_id,))
    source_row = c.fetchone()
    if not source_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Source connection not found")
    source_conn = dict(zip([col[0] for col in c.description], source_row))
    
    # Get destination connection
    c.execute('SELECT * FROM connections WHERE id = ?', (request.destination_connection_id,))
    dest_row = c.fetchone()
    if not dest_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Destination connection not found")
    dest_conn = dict(zip([col[0] for col in c.description], dest_row))
    
    conn.close()
    
    try:
        # Extract chunks from source
        source_conn_str = source_conn['connection_string'] or f"{source_conn['username']}/{source_conn['password']}@{source_conn['host']}:{source_conn['port']}/{source_conn['database']}"
        dest_conn_str = get_mssql_connection_string(dest_conn)
        
        chunks_processed = 0
        async for chunk in extract_table_chunks(
            source_conn_str,
            request.table_name,
            request.schema,
            request.chunk_size,
            request.selected_columns
        ):
            # Import chunk to destination
            await import_chunk(dest_conn_str, chunk, create_table=(chunks_processed == 0))
            chunks_processed += 1
        
        return {"message": "Migration completed successfully", "chunks_processed": chunks_processed}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)