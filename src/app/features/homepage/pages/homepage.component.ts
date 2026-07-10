import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TeamsService } from '../../../core/services/content/teams.service';
import { Group, Teams } from '../../../shared/contracts/teams.contract';
import { Observable } from 'rxjs';

import { CookieService } from '../../../core/services/core/cookie.service';
import { NgStyle, AsyncPipe } from '@angular/common';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { LoginComponent } from '../../../features/auth/login.component';

@Component({
    selector: 'app-homepage',
    templateUrl: './homepage.component.html',
    styleUrl: './homepage.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [NgStyle, LoaderComponent, LoginComponent]
})
export class HomepageComponent {
  private teamService = inject<TeamsService>(TeamsService);
  private cookieService = inject<CookieService>(CookieService);
  
  protected teamsFlags = this.teamService.flags;
  protected wcGroups = this.teamService.groups;
  protected showLogin: boolean = false;
  protected isLoggedIn: boolean = false;
  protected mobileGroupIndex: number = 0;

  protected prevGroup(): void {
    if (this.mobileGroupIndex > 0) this.mobileGroupIndex--;
  }

  protected nextGroup(groups: any[]): void {
    if (this.mobileGroupIndex < groups.length - 1) this.mobileGroupIndex++;
  }

  private route = inject(ActivatedRoute);

  ngOnInit(): void {
    // Resources are fetched reactively, no need to assign them here.
    
    let currentUser = this.cookieService.get('currentUser');
    (currentUser) ? this.isLoggedIn = true : this.isLoggedIn = false;

    this.route.queryParams.subscribe(params => {
      if (params['token']) {
        this.showLogin = true;
      }
    });
  }

}