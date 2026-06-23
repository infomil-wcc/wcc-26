import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamsComponent } from './teams.component';
import { BreadcrumpComponent } from '../../../shared/components/breadcrump/breadcrump.component';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';

describe('TeamsComponent', () => {
  let component: TeamsComponent;
  let fixture: ComponentFixture<TeamsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [TeamsComponent, BreadcrumpComponent, LoaderComponent]
})
    .compileComponents();
    
    fixture = TestBed.createComponent(TeamsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
