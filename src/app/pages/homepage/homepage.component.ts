import { Component, inject } from '@angular/core';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { CookieService } from 'ngx-cookie-service';

@Component({
  selector: 'app-homepage',
  templateUrl: './homepage.component.html',
  styleUrl: './homepage.component.scss'
})
export class HomepageComponent {
  private cookieService = inject<CookieService>(CookieService);
  protected headerInstance!: HeaderComponent;
  protected showLogin: boolean = false;
  protected isLoggedIn: boolean = false;

  ngOnInit(): void {
    
    let currentUser = this.cookieService.get('currentUser');
    (currentUser) ? this.isLoggedIn = true : this.isLoggedIn = false;
  }

}
