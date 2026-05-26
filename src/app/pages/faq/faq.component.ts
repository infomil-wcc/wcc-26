import { Component, inject } from '@angular/core';
import { RulesService } from '../../shared/services/content/rules.service';
import { Observable, map } from 'rxjs';

@Component({
  selector: 'app-faq',
  templateUrl: './faq.component.html',
  styleUrl: './faq.component.scss'
})
export class FaqComponent {
  private rulesService = inject(RulesService);

  protected $rules!: Observable<any>;

  ngOnInit(): void {
    this.$rules = this.rulesService.getRules().pipe(
      map((response: { data: any; }) => response.data)
    );
  }
}
