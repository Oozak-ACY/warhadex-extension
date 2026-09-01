export function el(doc, tag, props = {}, ...children) {
  const node = doc.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    node.setAttribute(key, String(value));
  }

  for (const child of children.flat()) {
    if (child === undefined || child === null || child === false) continue;
    node.append(typeof child === 'object' ? child : doc.createTextNode(String(child)));
  }

  return node;
}
