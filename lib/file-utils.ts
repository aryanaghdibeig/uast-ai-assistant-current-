export async function buildFilesContext(files: File[]) {
  let textContext = "";
  const images: any[] = [];

  for (const file of files) {
    if (file.type.startsWith("image/")) {
      // تبدیل تصویر به Base64
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      
      // افزودن به آرایه تصاویر با ساختار استاندارد
      images.push({
        type: "image_url",
        image_url: {
          url: `data:${file.type};base64,${base64}`,
        },
      });
    } else {
      // اگر فایل متنی است، محتوای آن را بخوان
      const text = await file.text();
      textContext += `\n[File: ${file.name}]\n${text.substring(0, 4000)}\n`;
    }
  }

  return { textContext, images };
}
