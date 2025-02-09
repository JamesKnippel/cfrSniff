import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTreeModule } from '@angular/material/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ECFRService } from '../../services/ecfr.service';
import { AgencyAnalyticsComponent } from '../agency-analytics/agency-analytics.component';
import { Agency } from '../../models/agency.model';

@Component({
  selector: 'app-agency-visualization',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTreeModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatTooltipModule,
    MatBadgeModule,
    MatInputModule,
    MatFormFieldModule,
    AgencyAnalyticsComponent
  ],
  template: `
    <div class="agency-container">
      <mat-card class="agency-tree">
        <mat-card-header>
          <mat-card-title>Federal Agencies</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <mat-form-field class="search-field" appearance="outline">
            <mat-label>Search agencies or titles</mat-label>
            <input matInput
                   [ngModel]="ecfrService.searchQuery()"
                   (ngModelChange)="onSearch($event)"
                   placeholder="Enter agency name or title number">
            <button *ngIf="ecfrService.searchQuery()"
                    matSuffix
                    mat-icon-button
                    aria-label="Clear"
                    (click)="clearSearch()">
              <mat-icon>close</mat-icon>
            </button>
          </mat-form-field>

          @if (ecfrService.agencies().length === 0) {
            <div class="loading-message">Loading agencies...</div>
          } @else if (ecfrService.filteredAgencies().length === 0) {
            <div class="no-results">No matching agencies found</div>
          } @else {
            @for (agency of ecfrService.filteredAgencies(); track agency.slug) {
              <div class="agency-item" 
                   [class.selected]="agency === ecfrService.selectedAgency()"
                   (click)="selectAgency(agency)">
                <div class="agency-info">
                  <span class="agency-name">{{ agency.display_name || agency.name }}</span>
                  <div class="agency-titles">
                    @for (title of getUniqueTitles(agency); track title) {
                      <span class="title-badge"
                            [class.selected]="title === ecfrService.selectedTitle()"
                            (click)="onTitleClick($event, agency, title)"
                            [matTooltip]="getTitleTooltip(title)">
                        {{ title }}
                      </span>
                    }
                  </div>
                </div>
                @if ((agency.children || []).length > 0) {
                  <span class="child-count">({{ agency.children.length }})</span>
                }
              </div>
              @if (agency === ecfrService.selectedAgency() && (agency.children || []).length > 0) {
                <div class="child-agencies">
                  @for (child of agency.children; track child.slug) {
                    <div class="child-agency-item"
                         (click)="selectAgency(child); $event.stopPropagation()">
                      <div class="agency-info">
                        <span class="agency-name">{{ child.display_name || child.name }}</span>
                        <div class="agency-titles">
                          @for (title of getUniqueTitles(child); track title) {
                            <span class="title-badge"
                                  [class.selected]="title === ecfrService.selectedTitle()"
                                  (click)="onTitleClick($event, child, title)"
                                  [matTooltip]="getTitleTooltip(title)">
                              {{ title }}
                            </span>
                          }
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }
            }
          }
        </mat-card-content>
      </mat-card>

      <div class="content-area">
        @if (ecfrService.selectedAgency(); as agency) {
          <mat-card class="title-selection">
            <mat-card-header>
              <mat-card-title>{{ agency.display_name || agency.name }}</mat-card-title>
              <mat-card-subtitle>Select a title to analyze</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <div class="title-chips">
                @for (title of ecfrService.uniqueTitles(); track title) {
                  <mat-chip-option
                    [selected]="title === ecfrService.selectedTitle()"
                    (selectionChange)="onTitleSelect(title)"
                    [matTooltip]="getTitleTooltip(title)"
                    matTooltipPosition="above">
                    Title {{ title }}
                  </mat-chip-option>
                }
              </div>
            </mat-card-content>
          </mat-card>

          <app-agency-analytics 
            [agency]="agency"
            [selectedTitle]="ecfrService.selectedTitle()"
          />
        }
      </div>
    </div>
  `,
  styles: [`
    .agency-container {
      display: grid;
      grid-template-columns: 400px 1fr;
      gap: 20px;
      padding: 20px;
      height: calc(100vh - 64px);
    }

    .content-area {
      display: flex;
      flex-direction: column;
      gap: 20px;
      overflow: auto;
    }

    .agency-tree {
      height: 100%;
      overflow: auto;
    }

    .search-field {
      width: 100%;
      margin-bottom: 16px;
    }

    .no-results {
      padding: 16px;
      text-align: center;
      color: #666;
      font-style: italic;
    }

    .title-selection {
      .title-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 16px 0;
      }
    }

    .loading-message {
      padding: 16px;
      text-align: center;
      color: #666;
    }

    .agency-item {
      padding: 8px 16px;
      cursor: pointer;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 1px solid #eee;

      &:hover {
        background-color: #f5f5f5;
      }

      &.selected {
        background-color: #e3f2fd;
      }
    }

    .agency-info {
      flex: 1;
      min-width: 0;
    }

    .agency-name {
      display: block;
      margin-bottom: 4px;
    }

    .agency-titles {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 4px;
    }

    .title-badge {
      font-size: 0.75em;
      padding: 2px 6px;
      border-radius: 12px;
      background-color: #e0e0e0;
      color: #666;
      cursor: pointer;

      &:hover {
        background-color: #bdbdbd;
      }

      &.selected {
        background-color: #2196F3;
        color: white;
      }
    }

    .child-agencies {
      margin-left: 24px;
      border-left: 2px solid #2196F3;
    }

    .child-agency-item {
      padding: 6px 16px;
      cursor: pointer;
      font-size: 0.9em;
      color: #666;

      &:hover {
        background-color: #f5f5f5;
        color: #000;
      }
    }

    .child-count {
      font-size: 0.8em;
      color: #666;
      margin-left: 8px;
    }
  `]
})
export class AgencyVisualizationComponent implements OnInit {
  public ecfrService = inject(ECFRService);

  ngOnInit() {
    // Force reload agencies when component initializes
    this.ecfrService.loadAgencies();
  }

  selectAgency(agency: Agency): void {
    console.log('Selecting agency in component:', agency);
    this.ecfrService.selectAgency(agency);
  }

  onTitleSelect(title: number): void {
    this.ecfrService.selectTitle(title);
  }

  onTitleClick(event: Event, agency: Agency, title: number): void {
    event.stopPropagation();
    this.selectAgency(agency);
    this.ecfrService.selectTitle(title);
  }

  getUniqueTitles(agency: Agency): number[] {
    return [...new Set(agency.cfr_references.map(ref => ref.title))].sort((a, b) => a - b);
  }

  getTitleTooltip(title: number): string {
    const titleData = this.ecfrService.titleData().find(td => td.title === title);
    if (!titleData) return `Title ${title}`;
    return `Title ${title}\nWord Count: ${titleData.wordCount.toLocaleString()}\nLast Updated: ${titleData.lastUpdated}`;
  }

  onSearch(query: string): void {
    this.ecfrService.updateSearch(query);
  }

  clearSearch(): void {
    this.ecfrService.updateSearch('');
  }
}
