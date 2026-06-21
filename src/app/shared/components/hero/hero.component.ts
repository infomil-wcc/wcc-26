import { Component, HostBinding, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'hero',
    templateUrl: './hero.component.html',
    styleUrl: './hero.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class HeroComponent {
  @HostBinding('class') readonly class = 'heroContainer';
  @Input() background?: string;
}
