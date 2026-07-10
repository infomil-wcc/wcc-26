import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GroupTableComponent } from './group-table.component';

describe('GroupTableComponent', () => {
  let component: GroupTableComponent;
  let fixture: ComponentFixture<GroupTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupTableComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(GroupTableComponent);
    component = fixture.componentInstance;
    
    // Provide a dummy input
    fixture.componentRef.setInput('group', { groupName: 'A', teams: [] });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
