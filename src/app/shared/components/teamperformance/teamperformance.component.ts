import { Component, Input, inject } from '@angular/core';
import { TeamsService } from '../../services/content/teams.service';
import { Observable } from 'rxjs';
import { Teams } from '../../contracts/teams.contract';

@Component({
  selector: 'teamperformance',
  templateUrl: './teamperformance.component.html',
  styleUrl: './teamperformance.component.scss'
})
export class TeamperformanceComponent {

  @Input() teamName!: string;

  private teamService = inject(TeamsService);
  protected $Teams!: Observable<Teams[]>;

  ngOnInit(): void {
    this.$Teams = this.teamService.getTeamByName(this.teamName);
  }
}
