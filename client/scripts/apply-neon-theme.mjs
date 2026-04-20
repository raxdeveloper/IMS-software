import fs from "node:fs";
import path from "node:path";

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, files);
    else if (/\.(tsx|ts)$/.test(name)) files.push(p);
  }
  return files;
}

const root = path.join(process.cwd(), "src");
const reps = [
  [/text-teal-600 dark:text-teal-400/g, "text-accent"],
  [/text-teal-700 dark:text-teal-400/g, "text-accent"],
  [/text-teal-700 dark:text-teal-300/g, "text-accent"],
  [
    /border-b-2 border-teal-600 text-teal-700 dark:text-teal-400/g,
    "border-b-2 border-accent text-accent",
  ],
  [/border-teal-600 text-teal-700 dark:text-teal-400/g, "border-accent text-accent"],
  [/border-teal-600 text-teal-700/g, "border-accent text-accent/90"],
  [/bg-teal-600 hover:bg-teal-700 text-white/g, "bg-accent hover:brightness-95 text-accent-foreground"],
  [/bg-teal-600 text-white/g, "bg-accent text-accent-foreground"],
  [/hover:bg-teal-700/g, "hover:brightness-95"],
  [/hover:border-teal-500\/50/g, "hover:border-accent/40"],
  [
    /bg-teal-50 dark:bg-teal-950\/30 border border-teal-200 dark:border-teal-900/g,
    "bg-accent/5 border border-accent/20",
  ],
  [/border-teal-200 dark:border-teal-800/g, "border-accent/25"],
  [
    /bg-teal-100 dark:bg-teal-900\/40 text-teal-800/g,
    "bg-accent/15 text-zinc-900 dark:text-accent",
  ],
  [/bg-teal-50 dark:bg-teal-950\/40/g, "bg-accent/10"],
  [/dark:border-teal-950\/40/g, "dark:border-accent/25"],
  [/text-teal-800/g, "text-zinc-900 dark:text-accent"],
  [/text-teal-700/g, "text-accent/90"],
  [/text-teal-600/g, "text-accent"],
  [/border-teal-600/g, "border-accent"],
  [/bg-teal-600/g, "bg-accent text-accent-foreground"],
];

for (const file of walk(root)) {
  let c = fs.readFileSync(file, "utf8");
  const orig = c;
  for (const [re, to] of reps) c = c.replace(re, to);
  if (c !== orig) fs.writeFileSync(file, c);
}

console.log("Theme replace done.");
