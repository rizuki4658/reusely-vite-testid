const DEFAULT_TAG_SUFFIX_MAP = {
  'input': '-input',
  'textarea': '-input',
  'select': '-select',
  'checkbox': '-checkbox',
  'datepicker': '-picker',
}

const DEFAULT_EVENT_TAG_SUFFIX_MAP = {
  'button': '-btn',
  'a': '-link',
  'form': '-form',
  'div': '-action',
  'li': '-item',
  'td': '-cell',
  // default: '-action'
}

const INTERACTIVE_TAGS = new Set([
  'input', 'textarea', 'select', 'button', 'a', 'form',
])

const STRUCTURAL_TAGS = new Set([
  'div', 'li', 'td', 'tr', 'section', 'article', 'nav', 'header', 'footer', 'main', 'aside',
])

const NODE_TYPES = {
  ELEMENT: 1,
  ATTRIBUTE: 6,
  TEXT: 2,
}

const TAG_TYPES = {
  ELEMENT: 0,
  COMPONENT: 1,
  SLOT: 2,
  TEMPLATE: 3,
}

module.exports = {
  DEFAULT_TAG_SUFFIX_MAP,
  DEFAULT_EVENT_TAG_SUFFIX_MAP,
  INTERACTIVE_TAGS,
  STRUCTURAL_TAGS,
  NODE_TYPES,
  TAG_TYPES,
}
