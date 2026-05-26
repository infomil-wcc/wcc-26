import { Component, EventEmitter, Input, OnChanges, Output, SimpleChange } from '@angular/core';

@Component({
  selector: 'loader',
  templateUrl: './loader.component.html',
  styleUrl: './loader.component.scss'
})
export class LoaderComponent implements OnChanges {

  @Input() showCalcs: boolean = false;
  @Input() showLoader: boolean = false;
  @Output() showLoaderChange = new EventEmitter<boolean>();

  chargingText: string = 'Chargement en cours...';

  ngOnInit(): void {
    if(this.showCalcs){
      this.timeoutText('Calculs des rangs en cours...');
    }
  }

  ngOnChanges(change: any) {
    if(change.showLoader['currentValue']) {
      document.querySelector('body')?.classList.add('fixed');
    } else {
      document.querySelector('body')?.classList.remove('fixed');
    }
  }

  timeoutText(txt: string) {
    setTimeout(() => {
      this.chargingText = txt;
    }, 4000);
  }

  ngOnDestroy():void {
    document.querySelector('body')?.classList.remove('fixed');
  }
}
