// Cuando la app llama a una API del SO que va a poner la app en background
// (Share.share, image picker, document picker, etc.), envolvemos la llamada con
// suspendFocusGuard() / resumeFocusGuard() para que el guardián de concentración
// no cuente eso como una interrupción.
//
// El contador permite anidar suspensiones en paralelo sin que una resume()
// destape al resto.

let suspendCount = 0;

export function suspendFocusGuard(): void {
  suspendCount++;
}

export function resumeFocusGuard(): void {
  suspendCount = Math.max(0, suspendCount - 1);
}

export function isFocusGuardSuspended(): boolean {
  return suspendCount > 0;
}
