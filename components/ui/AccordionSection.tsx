"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn, formatInteger } from "@/lib/utils";

interface Props {
  id?: string;
  title:       string;
  sub?:        string;
  children:    React.ReactNode;
  defaultOpen?: boolean;
  count?:      number | string;
}

export function AccordionSection({
  id,
  title,
  sub,
  children,
  defaultOpen = true,
  count,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  const headingId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!id) return;
    const reveal = () => {
      setOpen(true);
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ block: "start" });
        buttonRef.current?.focus({ preventScroll: true });
      });
    };
    const onHashChange = () => {
      if (window.location.hash === `#${id}`) reveal();
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (anchor?.getAttribute("href") === `#${id}`) reveal();
    };
    onHashChange();
    window.addEventListener("hashchange", onHashChange);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      document.removeEventListener("click", onClick);
    };
  }, [id]);

  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-36">
      <h2>
      <button
        ref={buttonRef}
        id={headingId}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={contentId}
        className="group flex min-h-11 w-full items-center justify-between gap-4 rounded-sm py-2 text-left"
      >
        <div className="text-left">
          <div className="flex items-center gap-2">
            <span className="heading-cinzel text-sm font-bold text-gold uppercase tracking-widest group-hover:text-gold-light transition-colors">
              {title}
            </span>
            {count !== undefined && (
              <span className="text-sm text-text-dim tabular-nums">({typeof count === "number" ? formatInteger(count) : count})</span>
            )}
          </div>
          {sub && (
            <p className="mt-1 text-sm text-text-dim">{sub}</p>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 text-text-dim transition-transform duration-200 group-hover:text-gold",
            open ? "rotate-0" : "-rotate-90"
          )}
        >
          ▾
        </span>
      </button>
      </h2>

      {/* Grid-rows collapse trick — animates height without JS measurement */}
      <div
        id={contentId}
        inert={!open}
        aria-hidden={!open}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-in-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        {/* Match data-panel's mobile gutter bleed so the height-animation clip does not trim either edge. */}
        <div className={cn("-mx-4 overflow-hidden px-4 sm:mx-0 sm:px-0", open && "pt-3")}>
          {children}
        </div>
      </div>
    </section>
  );
}
