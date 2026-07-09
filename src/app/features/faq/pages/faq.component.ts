import { Component, inject, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { RulesService } from '../../../core/services/content/rules.service';
import { Observable, map } from 'rxjs';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { AsyncPipe } from '@angular/common';
import { BreadcrumbComponent, breadCrump } from '../../../shared/components/breadcrumb/breadcrumb.component';

@Component({
    selector: 'app-faq',
    templateUrl: './faq.component.html',
    styleUrl: './faq.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [LoaderComponent, AsyncPipe, BreadcrumbComponent]
})
export class FaqComponent implements OnInit {
  private rulesService = inject(RulesService);

  protected $rules!: Observable<any>;
  
  breadCrumpData: breadCrump[] = [
    { label: 'Accueil', route: '/', active: false },
    { label: 'Informations', route: '/faq', active: false },
    { label: 'FAQ', route: '/faq', active: true }
  ];

  ngOnInit(): void {
    this.$rules = this.rulesService.getRules().pipe(
      map((response: { data: any; }) => response.data)
    );
  }
}
