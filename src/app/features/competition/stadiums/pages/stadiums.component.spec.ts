import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StadiumsComponent } from './stadiums.component';
import { BreadcrumbComponent } from '../../../../shared/components/breadcrumb/breadcrumb.component';
import { LoaderComponent } from '../../../../shared/components/loader/loader.component';

describe('StadiumsComponent', () => {
  let component: StadiumsComponent;
  let fixture: ComponentFixture<StadiumsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [StadiumsComponent, BreadcrumbComponent, LoaderComponent]
})
    .compileComponents();
    
    fixture = TestBed.createComponent(StadiumsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
