import { PortalContainer, Toaster } from "@keybr/widget";
import { type ReactNode } from "react";
import { NavMenu } from "./NavMenu.tsx";
import * as styles from "./Template.module.less";

// Personal fork: always the ad-free layout, no dev environment badge.
export function Template({
  path,
  children,
}: {
  readonly path: string;
  readonly children: ReactNode;
}) {
  return (
    <div className={styles.bodyAlt}>
      <main className={styles.mainAlt}>
        {children}
        <PortalContainer />
        <Toaster />
      </main>
      <nav className={styles.navAlt}>
        <NavMenu currentPath={path} />
      </nav>
    </div>
  );
}
