from pydantic import BaseModel
from typing import Optional, List

class DatabaseColumn(BaseModel):
    name: str
    type: str
    nullable: bool
    isPrimaryKey: bool
    selected: bool = True

class DatabaseTable(BaseModel):
    name: str
    schema: Optional[str] = None
    rowCount: Optional[int] = 0
    columns: List[DatabaseColumn]
    selected: bool = False

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

class SearchParams(BaseModel):
    search: Optional[str] = None
    limit: Optional[int] = 10
    offset: Optional[int] = 0

class MigrationChunk(BaseModel):
    table_name: str
    schema: Optional[str]
    chunk_number: int
    total_chunks: int
    rows: List[dict]

class MigrationRequest(BaseModel):
    source_connection_id: str
    destination_connection_id: str
    table_name: str
    schema: Optional[str]
    chunk_size: int = 1000000  # Default to 1M rows per chunk
    selected_columns: List[str]