import { Panel } from "ui";
const items = [1, 2];
export const view = <>
  <Panel.Header title="Hello" active data-id={items.length} {...props}>
    text &amp; {items.map(n => <i key={n}>{n + 1}</i>)}
  </Panel.Header>
  <br />
</>;
