import { Component, Input, ElementRef, ViewChild, OnChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import * as d3 from 'd3';
import { Agency } from '../../models/agency.model';
import { ECFRService } from '../../services/ecfr.service';

@Component({
  selector: 'app-agency-analytics',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatTabsModule],
  template: `
    <mat-card class="analytics-card">
      <mat-card-header>
        <mat-card-title>
          {{ agency.display_name }}
          @if (selectedTitle) {
            - Title {{ selectedTitle }}
          }
        </mat-card-title>
        <mat-card-subtitle>{{ agency.short_name }}</mat-card-subtitle>
      </mat-card-header>
      
      <mat-card-content>
        <div class="analytics-grid">
          @if (!selectedTitle) {
            <div class="stat-card">
              <h3>Total CFR References</h3>
              <p>{{ agency.cfr_references.length }}</p>
            </div>
            
            <div class="stat-card">
              <h3>Unique Titles</h3>
              <p>{{ uniqueTitles.length }}</p>
            </div>
            
            <div class="stat-card">
              <h3>Child Agencies</h3>
              <p>{{ agency.children.length }}</p>
            </div>
          } @else {
            <div class="stat-card">
              <h3>Word Count</h3>
              <p>{{ getTitleWordCount() | number }}</p>
            </div>
            
            <div class="stat-card">
              <h3>Last Updated</h3>
              <p>{{ getTitleLastUpdated() | date }}</p>
            </div>
            
            <div class="stat-card">
              <h3>References</h3>
              <p>{{ getTitleReferenceCount() }}</p>
            </div>
          }
        </div>

        <mat-tab-group>
          <mat-tab label="Title Distribution">
            <div #titleChart class="chart"></div>
          </mat-tab>
          
          <mat-tab label="Historical Word Count">
            <div #wordCountChart class="chart"></div>
          </mat-tab>
          
          <mat-tab label="Changes Over Time">
            <div class="changes-list">
              @for (change of ecfrService.selectedAgencyChanges(); track change.date) {
                <div class="change-item">
                  <h4>{{ change.date | date }}</h4>
                  <p>Titles: {{ change.title_count }}</p>
                  <p>Changed from previous: 
                    <span [class.increase]="change.difference > 0"
                          [class.decrease]="change.difference < 0">
                      {{ change.difference }}
                    </span>
                  </p>
                </div>
              }
            </div>
          </mat-tab>
        </mat-tab-group>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .analytics-card {
      height: 100%;
      overflow: auto;
    }

    .analytics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 20px;
    }

    .stat-card {
      padding: 15px;
      background: #f5f5f5;
      border-radius: 4px;
      text-align: center;

      h3 {
        margin: 0 0 8px 0;
        font-size: 1em;
        color: #666;
      }

      p {
        margin: 0;
        font-size: 1.5em;
        font-weight: 500;
      }
    }

    .chart {
      height: 400px;
      margin: 20px 0;
    }

    .changes-list {
      margin: 20px 0;
    }

    .change-item {
      padding: 10px;
      border-bottom: 1px solid #eee;

      h4 {
        margin: 0;
        color: #666;
      }

      p {
        margin: 5px 0;
      }
    }

    .increase { color: #4caf50; }
    .decrease { color: #f44336; }
  `]
})
export class AgencyAnalyticsComponent implements OnChanges {
  @Input() agency!: Agency;
  @Input() selectedTitle: number | null = null;
  
  @ViewChild('titleChart') titleChartElement!: ElementRef;
  @ViewChild('wordCountChart') wordCountChartElement!: ElementRef;

  public ecfrService = inject(ECFRService);
  
  get uniqueTitles(): number[] {
    return [...new Set(this.agency.cfr_references.map(ref => ref.title))];
  }

  ngOnChanges() {
    this.createTitleDistributionChart();
    this.createWordCountChart();
  }

  getTitleWordCount(): number {
    const titleData = this.ecfrService.titleData().find(td => td.title === this.selectedTitle);
    return titleData?.wordCount || 0;
  }

