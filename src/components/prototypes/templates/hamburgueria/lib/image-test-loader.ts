// Node test helper: Next's static-image loader is not available in tsx tests.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const assetRequire = createRequire(`${process.cwd()}/package.json`);
assetRequire.extensions[".webp"] = (module, filename) => {
  const bytes = readFileSync(filename);
  const size = assetRequire("next/dist/compiled/image-size").default(bytes);
  module.exports = {
    src: `data:image/webp;base64,${bytes.toString("base64")}`,
    width: size.width,
    height: size.height,
  };
};
