import { DesktopIcon } from "../components/DesktopIcon";
import { Dialog } from "../components/Dialog";
import "../base/desktop.css";
import { DialogTrigger } from "../components/DialogTrigger";
import { useEffect, useRef } from "react";
import { makeDraggable } from "../lib/extensions";

function dlgAboutDeContent() {
  return <>
    <h1>LilacDE</h1>
    A desktop environment for your web browser.
  </>;
}

function dlgAboutDeFooter() {
  return <>
    <small>(c) theonlyasdk 2025-26</small>
  </>;
}

export function Desktop() {
  const wallpaper = {
    url: "/wall.png",
    name: "Snowman"
  };
  const dialog_ids = ["de-about"];
  const desktop_icons = Array(150).fill("bi-folder2-open");

  useEffect(() => {
    dialog_ids.forEach(id => makeDraggable(document.getElementById(id)));
  }, []);

  return (
    <div
      className="wm-desktop"
      style={{ backgroundImage: `url(${wallpaper.url})` }}
    >
      {desktop_icons.map(icon => 
        <DesktopIcon icon={icon} key={icon+Math.random()*desktop_icons.length} />        
      )}
      <Dialog title="About LilacDE" body={dlgAboutDeContent()} id="de-about" footer={dlgAboutDeFooter()}  />
    </div>
  );
}
