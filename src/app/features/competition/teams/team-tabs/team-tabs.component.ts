import { Component, ContentChildren, QueryList, TemplateRef, Input, Directive, ChangeDetectionStrategy } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

@Directive({ selector: '[teamTabs]' })

export class TeamTabsDirective {
  @Input() title?: string;
  constructor(public template: TemplateRef<any>) { }
}

@Component({
  selector: 'app-team-tabs',
  templateUrl: './team-tabs.component.html',
  styleUrl: './team-tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [NgTemplateOutlet]
})
export class TeamTabsComponent {

  @ContentChildren(TeamTabsDirective) tabs!: QueryList<TeamTabsDirective>;
  selectedTab: number = 0;

  selectTab(index: number) {
    this.selectedTab = index;
  }
}
