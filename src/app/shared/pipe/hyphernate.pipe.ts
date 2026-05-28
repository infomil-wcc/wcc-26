import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'hyphernate'
})
export class HyphernatePipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return value;
    return value.toLowerCase().replace(/\s+/g, '-');
  }
}
