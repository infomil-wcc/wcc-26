import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HpNewsComponent } from './news.component';
import { NewsService } from '../../../../core/services/content/news.service';
import { MatchesService } from '../../../../core/services/content/matches.service';
import { GlobaltimeService } from '../../../../core/services/core/global-time.service';
import { of } from 'rxjs';

describe('HpNewsComponent', () => {
  let component: HpNewsComponent;
  let fixture: ComponentFixture<HpNewsComponent>;

  const mockNewsService = {
    getHPnews: () => of([])
  };

  const mockMatchesService = {
    getAllMatches: () => of([])
  };

  const mockGlobaltimeService = {
    getMuTime: () => of({ dateTime: '2026-07-09T00:00:00' })
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HpNewsComponent],
      providers: [
        { provide: NewsService, useValue: mockNewsService },
        { provide: MatchesService, useValue: mockMatchesService },
        { provide: GlobaltimeService, useValue: mockGlobaltimeService }
      ]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(HpNewsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should correctly identify today\'s date', () => {
    // Both same day
    expect(component['isToday']('2026-07-09T15:00:00', '2026-07-09T08:00:00')).toBeTrue();
    
    // Different days
    expect(component['isToday']('2026-07-10T15:00:00', '2026-07-09T08:00:00')).toBeFalse();
  });

  it('should correctly navigate to previous and next match', () => {
    component['matchIndex'] = 1;
    component['prevMatch']();
    expect(component['matchIndex']).toBe(0);

    // Should not go below 0
    component['prevMatch']();
    expect(component['matchIndex']).toBe(0);

    component['nextMatch'](3);
    expect(component['matchIndex']).toBe(1);

    component['nextMatch'](3);
    expect(component['matchIndex']).toBe(2);

    // Should not go above total - 1
    component['nextMatch'](3);
    expect(component['matchIndex']).toBe(2);
  });
});

