import { Component, inject, ChangeDetectionStrategy, OnInit, computed } from '@angular/core';
import { RulesService } from '../../../core/services/content/rules.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { BreadcrumbComponent, breadCrump } from '../../../shared/components/breadcrumb/breadcrumb.component';

@Component({
    selector: 'app-faq',
    templateUrl: './faq.component.html',
    styleUrl: './faq.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [LoaderComponent, BreadcrumbComponent]
})
export class FaqComponent implements OnInit {
  private rulesService = inject(RulesService);

  rulesData = this.rulesService.rules;
  
  breadCrumpData: breadCrump[] = [
    { label: 'Accueil', route: '/', active: false },
    { label: 'Informations', route: '/faq', active: false },
    { label: 'FAQ', route: '/faq', active: true }
  ];

  ngOnInit(): void {
  }
}
