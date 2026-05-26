import { Component, inject } from '@angular/core';
import { TeamsService } from '../../shared/services/content/teams.service';
import { Group, Teams } from '../../shared/contracts/teams.contract';
import { Observable } from 'rxjs';
import { HeaderComponent } from '../../shared/components/header/header.component';

@Component({
  selector: 'app-homepage',
  templateUrl: './homepage.component.html',
  styleUrl: './homepage.component.scss'
})
export class HomepageComponent {
  private teamService = inject<TeamsService>(TeamsService);
  protected $teamsFlags!: Observable<any>;
  protected $wcGroups!: Observable<Group[]>;
  protected headerInstance!: HeaderComponent;
  protected showLogin: boolean = false;

  ngOnInit(): void {
    this.$wcGroups = this.teamService.getGroups();
    this.$teamsFlags = this.teamService.getFlags();
  }

}
