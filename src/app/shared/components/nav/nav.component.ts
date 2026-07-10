import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { StateService, AppState } from '../../../core/services/core/state.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NgClass } from '@angular/common';
import { SidebarService } from '../../../core/services/core/sidebar.service';
import { ThemeService, AppTheme } from '../../../core/services/theme.service';

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
  public themeService = inject(ThemeService);
  private platformId = inject(PLATFORM_ID);

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
            "active": false,
            "icon": "groups"
          },
          {
            "label": "Les stades",
            "route": "les-stades",
            "active": false,
            "icon": "stadium"
          },
          {
            "label": "Les groupes",
            "route": "les-groupes",
            "active": false,
            "icon": "grid_view"
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
            "active": false,
            "icon": "star"
          },
          {
            "label": "Pronostics",
            "route": "pronostics",
            "active": false,
            "icon": "query_stats"
          }
        ]
      },
      {
        "label": "Leaderboard",
        "route": "leaderboard",
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
    if (isPlatformBrowser(this.platformId)) {
      window.scroll({ top: 0, left: 0, behavior: 'smooth' });
    }
  }

  ngOnDestroy() {
    if (this.stateSubscription) {
      this.stateSubscription.unsubscribe();
    }
  }

  public toggleTheme() {
    const current = this.themeService.getTheme();
    const next = current === 'default' ? 'fifa' : 'default';
    this.themeService.setTheme(next);
  }
}
