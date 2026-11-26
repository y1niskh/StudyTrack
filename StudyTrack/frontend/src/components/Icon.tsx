/* Icônes au trait (décoratives : toujours accompagnées d'un texte, donc cachées aux lecteurs d'écran). */
const PATHS = {
  home: "M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9",
  users: "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7",
  calendar: "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8.5 3v4M15.5 3v4",
  wallet: "M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5zM3 10.5h18M7 15h3",
  settings: "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
  logout: "M10 4H5v16h5M15 8l4 4-4 4M19 12H9",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5 10 17.5 19 7",
  x: "M6 6l12 12M18 6 6 18",
  alert: "M12 3 2 20.5h20zM12 10v4.5M12 17.5v.5",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 11v5.5M12 7.5v.5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2",
  left: "M15 5l-7 7 7 7",
  right: "M9 5l7 7-7 7",
  arrow: "M5 12h14M13 6l6 6-6 6",
  back: "M19 12H5M11 6l-6 6 6 6",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M20 20l-4-4",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  repeat: "M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5",
  stop: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M9 9h6v6H9z",
  undo: "M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  text: "M4 7V5h16v2M12 5v14M9 19h6",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 20a8 8 0 0 1 16 0",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ n }: { n: IconName }) {
  return <svg className="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={PATHS[n]} /></svg>;
}
