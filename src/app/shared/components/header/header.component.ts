import { Component, Input, OnInit, inject } from '@angular/core';
import { StateService, user } from '../../services/core/state.service';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'cmp-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit{

  private state = inject(StateService);

  protected $userState!: Observable<user>;

  @Input() showLogin: boolean = false;

  ngOnInit(): void {
    this.$userState = this.state.userState;
  }

  protected showLoginModal(): void {
    this.showLogin = true;
  }

  protected loadHomepage() {
    this.state.updateState({ currentPage: 'accueil' });
    location.href = `#accueil`;
  }

  protected logout() {
    this.state.logoutUser();
  }
}
