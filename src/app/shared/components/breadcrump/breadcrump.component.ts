import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { NgClass } from '@angular/common';

export interface breadCrump {
  label: string;
  route: string;
  active: boolean;
}

@Component({
    selector: 'app-breadcrump',
    templateUrl: './breadcrump.component.html',
    styleUrl: './breadcrump.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [NgClass]
})

export class BreadcrumpComponent {

  @Input() bcdata!: breadCrump[];
  @Output() routeEvent: EventEmitter<string> = new EventEmitter<string>();;

  routeTo(route: string): void {
    this.routeEvent.emit(route);
  }
}
