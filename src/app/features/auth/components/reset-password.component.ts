import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-reset-password-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="animate-fade-in-up">
      <div class="mb-8">
        <h3 class="text-3xl font-black text-[#0a1a0f] mb-2 flex items-center gap-3">
          <span class="material-symbols-outlined text-[#10b981] text-4xl">key</span>
          Nouveau mot de passe
        </h3>
        <p class="text-gray-500 font-medium text-sm md:text-base">Choisissez un nouveau mot de passe sécurisé.</p>
      </div>

      <form [formGroup]="formGroup" class="flex flex-col gap-5">
        <div>
          <label class="block text-xs font-bold text-gray-400 mb-1 tracking-wider uppercase">Mot de passe</label>
          <div class="relative flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#10b981] focus-within:ring-2 focus-within:ring-[#10b981]/20 transition-all bg-gray-50">
            <input tabindex="1" type="{{ passType }}" #passReset placeholder="••••••••" autocomplete="new-password"
              formControlName="pass" (keydown.enter)="submitReset.emit(passReset.value)"
              class="w-full bg-transparent p-3.5 outline-none text-[#0a1a0f] font-medium pr-12" />
            <button type="button" class="absolute right-3 text-gray-400 hover:text-[#10b981] transition-all duration-300 transform hover:scale-110 active:scale-90"
              (click)="toggleType.emit()">
              <span class="material-symbols-outlined">{{ visibility }}</span>
            </button>
          </div>
        </div>

        <div class="mt-4">
          <button tabindex="2" type="button"
            class="w-full bg-[#0a1a0f] hover:bg-[#10b981] text-white font-bold py-3.5 px-8 rounded-xl shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] hover:shadow-xl"
            (click)="submitReset.emit(passReset.value)" [disabled]="!formGroup.valid">
            Valider le mot de passe
          </button>
        </div>
      </form>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResetPasswordComponent {
  @Input() formGroup!: FormGroup;
  @Input() passType: string = 'password';
  @Input() visibility: string = 'visibility_off';

  @Output() toggleType = new EventEmitter<void>();
  @Output() submitReset = new EventEmitter<string>();
}
