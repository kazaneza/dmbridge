from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import sqlite3
import pyodbc
import os
import json
from datetime import datetime

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

class Connection(BaseModel):
    id: str
    name: str
    type: str
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    database: Optional[str] = None
    connection_string: Optional[str] = None

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
        conn_str = connection.connection_string
        if not conn_str:
            if connection.type == 'mssql':
                conn_str = (
                    f"DRIVER={{ODBC Driver 17 for SQL Server}};"
                    f"SERVER={connection.host},{connection.port};"
                    f"DATABASE={connection.database};"
                    f"UID={connection.username};"
                    f"PWD={connection.password}"
                )
            elif connection.type == 'oracle':
                conn_str = (
                    f"DRIVER={{Oracle in instantclient_21_1}};"
                    f"DBQ={connection.host}:{connection.port}/{connection.database};"
                    f"Uid={connection.username};"
                    f"Pwd={connection.password}"
                )
            elif connection.type == 'sqlite':
                return {"success": True, "message": "SQLite connection validated"}
        
        # Test connection
        conn = pyodbc.connect(conn_str, timeout=5)
        cursor = conn.cursor()
        
        # Test query based on database type
        if connection.type == 'mssql':
            cursor.execute('SELECT @@VERSION')
        elif connection.type == 'oracle':
            cursor.execute('SELECT * FROM v$version')
        
        cursor.fetchone()
        cursor.close()
        conn.close()
        return {"success": True, "message": "Connection successful"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)