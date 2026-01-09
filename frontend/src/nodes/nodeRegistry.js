import { InputNode } from './inputNode';
import { LLMNode } from './llmNode';
import { OutputNode } from './outputNode';
import { TextNode } from './textNode';
import { NumberNode } from './numberNode';
import { MergeNode } from './mergeNode';
import { JSONNode } from './jsonNode';
import { DelayNode } from './delayNode';
import { ConditionNode } from './conditionNode';

export const nodeRegistry = [
  {
    type: 'customInput',
    label: 'Input',
    description: 'Source data',
    variant: 'input',
    group: 'Sources',
    component: InputNode,
    defaultData: { inputType: 'Text' },
  },
  {
    type: 'text',
    label: 'Text',
    description: 'Template',
    variant: 'text',
    group: 'Sources',
    component: TextNode,
    defaultData: { text: '{{input}}' },
  },
  {
    type: 'json',
    label: 'JSON',
    description: 'Structured body',
    variant: 'json',
    group: 'Sources',
    component: JSONNode,
    defaultData: { json: '{\n  "key": "value"\n}' },
  },
  {
    type: 'number',
    label: 'Number',
    description: 'Constant',
    variant: 'number',
    group: 'Sources',
    component: NumberNode,
    defaultData: { value: 0 },
  },
  {
    type: 'llm',
    label: 'LLM',
    description: 'Prompt + response',
    variant: 'llm',
    group: 'Models',
    component: LLMNode,
    defaultData: {},
  },
  {
    type: 'merge',
    label: 'Merge',
    description: 'Combine inputs',
    variant: 'merge',
    group: 'Flow',
    component: MergeNode,
    defaultData: {},
  },
  {
    type: 'condition',
    label: 'Condition',
    description: 'Branch outputs',
    variant: 'condition',
    group: 'Flow',
    component: ConditionNode,
    defaultData: { operator: 'equals' },
  },
  {
    type: 'delay',
    label: 'Delay',
    description: 'Pause stream',
    variant: 'delay',
    group: 'Flow',
    component: DelayNode,
    defaultData: { delayMs: 300 },
  },
  {
    type: 'customOutput',
    label: 'Output',
    description: 'Send results',
    variant: 'output',
    group: 'Sinks',
    component: OutputNode,
    defaultData: { outputType: 'Text' },
  },
];

export const nodeTypes = nodeRegistry.reduce((acc, item) => {
  acc[item.type] = item.component;
  return acc;
}, {});

export const nodeTypeMeta = nodeRegistry.reduce((acc, item) => {
  acc[item.type] = item;
  return acc;
}, {});
