from pydantic import BaseModel
from typing import List, Optional

class CFRReference(BaseModel):
    title: int
    chapter: Optional[str] = None
    subtitle: Optional[str] = None

class Agency(BaseModel):
    name: str
    short_name: Optional[str] = None
    display_name: str
    sortable_name: str
    slug: str
    children: List['Agency'] = []
    cfr_references: List[CFRReference]
