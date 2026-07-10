import { signal } from '@angular/core';
import { Service } from '@angular/core';

@Service()
export class SidebarService {
  readonly isCollapsed = signal<boolean>(false);

  toggle(): void {
    this.isCollapsed.update(v => !v);
  }
}
