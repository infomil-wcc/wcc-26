import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { Teams } from '@shared/contracts/teams.contract';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-team-list',
  templateUrl: './team-list.component.html',
  styleUrl: './team-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass]
})
export class TeamListComponent {
  @Input() teams!: Teams[];
  @Input() hideList: boolean = false;

  @Output() teamSelected = new EventEmitter<Teams>();

  onTeamSelected(team: Teams): void {
    this.teamSelected.emit(team);
  }
}
