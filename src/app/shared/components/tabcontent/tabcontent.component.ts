import { Component, ContentChildren, QueryList, AfterContentInit, TemplateRef, Input, ViewChild, Directive, ChangeDetectionStrategy } from '@angular/core';

@Directive({
    selector: '[tabContent]',
    standalone: false
})

export class TabContentDirective {
  @Input() title?: string;
  constructor(public template: TemplateRef<any>) {}
}

@Component({
    selector: 'app-tabcontent',
    templateUrl: './tabcontent.component.html',
    styleUrl: './tabcontent.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class TabcontentComponent {

  @ContentChildren(TabContentDirective) tabs!: QueryList<TabContentDirective>;
  selectedTab: number = 0;

  selectTab(index: number) {
    this.selectedTab = index;
  }
}
