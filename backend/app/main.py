from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from .services.ecfr_service import ECFRService

app = FastAPI(title="eCFR Analyzer API")

# Configure CORS with more permissive settings for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development only - update this for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ecfr_service = ECFRService()

@app.get("/")
async def root():
    return {"message": "eCFR Analyzer API"}

@app.get("/api/agencies")
async def get_agencies():
    """Get all agencies and their titles"""
    try:
        agencies = await ecfr_service.get_agencies()
        # Add debug logging
        print(f"Retrieved {len(agencies) if agencies else 0} agencies")
        return agencies
    except Exception as e:
        print(f"Error getting agencies: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/historical-word-counts")
async def get_historical_word_counts(
    start_date: str = "2017-01-01",
    end_date: Optional[str] = None
):
    """Get historical word counts for all agencies between dates"""
    try:
        if end_date is None:
            end_date = datetime.now().strftime("%Y-%m-%d")
        return await ecfr_service.get_historical_word_counts(start_date, end_date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/agency/{agency_slug}/titles")
async def get_agency_titles(agency_slug: str):
    """Get all titles for a specific agency"""
    try:
        return await ecfr_service.get_agency_titles(agency_slug)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/agency/{agency_slug}/changes")
async def get_agency_changes(agency_slug: str):
    """Get historical changes for an agency's titles"""
    try:
        return await ecfr_service.get_agency_title_changes(agency_slug)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/title/{title_number}/word-count")
async def get_title_word_count(
    title_number: int,
    date: Optional[str] = None
):
    """Get word count for a specific title"""
    try:
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")
        return await ecfr_service.get_title_word_count(title_number, date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
