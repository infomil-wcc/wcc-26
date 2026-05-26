import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface breadCrump {
  label: string;
  route: string;
  active: boolean;
}

@Component({
  selector: 'app-breadcrump',
  templateUrl: './breadcrump.component.html',
  styleUrl: './breadcrump.component.scss'
})

export class BreadcrumpComponent {

  @Input() bcdata!: breadCrump[];
  @Output() routeEvent: EventEmitter<string> = new EventEmitter<string>();;

  routeTo(route: string): void {
    this.routeEvent.emit(route);
  }
}
