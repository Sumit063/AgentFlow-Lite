// llmNode.js

import { useStore } from '../store';
import { BaseNode } from './BaseNode';

export const LLMNode = ({ id }) => {
  const removeNode = useStore((state) => state.removeNode);

  return (
    <BaseNode
      title="LLM"
      subtitle="Prompt -> Response"
      variant="llm"
      inputs={[{ id: `${id}-system` }, { id: `${id}-prompt` }]}
      outputs={[{ id: `${id}-response` }]}
      onDelete={() => removeNode(id)}
    >
      <div className="node-body-copy">
        Use this node to generate responses with a system prompt and user input.
      </div>
      <div className="node-chip">Model: gpt-4.1</div>
    </BaseNode>
  );
};
