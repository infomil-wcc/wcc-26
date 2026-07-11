import { Component, inject, ChangeDetectionStrategy, OnInit, computed } from '@angular/core';
import { RulesService } from '../../../core/services/content/rules.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';


@Component({
    selector: 'app-faq',
    templateUrl: './faq.component.html',
    styleUrl: './faq.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [LoaderComponent]
})
export class FaqComponent implements OnInit {
  private rulesService = inject(RulesService);

  rulesData = this.rulesService.rules;
  


  ngOnInit(): void {
  }
}
