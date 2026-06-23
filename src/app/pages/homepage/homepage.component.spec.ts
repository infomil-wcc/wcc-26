import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomepageComponent } from './homepage.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { LoginComponent } from '../../shared/components/login/login.component';
import { LoaderComponent } from '../../shared/components/loader/loader.component';
import { ReactiveFormsModule } from '@angular/forms';

describe('HomepageComponent', () => {
  let component: HomepageComponent;
  let fixture: ComponentFixture<HomepageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [ReactiveFormsModule, HomepageComponent, ModalComponent, LoginComponent, LoaderComponent]
})
    .compileComponents();
    
    fixture = TestBed.createComponent(HomepageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
