import { MenuItem } from "./MenuItem";
import { MenuSeperator } from "./MenuSeperator";

function getMenuItemFromType(item) {
  const key = item.caption + Math.random();
  let result;
  if (item.type === "separator")
    result = <MenuSeperator />;
  else
    result = <MenuItem caption={item.caption} onclick={item.onclick} icon={item.icon} />
  return <div key={key}>{result}</div>;
}

export function MenuButton({ caption = "MenuItem", items, highlight = false }) {
  const highlightClass = highlight ? "wm-menubutton-highlight" : "false";

  return (
    <>
      <div className="dropdown">
        <button
          className={`btn wm-menubutton ${highlightClass}`}
          type="button"
          data-bs-toggle="dropdown"
          aria-expanded="false"
        >
          {caption}
        </button>
        <ul className="dropdown-menu">
          {!items ? (<MenuItem caption="Submenu unavailable." clickable={false} />) :
            <>
              {items.length === 0 ? (
                <MenuItem caption="No items." clickable={false} />
              ) : ""}
              {items.map(item => getMenuItemFromType(item))}
            </>}
        </ul>
      </div>
    </>
  );
}
