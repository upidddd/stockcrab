// Constants shared by the content scripts: logo, ids, which site this is.

const LOGO_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" width=\"22\" height=\"22\"><line x1=\"17\" y1=\"41\" x2=\"6\" y2=\"46\" stroke-width=\"3.2\" stroke=\"#a8341a\" stroke-linecap=\"round\" fill=\"none\"/><line x1=\"16\" y1=\"45\" x2=\"8\" y2=\"54\" stroke-width=\"3.2\" stroke=\"#a8341a\" stroke-linecap=\"round\" fill=\"none\"/><line x1=\"19\" y1=\"48\" x2=\"14\" y2=\"58\" stroke-width=\"3.2\" stroke=\"#a8341a\" stroke-linecap=\"round\" fill=\"none\"/><line x1=\"18\" y1=\"34\" x2=\"11\" y2=\"25\" stroke-width=\"4.5\" stroke=\"#a8341a\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M10.00 18.50L18.37 17.02A8.5 8.5 0 1 1 11.48 10.13Z\" fill=\"#e4572e\" stroke=\"#a8341a\" stroke-width=\"1.6\" stroke-linejoin=\"round\"/><line x1=\"47\" y1=\"41\" x2=\"58\" y2=\"46\" stroke-width=\"3.2\" stroke=\"#a8341a\" stroke-linecap=\"round\" fill=\"none\"/><line x1=\"48\" y1=\"45\" x2=\"56\" y2=\"54\" stroke-width=\"3.2\" stroke=\"#a8341a\" stroke-linecap=\"round\" fill=\"none\"/><line x1=\"45\" y1=\"48\" x2=\"50\" y2=\"58\" stroke-width=\"3.2\" stroke=\"#a8341a\" stroke-linecap=\"round\" fill=\"none\"/><line x1=\"46\" y1=\"34\" x2=\"53\" y2=\"25\" stroke-width=\"4.5\" stroke=\"#a8341a\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M54.00 18.50L45.63 17.02A8.5 8.5 0 1 0 52.52 10.13Z\" fill=\"#e4572e\" stroke=\"#a8341a\" stroke-width=\"1.6\" stroke-linejoin=\"round\"/><line x1=\"26\" y1=\"29\" x2=\"25\" y2=\"21\" stroke-width=\"2.6\" stroke=\"#a8341a\" stroke-linecap=\"round\" fill=\"none\"/><line x1=\"38\" y1=\"29\" x2=\"39\" y2=\"21\" stroke-width=\"2.6\" stroke=\"#a8341a\" stroke-linecap=\"round\" fill=\"none\"/><ellipse cx=\"32\" cy=\"40\" rx=\"19.5\" ry=\"13.5\" fill=\"#e4572e\" stroke=\"#a8341a\" stroke-width=\"1.8\"/><circle cx=\"25\" cy=\"19.5\" r=\"4.2\" fill=\"#ffffff\" stroke=\"#a8341a\" stroke-width=\"1.2\"/><circle cx=\"25\" cy=\"20.1\" r=\"1.9\" fill=\"#1c1c1c\"/><circle cx=\"39\" cy=\"19.5\" r=\"4.2\" fill=\"#ffffff\" stroke=\"#a8341a\" stroke-width=\"1.2\"/><circle cx=\"39\" cy=\"20.1\" r=\"1.9\" fill=\"#1c1c1c\"/></svg>";
const PANEL_ID = "stockcrab-panel";
const MARK = "stockcrab-mark";
// This copy of the content scripts; after the extension is reloaded a new copy replaces the old one's elements.
const INSTANCE = Math.random().toString(36).slice(2);
// False in an old copy whose extension was reloaded or removed.
function extensionAlive() {
  try {
    return !!browser.runtime?.id;
  } catch (e) {
    return false;
  }
}
const FILES = "abcdefgh";
const SITE = location.hostname.endsWith("lichess.org") ? "lichess" : "chesscom";