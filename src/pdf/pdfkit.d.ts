declare module "pdfkit" {
  export function registerStdFonts(...fonts: PdfkitStandardFont[]): void;
}

declare module "*.mjs" {
  const font: PdfkitStandardFont;
  export default font;
}

declare module "pdfkit/standard-fonts/Courier" {
  const font: PdfkitStandardFont;
  export default font;
}
declare module "pdfkit/standard-fonts/CourierBold" {
  const font: PdfkitStandardFont;
  export default font;
}
declare module "pdfkit/standard-fonts/CourierBoldOblique" {
  const font: PdfkitStandardFont;
  export default font;
}
declare module "pdfkit/standard-fonts/CourierOblique" {
  const font: PdfkitStandardFont;
  export default font;
}
declare module "pdfkit/standard-fonts/Helvetica" {
  const font: PdfkitStandardFont;
  export default font;
}
declare module "pdfkit/standard-fonts/HelveticaBold" {
  const font: PdfkitStandardFont;
  export default font;
}
declare module "pdfkit/standard-fonts/HelveticaBoldOblique" {
  const font: PdfkitStandardFont;
  export default font;
}
declare module "pdfkit/standard-fonts/HelveticaOblique" {
  const font: PdfkitStandardFont;
  export default font;
}
declare module "pdfkit/standard-fonts/Symbol" {
  const font: PdfkitStandardFont;
  export default font;
}
declare module "pdfkit/standard-fonts/TimesBold" {
  const font: PdfkitStandardFont;
  export default font;
}
declare module "pdfkit/standard-fonts/TimesBoldItalic" {
  const font: PdfkitStandardFont;
  export default font;
}
declare module "pdfkit/standard-fonts/TimesItalic" {
  const font: PdfkitStandardFont;
  export default font;
}
declare module "pdfkit/standard-fonts/TimesRoman" {
  const font: PdfkitStandardFont;
  export default font;
}
declare module "pdfkit/standard-fonts/ZapfDingbats" {
  const font: PdfkitStandardFont;
  export default font;
}

interface PdfkitStandardFont {
  name: string;
}
