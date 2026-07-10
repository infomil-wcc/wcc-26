import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-error-view',
  standalone: true,
  template: `
    <div class="animate-fade-in-up">
      <div class="mb-8">
        <h3 class="text-3xl font-black text-[#0a1a0f] mb-2 flex items-center gap-3">
          <span class="material-symbols-outlined text-red-500 text-4xl">error</span>
          Oups...
        </h3>
        <div class="bg-red-50 border-l-4 border-red-500 p-4 mt-4 rounded-r-lg">
          <p class="text-red-700 font-medium">{{ issueMsg }}</p>
        </div>
      </div>

      <div class="flex flex-col gap-4">
        <button type="button"
          class="w-full bg-white border border-gray-200 hover:border-[#10b981] text-gray-600 hover:text-[#10b981] font-bold py-3.5 px-8 rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] hover:shadow-md"
          (click)="retryRegister.emit()">
          Réessayer de créer un compte
        </button>
        <button type="button"
          class="w-full bg-[#0a1a0f] hover:bg-[#10b981] text-white font-bold py-3.5 px-8 rounded-xl shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] hover:shadow-xl"
          (click)="retryLogin.emit()">
          Se connecter avec un compte existant
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ErrorViewComponent {
  @Input() issueMsg: string = '';

  @Output() retryRegister = new EventEmitter<void>();
  @Output() retryLogin = new EventEmitter<void>();
}
