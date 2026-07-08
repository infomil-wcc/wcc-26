import { Component, ContentChildren, QueryList, AfterContentInit, TemplateRef, Input, ViewChild, Directive, ChangeDetectionStrategy } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

@Directive({ selector: '[tabContent]' })

export class TabContentDirective {
  @Input() title?: string;
  constructor(public template: TemplateRef<any>) {}
}

@Component({
    selector: 'app-tab-content',
    templateUrl: './tab-content.component.html',
    styleUrl: './tab-content.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [NgTemplateOutlet]
})
export class TabContentComponent {

  @ContentChildren(TabContentDirective) tabs!: QueryList<TabContentDirective>;
  selectedTab: number = 0;

  selectTab(index: number) {
    this.selectedTab = index;
  }
}
