/** Leave the app for another site (a payment page). One place, so tests can watch it. */
export function leaveTo(url: string): void {
  window.location.assign(url)
}
