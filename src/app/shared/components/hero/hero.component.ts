import { Component, HostBinding, Input } from '@angular/core';

@Component({
  selector: 'hero',
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss'
})
export class HeroComponent {
  @HostBinding('class') readonly class = 'heroContainer';
  @Input() background?: string;
}
