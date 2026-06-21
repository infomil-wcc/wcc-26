import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'hyphernate',
    standalone: false
})
export class HyphernatePipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return value;
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }
}
