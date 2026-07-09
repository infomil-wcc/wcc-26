import { Component, ChangeDetectionStrategy } from '@angular/core';
import { GroupTableComponent } from '../components/group-table/group-table.component';
import { BreadcrumbComponent, breadCrump } from '../../../../shared/components/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-group-standings',
  templateUrl: './group-standings.component.html',
  styleUrl: './group-standings.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
  imports: [GroupTableComponent, BreadcrumbComponent]
})
export class GroupStandingsComponent {
  breadCrumpData: breadCrump[] = [
    { label: 'Accueil', route: '/', active: false },
    { label: 'Compétition', route: '/competition/group-standings', active: false },
    { label: 'Groupes', route: '/competition/group-standings', active: true }
  ];
}
