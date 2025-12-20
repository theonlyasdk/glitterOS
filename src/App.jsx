import './App.css'
import './base/bs-theme.css';
import './base/effects.css';
import "./base/window.css";
import "./base/controls.css";
import { Desktop } from './modules/Desktop';
import { Menubar } from './modules/Menubar';
import { Dock } from './modules/Dock';

function App() {
  return (
    <>
      <Menubar />
      <Desktop />
      <Dock />
    </>
  )
}

export default App
