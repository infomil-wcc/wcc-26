import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-forgot-password-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="animate-fade-in-up">
      <div class="mb-8">
        <h3 class="text-3xl font-black text-[#0a1a0f] mb-2 flex items-center gap-3">
          <span class="material-symbols-outlined text-[#10b981] text-4xl">lock_reset</span>
          Mot de passe oublié
        </h3>
        <p class="text-gray-500 font-medium text-sm md:text-base">Recevez un lien de réinitialisation par email.</p>
      </div>

      <form [formGroup]="formGroup" class="flex flex-col gap-5">
        <div>
          <label class="block text-xs font-bold text-gray-400 mb-1 tracking-wider uppercase">Email</label>
          <div class="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#10b981] focus-within:ring-2 focus-within:ring-[#10b981]/20 transition-all bg-gray-50">
            <input tabindex="1" type="text" #emailForgot autocomplete="username" placeholder="prenom.nom"
              formControlName="email" (input)="onEmailInput.emit('forgot')"
              class="w-full bg-transparent p-3.5 outline-none text-[#0a1a0f] font-medium" />
            <div class="bg-gray-100 border-l border-gray-200 p-3.5 text-gray-500 font-semibold select-none">
              &#64;infomil.mu
            </div>
          </div>
        </div>

        @if (forgotPassMsg) {
          <div class="bg-green-50 text-green-700 p-3 rounded-lg text-sm font-medium border border-green-100">
            {{ forgotPassMsg }}
          </div>
        }

        <div class="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button tabindex="3" type="button"
            class="text-sm font-bold text-gray-500 hover:text-[#10b981] transition-all duration-300 inline-block transform hover:scale-[1.03] active:scale-[0.97]"
            (click)="toggleForgotPassword.emit()">Retour</button>
          <button tabindex="2" type="button"
            class="w-full sm:w-auto bg-[#0a1a0f] hover:bg-[#10b981] text-white font-bold py-3.5 px-8 rounded-xl shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] hover:shadow-xl"
            (click)="submitForgot.emit(emailForgot.value + '@infomil.mu')" [disabled]="!formGroup.valid">
            Envoyer le lien
          </button>
        </div>
      </form>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ForgotPasswordComponent {
  @Input() formGroup!: FormGroup;
  @Input() forgotPassMsg: string = '';

  @Output() onEmailInput = new EventEmitter<'login' | 'register' | 'forgot'>();
  @Output() toggleForgotPassword = new EventEmitter<void>();
  @Output() submitForgot = new EventEmitter<string>();
}
