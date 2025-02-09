import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AgencyVisualizationComponent } from './components/agency-visualization/agency-visualization.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatToolbarModule,
    AgencyVisualizationComponent
  ],
  template: `
    <mat-toolbar color="primary">
      <span>eCFR Agency Title Analyzer</span>
    </mat-toolbar>

    <app-agency-visualization></app-agency-visualization>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
    }
  `]
})
export class AppComponent {
  title = 'eCFR Analyzer';
}
