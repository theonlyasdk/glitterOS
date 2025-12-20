import "../base/menubar.css";
import { MenuButton } from "../components/MenuButton";
import { showBsModal } from "../lib/extensions";

function performLogout() {
  const response = confirm("Logout? This will close your current session");
}
function showAboutDialog() {
  showBsModal("de-about");
}
export function Menubar() {
  const items = [
    {
      caption:"About LilacWM",
      icon: "bi-flower1",
      onclick: showAboutDialog,
    },
    {
      type:"separator",
    },
    {
      caption:"Logout",
      onclick: performLogout,
      icon:"bi-box-arrow-right",
    }
  ];
  const wmMenuCaption = <span><i className="bi bi-flower1"></i>&nbsp;LilacWM</span>;

  return <div className="wm-menubar">
    <MenuButton caption={wmMenuCaption} highlight={true} items={items} />
    <MenuButton caption="File" />
    <MenuButton caption="Edit" />
  </div>;
}
