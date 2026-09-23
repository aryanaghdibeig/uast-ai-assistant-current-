import fs from "fs";

const srcPath =
  "C:/Users/PC/uast-ai-github-version/uast-ai-assistant-current-/tmp-model-picker-src.tsx";
const src = fs.readFileSync(srcPath, "utf8");
const lines = src.split(/\n/);

let body = lines.slice(1, 1076).join("\n");

body = body.replace(
  /import \{ clsx, type ClassValue \} from "clsx";\r?\n/,
  "",
);
body = body.replace(
  /import \{\r?\n  Popover as PopoverPrimitive,\r?\n  Tooltip as TooltipPrimitive,\r?\n\} from "radix-ui";\r?\n/,
  'import * as PopoverPrimitive from "@radix-ui/react-popover";\nimport * as TooltipPrimitive from "@radix-ui/react-tooltip";\n',
);
body = body.replace(/import \{ twMerge \} from "tailwind-merge";\r?\n/, "");
body = body.replace(
  /function cn\(\.\.\.inputs: ClassValue\[\]\) \{\r?\n  return twMerge\(clsx\(inputs\)\);\r?\n\}\r?\n\r?\n/,
  'import { cn } from "@/lib/utils";\n\n',
);

const pickerOut =
  "C:/Users/PC/uast-ai-github-version/uast-ai-assistant-current-/components/ui/model-picker.tsx";
fs.writeFileSync(pickerOut, body);

let demo = lines.slice(1078).join("\n");
demo = demo.replace(/^demo\.tsx\r?\n/, "");
const demoOut =
  "C:/Users/PC/uast-ai-github-version/uast-ai-assistant-current-/components/ui/model-picker-demo.tsx";
fs.writeFileSync(demoOut, demo);

console.log("Wrote", pickerOut, body.length);
console.log("Wrote", demoOut, demo.length);