  getTitleLastUpdated(): string {
    const titleData = this.ecfrService.titleData().find(td => td.title === this.selectedTitle);
    return titleData?.lastUpdated || '';
  }

  getTitleReferenceCount(): number {
    if (!this.selectedTitle) return 0;
    return this.agency.cfr_references.filter(ref => ref.title === this.selectedTitle).length;
  }

  private createTitleDistributionChart() {
    if (!this.titleChartElement) return;

    const element = this.titleChartElement.nativeElement;
    const data = this.uniqueTitles.map(title => ({
      title,
      count: this.agency.cfr_references.filter(ref => ref.title === title).length,
      isSelected: title === this.selectedTitle
    }));

    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const width = element.clientWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    d3.select(element).selectAll('*').remove();

    const svg = d3.select(element)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .range([0, width])
      .padding(0.1);

    const y = d3.scaleLinear()
      .range([height, 0]);

    x.domain(data.map(d => d.title.toString()));
    y.domain([0, d3.max(data, d => d.count)!]);

    // Add bars
    svg.selectAll('.bar')
      .data(data)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.title.toString())!)
      .attr('width', x.bandwidth())
      .attr('y', d => y(d.count))
      .attr('height', d => height - y(d.count))
      .style('fill', d => d.isSelected ? '#1976D2' : '#2196F3')
      .on('mouseover', function(event, d) {
        d3.select(this).style('fill', d.isSelected ? '#1565C0' : '#1976D2');
        svg.append('text')
          .attr('class', 'tooltip')
          .attr('x', x(d.title.toString())! + x.bandwidth()/2)
          .attr('y', y(d.count) - 5)
          .attr('text-anchor', 'middle')
          .text(`Title ${d.title}: ${d.count}`);
      })
      .on('mouseout', function(event, d) {
        d3.select(this).style('fill', d.isSelected ? '#1976D2' : '#2196F3');
        svg.selectAll('.tooltip').remove();
      });

    // Add axes
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-65)');

    svg.append('g')
      .call(d3.axisLeft(y));
  }

  private createWordCountChart() {
    if (!this.wordCountChartElement) return;

    const element = this.wordCountChartElement.nativeElement;
    const data = this.ecfrService.selectedAgencyHistory();
    if (!data?.length) return;

    const margin = { top: 20, right: 20, bottom: 30, left: 60 };
    const width = element.clientWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    d3.select(element).selectAll('*').remove();

    const svg = d3.select(element)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleTime()
      .range([0, width])
      .domain(d3.extent(data.map(d => new Date(d.date))) as [Date, Date]);

    const y = d3.scaleLinear()
      .range([height, 0])
      .domain([0, d3.max(data, d => d.wordCount) || 0]);

    // Add line
    const line = d3.line<any>()
      .x(d => x(new Date(d.date)))
      .y(d => y(d.wordCount));

    svg.append('path')
      .datum(data)
      .attr('class', 'line')
      .attr('fill', 'none')
      .attr('stroke', '#2196F3')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Add points
    svg.selectAll('.dot')
      .data(data)
      .enter().append('circle')
      .attr('class', 'dot')
      .attr('cx', d => x(new Date(d.date)))
      .attr('cy', d => y(d.wordCount))
      .attr('r', 4)
      .style('fill', '#2196F3')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('r', 6)
          .style('fill', '#1976D2');
        
        svg.append('text')
          .attr('class', 'tooltip')
          .attr('x', x(new Date(d.date)))
          .attr('y', y(d.wordCount) - 10)
          .attr('text-anchor', 'middle')
          .text(`${d.date}: ${d.wordCount.toLocaleString()} words`);
      })
      .on('mouseout', function() {
        d3.select(this)
          .attr('r', 4)
          .style('fill', '#2196F3');
        svg.selectAll('.tooltip').remove();
      });

    // Add axes
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x));

    svg.append('g')
      .call(d3.axisLeft(y)
        .tickFormat(d => d3.format('.2s')(d)));

    // Add labels
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left)
      .attr('x', 0 - (height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .text('Word Count');
  }
}
