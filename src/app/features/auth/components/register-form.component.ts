import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-register-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="animate-fade-in-up">
      <div class="mb-8">
        <h3 class="text-3xl font-black text-[#0a1a0f] mb-2 flex items-center gap-3">
          <span class="material-symbols-outlined text-[#10b981] text-4xl">person_add</span>
          Créer un compte
        </h3>
        <p class="text-gray-500 font-medium text-sm md:text-base">Remplissez les informations ci-dessous</p>
      </div>

      <form [formGroup]="formGroup" class="flex flex-col gap-5">
        <!-- Email Input -->
        <div>
          <label class="block text-xs font-bold text-gray-400 mb-1 tracking-wider uppercase">Email</label>
          <div class="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#10b981] focus-within:ring-2 focus-within:ring-[#10b981]/20 transition-all bg-gray-50">
            <input tabindex="1" type="text" #emailReg autocomplete="username" placeholder="prenom.nom"
              formControlName="email" (input)="onEmailInput.emit('register')"
              class="w-full bg-transparent p-3.5 outline-none text-[#0a1a0f] font-medium" />
            <div class="bg-gray-100 border-l border-gray-200 p-3.5 text-gray-500 font-semibold select-none">
              &#64;infomil.mu
            </div>
          </div>
          @if (formGroup.get('email')?.invalid && formGroup.get('email')?.touched) {
            <span class="text-red-500 text-xs font-semibold mt-1 block">Ce champ est obligatoire</span>
          }
        </div>

        <!-- Trigramme Input -->
        <div>
          <label class="block text-xs font-bold text-gray-400 mb-1 tracking-wider uppercase">Trigramme</label>
          <input tabindex="2" type="text" #trigrammeReg placeholder="iml-xxx" formControlName="trigramme"
            class="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 outline-none text-[#0a1a0f] font-medium focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 transition-all" />
          @if (formGroup.get('trigramme')?.invalid && formGroup.get('trigramme')?.touched) {
            <span class="text-red-500 text-xs font-semibold mt-1 block">Format attendu: iml-xxx ou XXX</span>
          }
        </div>

        <!-- Password Input -->
        <div>
          <label class="block text-xs font-bold text-gray-400 mb-1 tracking-wider uppercase">Mot de passe</label>
          <div class="relative flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#10b981] focus-within:ring-2 focus-within:ring-[#10b981]/20 transition-all bg-gray-50">
            <input tabindex="3" type="{{ passType }}" #passReg placeholder="••••••••" autocomplete="new-password"
              formControlName="pass"
              (keydown.enter)="submitRegister.emit({email: emailReg.value + '@infomil.mu', trigramme: trigrammeReg.value, pass: passReg.value})"
              class="w-full bg-transparent p-3.5 outline-none text-[#0a1a0f] font-medium pr-12" />
            <button type="button" class="absolute right-3 text-gray-400 hover:text-[#10b981] transition-all duration-300 transform hover:scale-110 active:scale-90"
              (click)="toggleType.emit()">
              <span class="material-symbols-outlined">{{ visibility }}</span>
            </button>
          </div>
        </div>

        <div class="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span class="text-sm text-gray-500 font-medium">
            Déjà inscrit ?
            <button tabindex="5" type="button" class="font-bold text-[#0a1a0f] hover:text-[#10b981] transition-all duration-300 inline-block transform hover:scale-[1.03] active:scale-[0.97]"
              (click)="toggleRegister.emit()">Me connecter</button>
          </span>
          <button tabindex="4" type="button"
            class="w-full sm:w-auto bg-[#0a1a0f] hover:bg-[#10b981] text-white font-bold py-3.5 px-8 rounded-xl shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] hover:shadow-xl"
            (click)="submitRegister.emit({email: emailReg.value + '@infomil.mu', trigramme: trigrammeReg.value, pass: passReg.value})"
            [disabled]="!formGroup.valid">
            S'inscrire
          </button>
        </div>
      </form>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterFormInterfaceComponent {
  @Input() formGroup!: FormGroup;
  @Input() passType: string = 'password';
  @Input() visibility: string = 'visibility_off';

  @Output() onEmailInput = new EventEmitter<'login' | 'register' | 'forgot'>();
  @Output() toggleRegister = new EventEmitter<void>();
  @Output() toggleType = new EventEmitter<void>();
  @Output() submitRegister = new EventEmitter<{ email: string; trigramme: string; pass: string }>();
}
