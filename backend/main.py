from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import sqlite3
import cx_Oracle
import pyodbc
from models import Connection, DatabaseTable
from database import fetch_mssql_schema, fetch_oracle_schema, fetch_sqlite_schema

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
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    connection = dict(zip([col[0] for col in c.description], row))
    
    try:
        if connection['type'] == 'mssql':
            conn_str = connection['connection_string']
            if not conn_str:
                conn_str = (
                    f"DRIVER={{ODBC Driver 17 for SQL Server}};"
                    f"SERVER={connection['host']},{connection['port']};"
                    f"DATABASE={connection['database']};"
                    f"UID={connection['username']};"
                    f"PWD={connection['password']}"
                )
            return await fetch_mssql_schema(conn_str)
            
        elif connection['type'] == 'oracle':
            conn_str = connection['connection_string']
            if not conn_str:
                # Build the connection string with service name
                conn_str = f"{connection['username']}/{connection['password']}@{connection['host']}:{connection['port']}/{connection['database']}"
            return await fetch_oracle_schema(conn_str)
            
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
            conn_str = connection.connection_string
            if not conn_str:
                conn_str = (
                    f"DRIVER={{ODBC Driver 17 for SQL Server}};"
                    f"SERVER={connection.host},{connection.port};"
                    f"DATABASE={connection.database};"
                    f"UID={connection.username};"
                    f"PWD={connection.password}"
                )
            
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)