export function MenuItem({caption="Action",onclick,icon,clickable=true}) {
  const clickableClass=!clickable?"text-muted fst-italic disabled":"";
  const bsIcon = icon ? <i className={`bi flex ${icon}`}></i> : null;
  return <li>
      <a className={`dropdown-item d-flex flex-row gap-2 ps-2 pe-2 ${clickableClass}`} href="#" onClick={onclick} disabled={!clickable}>
        {bsIcon}{caption}
      </a>
    </li>
}