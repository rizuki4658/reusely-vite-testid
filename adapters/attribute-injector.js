const SYNTHETIC_LOC = {
  source: '',
  start: { line: 1, column: 1, offset: 0 },
  end: { line: 1, column: 1, offset: 0 }
}

export function injectAttributes(node, attributes) {
  for (const attr of attributes) {
    node.props.push({
      type: 6, // NodeTypes.ATTRIBUTE
      name: attr.name,
      value: {
        type: 2, // NodeTypes.TEXT
        content: attr.value,
        loc: SYNTHETIC_LOC,
      },
      loc: SYNTHETIC_LOC,
    })
  }
}
