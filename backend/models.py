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