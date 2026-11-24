import { createRequire } from "node:module";
import { registerStdFonts } from "pdfkit";
import Courier from "../../node_modules/pdfkit/js/standard-fonts/Courier.mjs";
import CourierBold from "../../node_modules/pdfkit/js/standard-fonts/CourierBold.mjs";
import CourierBoldOblique from "../../node_modules/pdfkit/js/standard-fonts/CourierBoldOblique.mjs";
import CourierOblique from "../../node_modules/pdfkit/js/standard-fonts/CourierOblique.mjs";
import Helvetica from "../../node_modules/pdfkit/js/standard-fonts/Helvetica.mjs";
import HelveticaBold from "../../node_modules/pdfkit/js/standard-fonts/HelveticaBold.mjs";
import HelveticaBoldOblique from "../../node_modules/pdfkit/js/standard-fonts/HelveticaBoldOblique.mjs";
import HelveticaOblique from "../../node_modules/pdfkit/js/standard-fonts/HelveticaOblique.mjs";
import Symbol from "../../node_modules/pdfkit/js/standard-fonts/Symbol.mjs";
import TimesBold from "../../node_modules/pdfkit/js/standard-fonts/TimesBold.mjs";
import TimesBoldItalic from "../../node_modules/pdfkit/js/standard-fonts/TimesBoldItalic.mjs";
import TimesItalic from "../../node_modules/pdfkit/js/standard-fonts/TimesItalic.mjs";
import TimesRoman from "../../node_modules/pdfkit/js/standard-fonts/TimesRoman.mjs";
import ZapfDingbats from "../../node_modules/pdfkit/js/standard-fonts/ZapfDingbats.mjs";

const fonts = [
  Courier,
  CourierBold,
  CourierBoldOblique,
  CourierOblique,
  Helvetica,
  HelveticaBold,
  HelveticaBoldOblique,
  HelveticaOblique,
  Symbol,
  TimesRoman,
  TimesBold,
  TimesItalic,
  TimesBoldItalic,
  ZapfDingbats,
];

registerStdFonts(...fonts);

try {
  const source = import.meta.url as string | { href: string };
  const loaded = createRequire(typeof source === "string" ? source : source.href)("pdfkit") as {
    registerStdFonts?: typeof registerStdFonts;
  };
  if (loaded.registerStdFonts && loaded.registerStdFonts !== registerStdFonts) loaded.registerStdFonts(...fonts);
} catch {
  // A cópia usada pelo react-pdf já ficou registada acima.
}
