import { Component, ChangeDetectionStrategy } from '@angular/core';
import { GroupTableComponent } from '../../../shared/components/group-table/group-table.component';

@Component({
  selector: 'app-group-standings',
  templateUrl: './group-standings.component.html',
  styleUrl: './group-standings.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
  imports: [GroupTableComponent]
})
export class GroupStandingsComponent {}
