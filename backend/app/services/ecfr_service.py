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
        self._agencies_cache = None
        
    async def _make_request(self, endpoint: str, params: Dict = None) -> Any:
        """Make a request to the eCFR API"""
        url = f"{self.base_url}{endpoint}"
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            
            print(f"Request to {url} returned status {response.status_code}")
            
            if endpoint.endswith('.xml'):
                content = response.text
                print(f"XML content length: {len(content)}")
                if len(content) < 100:  # If content is suspiciously small
                    print(f"Warning: Small XML content: {content}")
                return content
                
            return response.json()
        except httpx.HTTPError as e:
            print(f"Error making request to {url}: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Response content: {e.response.text[:500]}")  # Print first 500 chars of error response
            return None
        except Exception as e:
            print(f"Unexpected error making request to {url}: {str(e)}")
            return None

    async def get_agencies(self) -> List[Dict]:
        """Get all agencies and their references"""
        if self._agencies_cache is not None:
            return self._agencies_cache
            
        agencies = await self._make_request("/admin/v1/agencies.json")
        if agencies:
            self._agencies_cache = agencies
            
        return agencies or []

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
        agencies_response = await self.get_agencies()
        if not agencies_response or not isinstance(agencies_response, list):
            return {"total": 0, "by_agency": {}}
            
        counts = {"total": 0, "by_agency": {}}
        
        for agency in agencies_response:
            if not isinstance(agency, dict):
                continue
                
            agency_count = 0
            agency_name = agency.get("name", "Unknown Agency")
            references = agency.get("cfr_references", [])
            
            if not isinstance(references, list):
                continue
                
            for ref in references:
                if not isinstance(ref, dict):
                    continue
                    
                title = ref.get("title")
                if not title:
                    continue
                    
                try:
                    word_count = await self._get_word_count_for_title_and_date(title, date)
                    if word_count is not None:
                        agency_count += word_count
                except Exception as e:
                    print(f"Error processing title {title} for agency {agency_name}: {str(e)}")
                    continue
                    
            counts["by_agency"][agency_name] = agency_count
            counts["total"] += agency_count
            
        return counts

    async def _get_word_count_for_title_and_date(self, title: int, date: str) -> Optional[int]:
        """Get word count for a specific title and date."""
        try:
            # Get the most recent issue date from the API
            response = await self._make_request("/versioner/v1/titles")
            if not response or not isinstance(response, dict):
                print(f"Failed to get titles or invalid response type: {type(response)}")
                return None
                
            titles_data = response.get('titles', [])
            if not isinstance(titles_data, list):
                print(f"Invalid titles data type: {type(titles_data)}")
                return None
                
            title_info = next((t for t in titles_data if str(t.get('title_number', '')) == str(title)), None)
            if not title_info:
                print(f"Title {title} not found in titles data")
                return None
                
            most_recent_date = title_info.get('most_recent_change')
            if not most_recent_date:
                print(f"No most recent date found for title {title}")
                return None
                
            # If requested date is past the most recent issue date, use the most recent date
            if date > most_recent_date:
                print(f"Requested date {date} is past most recent issue date {most_recent_date}, using {most_recent_date}")
                date = most_recent_date

            # Make the request for the word count
            xml = await self._make_request(
                f"/versioner/v1/full/{date}/title-{title}.xml"
            )
            if not xml or not isinstance(xml, str):
                print(f"No XML content returned for title {title} or invalid type: {type(xml)}")
                return None
                
            # Use lxml parser for better performance and reliability
            soup = BeautifulSoup(xml, 'lxml-xml')
            if not soup or not soup.find():
                print(f"Failed to parse XML for title {title}")
                return None
            
            # Remove elements that shouldn't be counted
            for element in soup.find_all(['TOC', 'PRTPAGE']):
                element.decompose()
                
            text = soup.get_text(separator=' ', strip=True)
            if not text:
                print(f"No text content found for title {title}")
                return None
            
            # Clean up text
            text = re.sub(r'\[\d+\s+FR\s+\d+\]', '', text)  # Remove citations
            text = re.sub(r'\[Reserved\]', '', text)  # Remove [Reserved]
            text = re.sub(r'\d+\s*(U\.S\.C\.|CFR|et seq\.)', '', text)  # Remove legal references
            
            # Count words
            words = [word for word in text.split() if word.strip()]
            word_count = len(words)
            
            print(f"Processed title {title}: {word_count} words")
            
            return word_count

        except Exception as e:
            print(f"Error getting word count for {title} on {date}: {str(e)}")
            return None

    async def get_agency_titles(self, agency_slug: str) -> List[Dict]:
        """Get all titles for a specific agency"""
        agencies_response = await self.get_agencies()
        if not agencies_response or not isinstance(agencies_response, list):
            return []
            
        agency = next((a for a in agencies_response if isinstance(a, dict) and a.get("slug") == agency_slug), None)
        if not agency:
            return []
            
        titles = []
        references = agency.get("cfr_references", [])
        if not isinstance(references, list):
            return []
            
        for ref in references:
            if not isinstance(ref, dict):
                continue
                
            title = ref.get("title")
            if not title:
                continue
                
            try:
                structure = await self._make_request(
                    f"/versioner/v1/structure/{datetime.now().strftime('%Y-%m-%d')}/title-{title}.json"
                )
                if structure and isinstance(structure, dict):
                    structure['title_number'] = title  # Ensure title number is always present
                    titles.append(structure)
            except Exception as e:
                print(f"Error fetching structure for title {title}: {str(e)}")
                continue
                
        return titles

    async def get_agency_title_changes(self, agency_slug: str) -> List[Dict]:
        """Track changes in agency's titles over time"""
        now = datetime.now()
        # Generate dates from past to present
        dates = []
        current_date = now - timedelta(days=730)  # 2 years back
        while current_date <= now:
            dates.append(current_date.strftime("%Y-%m-%d"))
            current_date += timedelta(days=90)  # Move forward by quarter
        
        changes = []
        previous_titles = set()
        
        for date in dates:
            try:
                titles = await self.get_agency_titles(agency_slug)
                if not titles:
                    continue
                
                # Extract title numbers, ensuring they are integers
                current_titles = set()
                for t in titles:
                    if isinstance(t, dict):
                        title_num = t.get('title_number')
                        if title_num is not None:
                            try:
                                current_titles.add(int(title_num))
                            except (ValueError, TypeError):
                                continue
                
                change = {
                    "date": date,
                    "title_count": len(current_titles),
                    "titles": sorted(list(current_titles)),
                    "difference": len(current_titles) - len(previous_titles)
                }
                
                changes.append(change)
                previous_titles = current_titles
            except Exception as e:
                print(f"Error processing changes for date {date}: {str(e)}")
                continue
                
        return sorted(changes, key=lambda x: x['date'])

    async def get_title_word_count(self, title_number: int, date: Optional[str] = None) -> Dict:
        """Get word count for a specific title"""
        if not date:
            date = datetime.now().strftime("%Y-%m-%d")
            
        try:
            word_count = await self._get_word_count_for_title_and_date(title_number, date)
            if word_count is None:
                print(f"No word count returned for title {title_number}")
                return {
                    "title": title_number,
                    "date": date,
                    "word_count": 0
                }
                
            return {
                "title": title_number,
                "date": date,
                "word_count": word_count
            }
        except Exception as e:
            print(f"Error getting word count for title {title_number}: {str(e)}")
            return {
                "title": title_number,
                "date": date,
                "word_count": 0,
                "error": str(e)
            }
