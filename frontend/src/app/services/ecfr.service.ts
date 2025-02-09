import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Agency } from '../models/agency.model';
import { firstValueFrom } from 'rxjs';

interface HistoricalData {
  date: string;
  wordCount: number;
}

interface TitleChange {
  date: string;
  title_count: number;
  titles: any[];
  difference: number;
}

interface TitleData {
  title: number;
  wordCount: number;
  lastUpdated: string;
}

interface TitleWordCountResponse {
  word_count: number;
  date: string;
}

@Injectable({
  providedIn: 'root'
})
export class ECFRService {
  private readonly baseUrl = 'http://localhost:8000/api';
  
  // State signals
  readonly agencies = signal<Agency[]>([]);
  readonly selectedAgency = signal<Agency | null>(null);
  readonly selectedTitle = signal<number | null>(null);
  readonly selectedAgencyHistory = signal<HistoricalData[]>([]);
  readonly selectedAgencyChanges = signal<TitleChange[]>([]);
  readonly titleData = signal<TitleData[]>([]);
  readonly searchQuery = signal('');

  // Computed values
  readonly filteredAgencies = computed(() => {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.agencies();
    
    return this.searchAgencies(this.agencies(), query);
  });

  readonly selectedAgencyAnalytics = computed(() => {
    const agency = this.selectedAgency();
    if (!agency) return null;

    return {
      totalReferences: agency.cfr_references?.length || 0,
      uniqueTitles: new Set(agency.cfr_references?.map(ref => ref.title) || []).size,
      childAgencies: agency.children?.length || 0
    };
  });

  readonly uniqueTitles = computed(() => {
    const agency = this.selectedAgency();
    if (!agency?.cfr_references) return [];
    
    return Array.from(new Set(agency.cfr_references.map(ref => ref.title)))
      .sort((a, b) => a - b);
  });

  constructor(private http: HttpClient) {
    this.loadAgencies();
  }

  private searchAgencies(agencies: Agency[], query: string): Agency[] {
    if (!Array.isArray(agencies)) return [];
    
    return agencies.filter(agency => {
      if (!agency) return false;
      
      // Check if agency name matches
      const nameMatch = ((agency.display_name || agency.name) || '').toLowerCase().includes(query);
      
      // Check if any titles match
      const titleMatch = (agency.cfr_references || []).some(ref => 
        ref?.title?.toString().includes(query)
      );
      
      // If this agency matches, include it and all its children
      if (nameMatch || titleMatch) {
        return true;
      }
      
      // If this agency doesn't match, check its children and only include it if any children match
      const matchingChildren = this.searchAgencies(agency.children || [], query);
      if (matchingChildren.length > 0) {
        agency.children = matchingChildren; // Only include matching children
        return true;
      }
      
      return false;
    });
  }

  async loadAgencies(): Promise<void> {
    try {
      const response = await firstValueFrom(this.http.get<any>(`${this.baseUrl}/agencies`));
      console.log('API Response:', response);
      
      let agencies: Agency[] = [];
      if (Array.isArray(response)) {
        agencies = response;
      } else if (response && typeof response === 'object') {
        agencies = response.agencies || response.data || [];
      }
      
      console.log('Transformed Agencies:', agencies);
      this.agencies.set(agencies);
    } catch (error) {
      console.error('Error loading agencies:', error);
      this.agencies.set([]);
    }
  }

  async selectAgency(agency: Agency): Promise<void> {
    console.log('Selecting agency:', agency);
    this.selectedAgency.set(agency);
    this.selectedTitle.set(null);
    await Promise.all([
      this.loadAgencyHistory(agency),
      this.loadAgencyChanges(agency),
      this.loadTitleData(agency)
    ]);
  }

  async selectTitle(title: number): Promise<void> {
    console.log('Selecting title:', title);
    this.selectedTitle.set(title);
    await this.loadTitleWordCount(title);
  }

  updateSearch(query: string): void {
    this.searchQuery.set(query);
  }

  private async loadTitleData(agency: Agency): Promise<void> {
    try {
      if (!agency?.cfr_references?.length) {
        this.titleData.set([]);
        return;
      }

      // Get unique titles
      const titles = agency.cfr_references.map(ref => ref.title);
      const uniqueTitles = Array.from(new Set(titles));
      
      // Batch titles into groups of 5 to prevent too many concurrent requests
      const batchSize = 5;
      const batches = [];
      for (let i = 0; i < uniqueTitles.length; i += batchSize) {
        batches.push(uniqueTitles.slice(i, i + batchSize));
      }

      const allTitleData: TitleData[] = [];
      
      // Process batches sequentially
      for (const batch of batches) {
        const batchPromises = batch.map(async title => {
          try {
            const response = await firstValueFrom(
              this.http.get<TitleWordCountResponse>(`${this.baseUrl}/title/${title}/word-count`)
            );
            
            if (!response?.word_count) {
              console.warn(`No word count data returned for title ${title}`);
              return null;
            }

            const titleData: TitleData = {
              title,
              wordCount: response.word_count,
              lastUpdated: response.date || new Date().toISOString()
            };

            return titleData;
          } catch (error) {
            console.warn(`Error loading data for title ${title}:`, error);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        const validResults = batchResults.filter((data): data is TitleData => data !== null);
        allTitleData.push(...validResults);
      }

      console.log(`Loaded word counts for ${allTitleData.length} titles`);
      this.titleData.set(allTitleData);
    } catch (error) {
      console.error('Error loading title data:', error);
      this.titleData.set([]);
    }
  }

  async loadAgencyHistory(agency: Agency): Promise<void> {
    try {
      const data = await firstValueFrom(
        this.http.get<HistoricalData[]>(
          `${this.baseUrl}/historical-word-counts?agency=${agency.slug}`
        )
      );
      console.log('Agency history:', data);
      this.selectedAgencyHistory.set(data || []);
    } catch (error) {
      console.error('Error loading agency history:', error);
      this.selectedAgencyHistory.set([]);
    }
  }

  async loadAgencyChanges(agency: Agency): Promise<void> {
    try {
      const data = await firstValueFrom(
        this.http.get<TitleChange[]>(
          `${this.baseUrl}/agency/${agency.slug}/changes`
        )
      );
      console.log('Agency changes:', data);
      this.selectedAgencyChanges.set(data || []);
    } catch (error) {
      console.error('Error loading agency changes:', error);
      this.selectedAgencyChanges.set([]);
    }
  }

  private async loadTitleWordCount(title: number): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<TitleWordCountResponse>(`${this.baseUrl}/title/${title}/word-count`)
      );
      
      if (!response?.word_count) {
        console.warn(`No word count data returned for title ${title}`);
        return;
      }

      // Update the title data with new word count
      const currentTitleData = this.titleData();
      const updatedTitleData = currentTitleData.map(td => 
        td.title === title 
          ? { ...td, wordCount: response.word_count, lastUpdated: response.date || new Date().toISOString() }
          : td
      );
      this.titleData.set(updatedTitleData);
    } catch (error) {
      console.error('Error loading title word count:', error);
    }
  }
}
