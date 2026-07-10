import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationFormComponent } from './confirmation-form.component';
import { AuthService } from '../../../../core/services/core/auth.service';
import { MailService } from '../../../../core/services/core/mail.service';

describe('ConfirmationFormComponent', () => {
  let component: ConfirmationFormComponent;
  let fixture: ComponentFixture<ConfirmationFormComponent>;

  beforeEach(async () => {
    const mockAuthService = {
      confirmRegister: vi.fn()
    };
    
    const mockMailService = {
      sendConfirmationEmail: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [ConfirmationFormComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: MailService, useValue: mockMailService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmationFormComponent);
    component = fixture.componentInstance;
    
    // Set inputs
    fixture.componentRef.setInput('email', 'test@test.com');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
