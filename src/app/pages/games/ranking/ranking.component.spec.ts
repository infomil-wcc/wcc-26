import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RankingComponent } from './ranking.component';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';

describe('RankingComponent', () => {
  let component: RankingComponent;
  let fixture: ComponentFixture<RankingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RankingComponent, LoaderComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RankingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
