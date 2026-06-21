import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'app-articles',
    templateUrl: './articles.component.html',
    styleUrl: './articles.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ArticlesComponent {

}
