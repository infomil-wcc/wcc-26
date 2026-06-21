import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { TeamsService } from '../../shared/services/content/teams.service';
import { Group, Teams } from '../../shared/contracts/teams.contract';
import { Observable } from 'rxjs';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { CookieService } from '../../shared/services/core/cookie.service';

@Component({
    selector: 'app-homepage',
    templateUrl: './homepage.component.html',
    styleUrl: './homepage.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class HomepageComponent {
  private teamService = inject<TeamsService>(TeamsService);
  private cookieService = inject<CookieService>(CookieService);
  protected $teamsFlags!: Observable<any>;
  protected $wcGroups!: Observable<Group[]>;
  protected headerInstance!: HeaderComponent;
  protected showLogin: boolean = false;
  protected isLoggedIn: boolean = false;

  ngOnInit(): void {
    this.$wcGroups = this.teamService.getGroups();
    this.$teamsFlags = this.teamService.getFlags();
    
    let currentUser = this.cookieService.get('currentUser');
    (currentUser) ? this.isLoggedIn = true : this.isLoggedIn = false;
  }

}