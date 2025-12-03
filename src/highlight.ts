let originalSelectionIds: string[] = [];

export const setOriginalSelection = (nodes: readonly SceneNode[]) => {
  originalSelectionIds = nodes.map((n) => n.id);
};

export const highlightNode = async (nodeId: string) => {
  const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null;
  if (node) {
    figma.currentPage.selection = [node];
  }
};

export const restoreSelection = async () => {
  const restored: SceneNode[] = [];
  for (const id of originalSelectionIds) {
    const n = (await figma.getNodeByIdAsync(id)) as SceneNode | null;
    if (n) restored.push(n);
  }
  figma.currentPage.selection = restored;
};
