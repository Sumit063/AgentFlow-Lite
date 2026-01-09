const VARIABLE_REGEX = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

export const parseTextVariables = (value) => {
  const variables = [];
  const seen = new Set();
  let match;

  VARIABLE_REGEX.lastIndex = 0;

  while ((match = VARIABLE_REGEX.exec(value)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      variables.push(name);
    }
  }

  return variables;
};

export const variableToHandleId = (nodeId, variableName) =>
  `${nodeId}-var-${variableName}`;
