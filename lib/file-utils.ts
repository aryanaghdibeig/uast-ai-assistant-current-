export async function buildFilesContext(files: File[]) {
  if (!files || files.length === 0) return { textContext: "", images: [] };

  let textContext = "";
  const images: { name: string; base64: string }[] = [];

  for (const file of files) {
    if (file.type.startsWith("image/")) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString("base64");

      images.push({
        name: file.name,
        base64: `data:${file.type};base64,${base64}`,
      });
    } else if (file.type.startsWith("text/")) {
      const text = await file.text();
      textContext += `\n--- File: ${file.name} ---\n${text.slice(0, 4000)}\n`;
    } else {
      textContext += `\n--- File: ${file.name} ---\n[Unsupported non-image file]\n`;
    }
  }

  return { textContext, images };
}
