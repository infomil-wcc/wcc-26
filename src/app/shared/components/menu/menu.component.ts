import { Component, Input, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { StateService, user } from '../../../core/services/core/state.service';
import { Observable, Subscription } from 'rxjs';
import { NavComponent } from '../nav/nav.component';
import { LoginComponent } from '../login/login.component';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { SidebarService } from '../../../core/services/core/sidebar.service';

@Component({
    selector: 'cmp-menu',
    templateUrl: './menu.component.html',
    styleUrl: './menu.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [NavComponent, LoginComponent, AsyncPipe]
})
export class MenuComponent implements OnInit{

  private state = inject(StateService);
  private router = inject(Router);
  protected sidebar = inject(SidebarService);

  protected $userState!: Observable<user>;

  @Input() showLogin: boolean = false;

  ngOnInit(): void {
    this.$userState = this.state.userState;
  }

  public showLoginModal(): void {
    this.showLogin = true;
  }

  protected loadHomepage() {
    this.state.updateState({ currentPage: 'accueil' });
    this.router.navigate(['/accueil']);
  }

  protected logout() {
    this.state.logoutUser();
  }
}
