import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';

@Component({
  selector: 'app-calendar-strip',
  templateUrl: './calendar-strip.component.html',
  styleUrl: './calendar-strip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DatePipe]
})
export class CalendarStripComponent {
  @Input() matchDates: string[] | null = [];
  @Input() filterDate: string | null = null;
  @Output() dateChange = new EventEmitter<string | null>();
  @Output() collapseChange = new EventEmitter<boolean>();

  isCollapsed: boolean = false;

  selectDate(date: string | null): void {
    this.dateChange.emit(date);
  }

  scrollStrip(element: HTMLElement, offset: number): void {
    element.scrollBy({ left: offset, behavior: 'smooth' });
  }

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    this.collapseChange.emit(this.isCollapsed);
  }
}
