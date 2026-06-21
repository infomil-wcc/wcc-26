import { Component, Input, inject, ChangeDetectionStrategy } from '@angular/core';
import { TeamsService } from '../../services/content/teams.service';
import { Observable } from 'rxjs';
import { Teams } from '../../contracts/teams.contract';
import { NgClass, AsyncPipe } from '@angular/common';

@Component({
    selector: 'teamperformance',
    templateUrl: './teamperformance.component.html',
    styleUrl: './teamperformance.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [NgClass, AsyncPipe]
})
export class TeamperformanceComponent {

  @Input() teamName!: string;

  private teamService = inject(TeamsService);
  protected $Teams!: Observable<Teams[]>;

  ngOnInit(): void {
    this.$Teams = this.teamService.getTeamByName(this.teamName);
  }
}
