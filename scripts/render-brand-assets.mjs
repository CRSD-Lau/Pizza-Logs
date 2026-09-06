// Author: Neil Mitchell
// Last modified by: Neil Mitchell
// Render the established guild artwork through the same CSS blend as the site.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import sharp from "sharp";

const author = "Neil Mitchell";
const background = "#0a0c10";
const sourcePath = "assets/brand/pizza-warriors-source.png";
const source = await readFile(sourcePath);
const sourceUrl = `data:image/png;base64,${source.toString("base64")}`;
const xmp = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:pl="https://pizzalogs.local/metadata/1.0/" xmp:CreatorTool="${author}" pl:LastModifiedBy="${author}"><dc:creator><rdf:Seq><rdf:li>${author}</rdf:li></rdf:Seq></dc:creator></rdf:Description></rdf:RDF></x:xmpmeta>`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ deviceScaleFactor: 1 });
const outputs = [];
await mkdir("public/brand", { recursive: true });

async function writeImage(file, pixels, width, height, format = "png") {
  const result = sharp(pixels).withXmp(xmp);
  const data = format === "jpeg" ? await result.jpeg({ quality: 93, chromaSubsampling: "4:4:4" }).toBuffer() : await result.png().toBuffer();
  await writeFile(file, data);
  outputs.push({ file, width, height, bytes: data.length, sha256: createHash("sha256").update(data).digest("hex") });
  return data;
}

async function icon(size, scale = 1, blended = true) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;width:100vw;height:100vh;background:${blended ? background : "#000"};display:flex;align-items:center;justify-content:center"><img alt="" src="${sourceUrl}" style="display:block;width:${scale * 100}%;height:${scale * 100}%;object-fit:contain;mix-blend-mode:${blended ? "lighten" : "normal"}"></body></html>`);
  await page.locator("img").evaluate(img => img.decode());
  return page.screenshot();
}

try {
  await writeImage("public/brand/guild-crest-v1.png", await icon(512, 1, false), 512, 512);
  await writeImage("public/brand/icon-192.png", await icon(192, 0.92), 192, 192);
  await writeImage("public/brand/icon-512.png", await icon(512, 0.92), 512, 512);
  await writeImage("public/brand/icon-maskable-512.png", await icon(512, 0.76), 512, 512);
  await writeImage("public/brand/apple-touch-icon.png", await icon(180, 0.84), 180, 180);

  // ICO directory with PNG payloads: browser tabs retain the same silhouette.
  const sizes = [16, 32, 48];
  const images = [];
  for (const size of sizes) images.push(await sharp(await icon(size)).withXmp(xmp).png().toBuffer());
  const directory = Buffer.alloc(6 + 16 * sizes.length);
  directory.writeUInt16LE(1, 2); directory.writeUInt16LE(sizes.length, 4);
  let offset = directory.length;
  images.forEach((data, index) => {
    const pos = 6 + 16 * index;
    directory[pos] = sizes[index]; directory[pos + 1] = sizes[index];
    directory.writeUInt16LE(1, pos + 4); directory.writeUInt16LE(32, pos + 6);
    directory.writeUInt32LE(data.length, pos + 8); directory.writeUInt32LE(offset, pos + 12);
    offset += data.length;
  });
  const ico = Buffer.concat([directory, ...images]);
  await writeFile("public/favicon.ico", ico);
  outputs.push({ file: "public/favicon.ico", sizes, bytes: ico.length, sha256: createHash("sha256").update(ico).digest("hex") });

  const svgImage = (await icon(192)).toString("base64");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192"><title>Pizza Warriors</title><metadata>Author: ${author}; Creator: ${author}; Last modified by: ${author}</metadata><image width="192" height="192" href="data:image/png;base64,${svgImage}"/></svg>\n`;
  await writeFile("app/icon.svg", svg);
  outputs.push({ file: "app/icon.svg", width: 192, height: 192, bytes: Buffer.byteLength(svg), sha256: createHash("sha256").update(svg).digest("hex") });

  const cinzel = (await readFile("node_modules/@fontsource/cinzel/files/cinzel-latin-700-normal.woff2")).toString("base64");
  const rajdhani = (await readFile("node_modules/@fontsource/rajdhani/files/rajdhani-latin-500-normal.woff2")).toString("base64");
  await page.setViewportSize({ width: 1280, height: 640 });
  await page.setContent(`<!doctype html><html><head><meta name="author" content="${author}"><style>
    @font-face{font-family:Cinzel;src:url(data:font/woff2;base64,${cinzel})} @font-face{font-family:Rajdhani;src:url(data:font/woff2;base64,${rajdhani})}
    *{box-sizing:border-box}body{margin:0;width:1280px;height:640px;background:${background};color:#e8dfc8;overflow:hidden;position:relative;font-family:Rajdhani,sans-serif}
    .frame{position:absolute;inset:30px;border:1px solid #c8a84b30}.rule{position:absolute;left:76px;right:76px;bottom:124px;height:1px;background:linear-gradient(90deg,#c8a84b00,#c8a84b80,#c8a84b00)}
    .crest{position:absolute;left:74px;top:106px;width:350px;height:350px;mix-blend-mode:lighten}
    .copy{position:absolute;left:484px;top:147px;right:64px}.eyebrow{font-size:23px;letter-spacing:5px;color:#b3a68c;margin:0 0 24px}.name{font:700 78px/1.14 Cinzel,serif;letter-spacing:-3px;color:#f0d080;white-space:nowrap;margin:0 0 18px}.name span{color:#e8dfc8}.tag{font-size:30px;letter-spacing:4px;color:#c8a84b;margin:0}.description{font-size:25px;color:#b3a68c;margin:28px 0 0;letter-spacing:.3px}.bottom{position:absolute;left:0;right:0;bottom:64px;text-align:center;letter-spacing:4px;color:#b3a68c;font-size:20px}.bottom b{color:#c8a84b;margin:0 20px;font-weight:400}
    </style></head><body><div class="frame"></div><img class="crest" alt="Pizza Warriors crest" src="${sourceUrl}"><div class="copy"><p class="eyebrow">PIZZA WARRIORS</p><h1 class="name">Pizza <span>Logs</span></h1><p class="tag">WOTLK RAID ANALYTICS</p><p class="description">Every pull. Every player. Every raid.</p></div><div class="rule"></div><div class="bottom">RAID REPORTS <b>·</b> PLAYER HISTORY <b>·</b> GUILD RECORDS</div></body></html>`);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(img => img.decode())); });
  await writeImage("public/social-preview.jpg", await page.screenshot(), 1280, 640, "jpeg");
  await writeFile("assets/brand/manifest.json", JSON.stringify({ author, lastModifiedBy: author, source: sourcePath, sourceSha256: createHash("sha256").update(source).digest("hex"), background, method: "Browser-rendered existing artwork, CSS lighten background blend, native-size exports; no generated replacement logo.", outputs }, null, 2) + "\n");
  console.log(JSON.stringify(outputs.map(({ file, bytes }) => ({ file, bytes })), null, 2));
} finally { await browser.close(); }
