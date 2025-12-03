export const gatherNodesWithFills = (nodes: readonly SceneNode[]): SceneNode[] => {
  const result: SceneNode[] = [];

  const walk = (node: SceneNode) => {
    if ("fills" in node) {
      result.push(node);
    }
    if ("children" in node) {
      for (const child of node.children) {
        walk(child);
      }
    }
  };

  for (const node of nodes) {
    walk(node);
  }

  return result;
};
