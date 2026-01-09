// textNode.js

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useUpdateNodeInternals } from 'reactflow';
import { useStore } from '../store';
import { BaseNode } from './BaseNode';
import { parseTextVariables, variableToHandleId } from './textNodeUtils';

export const TextNode = ({ id, data }) => {
  const updateNodeField = useStore((state) => state.updateNodeField);
  const removeNode = useStore((state) => state.removeNode);
  const updateNodeInternals = useUpdateNodeInternals();
  const [currText, setCurrText] = useState(data?.text || '{{input}}');
  const textareaRef = useRef(null);
  const minSize = useMemo(() => ({ width: 220, height: 90 }), []);
  const maxSize = useMemo(() => ({ width: 520, height: 260 }), []);

  const variables = useMemo(() => parseTextVariables(currText), [currText]);
  const inputHandles = useMemo(
    () =>
      variables.map((variable) => ({
        id: variableToHandleId(id, variable),
        label: variable,
      })),
    [id, variables]
  );

  const autosizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    textarea.style.width = `${minSize.width}px`;

    const nextHeight = Math.min(
      maxSize.height,
      Math.max(minSize.height, textarea.scrollHeight + 2)
    );
    const nextWidth = Math.min(
      maxSize.width,
      Math.max(minSize.width, textarea.scrollWidth + 2)
    );

    textarea.style.height = `${nextHeight}px`;
    textarea.style.width = `${nextWidth}px`;
  }, [maxSize.height, maxSize.width, minSize.height, minSize.width]);

  const handleTextChange = (e) => {
    const value = e.target.value;
    setCurrText(value);
    updateNodeField(id, 'text', value);
  };

  useLayoutEffect(() => {
    autosizeTextarea();
  }, [autosizeTextarea, currText]);

  const variableSignature = useMemo(() => variables.join('|'), [variables]);

  useLayoutEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals, variableSignature]);

  return (
    <BaseNode
      title="Text"
      subtitle="Template with variables"
      variant="text"
      inputs={inputHandles}
      outputs={[{ id: `${id}-output` }]}
      onDelete={() => removeNode(id)}
    >
      <div className="node-field">
        <label htmlFor={`${id}-text-input`}>Template</label>
        <textarea
          id={`${id}-text-input`}
          ref={textareaRef}
          value={currText}
          onChange={handleTextChange}
          className="node-textarea"
          placeholder="Write a template like {{input}}"
          spellCheck={false}
          wrap="off"
        />
        <div className="node-helper">
          Use double curly braces to create inputs: <span>{'{{variable}}'}</span>
        </div>
      </div>
    </BaseNode>
  );
};
