/**
 * Build the organizational knowledge index from the two UAST note PDFs.
 *
 *   npm run knowledge:index
 */

import {
  getOrgKnowledgeIndexPath,
  getOrgKnowledgeSourceDir,
  rebuildOrgKnowledgeIndex,
} from "@/lib/assistant/orgKnowledge";

async function main() {
  console.log("Source dir:", getOrgKnowledgeSourceDir());
  console.log("Indexing org knowledge PDFs...");

  const index = await rebuildOrgKnowledgeIndex();

  console.log("Built at:", index.builtAt);
  console.log("Embedding model:", index.model);
  console.log("Chunks:", index.chunks.length);
  for (const doc of index.documents) {
    console.log(
      `- ${doc.title}: ${doc.chunkCount} chunks, ${doc.characterCount} chars`,
    );
  }
  console.log("Index file:", getOrgKnowledgeIndexPath());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
