import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TeamsService } from '../../shared/services/content/teams.service';
import { Group, Teams } from '../../shared/contracts/teams.contract';
import { Observable } from 'rxjs';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { CookieService } from '../../shared/services/core/cookie.service';
import { NgStyle, AsyncPipe } from '@angular/common';
import { LoaderComponent } from '../../shared/components/loader/loader.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { LoginComponent } from '../../shared/components/login/login.component';

@Component({
    selector: 'app-homepage',
    templateUrl: './homepage.component.html',
    styleUrl: './homepage.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [NgStyle, LoaderComponent, ModalComponent, LoginComponent, AsyncPipe]
})
export class HomepageComponent {
  private teamService = inject<TeamsService>(TeamsService);
  private cookieService = inject<CookieService>(CookieService);
  protected $teamsFlags!: Observable<any>;
  protected $wcGroups!: Observable<Group[]>;
  protected headerInstance!: HeaderComponent;
  protected showLogin: boolean = false;
  protected isLoggedIn: boolean = false;

  private route = inject(ActivatedRoute);

  ngOnInit(): void {
    this.$wcGroups = this.teamService.getGroups();
    this.$teamsFlags = this.teamService.getFlags();
    
    let currentUser = this.cookieService.get('currentUser');
    (currentUser) ? this.isLoggedIn = true : this.isLoggedIn = false;

    this.route.queryParams.subscribe(params => {
      if (params['token']) {
        this.showLogin = true;
      }
    });
  }

}