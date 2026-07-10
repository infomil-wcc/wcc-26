import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-confirmation-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="animate-fade-in-up">
      <div class="mb-8">
        <h3 class="text-3xl font-black text-[#0a1a0f] mb-2 flex items-center gap-3">
          <span class="material-symbols-outlined text-[#10b981] text-4xl">mark_email_read</span>
          Confirmation
        </h3>
        <p class="text-gray-500 font-medium text-sm md:text-base">Entrez le code reçu par email.</p>
      </div>

      <form [formGroup]="formGroup" class="flex flex-col gap-5">
        <div>
          <label class="block text-xs font-bold text-gray-400 mb-1 tracking-wider uppercase">Code à 5 chiffres</label>
          <input tabindex="1" type="text" #inputConfcode autocomplete="one-time-code" placeholder="12345"
            class="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 outline-none text-center text-2xl font-black text-[#0a1a0f] focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 transition-all tracking-[0.5em]"
            (input)="onInputChange(inputConfcode.value)" />
        </div>

        <div class="mt-4">
          <button tabindex="2" type="button"
            class="w-full bg-[#0a1a0f] hover:bg-[#10b981] text-white font-bold py-3.5 px-8 rounded-xl shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] hover:shadow-xl"
            [disabled]="disableConfirm"
            (click)="submitConfirm.emit()">
            Valider le code
          </button>
        </div>
      </form>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmationFormInterfaceComponent {
  @Input() formGroup!: FormGroup;
  @Input() disableConfirm: boolean = true;
  
  @Output() checkCode = new EventEmitter<string>();
  @Output() submitConfirm = new EventEmitter<void>();

  onInputChange(val: string): void {
    this.checkCode.emit(val);
  }
}
