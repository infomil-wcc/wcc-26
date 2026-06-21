import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StadiumsComponent } from './stadiums.component';
import { BreadcrumpComponent } from '../../../shared/components/breadcrump/breadcrump.component';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';

describe('StadiumsComponent', () => {
  let component: StadiumsComponent;
  let fixture: ComponentFixture<StadiumsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StadiumsComponent, BreadcrumpComponent, LoaderComponent]
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
