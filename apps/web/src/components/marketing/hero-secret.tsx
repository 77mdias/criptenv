import type { ReactNode } from "react";
import "./hero-secret.css";
import "./hero-secret.generated.css";

// How many pieces orbit the shard. hero-secret.generated.css has one rule per piece
// (WEB_PIECES in ux-ui/motion/hero-secret/scripts/build_assets.py): keep them equal.
export const HERO_PIECES = 90;

const depths = ["hero-far", "hero-mid", "hero-near"];

// Both are decoration; the `hero-secret` class on the section around them sets the loop,
// and the theme only swaps their images.

/** The hero's background: light rays and drifting out-of-focus flakes. */
export function HeroBackdrop() {
  return (
    <div className="hero-backdrop" aria-hidden="true">
      <Sway>
        <div className="hero-plate" />
      </Sway>
      <div className="hero-fg">
        {depths.map((depth) => (
          <Sway key={depth} className={depth}>
            <div className="hero-drift" />
            <div className="hero-drift" />
          </Sway>
        ))}
      </div>
    </div>
  );
}

/** The shard of light with its splinters in orbit. Fills its positioned parent. */
export function HeroShard() {
  return (
    <div className="hero-shard" aria-hidden="true">
      <Sway className="hero-shard-cam">
        <div className="hero-shard-origin">
          <div className="hero-box hero-glow" />
          <div className="hero-box hero-crystal">
            <div className="hero-box hero-seam" />
          </div>
          {Array.from({ length: HERO_PIECES }, (_, i) => (
            <i key={i} />
          ))}
        </div>
      </Sway>
    </div>
  );
}

/** The camera's drift: one element per axis (see hero-secret.css). */
function Sway({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`hero-cam ${className}`}>
      <div className="hero-cam-y">{children}</div>
    </div>
  );
}
