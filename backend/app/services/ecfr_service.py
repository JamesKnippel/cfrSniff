from datetime import datetime, timedelta
import httpx
from typing import Dict, List, Any, Optional
from bs4 import BeautifulSoup
import re
import asyncio
from ..models.agency import Agency, CFRReference

class ECFRService:
    def __init__(self):
        self.base_url = "https://www.ecfr.gov/api"
        self.client = httpx.AsyncClient(timeout=30.0)
        
    async def _make_request(self, endpoint: str, params: Dict = None) -> Any:
        """Make a request to the eCFR API"""
        url = f"{self.base_url}{endpoint}"
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            print(f"Error making request to {url}: {str(e)}")
            return None

    async def get_agencies(self) -> List[Dict]:
        """Get all agencies and their references"""
        return await self._make_request("/admin/v1/agencies.json")

    async def get_historical_word_counts(self, start_date: str, end_date: str) -> List[Dict]:
        """Get word counts for all agencies between two dates"""
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        dates = []
        current = start
        
        # Generate quarterly dates
        while current <= end:
            dates.append(current.strftime("%Y-%m-%d"))
            current += timedelta(days=90)
            
        results = []
        for date in dates:
            try:
                count = await self._get_word_count_for_date(date)
                results.append({
                    "date": date,
                    "total_words": count["total"],
                    "by_agency": count["by_agency"]
                })
            except Exception as e:
                print(f"Error processing date {date}: {str(e)}")
                continue
                
        return results
        
    async def _get_word_count_for_date(self, date: str) -> Dict:
        """Get word count for all agencies on a specific date"""
        agencies = await self.get_agencies()
        counts = {"total": 0, "by_agency": {}}
        
        for agency in agencies:
            agency_count = 0
            for ref in agency.get("cfr_references", []):
                try:
                    xml = await self._make_request(
                        f"/versioner/v1/full/{date}/title-{ref['title']}.xml"
                    )
                    if xml:
                        # Parse XML and count words
                        soup = BeautifulSoup(xml, 'lxml')
                        text = soup.get_text()
                        words = len(re.findall(r'\w+', text))
                        agency_count += words
                except Exception as e:
                    print(f"Error processing title {ref['title']} for agency {agency['name']}: {str(e)}")
                    continue
                    
            counts["by_agency"][agency["name"]] = agency_count
            counts["total"] += agency_count
            
        return counts

    async def get_agency_titles(self, agency_slug: str) -> List[Dict]:
        """Get all titles for a specific agency"""
        agencies = await self.get_agencies()
        agency = next((a for a in agencies if a["slug"] == agency_slug), None)
        if not agency:
            return []
            
        titles = []
        for ref in agency.get("cfr_references", []):
            structure = await self._make_request(
                f"/versioner/v1/structure/{datetime.now().strftime('%Y-%m-%d')}/title-{ref['title']}.json"
            )
            if structure:
                titles.append(structure)
                
        return titles

    async def get_agency_title_changes(self, agency_slug: str) -> Dict:
        """Track changes in agency's titles over time"""
        now = datetime.now()
        dates = [
            (now - timedelta(days=x*90)).strftime("%Y-%m-%d")
            for x in range(8)  # Last 2 years, quarterly
        ]
        
        changes = []
        previous_count = None
        
        for date in dates:
            try:
                titles = await self.get_agency_titles(agency_slug)
                current_count = len(titles)
                
                change = {
                    "date": date,
                    "title_count": current_count,
                    "titles": titles,
                    "difference": 0 if previous_count is None else current_count - previous_count
                }
                
                changes.append(change)
                previous_count = current_count
            except Exception as e:
                print(f"Error processing changes for date {date}: {str(e)}")
                continue
                
        return changes

    async def get_title_word_count(self, title_number: int, date: str) -> Dict:
        """Get word count for a specific title"""
        try:
            xml = await self._make_request(
                f"/versioner/v1/full/{date}/title-{title_number}.xml"
            )
            if xml:
                soup = BeautifulSoup(xml, 'lxml')
                text = soup.get_text()
                return {
                    "title": title_number,
                    "date": date,
                    "word_count": len(re.findall(r'\w+', text))
                }
        except Exception as e:
            print(f"Error getting word count for title {title_number}: {str(e)}")
            return {
                "title": title_number,
                "date": date,
                "word_count": 0,
                "error": str(e)
            }
