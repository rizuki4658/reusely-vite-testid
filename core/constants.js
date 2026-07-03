export const DEFAULT_TAG_SUFFIX_MAP = {
  'input': '-input',
  'textarea': '-input',
  'select': '-select',
  'checkbox': '-checkbox',
  'datepicker': '-picker',
}

export const DEFAULT_EVENT_TAG_SUFFIX_MAP = {
  'button': '-btn',
  'a': '-link',
  'form': '-form',
  'div': '-action',
  'li': '-item',
  'td': '-cell',
  // default: '-action'
}

export const INTERACTIVE_TAGS = new Set([
  'input', 'textarea', 'select', 'button', 'a', 'form',
])

export const STRUCTURAL_TAGS = new Set([
  'div', 'li', 'td', 'tr', 'section', 'article', 'nav', 'header', 'footer', 'main', 'aside',
])

export const NODE_TYPES = {
  ELEMENT: 1,
  ATTRIBUTE: 6,
  TEXT: 2,
}

export const TAG_TYPES = {
  ELEMENT: 0,
  COMPONENT: 1,
  SLOT: 2,
  TEMPLATE: 3,
}
