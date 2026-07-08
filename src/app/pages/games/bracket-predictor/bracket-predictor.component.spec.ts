import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BracketPredictorComponent } from './bracket-predictor.component';
import { TeamsService } from '../../../core/services/content/teams.service';
import { of } from 'rxjs';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

describe('BracketPredictorComponent', () => {
  let component: BracketPredictorComponent;
  let fixture: ComponentFixture<BracketPredictorComponent>;
  let mockTeamsService: any;

  beforeEach(async () => {
    mockTeamsService = {
      getGroups: jasmine.createSpy('getGroups').and.returnValue(of([])),
      getFlags: jasmine.createSpy('getFlags').and.returnValue(of([]))
    };

    await TestBed.configureTestingModule({
    imports: [DragDropModule, HttpClientTestingModule, BracketPredictorComponent],
    providers: [
        { provide: TeamsService, useValue: mockTeamsService }
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
    .compileComponents();

    fixture = TestBed.createComponent(BracketPredictorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load groups on init', () => {
    expect(mockTeamsService.getGroups).toHaveBeenCalled();
    expect(mockTeamsService.getFlags).toHaveBeenCalled();
  });
});
