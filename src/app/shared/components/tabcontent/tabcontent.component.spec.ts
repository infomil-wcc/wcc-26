import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TabcontentComponent } from './tabcontent.component';

describe('TabcontentComponent', () => {
  let component: TabcontentComponent;
  let fixture: ComponentFixture<TabcontentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TabcontentComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TabcontentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
