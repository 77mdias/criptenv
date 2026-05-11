/**
 * Suppresses THREE.Clock deprecation warning from @react-three/fiber.
 *
 * THREE.js r183+ deprecated THREE.Clock in favor of THREE.Timer, but
 * @react-three/fiber 9.6.1 still uses it internally. This is a library
 * compatibility issue, not a bug in our code.
 *
 * TODO: Remove this once @react-three/fiber updates to use THREE.Timer.
 * Tracking: https://github.com/pmndrs/react-three-fiber/issues
 */

const ORIGINAL_WARN = console.warn

const SUPPRESSED_PATTERNS = [
  "THREE.THREE.Clock: This module has been deprecated",
  "Please use THREE.Timer instead",
]

export function suppressThreeWarnings() {
  console.warn = function (...args: unknown[]) {
    const message = args[0]?.toString() ?? ""
    if (SUPPRESSED_PATTERNS.some((pattern) => message.includes(pattern))) {
      return
    }
    ORIGINAL_WARN.apply(console, args)
  }
}

export function restoreThreeWarnings() {
  console.warn = ORIGINAL_WARN
}
