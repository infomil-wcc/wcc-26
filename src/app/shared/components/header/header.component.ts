import { Component, Input, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { StateService, user } from '../../services/core/state.service';
import { Observable, Subscription } from 'rxjs';
import { NavComponent } from '../nav/nav.component';
import { ModalComponent } from '../modal/modal.component';
import { LoginComponent } from '../login/login.component';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';

@Component({
    selector: 'cmp-header',
    templateUrl: './header.component.html',
    styleUrl: './header.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [NavComponent, ModalComponent, LoginComponent, AsyncPipe]
})
export class HeaderComponent implements OnInit{

  private state = inject(StateService);
  private router = inject(Router);

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
