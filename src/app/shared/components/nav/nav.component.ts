import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, inject } from '@angular/core';
import { StateService, AppState } from '../../../core/services/core/state.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NgClass } from '@angular/common';
import { SidebarService } from '../../../core/services/core/sidebar.service';

interface NavigationItem {
  label: string;
  route: string;
  active: boolean;
  icon?: string;
  sub?: NavigationItem[];
}

@Component({
    selector: 'cmp-nav',
    templateUrl: './nav.component.html',
    styleUrls: ['./nav.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [NgClass]
})
export class NavComponent implements OnInit, OnDestroy {

  public showMenu: boolean = false;
  public navList: NavigationItem[];
  private stateSubscription!: Subscription;
  protected sidebar = inject(SidebarService);

  constructor(private stateService: StateService, private router: Router) {
    this.navList = [
      {
        "label": "Accueil",
        "route": "accueil",
        "active": true,
        "icon": "home"
      },
      {
        "label": "Matchs",
        "route": "les-matchs",
        "active": false,
        "icon": "calendar_month"
      },
      {
        "label": "WCC 26",
        "route": "infos",
        "active": false,
        "icon": "public",
        "sub": [
          {
            "label": "Les équipes",
            "route": "les-equipes",
            "active": false
          },
          {
            "label": "Les stades",
            "route": "les-stades",
            "active": false
          },
          {
            "label": "Les groupes",
            "route": "les-groupes",
            "active": false
          }
        ]
      },
      {
        "label": "Jeux",
        "route": "jeux",
        "active": false,
        "icon": "sports_esports",
        "sub": [
          {
            "label": "Stars du tournoi",
            "route": "meilleur-buteur",
            "active": false
          },
          {
            "label": "Pronostics",
            "route": "pronostiques",
            "active": false
          }
        ]
      },
      {
        "label": "Classement",
        "route": "classement",
        "active": false,
        "icon": "leaderboard"
      },
      {
        "label": "FAQ",
        "route": "game-rules",
        "active": false,
        "icon": "help"
      }
    ];
  }

  ngOnInit() {
    this.stateSubscription = this.stateService.currentState.subscribe((state: AppState) => {
      const currentRoute = state.currentPage;
      this.updateActiveNavItem(currentRoute);
    });
  }


  private updateActiveNavItem(currentRoute: string) {
    this.navList.forEach(item => {
      item.active = item.route === currentRoute;

      if (item.sub) {
        item.sub.forEach(subItem => {
          subItem.active = subItem.route === currentRoute;
          if (subItem.active) {
            item.active = true;
          }
        });
      }
    });
  }

  public navTo(currentRoute: string, pageName: string) {
    this.stateService.updateState({ currentPage: currentRoute });
    this.router.navigate(['/' + currentRoute]);
    this.showMenu = false;
    window.scroll({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
  }

  ngOnDestroy() {
    if (this.stateSubscription) {
      this.stateSubscription.unsubscribe();
    }
  }
}
