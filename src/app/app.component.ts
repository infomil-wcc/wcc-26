import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { NgStyle } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';

import { MenuComponent } from './shared/components/menu/menu.component';
import { SidebarService } from './core/services/core/sidebar.service';
import { HpNewsComponent } from './features/homepage/components/news/news.component';
import { LoaderComponent } from './shared/components/loader/loader.component';

import { AppFacade } from './app.facade';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AppFacade],
  imports: [
    MenuComponent,
    HpNewsComponent,
    RouterOutlet,
    ReactiveFormsModule,
    LoaderComponent,
    NgStyle,
  ],
})
export class AppComponent implements OnInit {

  protected readonly facade = inject(AppFacade);
  protected readonly router = inject(Router);
  protected readonly sidebar = inject(SidebarService);

  readonly title = 'IML Foot Challenge - FIFA WORLD CUP 2026';

  ngOnInit(): void {
    this.facade.init();
  }
}
