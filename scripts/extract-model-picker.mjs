import fs from "fs";

const p =
  "C:/Users/PC/.cursor/projects/c-Users-PC-uast-ai-github-version-uast-ai-assistant-current/agent-transcripts/1e9001be-ea41-4817-8a88-fbe790d091ab/1e9001be-ea41-4817-8a88-fbe790d091ab.jsonl";
const lines = fs.readFileSync(p, "utf8").split(/\n/);
const t = JSON.parse(lines[758]).message.content.find((c) => c.type === "text")
  .text;

const re = /```(?:tsx?|typescript)?\n([\s\S]*?)```/g;
let m;
let n = 0;
const blocks = [];
while ((m = re.exec(t))) {
  n++;
  blocks.push({ n, len: m[1].length, head: m[1].slice(0, 80), body: m[1] });
}

console.log("blocks:", blocks.length);
for (const b of blocks) {
  console.log(b.n, b.len, b.head.replace(/\n/g, " "));
}

const picker = blocks.find((b) => b.body.includes("export function ModelPicker"));
const demo = blocks.find((b) => b.body.includes("ModelPickerDemo"));
const outDir = "C:/Users/PC/uast-ai-github-version/uast-ai-assistant-current-";

if (picker) {
  fs.writeFileSync(`${outDir}/tmp-model-picker-src.tsx`, picker.body);
  console.log("wrote picker", picker.len);
}
if (demo) {
  fs.writeFileSync(`${outDir}/tmp-model-picker-demo-src.tsx`, demo.body);
  console.log("wrote demo", demo.len);
}
