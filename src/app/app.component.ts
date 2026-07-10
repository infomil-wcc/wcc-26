import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';

import { LayoutComponent } from './shared/components/layout/layout.component';
import { MenuComponent } from './shared/components/menu/menu.component';
import { HeroComponent } from './shared/components/hero/hero.component';
import { HpNewsComponent } from './features/homepage/components/news/news.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { DialogComponent } from './shared/components/dialog/dialog.component';
import { LoaderComponent } from './shared/components/loader/loader.component';

import { AppFacade } from './app.facade';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AppFacade],
  imports: [
    LayoutComponent,
    MenuComponent,
    HeroComponent,
    HpNewsComponent,
    RouterOutlet,
    FooterComponent,
    DialogComponent,
    ReactiveFormsModule,
    LoaderComponent,
  ],
})
export class AppComponent implements OnInit {

  protected readonly facade = inject(AppFacade);
  protected readonly router = inject(Router);

  readonly title = 'IML Foot Challenge - FIFA WORLD CUP 2026';

  ngOnInit(): void {
    this.facade.init();
  }
}
