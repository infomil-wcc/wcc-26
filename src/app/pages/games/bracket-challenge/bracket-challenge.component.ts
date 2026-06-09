import { Component, inject, OnInit } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';

@Component({
  selector: 'app-bracket-challenge',
  templateUrl: './bracket-challenge.component.html',
  styleUrl: './bracket-challenge.component.scss'
})
export class BracketChallengeComponent implements OnInit {
  private cookieService = inject(CookieService);
  
  protected activeWizardStep: 'groups' | 'knockout' = 'groups';
  protected advancedQualifiers: any[] = [];
  protected isLoggedIn: boolean = false;

  ngOnInit(): void {
    const currentUser = this.cookieService.get('currentUser');
    this.isLoggedIn = !!currentUser;
  }

  handleGroupPredictionsFinished(qualifiedTeams: any[]): void {
    this.advancedQualifiers = qualifiedTeams;
    this.activeWizardStep = 'knockout';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  backToGroups(): void {
    this.activeWizardStep = 'groups';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
