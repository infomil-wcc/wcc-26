import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { SidebarService } from '../../../core/services/core/sidebar.service';

@Component({
    selector: 'layout',
    templateUrl: './layout.component.html',
    styleUrl: './layout.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager
})
export class LayoutComponent {
  protected sidebar = inject(SidebarService);
}
