import { Component, HostBinding, Input, ChangeDetectionStrategy } from '@angular/core';
import { NgStyle } from '@angular/common';

@Component({
    selector: 'hero',
    templateUrl: './hero.component.html',
    styleUrl: './hero.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [NgStyle]
})
export class HeroComponent {
  @HostBinding('class') readonly class = 'heroContainer';
  @Input() background?: string;
}
