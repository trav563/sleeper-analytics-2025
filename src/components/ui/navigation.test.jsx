import { describe,it,expect,beforeEach,afterEach,vi } from 'vitest';
import { act,useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SegmentedTabs } from './SegmentedTabs';
import { Dialog,DialogContent,DialogTitle } from './Dialog';
let host,root;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();});
function TabsProbe(){const [value,setValue]=useState('grades');return <SegmentedTabs label="Analysis" tabs={[{value:'grades',label:'Grades'},{value:'trades',label:'Trades'},{value:'sell',label:'Sell high'}]} value={value} onChange={setValue}/>;}
function DialogProbe(){const [open,setOpen]=useState(false);return <><button onClick={()=>setOpen(true)}>Open</button><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogTitle>Choose team</DialogTitle><button onClick={()=>setOpen(false)}>Close</button><button>Last</button></DialogContent></Dialog></>;}
describe('accessible navigation',()=>{
 it('supports arrow, Home, End and one tabbable active tab',()=>{
  act(()=>root.render(<TabsProbe/>));const tabs=host.querySelectorAll('[role="tab"]');tabs[0].focus();
  act(()=>tabs[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));
  expect(document.activeElement).toBe(tabs[1]);expect(tabs[1].getAttribute('aria-selected')).toBe('true');
  act(()=>tabs[1].dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true})));expect(document.activeElement).toBe(tabs[2]);
  act(()=>tabs[2].dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true})));expect(document.activeElement).toBe(tabs[0]);
  expect([...tabs].filter(t=>t.tabIndex===0)).toHaveLength(1);
 });
 it('labels dialogs, traps focus, closes with Escape, and restores focus',()=>{
  vi.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{}]);
  act(()=>root.render(<DialogProbe/>));const opener=host.querySelector('button');opener.focus();act(()=>opener.click());
  const dialog=document.querySelector('[role="dialog"]'),buttons=dialog.querySelectorAll('button');
  expect(document.getElementById(dialog.getAttribute('aria-labelledby')).textContent).toBe('Choose team');
  expect(document.activeElement).toBe(buttons[0]);buttons[1].focus();
  act(()=>buttons[1].dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true})));
  expect(document.activeElement).toBe(buttons[0]);
  act(()=>buttons[0].dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  expect(document.querySelector('[role="dialog"]')).toBeNull();expect(document.activeElement).toBe(opener);expect(document.body.style.overflow).toBe('');
 });
});
