import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { NgClass } from '@angular/common';

export interface breadCrump {
  label: string;
  route: string;
  active: boolean;
}

@Component({
    selector: 'app-breadcrumb',
    templateUrl: './breadcrumb.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [NgClass]
})

export class BreadcrumbComponent {

  @Input() bcdata!: breadCrump[];
  @Output() routeEvent: EventEmitter<string> = new EventEmitter<string>();;

  routeTo(route: string): void {
    this.routeEvent.emit(route);
  }
}
