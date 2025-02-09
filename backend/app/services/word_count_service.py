from datetime import datetime, timedelta
import httpx
import xml.etree.ElementTree as ET
import re
from typing import List, Dict, Optional
import asyncio
from bs4 import BeautifulSoup
import logging
import os
from dotenv import load_dotenv
from functools import lru_cache
import time

load_dotenv()  # Load environment variables from .env file

logger = logging.getLogger(__name__)

class WordCountService:
    def __init__(self):
        self.base_url = os.getenv('ECFR_API_URL', 'https://www.ecfr.gov/api/versioner/v1')
        self.client = httpx.AsyncClient(
            timeout=60.0,  # Longer timeout for large files
            headers={"accept": "application/xml"}
        )
        self._cache = {}  # Simple in-memory cache
        self.cache_ttl = 3600  # Cache TTL in seconds (1 hour)

    def _get_from_cache(self, key: str) -> Optional[int]:
        """Get value from cache if it exists and is not expired."""
        if key in self._cache:
            value, timestamp = self._cache[key]
            if time.time() - timestamp < self.cache_ttl:
                return value
            else:
                del self._cache[key]  # Remove expired entry
        return None

    def _set_cache(self, key: str, value: int):
        """Set value in cache with current timestamp."""
        self._cache[key] = (value, time.time())

    async def get_title_word_count(self, date: str, title: str) -> int:
        """Get word count for a specific title on a specific date."""
        cache_key = f"{date}_{title}"
        cached_value = self._get_from_cache(cache_key)
        if cached_value is not None:
            return cached_value

        url = f"{self.base_url}/full/{date}/title-{title}.xml"
        try:
            response = await self.client.get(url)
            response.raise_for_status()
            
            # Use BeautifulSoup to parse XML and extract text
            soup = BeautifulSoup(response.text, 'lxml-xml')
            
            if not soup or not soup.find():
                raise ValueError("Failed to parse XML content")
            
            # Remove elements that shouldn't be counted
            excluded_elements = ['TOC', 'PRTPAGE', 'SECTNO', 'CITA', 'FTREF', 'EAR', 'STARS']
            for element in soup.find_all(excluded_elements):
                element.decompose()
            
            # Get all text content
            text = soup.get_text(separator=' ', strip=True)
            
            # Clean up text
            # Remove citations like [55 FR 1234]
            text = re.sub(r'\[\d+\s+FR\s+\d+\]', '', text)
            # Remove reserved sections
            text = re.sub(r'\[Reserved\]', '', text)
            # Remove legal references
            text = re.sub(r'\d+\s*(U\.S\.C\.|CFR|et seq\.)', '', text)
            # Remove section numbers
            text = re.sub(r'§+\s*\d+\.+\d+', '', text)
            # Remove multiple spaces
            text = re.sub(r'\s+', ' ', text)
            
            # Split and count words
            words = [word for word in text.split() if word.strip()]
            word_count = len(words)
            
            # Cache the result
            self._set_cache(cache_key, word_count)
            return word_count
            
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.warning(f"No data available for title {title} on {date}")
                return 0
            raise
        except Exception as e:
            logger.error(f"Error getting word count for title {title} on {date}: {str(e)}")
            raise

    async def get_historical_word_counts(self, title: str, start_year: int = 2017, end_year: int = 2025) -> List[Dict]:
        """Get historical word counts for a title across years."""
        # Don't try to get future dates
        current_year = datetime.now().year
        end_year = min(end_year, current_year)
        
        dates = []
        current_date = datetime(start_year, 1, 1)
        end_date = datetime(end_year, 12, 31)
        
        # Sample dates every 6 months
        while current_date <= end_date:
            dates.append(current_date.strftime("%Y-%m-%d"))
            # Move to next 6-month period
            next_month = current_date.month + 6
            year_increment = (next_month - 1) // 12
            month = ((next_month - 1) % 12) + 1
            current_date = current_date.replace(year=current_date.year + year_increment, month=month, day=1)

        # Process dates in parallel with concurrency control
        semaphore = asyncio.Semaphore(5)  # Limit concurrent requests

        async def fetch_with_semaphore(date: str) -> Dict:
            async with semaphore:
                try:
                    word_count = await self.get_title_word_count(date, title)
                    return {"date": date, "word_count": word_count}
                except Exception as e:
                    logger.error(f"Error processing date {date}: {str(e)}")
                    return {"date": date, "error": str(e)}

        # Create tasks for all dates
        tasks = [fetch_with_semaphore(date) for date in dates]
        results = await asyncio.gather(*tasks)
        
        # Filter out errors and zero word counts
        valid_results = [
            result for result in results 
            if "error" not in result and result["word_count"] > 0
        ]
        
        return sorted(valid_results, key=lambda x: x["date"])

    async def close(self):
        """Close the HTTP client and clear cache."""
        await self.client.aclose()
        self._cache.clear()
