import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamTabsComponent } from './team-tabs.component';

describe('TeamTabsComponent', () => {
  let component: TeamTabsComponent;
  let fixture: ComponentFixture<TeamTabsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [TeamTabsComponent]
})
    .compileComponents();
    
    fixture = TestBed.createComponent(TeamTabsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
