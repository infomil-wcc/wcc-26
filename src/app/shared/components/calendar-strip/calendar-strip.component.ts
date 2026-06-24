import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';

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

  selectDate(date: string | null): void {
    this.dateChange.emit(date);
  }

  scrollStrip(element: HTMLElement, offset: number): void {
    element.scrollBy({ left: offset, behavior: 'smooth' });
  }
}
